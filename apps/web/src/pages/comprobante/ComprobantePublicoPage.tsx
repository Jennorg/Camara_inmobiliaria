import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileDown, ArrowLeft, Loader2 } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import CertificadoProgramaView from '@/components/CertificadoProgramaView'
import CertificadoCursoView from '@/components/CertificadoCursoView'
import { API_URL } from '@/config/env'
import { exportElementToPdf } from '@/utils/domToPdf'
import { apiFetch } from '@/lib/apiClient'

type ApiData = {
  codigo_validacion: string
  fecha_emision: string
  titular_nombre: string
  cedula?: string | null
  programa_o_curso: string
  programa_codigo?: string | null
  tipo_inscripcion?: string | null
  modalidad?: string | null
  categoria?: string | null
  descripcion?: string | null
  modulos_lista?: string | null
  instructor_nombre?: string | null
  instructor_cargo?: string | null
  vigente: boolean
}

const MAIN_PROGRAMS = new Set(['CIBIR', 'PREANI', 'PEGI', 'PADI'])

const ComprobantePublicoPage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ApiData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const urlVerificacion = codigo ? `${origin}/comprobante/${encodeURIComponent(codigo)}` : origin

  useEffect(() => {
    if (!codigo?.trim()) {
      setError('Enlace incompleto')
      setLoading(false)
      return
    }
    let active = true
    apiFetch(`${API_URL}/api/public/comprobantes/${encodeURIComponent(codigo)}`)
      .then((j) => {
        if (!active) return
        if (j.success && j.data) {
          setData(j.data as ApiData)
        } else {
          setError(j.message || 'No se pudo cargar el comprobante')
        }
      })
      .catch(() => {
        if (active) setError('Error de conexión')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [codigo])

  const isMainProgram = data?.programa_codigo
    ? MAIN_PROGRAMS.has(data.programa_codigo.trim().toUpperCase())
    : false

  const handleDownloadPdf = async () => {
    if (!data) return
    setDownloadingPdf(true)
    try {
      const targetId = 'certificate-print-area'
      const safeName = (data.titular_nombre || 'Comprobante').replace(/[^a-zA-Z0-9_-]/g, '_')
      await exportElementToPdf(targetId, `Comprobante_${safeName}.pdf`)
    } catch (err) {
      console.error('Error generando PDF:', err)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleBack = () => {
    if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 print:bg-white">
      <Helmet>
        <title>
          {data ? `${data.programa_o_curso} - ${data.titular_nombre}` : 'Verificación de Comprobante'}
        </title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Great+Vibes&family=Montserrat:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,600;1,600&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: landscape; margin: 0; }
            .print-full-page {
              width: 297mm !important;
              height: 210mm !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              transform: none !important;
            }
          }
        `}</style>
      </Helmet>

      <header className="no-print border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50 shadow-xs">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors font-semibold text-sm cursor-pointer mr-2"
            >
              <ArrowLeft size={16} />
              Volver
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Verificación pública</p>
              <h2 className="text-sm font-bold text-slate-800">Comprobante de aprobación digital</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
          >
            {downloadingPdf ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Descargando PDF...
              </>
            ) : (
              <>
                <FileDown size={16} />
                Descargar PDF
              </>
            )}
          </button>
        </div>
      </header>

      <main className="flex justify-center items-center py-10 px-4 print:p-0">
        {loading && (
          <p className="text-center text-sm font-medium text-slate-400 py-20">Cargando comprobante…</p>
        )}
        {!loading && error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-8 text-center text-sm text-red-700 w-full max-w-md mx-auto">
            {error}
          </div>
        )}
        {!loading && data && (
          isMainProgram ? (
            <CertificadoProgramaView
              codigo={data.codigo_validacion}
              fechaEmisionIso={data.fecha_emision}
              titularNombre={data.titular_nombre}
              programaOCurso={data.programa_o_curso}
              programaCodigo={data.programa_codigo || 'CURSO'}
              urlVerificacion={urlVerificacion}
              vigente={data.vigente}
              cedula={data.cedula}
            />
          ) : (
            <CertificadoCursoView
              codigo={data.codigo_validacion}
              fechaEmisionIso={data.fecha_emision}
              titularNombre={data.titular_nombre}
              programaOCurso={data.programa_o_curso}
              modalidad={data.modalidad}
              categoria={data.categoria}
              descripcion={data.descripcion}
              modulosLista={data.modulos_lista}
              instructorNombre={data.instructor_nombre}
              instructorCargo={data.instructor_cargo}
              urlVerificacion={urlVerificacion}
              vigente={data.vigente}
              cedula={data.cedula}
            />
          )
        )}
      </main>
    </div>
  )
}

export default ComprobantePublicoPage
