import React, { useEffect, useState } from 'react'
import { Award, Copy, ExternalLink, ShieldCheck } from 'lucide-react'
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard'
import { useAuth } from '@/context/AuthContext'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'

interface CertRow {
  id_certificado: number
  codigo_validacion: string
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

function esVigente(r: CertRow): boolean {
  return Number(r.completado) === 1 && (r.inscripcion_estatus === 'Inscrito' || r.inscripcion_estatus === 'Pagado')
}

const WidgetMisCertificados: React.FC = () => {
  const { token, user } = useAuth()
  const [rows, setRows] = useState<CertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

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
        if (j.success && Array.isArray(j.data)) setRows(j.data)
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

  const isAfiliadoActivo = !!user?.id_afiliado || user?.roles?.includes('afiliado') || afiliadoData?.estatus === 'Afiliado';
  const esCibirAprobado = afiliadoData?.cibir_convalidado === 1;
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
        <div className="mb-6 rounded-2xl border-2 border-emerald-200/80 bg-emerald-50/40 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100/60 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-800">
                  <ShieldCheck size={11} /> {afiliadoData?.estatus === 'Afiliado' ? 'Miembro Activo' : 'CIBIR Aprobado'}
                </span>
                <span className="text-slate-400 text-xs font-bold font-mono">
                  ID: #{afiliadoData?.codigo || user?.codigo || user?.id_afiliado}
                </span>
              </div>
              <h4 className="font-extrabold text-base text-emerald-950">
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
              {afiliacionId && (
                <>
                  <button
                    type="button"
                    onClick={abrirCertificadoAfiliacion}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wide text-white transition-colors shadow-xs cursor-pointer"
                  >
                    <ExternalLink size={14} />
                    Ver Certificado
                  </button>
                  <button
                    type="button"
                    onClick={() => copiar(urlAfiliacion)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3.5 py-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                  >
                    <Copy size={14} />
                    Copiar Enlace
                  </button>
                </>
              )}
            </div>
          </div>
          {urlAfiliacion && (
            <div className="mt-4 rounded-xl border border-dashed border-emerald-200 bg-white/90 px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                Enlace de verificación pública
              </p>
              <p className="text-xs font-medium text-emerald-800 break-all leading-snug">{urlAfiliacion}</p>
            </div>
          )}
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
            const url = `${origin}/comprobante/${encodeURIComponent(r.codigo_validacion)}`
            const vigente = esVigente(r)
            return (
              <li
                key={r.id_certificado}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 sm:p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm" style={{ color: 'var(--color-primary)' }}>
                      {tituloCertificado(r)}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Código:{' '}
                      <span className="font-mono font-semibold text-slate-700">{r.codigo_validacion}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Emitido: {new Date(r.fecha_emision).toLocaleDateString('es-VE')}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${vigente
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                          }`}
                      >
                        {vigente ? 'Vigente' : 'No vigente'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirPublico(r.codigo_validacion)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-emerald-700 cursor-pointer"
                    >
                      <ExternalLink size={14} />
                      Abrir comprobante
                    </button>
                    <button
                      type="button"
                      onClick={() => copiar(url)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      <Copy size={14} />
                      Copiar enlace
                    </button>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white/80 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Enlace de verificación pública
                  </p>
                  <p className="text-xs font-medium text-emerald-800 break-all leading-snug">{url}</p>
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
