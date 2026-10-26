import type { Client } from '@libsql/client'

/** Tablas de la agenda de entrevistas y las columnas nuevas de `entrevistas`. Idempotente; requiere que `entrevistas` ya exista. */
export async function asegurarEsquemaAgenda(client: Client): Promise<void> {
  await client.batch([
    `CREATE TABLE IF NOT EXISTS disponibilidad_entrevistas (
       id          INTEGER PRIMARY KEY,
       dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
       hora_inicio TEXT    NOT NULL,
       hora_fin    TEXT    NOT NULL
     )`,
    `CREATE TABLE IF NOT EXISTS enlaces_agenda (
       id             INTEGER PRIMARY KEY,
       id_inscripcion INTEGER NOT NULL,
       token_hash     TEXT    NOT NULL UNIQUE,
       vence_en       TEXT    NOT NULL,
       usado_en       TEXT,
       creado_en      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
     )`,
    `CREATE INDEX IF NOT EXISTS idx_enlaces_agenda_inscripcion ON enlaces_agenda(id_inscripcion)`,
  ], 'write')

  const columnas = new Set((await client.execute(`PRAGMA table_info(entrevistas)`)).rows.map(r => String(r.name)))
  if (!columnas.has('meet_url')) await client.execute(`ALTER TABLE entrevistas ADD COLUMN meet_url TEXT`)
  if (!columnas.has('google_event_id')) await client.execute(`ALTER TABLE entrevistas ADD COLUMN google_event_id TEXT`)
  // Solo las reservas hechas por enlace compiten por el horario; las entrevistas fijadas a mano no se bloquean
  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS uq_entrevista_reservada ON entrevistas(fecha, hora)
    WHERE google_event_id IS NOT NULL AND estatus <> 'Cancelada' AND eliminado_en IS NULL`)
}
