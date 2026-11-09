import { createClient } from '@libsql/client'
import { env } from '../config/env.js'

// Historial de respaldos en una base Turso SEPARADA de la principal (si no, restaurar la borraría).

type Db = { execute: (s: any) => Promise<any>; batch: (s: any[], mode?: any) => Promise<any> }
export type TipoRespaldo = 'manual' | 'automatico' | 'previo_restauracion'
export interface MetaRespaldo { id: number; tipo: TipoRespaldo; creado_en: string; creado_por: string | null; tablas: number; filas: number; bytes: number }

/** Cuántos se conservan por tipo; los más antiguos se eliminan al guardar uno nuevo. */
export const CONSERVAR: Record<TipoRespaldo, number> = { automatico: 7, manual: 20, previo_restauracion: 10 }

export const crearHistorial = (cli: Db) => {
  let lista = false
  const asegurar = async () => {
    if (lista) return
    await cli.execute(`CREATE TABLE IF NOT EXISTS respaldos (
      id         INTEGER PRIMARY KEY,
      tipo       TEXT    NOT NULL CHECK (tipo IN ('manual', 'automatico', 'previo_restauracion')),
      creado_en  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      creado_por TEXT,
      tablas     INTEGER NOT NULL,
      filas      INTEGER NOT NULL,
      bytes      INTEGER NOT NULL,
      contenido  BLOB    NOT NULL
    )`)
    lista = true
  }
  return {
    async guardar(tipo: TipoRespaldo, contenido: Buffer, datos: { creadoPor: string | null; tablas: number; filas: number }): Promise<number> {
      await asegurar()
      const r = await cli.execute({
        sql: `INSERT INTO respaldos (tipo, creado_por, tablas, filas, bytes, contenido) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [tipo, datos.creadoPor, datos.tablas, datos.filas, contenido.length, contenido],
      })
      await cli.execute({
        sql: `DELETE FROM respaldos WHERE tipo = ? AND id NOT IN (SELECT id FROM respaldos WHERE tipo = ? ORDER BY id DESC LIMIT ?)`,
        args: [tipo, tipo, CONSERVAR[tipo]],
      })
      return Number(r.rows[0].id)
    },
    async listar(): Promise<MetaRespaldo[]> {
      await asegurar()
      const r = await cli.execute(`SELECT id, tipo, creado_en, creado_por, tablas, filas, bytes FROM respaldos ORDER BY id DESC`)
      return r.rows.map((x: any) => ({ id: Number(x.id), tipo: x.tipo, creado_en: String(x.creado_en), creado_por: x.creado_por ?? null, tablas: Number(x.tablas), filas: Number(x.filas), bytes: Number(x.bytes) }))
    },
    async obtener(id: number): Promise<Buffer | null> {
      await asegurar()
      const r = await cli.execute({ sql: `SELECT contenido FROM respaldos WHERE id = ?`, args: [id] })
      return r.rows[0] ? Buffer.from(r.rows[0].contenido as ArrayBuffer) : null
    },
    async eliminar(id: number): Promise<boolean> {
      await asegurar()
      return (await cli.execute({ sql: `DELETE FROM respaldos WHERE id = ?`, args: [id] })).rowsAffected > 0
    },
  }
}
export type Historial = ReturnType<typeof crearHistorial>

/** null cuando no hay base de respaldo configurada. */
export const historial: Historial | null = env.BACKUP_DATABASE_URL
  ? crearHistorial(createClient({ url: env.BACKUP_DATABASE_URL, authToken: env.BACKUP_DATABASE_AUTH_TOKEN }))
  : null
