import React, { useEffect, useState } from 'react'
import { AlertTriangle, Award, Copy, ExternalLink, Lock } from 'lucide-react'
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard'
import { useAuth } from '@/context/AuthContext'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'
import { formatDateLatina } from '@/utils/formatters'

interface CertRow {
  id_certificado: number
  codigo_validacion: string | null
  fecha_emision: string
  programa_codigo: string | null
  tipo_inscripcion: string | null
  inscripcion_estatus: string
  completado: number
  curso_nombre: string | null
}

function tituloCertificado(r: CertRow): string {
  return r.curso_nombre || (r.programa_codigo ? `Programa ${r.programa_codigo}` : 'Formación académica')
}

const WidgetMisCertificados: React.FC = () => {
  const { token, user } = useAuth()
  const [rows, setRows] = useState<CertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [bloqueo, setBloqueo] = useState<{ meses: number; monto_usd: number } | null>(null)

  const [afiliadoData, setAfiliadoData] = useState<any | null>(null)
  const [loadingAfi, setLoadingAfi] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    let active = true
    setFetchError(null)

    // Cargar certificados académicos
    apiFetch(`${API_URL}/api/afiliados/me/certificados`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((j) => {
        if (!active) return
        if (j.success && Array.isArray(j.data)) {
          setRows(j.data)
          setBloqueo(j.bloqueado_por_mora ? j.deuda : null)
        }
        else setFetchError(typeof j.message === 'string' ? j.message : 'No se pudieron cargar los certificados.')
      })
      .catch(() => {
        if (active) setFetchError('Error de conexión al cargar certificados.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    // Cargar estatus de afiliado si corresponde
    if (user?.id_afiliado) {
      setLoadingAfi(true)
      apiFetch(`${API_URL}/api/afiliados/${user.id_afiliado}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((j) => {
          if (!active) return
          if (j.success && j.data) {
            console.log('DEBUG: afiliadoData:', j.data);
            setAfiliadoData(j.data)
          }
        })
        .catch(() => { })
        .finally(() => {
          if (active) setLoadingAfi(false)
        })
    }
    return () => { active = false }
  }, [token, user?.id_afiliado])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const copiar = (text: string) => {
    void navigator.clipboard.writeText(text).catch(() => { })
  }

  const abrirPublico = (codigo: string) => {
    window.open(`${origin}/comprobante/${encodeURIComponent(codigo)}`, '_blank', 'noopener,noreferrer')
  }

  const afiliacionId = afiliadoData?.codigo || user?.codigo || user?.id_afiliado;

  const abrirCertificadoAfiliacion = () => {
    if (afiliacionId) {
      window.open(`${origin}/comprobante/afiliacion/${afiliacionId}`, '_blank', 'noopener,noreferrer')
    }
  }

  const isAfiliadoActivo = afiliadoData?.estatus ? ['6_INSCRIPCION', 'Afiliado'].includes(String(afiliadoData.estatus).trim()) : false;
  const esCibirAprobado = afiliadoData?.cibir_acreditado === 1;
  const mostrarWidget = isAfiliadoActivo || esCibirAprobado;

  console.log('DEBUG: isAfiliadoActivo:', isAfiliadoActivo, 'esCibirAprobado:', esCibirAprobado, 'mostrarWidget:', mostrarWidget);

  const urlAfiliacion = afiliacionId ? `${origin}/comprobante/afiliacion/${afiliacionId}` : ''

  return (
    <DashboardCard title="Mis certificados y comprobantes" icon={Award}>
      {fetchError && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{fetchError}</p>
      )}


      {/* Sección Certificado de Afiliación Gremial */}
      {mostrarWidget && (
        <div className={`mb-6 rounded-2xl border-2 p-5 sm:p-6 shadow-sm ${bloqueo ? 'border-amber-300 bg-amber-50/50' : 'border-emerald-200/80 bg-emerald-50/40'}`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h4 className={`flex items-center gap-2 font-extrabold text-base ${bloqueo ? 'text-amber-950' : 'text-emerald-950'}`}>
                {bloqueo && <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-500 text-white" aria-hidden="true"><AlertTriangle size={13} /></span>}
                Certificado de Afiliación
              </h4>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                {afiliadoData?.estatus === 'Afiliado'
                  ? "Como miembro registrado en la Cámara Inmobiliaria de Bolívar, dispones de tu certificado de afiliación digital y público."
                  : "Has aprobado el programa CIBIR. Dispones de tu certificado digital y público."
                }
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0 self-start sm:self-auto">
              {afiliacionId && bloqueo && (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-amber-900 cursor-not-allowed"
                >
                  <Lock size={14} aria-hidden="true" />
                  Bloqueado por mora
                </button>
              )}
              {afiliacionId && !bloqueo && (
                <>
                  <button
                    type="button"
                    onClick={abrirCertificadoAfiliacion}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition-colors shadow-xs cursor-pointer"
                  >
                    <ExternalLink size={14} />
                    Ver Certificado
                  </button>
                  <button
                    type="button"
                    onClick={() => copiar(urlAfiliacion)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                  >
                    <Copy size={14} />
                    Copiar Enlace
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Separador cuando hay tanto de afiliación como de cursos */}
      {mostrarWidget && rows.length > 0 && (
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[var(--color-bg-card)] px-3 text-slate-400 font-bold tracking-widest">
              Certificados Académicos
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm font-medium text-slate-400 py-10">Cargando…</p>
      ) : rows.length === 0 ? (
        !isAfiliadoActivo && (
          <p className="text-center text-sm text-slate-500 py-10 max-w-md mx-auto leading-relaxed">
            Cuando completes un programa o curso aprobado por la institución, aquí aparecerá tu comprobante de
            aprobación digital con enlace público de verificación y opción de exportar a PDF.
          </p>
        )
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const codigo = r.codigo_validacion
            const bloqueado = !codigo
            const url = codigo ? `${origin}/comprobante/${encodeURIComponent(codigo)}` : ''
            return (
              <li
                key={r.id_certificado}
                className={`rounded-xl border p-4 sm:p-5 ${bloqueado ? 'border-amber-300 bg-amber-50/50' : 'border-[var(--color-border)] bg-[var(--color-bg-subtle)]'}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {bloqueado && (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500 text-white" aria-hidden="true">
                        <AlertTriangle size={16} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm" style={{ color: bloqueado ? undefined : 'var(--color-primary)' }}>
                        {tituloCertificado(r)}
                      </h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Emitido: {formatDateLatina(r.fecha_emision)}
                      </p>
                      {bloqueado && (
                        <p className="mt-1.5 text-xs font-semibold text-amber-900">Bloqueado: regulariza tus mensualidades para abrirlo.</p>
                      )}
                    </div>
                  </div>
                  {bloqueado ? (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 self-start rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-amber-900 cursor-not-allowed shrink-0"
                    >
                      <Lock size={14} aria-hidden="true" />
                      Bloqueado
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => abrirPublico(codigo)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        <ExternalLink size={14} />
                        Abrir certificado
                      </button>
                      <button
                        type="button"
                        onClick={() => copiar(url)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        <Copy size={14} />
                        Copiar enlace
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </DashboardCard>
  )
}

export default WidgetMisCertificados
