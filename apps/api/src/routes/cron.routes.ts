import { Router, type Request, type Response } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'
import { ejecutarCobranzaDiaria } from '../services/cobranza.service.js'
import { crearRespaldo } from '../controllers/respaldos.controller.js'
import { historial } from '../lib/respaldo-historial.js'
import { resumir } from '../lib/respaldo.js'

const router = Router()

/** Vercel Cron llama por GET con `Authorization: Bearer ${CRON_SECRET}`. */
function autorizado(req: Request): boolean {
  if (!env.CRON_SECRET) return false
  const recibido = Buffer.from(req.headers.authorization ?? '')
  const esperado = Buffer.from(`Bearer ${env.CRON_SECRET}`)
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado)
}

// GET /api/cron/cobranza — avisos de mensualidad y expiración de reservas (una vez al día)
router.get('/cobranza', async (req: Request, res: Response) => {
  if (!env.CRON_SECRET) {
    res.status(503).json({ success: false, message: 'CRON_SECRET no configurado' })
    return
  }
  if (!autorizado(req)) {
    res.status(401).json({ success: false, message: 'No autorizado' })
    return
  }
  try {
    const resultado = await ejecutarCobranzaDiaria()
    console.log('[cron/cobranza]', JSON.stringify(resultado))
    res.json({ success: true, data: resultado })
  } catch (error) {
    console.error('[cron/cobranza]', error)
    res.status(500).json({ success: false, message: 'Error en la cobranza diaria' })
  }
})

// GET /api/cron/respaldo — respaldo automático diario (solo si hay base de respaldo donde guardarlo)
router.get('/respaldo', async (req: Request, res: Response) => {
  if (!env.CRON_SECRET) { res.status(503).json({ success: false, message: 'CRON_SECRET no configurado' }); return }
  if (!autorizado(req)) { res.status(401).json({ success: false, message: 'No autorizado' }); return }
  if (!historial) { res.status(503).json({ success: false, message: 'BACKUP_DATABASE_URL no configurada: no hay dónde guardar el respaldo' }); return }
  try {
    const { respaldo, contenido, id } = await crearRespaldo('automatico', null)
    const resumen = { id, bytes: contenido.length, ...resumir(respaldo) }
    console.log('[cron/respaldo]', JSON.stringify(resumen))
    res.json({ success: true, data: resumen })
  } catch (error) {
    console.error('[cron/respaldo]', error)
    res.status(500).json({ success: false, message: 'Error al generar el respaldo automático' })
  }
})

export default router
