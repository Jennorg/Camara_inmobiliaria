import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import ComprobanteVerificacionView from '@/components/ComprobanteVerificacionView'
import CertificadoProgramaView from '@/components/CertificadoProgramaView'
import { API_URL } from '@/config/env'

type ApiData = {
  codigo_validacion: string
  fecha_emision: string
  titular_nombre: string
  cedula?: string | null
  programa_o_curso: string
  programa_codigo?: string | null
  vigente: boolean
}

const ComprobantePublicoPage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ApiData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const urlVerificacion = codigo ? `${origin}/comprobante/${encodeURIComponent(codigo)}` : origin

  useEffect(() => {
    if (!codigo?.trim()) {
      setError('Enlace incompleto')
      setLoading(false)
      return
    }
    fetch(`${API_URL}/api/public/comprobantes/${encodeURIComponent(codigo)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data) {
          setData(j.data as ApiData)
        } else {
          setError(j.message || 'No se pudo cargar el comprobante')
        }
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [codigo])

  const handlePrintPdf = () => {
    window.print()
  }

  const handleBack = () => {
    if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const isProgramaPrincipal =
    data?.programa_codigo &&
    ['CIBIR', 'PEGI', 'PREANI', 'PADI'].includes(data.programa_codigo.toUpperCase())

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 print:bg-white">
      <Helmet>
        <title>
          {data ? `${data.programa_o_curso} - ${data.titular_nombre}` : 'Verificación de Comprobante'}
        </title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Montserrat:wght@400;500;700;900&family=Playfair+Display:ital,wght@1,600&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            ${
              isProgramaPrincipal
                ? `
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
            `
                : ''
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
            onClick={handlePrintPdf}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
          >
            <Printer size={16} />
            Exportar PDF
          </button>
        </div>
        <p className="mx-auto max-w-4xl px-4 pb-3 text-[11px] text-slate-500 pl-16">
          Use la impresión del navegador y elija <strong>Guardar como PDF</strong> como destino {isProgramaPrincipal && '(orientación Horizontal)'}.
        </p>
      </header>

      <main
        className={
          isProgramaPrincipal
            ? 'flex justify-center items-center py-10 px-4 print:p-0'
            : 'mx-auto max-w-3xl px-4 py-10 print:py-6'
        }
      >
        {loading && (
          <p className="text-center text-sm font-medium text-slate-400 py-20">Cargando comprobante…</p>
        )}
        {!loading && error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-8 text-center text-sm text-red-700 w-full max-w-md mx-auto">
            {error}
          </div>
        )}
        {!loading && data && (
          isProgramaPrincipal ? (
            <CertificadoProgramaView
              codigo={data.codigo_validacion}
              fechaEmisionIso={data.fecha_emision}
              titularNombre={data.titular_nombre}
              programaOCurso={data.programa_o_curso}
              programaCodigo={data.programa_codigo!}
              urlVerificacion={urlVerificacion}
              vigente={data.vigente}
              cedula={data.cedula}
            />
          ) : (
            <ComprobanteVerificacionView
              codigo={data.codigo_validacion}
              fechaEmisionIso={data.fecha_emision}
              titularNombre={data.titular_nombre}
              programaOCurso={data.programa_o_curso}
              urlVerificacion={urlVerificacion}
              vigente={data.vigente}
            />
          )
        )}
      </main>
    </div>
  )
}

export default ComprobantePublicoPage
