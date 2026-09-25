import React, { useState, useRef, useEffect } from 'react'
import QRCode from 'qrcode'
import logoImg from '@/assets/logo_ciebo_green.svg'
import firmaFranciscoImg from '@/assets/firma-francisco.webp'
import { formatNombreCard } from '@/utils/formatters'

export interface Firmante {
  id?: string | number
  nombre: string
  cargo: string
  firma_url?: string | null
  mostrar_firma?: boolean
}

export interface CertificadoCursoViewProps {
  codigo: string
  fechaEmisionIso: string
  titularNombre: string
  programaOCurso: string
  modalidad?: string | null
  categoria?: string | null
  descripcion?: string | null
  instructorNombre?: string | null
  instructorCargo?: string | null
  urlVerificacion: string
  qrDataUrl?: string
  vigente: boolean
  cedula?: string | null
  modulosLista?: string | string[] | null
  firmantes?: Firmante[]
}

function formatFecha(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const month = d.toLocaleDateString('es-VE', { month: 'long' })
    const year = d.getFullYear()
    return `${month}, ${year}`
  } catch {
    return iso
  }
}

/**
 * Normaliza el prefijo de participación y extrae la lista de módulos/conferencias.
 */
function getPrefijoParticipacion(
  modalidad?: string | null,
  categoria?: string | null,
  titulo?: string,
  descripcion?: string | null,
  modulosLista?: string | string[] | null
): { prefix: string; cleanTitle: string; itemsList: string[] } {
  const modLower = (modalidad || '').toLowerCase()
  const catLower = (categoria || '').toLowerCase()
  const titLower = (titulo || '').toLowerCase()
  const descLower = (descripcion || '').toLowerCase()

  // Extraer lista de módulos o conferencias
  let itemsList: string[] = []
  if (Array.isArray(modulosLista)) {
    itemsList = modulosLista.map(s => String(s || '').trim()).filter(Boolean)
  } else if (typeof modulosLista === 'string' && modulosLista.trim()) {
    itemsList = modulosLista.split('|||').map(s => s.trim()).filter(Boolean)
  }

  // Descartar placeholders genéricos como "Módulo General" si hay otros
  if (itemsList.length === 1 && /^mó?dulo general$/i.test(itemsList[0])) {
    itemsList = []
  } else {
    itemsList = itemsList.filter(s => !/^mó?dulo general$/i.test(s))
  }

  if (itemsList.length === 0 && descripcion) {
    const rawText = descripcion
    const lines = rawText
      .split(/\r?\n|;|\u2022|\u25cf/)
      .map(s => s.trim().replace(/^[-*•\d+.]\s*/, ''))
      .filter(s => s.length > 0 && !/^conferencias?\s*:?$/i.test(s) && !/^modulos?\s*:?$/i.test(s) && !/^curso test$/i.test(s) && !/^test$/i.test(s) && !/^mó?dulo general$/i.test(s))
    if (lines.length >= 1) {
      itemsList = lines
    }
  }

  const allText = `${modLower} ${catLower} ${titLower} ${descLower}`
  const isConferencia = allText.includes('conferencia') || allText.includes('magia y realidad')
  const isTaller = allText.includes('taller')
  const isSeminario = allText.includes('seminario')
  const isMasterclass = allText.includes('masterclass')
  const isDiplomado = allText.includes('diplomado')
  const isCharla = allText.includes('charla')
  const isConversatorio = allText.includes('conversatorio')

  const isPlural = itemsList.length > 1

  let prefix = ''
  if (isConferencia && (allText.includes('modulo') || allText.includes('módulo'))) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LAS CONFERENCIAS Y MÓDULOS:' : 'POR SU PARTICIPACIÓN EN LA CONFERENCIA Y MÓDULOS:'
  } else if (isConferencia) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LAS CONFERENCIAS:' : 'POR SU PARTICIPACIÓN EN LA CONFERENCIA:'
  } else if (isTaller) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LOS TALLERES:' : 'POR SU PARTICIPACIÓN EN EL TALLER:'
  } else if (isSeminario) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LOS SEMINARIOS:' : 'POR SU PARTICIPACIÓN EN EL SEMINARIO:'
  } else if (isMasterclass) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LAS MASTERCLASSES:' : 'POR SU PARTICIPACIÓN EN LA MASTERCLASS:'
  } else if (isDiplomado) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LOS DIPLOMADOS:' : 'POR SU PARTICIPACIÓN EN EL DIPLOMADO:'
  } else if (isCharla) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LAS CHARLAS:' : 'POR SU PARTICIPACIÓN EN LA CHARLA:'
  } else if (isConversatorio) {
    prefix = isPlural ? 'POR SU PARTICIPACIÓN EN LOS CONVERSATORIOS:' : 'POR SU PARTICIPACIÓN EN EL CONVERSATORIO:'
  } else if (isPlural) {
    prefix = 'POR SU PARTICIPACIÓN EN LOS MÓDULOS:'
  } else {
    prefix = 'POR SU PARTICIPACIÓN EN EL CURSO:'
  }

  let cleanTitle = (titulo || 'FORMACIÓN PROFESIONAL').trim()
  cleanTitle = cleanTitle
    .replace(/^taller\s*:?\s*/i, '')
    .replace(/^conferencias?\s*:?\s*/i, '')
    .replace(/^seminario\s*:?\s*/i, '')
    .replace(/^masterclass\s*:?\s*/i, '')
    .replace(/^diplomado\s*:?\s*/i, '')
    .replace(/^charla\s*:?\s*/i, '')
    .replace(/^conversatorio\s*:?\s*/i, '')
    .replace(/^curso\s*:?\s*/i, '')
    .trim()

  return { prefix, cleanTitle, itemsList }
}

const CertificadoCursoView: React.FC<CertificadoCursoViewProps> = ({
  codigo,
  fechaEmisionIso,
  titularNombre,
  programaOCurso,
  modalidad,
  categoria,
  descripcion,
  instructorNombre,
  instructorCargo,
  urlVerificacion,
  qrDataUrl,
  vigente,
  cedula,
  modulosLista,
  firmantes,
}) => {
  const [localQr, setLocalQr] = useState<string>(qrDataUrl || '')

  useEffect(() => {
    if (qrDataUrl) {
      setLocalQr(qrDataUrl)
      return
    }
    if (urlVerificacion) {
      QRCode.toDataURL(urlVerificacion, { margin: 1, width: 250 })
        .then(setLocalQr)
        .catch(() => {})
    }
  }, [urlVerificacion, qrDataUrl])

  const qrApiUrl = qrDataUrl || localQr || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(urlVerificacion)}`

  const [width, setWidth] = useState(1000)
  const trackerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = trackerRef.current
    if (!node) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 50) {
          setWidth(entry.contentRect.width)
        }
      }
    })
    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [])

  const validWidth = width > 50 ? width : 1000
  const scale = Math.min(1, validWidth / 1000)
  const { prefix, cleanTitle, itemsList } = getPrefijoParticipacion(modalidad, categoria, programaOCurso, descripcion, modulosLista)

  // Mostrar únicamente el primer nombre y primer apellido
  const nombreMostrado = formatNombreCard(titularNombre) || titularNombre

  return (
    <div className="w-full relative">
      <div ref={trackerRef} className="absolute inset-x-0 top-0 h-0 pointer-events-none" />
      <div
        className="w-full flex justify-center items-start overflow-hidden print:!h-auto print:!overflow-visible"
        style={{ height: scale < 1 ? `${707 * scale}px` : 'auto' }}
      >
        <article
          id="certificate-print-area"
          className="print-full-page relative bg-white border border-slate-200/80 w-[1000px] h-[707px] rounded-2xl shadow-2xl overflow-hidden select-none print:!transform-none shrink-0"
          style={{
            transform: scale < 1 ? `scale(${scale})` : 'none',
            transformOrigin: 'top center',
            backgroundColor: '#ffffff',
          }}
        >
          {/* ── BORDES DECORATIVOS CIBIR ── */}
          {/* Borde negro fino perimetral */}
          <div className="absolute inset-6 border border-slate-800/80 pointer-events-none rounded-none z-10" />

          {/* ── POLÍGONOS DECORATIVOS ESQUINAS (SVG NATIVO 100% FIEL Y NÍTIDO) ── */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 1000 707" fill="none">
            {/* Esquina superior izquierda */}
            <polygon points="0,0 210,0 0,127" fill="#F6A644" />
            <polygon points="0,0 161,0 0,68" fill="#2E6F44" />
            <polygon points="0,0 78,0 0,57" fill="#2F5496" />

            {/* Esquina superior derecha */}
            <polygon points="1000,0 760,0 1000,212" fill="#2F5496" />
            <polygon points="1000,0 825,0 1000,173" fill="#2E6F44" />
            <polygon points="1000,0 928,0 1000,106" fill="#F6A644" />

            {/* Esquina inferior derecha */}
            <polygon points="1000,707 1000,558 790,707" fill="#F6A644" />
            <polygon points="1000,707 1000,601 920,707" fill="#2F5496" />

            {/* Esquina inferior izquierda */}
            <polygon points="0,707 202,707 0,564" fill="#2E6F44" />
            <polygon points="0,707 227,707 88,645" fill="#2F5496" />
            <polygon points="0,707 200,707 0,672" fill="#F6A644" />
          </svg>

          {/* ══════════════════════════════════════════════════════════════════
              3. MARCA DE AGUA CENTRAL
          ══════════════════════════════════════════════════════════════════ */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <img
              src={logoImg}
              alt=""
              className="w-[640px] h-auto object-contain opacity-[0.08] grayscale-0 translate-y-6"
            />
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              4. CONTENIDO DEL CERTIFICADO
          ══════════════════════════════════════════════════════════════════ */}
          <div className="relative z-10 flex flex-col items-center justify-between h-full px-16 py-8">

            {/* ── SECCIÓN SUPERIOR: LOGO Y CABECERA ── */}
            <div className="w-full flex flex-col items-center justify-center text-center">
              <div className="flex flex-col items-center justify-center gap-2 text-center">
                <img
                  src={logoImg}
                  alt="Cámara Inmobiliaria de Bolívar"
                  className="h-28 w-auto object-contain drop-shadow-sm"
                />
                <h2 className="text-[#0f5431] font-black uppercase tracking-[0.10em] text-[18px] text-center leading-tight font-sans">
                  <span className="block whitespace-nowrap">CÁMARA INMOBILIARIA</span>
                  <span className="block whitespace-nowrap">DE BOLÍVAR</span>
                </h2>
              </div>

              {/* Otorgamiento */}
              <p
                className="text-slate-800 font-extrabold uppercase text-[12.5px] tracking-[0.22em] mt-5 font-sans"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                La Cámara Inmobiliaria del estado Bolívar<br />otorga el siguiente reconocimiento a:
              </p>
            </div>

            {/* ── SECCIÓN CENTRAL: NOMBRE DEL DESTINATARIO ── */}
            <div className="w-full flex flex-col items-center my-auto max-w-[820px]">
              {/* Nombre en Fuente Caligráfica Cursiva (Primer Nombre y Primer Apellido) */}
              <div className="relative w-full flex items-center justify-center py-2">
                <div className="absolute left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-slate-400 to-transparent bottom-0" />
                <span
                  className="text-slate-900 text-center leading-tight tracking-wide px-8 select-all"
                  style={{
                    fontFamily: "'Great Vibes', 'Alex Brush', cursive",
                    fontSize: (() => {
                      const len = (nombreMostrado || '').length;
                      if (len > 35) return '42px';
                      if (len > 28) return '50px';
                      if (len > 20) return '60px';
                      return '70px';
                    })(),
                    textShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  }}
                >
                  {nombreMostrado}
                </span>
              </div>

              {/* Cédula si está disponible */}
              {cedula && (
                <p className="text-slate-900 font-black text-[14px] sm:text-[15px] tracking-widest font-mono mt-1.5 opacity-90">
                  C.I.: {cedula.replace(/\D/g, '').length >= 5 ? Number(cedula.replace(/\D/g, '')).toLocaleString('es-VE') : cedula}
                </p>
              )}

              {/* Texto de Participación */}
              <div className="flex flex-col items-center text-center mt-3 max-w-[780px]">
                <p
                  className="text-slate-900 font-extrabold text-[13.5px] uppercase tracking-wide leading-snug"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  <span className="text-slate-950 font-black">{prefix}</span>
                </p>

                {itemsList.length > 1 ? (
                  <ul className="flex flex-col items-start text-left mt-2.5 space-y-1.5 max-w-[720px] mx-auto">
                    {itemsList.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-slate-900 font-extrabold text-[13.5px] uppercase tracking-wider text-left leading-snug"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                      >
                        <span className="text-[#0f5431] font-bold text-[14px] leading-none shrink-0 select-none">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : itemsList.length === 1 ? (
                  <p
                    className="text-slate-950 font-black text-[15px] uppercase tracking-wide mt-1.5"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {itemsList[0]}
                  </p>
                ) : (
                  <p
                    className="text-slate-950 font-black text-[15px] uppercase tracking-wide mt-1.5"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {cleanTitle}
                  </p>
                )}
              </div>
            </div>

            {/* ── SECCIÓN INFERIOR: FIRMAS CONFIGURADAS Y FECHA ── */}
            {(() => {
              let activeFirmantes = (firmantes && firmantes.length > 0) ? [...firmantes] : [{
                nombre: 'FRANCISCO PIÑANGO',
                cargo: 'PRESIDENTE DE LA CAMARA INMOBILIARIA DE BOLIVAR',
                firma_url: null,
                mostrar_firma: true
              }];

              // Si solo hay 1 firmante por defecto y se especificó instructor/conferencista por separado, incluirlo
              if (activeFirmantes.length === 1 && instructorNombre && !activeFirmantes.some(f => f.nombre.trim().toLowerCase() === instructorNombre.trim().toLowerCase())) {
                activeFirmantes.push({
                  nombre: instructorNombre,
                  cargo: instructorCargo || 'FACILITADOR / CONFERENCISTA',
                  firma_url: null,
                  mostrar_firma: true
                });
              }

              const count = activeFirmantes.length;
              let gridLayout = 'flex flex-wrap justify-center gap-6';
              if (count === 1) gridLayout = 'flex justify-center max-w-sm mx-auto';
              else if (count === 2) gridLayout = 'grid grid-cols-2 max-w-3xl mx-auto gap-16 justify-items-center';
              else if (count === 3) gridLayout = 'grid grid-cols-3 max-w-4xl mx-auto gap-8 justify-items-center';
              else if (count === 4) gridLayout = 'grid grid-cols-4 max-w-5xl mx-auto gap-4 justify-items-center';
              else gridLayout = 'grid grid-cols-5 gap-2 justify-items-center';

              return (
                <div className="w-full flex flex-col items-center gap-1 px-4 pb-1">
                  <div className={`w-full ${gridLayout} items-start px-2`}>
                    {activeFirmantes.map((f, idx) => {
                      const nombreStr = (f?.nombre || '').toString()
                      let cargoStr = (f?.cargo || '').toString().trim()
                      const cargoUpper = cargoStr.toUpperCase()

                      if (
                        (cargoUpper.includes('PRESIDENTE') || cargoUpper.includes('VICEPRESIDENTE')) &&
                        !cargoUpper.includes('CAMARA INMOBILIARIA') &&
                        !cargoUpper.includes('DEL ESTADO BOLIVAR') &&
                        !cargoUpper.includes('DE BOLIVAR')
                      ) {
                        cargoStr = `${cargoStr} DE LA CÁMARA INMOBILIARIA DEL ESTADO BOLÍVAR`
                      }

                      const imgSource = f?.firma_url || (nombreStr.toUpperCase().includes('FRANCISCO') ? firmaFranciscoImg : null);
                      return (
                        <div key={`firma-slot-${idx}`} className="flex flex-col items-center justify-start text-center min-w-[140px] max-w-[280px]">
                          <div className="relative h-14 w-44 flex items-end justify-center">
                            {f?.mostrar_firma !== false && imgSource ? (
                              <img
                                src={imgSource}
                                className="absolute bottom-[-4px] h-16 w-auto object-contain select-none pointer-events-none"
                                alt={`Firma ${nombreStr}`}
                              />
                            ) : null}
                          </div>
                          <div className="w-44 h-[1px] bg-slate-800 mb-1.5 shrink-0" />
                          <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider font-sans leading-tight whitespace-nowrap">
                            {nombreStr}
                          </span>
                          <span className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wider font-sans mt-1 text-center leading-tight max-w-[240px]">
                            {cargoStr}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Fecha de Emisión (Abajo de las firmas) */}
                  <span className="text-[11px] font-black text-[#0f2e59] uppercase tracking-wider font-sans mt-2 whitespace-nowrap">
                    {formatFecha(fechaEmisionIso).toUpperCase()}
                  </span>
                </div>
              );
            })()}

          </div>
        </article>
      </div>
    </div>
  )
}

export default CertificadoCursoView
