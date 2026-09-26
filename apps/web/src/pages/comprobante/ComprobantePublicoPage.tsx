import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileDown, ArrowLeft, Loader2, Download } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import CertificadoProgramaView from '@/components/CertificadoProgramaView'
import CertificadoCursoView from '@/components/CertificadoCursoView'
import { API_URL } from '@/config/env'
import {
  renderCertificadoProgramaCanvas,
  renderCertificadoCursoCanvas,
  downloadCanvasAsPdf,
  downloadCanvasAsPng
} from '@/utils/certificateCanvasRenderer'
import { apiFetch } from '@/lib/apiClient'

type ApiData = {
  codigo_validacion: string
  fecha_emision: string
  titular_nombre: string
  titular_nombres?: string | null
  titular_apellidos?: string | null
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
  firmantes?: any[]
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
  const [downloadingPng, setDownloadingPng] = useState(false)

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
          setError(j.message || 'No se pudo encontrar el comprobante solicitado.')
        }
      })
      .catch((err) => {
        if (active) setError(err?.message || 'Error al consultar el comprobante')
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
      let canvas: HTMLCanvasElement
      if (isMainProgram) {
        canvas = await renderCertificadoProgramaCanvas({
          codigo: data.codigo_validacion,
          fechaEmisionIso: data.fecha_emision,
          titularNombre: data.titular_nombre,
          titularNombres: data.titular_nombres,
          titularApellidos: data.titular_apellidos,
          programaOCurso: data.programa_o_curso,
          programaCodigo: data.programa_codigo || '',
          urlVerificacion,
          cedula: data.cedula,
          firmantes: data.firmantes,
        }, 3.0)
      } else {
        canvas = await renderCertificadoCursoCanvas({
          codigo: data.codigo_validacion,
          fechaEmisionIso: data.fecha_emision,
          titularNombre: data.titular_nombre,
          titularNombres: data.titular_nombres,
          titularApellidos: data.titular_apellidos,
          programaOCurso: data.programa_o_curso,
          modalidad: data.modalidad,
          categoria: data.categoria,
          descripcion: data.descripcion,
          instructorNombre: data.instructor_nombre,
          instructorCargo: data.instructor_cargo,
          urlVerificacion,
          cedula: data.cedula,
          modulosLista: data.modulos_lista,
          firmantes: data.firmantes,
        }, 3.0)
      }
      const safeName = (data.titular_nombre || 'Comprobante').replace(/[^a-zA-Z0-9_-]/g, '_')
      downloadCanvasAsPdf(canvas, `Comprobante_${safeName}.pdf`)
    } catch (err) {
      console.error('Error generando PDF:', err)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleDownloadPng = async () => {
    if (!data) return
    setDownloadingPng(true)
    try {
      let canvas: HTMLCanvasElement
      if (isMainProgram) {
        canvas = await renderCertificadoProgramaCanvas({
          codigo: data.codigo_validacion,
          fechaEmisionIso: data.fecha_emision,
          titularNombre: data.titular_nombre,
          titularNombres: data.titular_nombres,
          titularApellidos: data.titular_apellidos,
          programaOCurso: data.programa_o_curso,
          programaCodigo: data.programa_codigo || '',
          urlVerificacion,
          cedula: data.cedula,
          firmantes: data.firmantes,
        }, 3.0)
      } else {
        canvas = await renderCertificadoCursoCanvas({
          codigo: data.codigo_validacion,
          fechaEmisionIso: data.fecha_emision,
          titularNombre: data.titular_nombre,
          titularNombres: data.titular_nombres,
          titularApellidos: data.titular_apellidos,
          programaOCurso: data.programa_o_curso,
          modalidad: data.modalidad,
          categoria: data.categoria,
          descripcion: data.descripcion,
          instructorNombre: data.instructor_nombre,
          instructorCargo: data.instructor_cargo,
          urlVerificacion,
          cedula: data.cedula,
          modulosLista: data.modulos_lista,
          firmantes: data.firmantes,
        }, 3.0)
      }
      const safeName = (data.titular_nombre || 'Comprobante').replace(/[^a-zA-Z0-9_-]/g, '_')
      await downloadCanvasAsPng(canvas, `Comprobante_${safeName}.png`)
    } catch (err) {
      console.error('Error generando PNG:', err)
    } finally {
      setDownloadingPng(false)
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || downloadingPng}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wide border border-slate-200/80 shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
              title="Descargar en formato PDF"
            >
              {downloadingPdf ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Descargando PDF...
                </>
              ) : (
                <>
                  <FileDown size={16} className="text-slate-600" />
                  PDF
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={downloadingPdf || downloadingPng}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm hover:bg-emerald-700 cursor-pointer disabled:opacity-50 transition-colors"
              title="Descargar imagen PNG en máxima calidad (300 DPI) para impresión física"
            >
              {downloadingPng ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generando PNG...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Descargar PNG (Impresión)
                </>
              )}
            </button>
          </div>
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
              titularNombres={data.titular_nombres}
              titularApellidos={data.titular_apellidos}
              programaOCurso={data.programa_o_curso}
              programaCodigo={data.programa_codigo || 'CURSO'}
              urlVerificacion={urlVerificacion}
              vigente={data.vigente}
              cedula={data.cedula}
              firmantes={data.firmantes}
            />
          ) : (
            <CertificadoCursoView
              codigo={data.codigo_validacion}
              fechaEmisionIso={data.fecha_emision}
              titularNombre={data.titular_nombre}
              titularNombres={data.titular_nombres}
              titularApellidos={data.titular_apellidos}
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
              firmantes={data.firmantes}
            />
          )
        )}
      </main>
    </div>
  )
}

export default ComprobantePublicoPage
