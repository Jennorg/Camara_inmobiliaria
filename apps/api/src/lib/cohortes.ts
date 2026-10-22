import type { Client } from '@libsql/client'

/** Programas que se agrupan en cohortes. */
export const PROGRAMAS_COHORTE = ['CIBIR', 'PREANI', 'PEGI', 'PADI'] as const
export type ProgramaCohorte = (typeof PROGRAMAS_COHORTE)[number]
export const esProgramaCohorte = (v: unknown): v is ProgramaCohorte => PROGRAMAS_COHORTE.includes(v as ProgramaCohorte)

/** Etapas en que puede estar un inscrito de una cohorte, para resumir cada cohorte de un vistazo. */
export const ETAPAS = ['cursando', 'completado', 'admitido', 'entrevista', 'pendiente', 'sin_expediente', 'rechazado'] as const
export type Etapa = (typeof ETAPAS)[number]

/**
 * Etapa de una inscripción: rechazada/cancelada; admitida (cursando el CIBIR si el afiliado está en 5_CIBIR,
 * completada si ya terminó); en entrevista; o preinscrita (pendiente de revisión, o sin expediente aún).
 */
export function etapaDe(i: { estatus: string; completado: unknown; afiliado: string | null; documentos: number }): Etapa {
  if (i.estatus === 'Rechazado' || i.estatus === 'Cancelado') return 'rechazado'
  if (i.estatus === 'Inscrito' || i.estatus === 'Pagado') {
    if (i.afiliado === '5_CIBIR') return 'cursando'
    return Number(i.completado) === 1 ? 'completado' : 'admitido'
  }
  if (i.estatus === 'Entrevista') return 'entrevista'
  return i.documentos > 0 ? 'pendiente' : 'sin_expediente'
}

/** Cuántos inscritos hay en cada etapa, por cohorte. */
export async function etapasPorCohorte(client: Client): Promise<Map<number, Record<Etapa, number>>> {
  const r = await client.execute(`
    SELECT ic.id_cohorte, ic.estatus, ic.completado,
           (SELECT a.estatus FROM afiliados a
             WHERE (e.id_persona IS NOT NULL AND a.id_persona = e.id_persona)
                OR (e.id_empresa IS NOT NULL AND a.id_empresa = e.id_empresa) LIMIT 1) AS afiliado,
           (SELECT COUNT(*) FROM documentos d
             WHERE d.entidad_tipo = 'estudiante' AND d.entidad_id = ic.id_estudiante AND d.eliminado_en IS NULL) AS documentos
    FROM inscripciones_cursos ic JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
    WHERE ic.id_cohorte IS NOT NULL`)
  const porCohorte = new Map<number, Record<Etapa, number>>()
  for (const f of r.rows as any[]) {
    const cuenta = porCohorte.get(Number(f.id_cohorte)) ?? Object.fromEntries(ETAPAS.map(e => [e, 0])) as Record<Etapa, number>
    cuenta[etapaDe({ estatus: String(f.estatus), completado: f.completado, afiliado: f.afiliado ?? null, documentos: Number(f.documentos) })]++
    porCohorte.set(Number(f.id_cohorte), cuenta)
  }
  return porCohorte
}

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
