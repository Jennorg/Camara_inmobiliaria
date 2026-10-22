import Swal from 'sweetalert2'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'

export type EstadoMesCorreccion = 'pagado' | 'en_revision' | 'deuda' | 'por_pagar' | 'adelantado'

export interface MesCorregible {
  periodo: string
  estado: EstadoMesCorreccion
  historico?: boolean
  pago: { id_pago: number; numero_recibo: string } | null
}

export const mesLargo = (ym: string) =>
  new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })

/** Acción que el superadmin puede aplicar a un mes según de dónde viene su estado */
export const accionDelMes = (m: MesCorregible): 'anular' | 'desmarcar' | 'marcar' | null =>
  m.pago ? 'anular' : m.historico ? 'desmarcar' : m.estado === 'deuda' || m.estado === 'por_pagar' ? 'marcar' : null

/**
 * Corrección del superadmin sobre un mes de solvencia: anular el pago con recibo, quitar la marca manual/importada o
 * marcarlo como pagado. Pide confirmación (y el motivo al anular). Devuelve true si se aplicó el cambio.
 */
export async function corregirMesSolvencia(idAfiliado: number, m: MesCorregible, token: string | null): Promise<boolean> {
  const accion = accionDelMes(m)
  if (!accion) return false
  let url: string
  let method: 'PATCH' | 'PUT'
  let body: Record<string, unknown>

  if (accion === 'anular' && m.pago) {
    const r = await Swal.fire({
      title: `Anular pago ${m.pago.numero_recibo}`,
      text: 'El pago deja de contar en los libros y en la solvencia. No revierte efectos ya aplicados (afiliación, inscripción a un curso).',
      input: 'text', inputLabel: 'Motivo de la anulación', inputValidator: v => (v.trim().length < 3 ? 'Indica el motivo' : null),
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Anular pago', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626',
    })
    if (!r.isConfirmed) return false
    url = `${API_URL}/api/pagos/admin/${m.pago.id_pago}/anular`
    method = 'PATCH'
    body = { motivo: String(r.value).trim() }
  } else {
    const marcar = accion === 'marcar'
    const r = await Swal.fire({
      title: marcar ? `Marcar ${mesLargo(m.periodo)} como pagado` : `Quitar la marca de pago de ${mesLargo(m.periodo)}`,
      text: marcar
        ? 'Se registra sin recibo ni monto cobrado: solo cambia la solvencia (y se valora a la cuota vigente en los libros).'
        : 'El mes volverá a figurar como pendiente de pago.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar', confirmButtonColor: '#059669',
    })
    if (!r.isConfirmed) return false
    url = `${API_URL}/api/pagos/admin/solvencia/afiliado/${idAfiliado}/mes`
    method = 'PUT'
    body = { periodo: m.periodo, pagado: marcar }
  }

  try {
    await apiFetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    return true
  } catch (e) {
    Swal.fire('No se pudo aplicar', e instanceof Error ? e.message : 'Inténtalo de nuevo.', 'error')
    return false
  }
}
