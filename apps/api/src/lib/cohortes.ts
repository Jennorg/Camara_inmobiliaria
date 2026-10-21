import type { Client } from '@libsql/client'

/** Programas que se agrupan en cohortes. */
export const PROGRAMAS_COHORTE = ['CIBIR', 'PREANI', 'PEGI', 'PADI'] as const
export type ProgramaCohorte = (typeof PROGRAMAS_COHORTE)[number]
export const esProgramaCohorte = (v: unknown): v is ProgramaCohorte => PROGRAMAS_COHORTE.includes(v as ProgramaCohorte)

/** Subconsulta SQL: la cohorte abierta de un programa (a lo sumo una, lo garantiza un índice único). */
const abierta = (programa: string) =>
  `(SELECT id_cohorte FROM cohortes WHERE programa_codigo = ${programa} AND estado = 'Abierta' ORDER BY numero DESC LIMIT 1)`

/**
 * Crea (si falta) todo lo que necesitan las cohortes. Es idempotente y solo AÑADE: tabla, columna
 * nullable e índices/triggers; no toca datos existentes. Lo usan initdb, el script de migración y el
 * arranque perezoso de la API, así el orden de despliegue (código vs. base de datos) no importa.
 *
 * Los triggers asignan la cohorte abierta sin tocar el código que crea las inscripciones:
 *  1. al insertar una inscripción de programa (CIBIR/PREANI/PEGI/PADI) hereda la cohorte de la
 *     inscripción AFILIACION del mismo estudiante (si la tiene) o, si no, la cohorte abierta;
 *  2. cuando un afiliado pasa a 5_CIBIR (empieza el CIBIR), su inscripción AFILIACION toma la
 *     cohorte CIBIR abierta, que es la que luego heredará su inscripción CIBIR.
 */
export async function asegurarEsquemaCohortes(client: Client): Promise<void> {
  await client.batch([
    `CREATE TABLE IF NOT EXISTS cohortes (
      id_cohorte      INTEGER PRIMARY KEY,
      programa_codigo TEXT    NOT NULL CHECK (programa_codigo IN ('CIBIR','PREANI','PEGI','PADI')),
      numero          INTEGER NOT NULL CHECK (numero > 0),
      nombre          TEXT    NOT NULL,
      descripcion     TEXT,
      fecha_inicio    TEXT,
      fecha_fin       TEXT,
      estado          TEXT    NOT NULL DEFAULT 'Abierta' CHECK (estado IN ('Abierta','Cerrada')),
      creado_en       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      actualizado_en  TEXT,
      UNIQUE (programa_codigo, numero)
    )`,
    // Una sola cohorte abierta por programa
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_cohorte_abierta ON cohortes(programa_codigo) WHERE estado = 'Abierta'`,
  ], 'write')

  const cols = await client.execute(`SELECT name FROM pragma_table_info('inscripciones_cursos')`)
  if (!cols.rows.some(r => r.name === 'id_cohorte')) {
    try {
      await client.execute(`ALTER TABLE inscripciones_cursos ADD COLUMN id_cohorte INTEGER REFERENCES cohortes(id_cohorte)`)
    } catch {
      // Otra instancia la creó a la vez
    }
  }

  await client.batch([
    `CREATE INDEX IF NOT EXISTS idx_insc_cohorte ON inscripciones_cursos(id_cohorte)`,
    `CREATE TRIGGER IF NOT EXISTS trg_cohorte_inscripcion_programa
     AFTER INSERT ON inscripciones_cursos
     WHEN NEW.id_curso IS NULL AND NEW.id_cohorte IS NULL AND NEW.programa_codigo IN ('CIBIR','PREANI','PEGI','PADI')
     BEGIN
       UPDATE inscripciones_cursos SET id_cohorte = COALESCE(
         (SELECT x.id_cohorte FROM inscripciones_cursos x JOIN cohortes c ON c.id_cohorte = x.id_cohorte
           WHERE x.id_estudiante = NEW.id_estudiante AND x.programa_codigo = 'AFILIACION' AND c.programa_codigo = NEW.programa_codigo
           LIMIT 1),
         ${abierta('NEW.programa_codigo')})
       WHERE id_inscripcion = NEW.id_inscripcion;
     END`,
    `CREATE TRIGGER IF NOT EXISTS trg_cohorte_afiliado_cibir
     AFTER UPDATE OF estatus ON afiliados
     WHEN NEW.estatus = '5_CIBIR' AND OLD.estatus IS NOT NEW.estatus
     BEGIN
       UPDATE inscripciones_cursos SET id_cohorte = ${abierta("'CIBIR'")}
       WHERE programa_codigo = 'AFILIACION' AND id_curso IS NULL AND id_cohorte IS NULL
         AND id_estudiante IN (
           SELECT id_estudiante FROM estudiantes
           WHERE (id_persona IS NOT NULL AND id_persona = NEW.id_persona)
              OR (id_empresa IS NOT NULL AND id_empresa = NEW.id_empresa));
     END`,
  ], 'write')
}
