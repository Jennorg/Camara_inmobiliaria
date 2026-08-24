import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileDown, ArrowLeft, Loader2, Award } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { API_URL } from '@/config/env'
import logoImg from '@/assets/Logo4.webp'
import firmaImg from '@/assets/firma-francisco.webp'
import { exportElementToPdf } from '@/utils/domToPdf'
import { apiFetch } from '@/lib/apiClient'

interface AfiliadoData {
  id_afiliado: number
  nombre_completo: string
  nombres: string | null
  apellidos: string | null
  cedula: string | null
  codigo: string | null;
  tipo_afiliado: string
  estatus: string
  empresa_rif_tipo?: string | null
  empresa_rif_numero?: string | null
  empresa_razon_social?: string | null
}

const CertificadoAfiliacionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<AfiliadoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState(1000)
  const trackerRef = useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const node = trackerRef.current
    if (!node) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [])

  const scale = Math.min(1, width / 1000)

  useEffect(() => {
    if (!id) {
      setError('ID de afiliado no especificado.')
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    apiFetch(`${API_URL}/api/public/afiliados/${id}`)
      .then((resJson) => {
        if (!active) return
        if (resJson.success && resJson.data) {
          setData(resJson.data as AfiliadoData)
        } else {
          setError(resJson.message || 'No se pudo cargar el certificado.')
        }
      })
      .catch((err) => {
        if (!active) return
        console.error('Error fetching affiliate:', err)
        setError(err.message || 'Error de conexión con el servidor.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [id])

  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const handleDownloadPdf = async () => {
    if (!data) return
    setDownloadingPdf(true)
    try {
      const safeName = (data.nombre_completo || 'Afiliado').replace(/[^a-zA-Z0-9_-]/g, '_')
      await exportElementToPdf('certificate-print-area', `Certificado_Afiliacion_${safeName}.pdf`)
    } catch (err) {
      console.error('Error al generar el PDF del certificado:', err)
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Formatear cédula/RIF
  const formatDocumentId = (row: AfiliadoData) => {
    const rawId = row.cedula || row.empresa_rif_numero || ''
    if (!rawId) return '—'

    if (rawId.includes('-')) {
      return rawId
    }

    let prefix = 'V'
    let numberPart = rawId

    if (row.tipo_afiliado === 'Corporativo') {
      prefix = row.empresa_rif_tipo || 'J'
    }

    const cleanNumber = numberPart.replace(/\D/g, '')
    if (cleanNumber.length > 0) {
      const formattedNum = Number(cleanNumber).toLocaleString('es-VE')
      return `${prefix}-${formattedNum}`
    }

    return `${prefix}-${numberPart}`
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const verificationUrl = id ? `${origin}/comprobante/afiliacion/${id}` : origin
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`

  const handleBack = () => {
    if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 print:bg-white print:p-0">
      <Helmet>
        <title>
          {data ? `Certificado de Afiliación - ${data.nombre_completo}` : 'Certificado de Afiliación'}
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

      {/* Barra de Herramientas Superior */}
      <header className="no-print bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs sticky top-0 z-50">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors font-semibold text-sm cursor-pointer"
        >
          <ArrowLeft size={16} />
          Volver
        </button>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-colors transition-transform active:scale-95 cursor-pointer"
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

      {/* Contenido Principal */}
      <main className="flex justify-center items-center py-10 px-4 print:p-0">
        {loading && (
          <div className="flex flex-col items-center gap-4 py-20">
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
            <p className="font-bold text-slate-500">Cargando certificado gremial...</p>
          </div>
        )}

        {!loading && error && (
          <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-200 text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto">
              <Award className="text-rose-500 h-10 w-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-800">Certificado No Disponible</h2>
            <p className="text-slate-500">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors"
            >
              Ir al Inicio
            </button>
          </div>
        )}

        {!loading && data && (
          <div className="w-full relative">
            <div ref={trackerRef} className="absolute inset-x-0 top-0 h-0 pointer-events-none" />
            <div
              className="w-full flex justify-center items-start overflow-hidden print:!h-auto print:!overflow-visible"
              style={{ height: scale < 1 ? `${707 * scale}px` : 'auto' }}
            >
              <div
                id="certificate-print-area"
                className="print-full-page relative bg-white border border-slate-200 w-[1000px] h-[707px] rounded-3xl shadow-2xl overflow-hidden flex flex-col justify-between p-12 select-none print:!transform-none shrink-0"
                style={{
                  transform: scale < 1 ? `scale(${scale})` : 'none',
                  transformOrigin: 'top center',
                }}
              >
            {/* ── VECTOR BACKGROUND ACCENTS (FIDELIDAD TOTAL A LA FOTO) ── */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
              viewBox="0 0 1000 707"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Marco fino rectangular interno */}
              <rect x="25" y="25" width="950" height="657" fill="none" stroke="#000000" strokeWidth="1.5" opacity="0.8" />

              {/* Esquina superior derecha: Polígono amarillo */}
              <path d="M 880 25 L 975 25 L 975 120 Z" fill="#eab308" />

              {/* Lado izquierdo: Chevron dorado */}
              <path d="M 25 150 L 65 240 L 25 330 Z" fill="#f59e0b" opacity="0.9" />

              {/* Esquina inferior izquierda: Círculo y Arcos concéntricos perfectos (Nunca rotos) */}
              {/* Arcos decorativos */}
              <path d="M 25 240 Q 250 240 330 682" fill="none" stroke="#a7f3d0" strokeWidth="8" opacity="0.6" />
              <path d="M 25 200 Q 290 200 375 682" fill="none" stroke="#fef08a" strokeWidth="6" opacity="0.5" />

              {/* Círculo base verde oscuro */}
              <path d="M 25 300 C 130 300 290 420 290 682 L 25 682 Z" fill="#022c22" />

              {/* Esquina inferior derecha: Ondas y curvas continuas */}
              {/* Onda 1 (verde claro) */}
              <path d="M 520 682 Q 720 575 975 605 L 975 682 Z" fill="#10b981" opacity="0.3" />
              {/* Onda 2 (verde medio) */}
              <path d="M 610 682 Q 800 595 975 625 L 975 682 Z" fill="#047857" opacity="0.75" />
              {/* Onda 3 (verde oscuro principal) */}
              <path d="M 700 682 Q 850 615 975 650 L 975 682 Z" fill="#022c22" />
            </svg>

            {/* ── CONTENIDO DEL CERTIFICADO ── */}
            {/* Header del Certificado */}
            <div className="relative z-10 flex flex-col items-center text-center mt-2">
              <img src={logoImg} className="h-34 w-auto mb-2 drop-shadow-sm" alt="Logo CIEBO" />
              <h2 className="text-emerald-950 font-bold uppercase tracking-[0.2em] text-xs font-sans">
                Cámara Inmobiliaria
              </h2>
              <h2 className="text-emerald-900 font-bold uppercase tracking-[0.2em] text-xs font-sans">
                de Bolívar
              </h2>
            </div>

            {/* Cuerpo Principal */}
            <div className="relative z-10 flex flex-col items-center text-center my-auto px-10">
              <p className="text-emerald-900 font-sans font-medium text-[13px] uppercase tracking-wider max-w-[650px] leading-relaxed">
                La Cámara Inmobiliaria de Bolívar (CIEBO)
                <br />
                le otorga el presente certificado a
              </p>

              {/* Nombre del Afiliado */}
              <h1 className="text-emerald-950 font-sans font-extrabold text-3xl mt-4 mb-1 tracking-tight uppercase">
                {data.nombre_completo}
              </h1>

              {/* Roles corporativos */}
              {data.tipo_afiliado === 'Corporativo' && (data.nombres || data.apellidos) && (
                <p className="text-emerald-800 font-sans font-bold text-sm mb-3 uppercase tracking-wider">
                  Representante Legal: {data.nombres} {data.apellidos}
                </p>
              )}

              {data.tipo_afiliado === 'Agente Corporativo' && data.empresa_razon_social && (
                <p className="text-emerald-800 font-sans font-bold text-sm mb-3 uppercase tracking-wider">
                  Agente Corporativo de: {data.empresa_razon_social}
                </p>
              )}

              {/* Cédula / RIF */}
              <div className="flex flex-col items-center mb-1 mt-1">
                <p className="text-emerald-900 font-sans font-bold text-sm tracking-widest flex items-center gap-1.5 border-b border-emerald-900/60 pb-1 px-8 min-w-[240px] justify-center">
                  <span className="font-mono">{formatDocumentId(data)}</span>
                </p>
              </div>

              {/* Cinta/Ribbon Decorativo (Fiel a la foto, sin partes rotas) */}
              <div className="relative flex items-center justify-center w-full max-w-[400px] h-8 mt-4">
                <svg viewBox="0 0 320 40" className="h-8 w-auto">
                  <defs>
                    <linearGradient id="ribbonGradAff" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#047857" />
                      <stop offset="100%" stopColor="#eab308" />
                    </linearGradient>
                  </defs>
                  {/* Folded Ribbon Zig-zag */}
                  <path d="M 12 28 L 2 20 L 12 12 L 18 20 Z" fill="#022c22" />
                  <path d="M 18 20 L 26 12 L 34 20 L 26 28 Z" fill="#047857" />
                  <path d="M 34 20 L 42 12 L 50 20 L 42 28 Z" fill="#10b981" />
                  <path d="M 50 20 L 58 12 L 66 20 L 58 28 Z" fill="#fbbf24" />
                  <path d="M 66 20 L 72 14 L 72 26 Z" fill="#d97706" />
                  {/* Main Bar */}
                  <rect x="72" y="14" width="230" height="12" rx="2" fill="url(#ribbonGradAff)" />
                </svg>
              </div>

              {/* Texto de constancia */}
              <p
                className="text-emerald-950 text-base mt-3"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 600 }}
              >
                Como constancia de Afiliación a este Gremio
              </p>
            </div>

            {/* Footer con Firma Única y QR Único a la Izquierda */}
            <div className="relative z-10 grid grid-cols-[1fr_1.5fr_1fr] items-center w-full mt-4 pb-2">
              {/* QR Único a la Izquierda (Código de Afiliación) integrado de forma limpia */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="bg-white p-2.5 rounded-xl shadow-md border border-slate-100">
                  <img
                    src={qrApiUrl}
                    className="h-22 w-22"
                    alt="Código QR de Verificación"
                  />
                </div>
                <p
                  className="text-emerald-100 text-[10px] mt-1.5 font-bold tracking-wide select-none drop-shadow-xs"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic' }}
                >
                  Código de afiliación
                </p>
              </div>

              {/* Firma Centro */}
              <div className="flex flex-col items-center justify-center px-10">
                <div className="relative w-48 h-12 flex items-center justify-center">
                  <img
                    src={firmaImg}
                    className="absolute bottom-[-12px] h-28 w-auto object-contain select-none pointer-events-none max-w-none"
                    alt="Firma Francisco Piñango"
                  />
                </div>
                <div className="w-48 h-[1.5px] bg-slate-400 mb-1" />
                <span className="text-[10px] font-black text-emerald-950 uppercase tracking-widest font-sans">
                  Francisco Piñango
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans mt-0.5">
                  Presidente de la Junta Directiva
                </span>
              </div>

              {/* Código de Afiliado a la derecha */}
              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-black text-emerald-900 uppercase tracking-widest font-sans mb-1.5 text-center">
                  Código de Afiliado
                </span>
                <span className="inline-flex items-center justify-center text-xl font-bold font-mono text-emerald-950 border border-slate-200 bg-white px-6 py-2 rounded-xl shadow-md">
                  {data.codigo || data.id_afiliado}
                </span>
              </div>
            </div>
          </div>
          </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default CertificadoAfiliacionPage
