import { db } from '../lib/db.js'

const CLAVE_ELECTRONICOS = 'pagos_electronicos'

export const MENSAJE_SOLO_ADMINISTRACION =
  'Por ahora los pagos se reciben únicamente en la administración de la Cámara. Acude a la sede para realizar tu pago y se emitirá tu recibo al momento.'

/** ¿Pueden los afiliados reportar pagos electrónicos (pago móvil, transferencia, Zelle…)? Por defecto sí. */
export async function pagosElectronicosHabilitados(): Promise<boolean> {
  const r = await db.execute({ sql: `SELECT valor FROM cms_configuracion WHERE clave = ?`, args: [CLAVE_ELECTRONICOS] })
  return String(r.rows[0]?.valor ?? '1') !== '0'
}

export async function setPagosElectronicos(habilitados: boolean): Promise<void> {
  await db.execute({
    sql: `INSERT INTO cms_configuracion (clave, valor, actualizado_en) VALUES (?, ?, ?)
          ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor, actualizado_en = excluded.actualizado_en`,
    args: [CLAVE_ELECTRONICOS, habilitados ? '1' : '0', new Date().toISOString()],
  })
}
