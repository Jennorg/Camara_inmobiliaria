import type { Client } from '@libsql/client'

let pendiente: Promise<void> | null = null

const COLUMNAS: Record<string, string> = { descargo_afiliado: 'defensa_afiliado', fecha_descargo: 'fecha_defensa' }

/**
 * Renombra "descargos" a "defensa" en el esquema de denuncias: el estatus `en_descargos` pasa a `en_defensa`
 * y las columnas `descargo_afiliado` / `fecha_descargo` a `defensa_afiliado` / `fecha_defensa`.
 * El CHECK del estatus no se puede cambiar en SQLite, así que se reconstruye la tabla dentro de una transacción.
 * Como las tablas hijas (documentos e historial) se borran en cascada al soltar `denuncias`, se respaldan antes y se
 * reinsertan después; si los conteos no cuadran, se deshace todo. Es idempotente y barata si ya está al día.
 */
export function asegurarEsquemaDenuncias(client: Client): Promise<void> {
  return (pendiente ??= (async () => {
    const r = await client.execute(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'denuncias'`)
    const ddl = String(r.rows[0]?.sql ?? '')
    if (!ddl || !ddl.includes('en_descargos')) return

    const info = (await client.execute(`PRAGMA table_info(denuncias)`)).rows.map(c => String(c.name))
    const nuevas = info.map(c => COLUMNAS[c] ?? c)
    const seleccion = info.map(c => (c === 'estatus' ? `CASE estatus WHEN 'en_descargos' THEN 'en_defensa' ELSE estatus END` : c))
    const ddlNuevo = ddl
      .replace(/CREATE TABLE\s+(IF NOT EXISTS\s+)?"?denuncias"?/i, 'CREATE TABLE denuncias_nueva')
      .replace(/en_descargos/g, 'en_defensa')
      .replace(/descargo_afiliado/g, 'defensa_afiliado')
      .replace(/fecha_descargo/g, 'fecha_defensa')

    const conteo = async (tx: { execute: Client['execute'] }, t: string) => Number((await tx.execute(`SELECT COUNT(*) n FROM ${t}`)).rows[0].n)
    const tx = await client.transaction('write')
    try {
      const antes = { d: await conteo(tx, 'denuncias'), docs: await conteo(tx, 'documentos_denuncia'), hist: await conteo(tx, 'historial_denuncia') }
      await tx.execute(`DROP TABLE IF EXISTS _bak_documentos_denuncia`)
      await tx.execute(`DROP TABLE IF EXISTS _bak_historial_denuncia`)
      await tx.execute(`CREATE TABLE _bak_documentos_denuncia AS SELECT * FROM documentos_denuncia`)
      await tx.execute(`CREATE TABLE _bak_historial_denuncia AS SELECT * FROM historial_denuncia`)
      await tx.execute(ddlNuevo)
      await tx.execute(`INSERT INTO denuncias_nueva (${nuevas.join(', ')}) SELECT ${seleccion.join(', ')} FROM denuncias`)
      await tx.execute(`DROP TABLE denuncias`)
      await tx.execute(`ALTER TABLE denuncias_nueva RENAME TO denuncias`)
      await tx.execute(`INSERT INTO documentos_denuncia SELECT * FROM _bak_documentos_denuncia`)
      await tx.execute(`INSERT INTO historial_denuncia SELECT * FROM _bak_historial_denuncia`)
      await tx.execute(`UPDATE historial_denuncia SET estatus_anterior = 'en_defensa' WHERE estatus_anterior = 'en_descargos'`)
      await tx.execute(`UPDATE historial_denuncia SET estatus_nuevo = 'en_defensa' WHERE estatus_nuevo = 'en_descargos'`)
      await tx.execute(`DROP TABLE _bak_documentos_denuncia`)
      await tx.execute(`DROP TABLE _bak_historial_denuncia`)
      for (const i of [
        `CREATE INDEX IF NOT EXISTS idx_denuncias_codigo ON denuncias(codigo)`,
        `CREATE INDEX IF NOT EXISTS idx_denuncias_estatus ON denuncias(estatus)`,
        `CREATE INDEX IF NOT EXISTS idx_denuncias_denunciado ON denuncias(id_afiliado_denunciado)`,
        `CREATE INDEX IF NOT EXISTS idx_denuncias_denunciante ON denuncias(id_afiliado_denunciante)`,
      ]) await tx.execute(i)
      const despues = { d: await conteo(tx, 'denuncias'), docs: await conteo(tx, 'documentos_denuncia'), hist: await conteo(tx, 'historial_denuncia') }
      if (despues.d !== antes.d || despues.docs !== antes.docs || despues.hist !== antes.hist) {
        throw new Error(`Migración de denuncias cancelada: los conteos no coinciden (${JSON.stringify(antes)} → ${JSON.stringify(despues)})`)
      }
      await tx.commit()
    } catch (e) {
      await tx.rollback().catch(() => {})
      throw e
    } finally {
      tx.close()
    }
  })().catch(e => { pendiente = null; throw e }))
}
