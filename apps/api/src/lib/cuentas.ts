import type { Client } from '@libsql/client'

export const TIPOS_CUENTA = ['pago_movil', 'transferencia', 'transferencia_usd', 'zelle', 'binance', 'efectivo', 'otro'] as const

let pendiente: Promise<void> | null = null

/**
 * Las bases creadas antes de las cuentas en dólares y de Binance tienen un CHECK de `tipo` que las rechaza, y SQLite no
 * permite cambiarlo: se reconstruye la tabla (en una transacción, conservando los datos). Es idempotente y barata si ya
 * está al día, así que se llama al iniciar y antes de crear o editar una cuenta.
 */
export function asegurarTiposCuenta(client: Client): Promise<void> {
  return (pendiente ??= (async () => {
    const r = await client.execute(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cuentas_bancarias_camara'`)
    const ddl = String(r.rows[0]?.sql ?? '')
    if (!ddl || ddl.includes("'binance'")) return
    const tipos = TIPOS_CUENTA.map(t => `'${t}'`).join(', ')
    await client.batch([
      `CREATE TABLE cuentas_bancarias_camara_nueva (
        id_cuenta       INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo            TEXT NOT NULL CHECK (tipo IN (${tipos})),
        banco           TEXT NOT NULL,
        beneficiario    TEXT NOT NULL,
        identificacion  TEXT NOT NULL,
        numero_cuenta   TEXT,
        telefono        TEXT,
        email           TEXT,
        instrucciones   TEXT,
        activo          INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
        orden           INTEGER DEFAULT 0,
        creado_en       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        actualizado_en  TEXT
      )`,
      `INSERT INTO cuentas_bancarias_camara_nueva
         SELECT id_cuenta, tipo, banco, beneficiario, identificacion, numero_cuenta, telefono, email, instrucciones, activo, orden, creado_en, actualizado_en
         FROM cuentas_bancarias_camara`,
      `DROP TABLE cuentas_bancarias_camara`,
      `ALTER TABLE cuentas_bancarias_camara_nueva RENAME TO cuentas_bancarias_camara`,
      `CREATE INDEX IF NOT EXISTS idx_cuentas_bancarias_activo ON cuentas_bancarias_camara(activo)`,
    ], 'write')
  })().catch(e => { pendiente = null; throw e }))
}
