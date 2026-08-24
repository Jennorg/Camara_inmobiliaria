import React, { useState, useRef, useEffect } from 'react'
import logoImg from '@/assets/Logo4.webp'
import logoWatermark from '@/assets/Logo2.webp'
import firmaFranciscoImg from '@/assets/firma-francisco.webp'

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
  vigente: boolean
  cedula?: string | null
  modulosLista?: string | string[] | null
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
 * Normaliza el prefijo de participación según la categoría, modalidad y cantidad de módulos/conferencias.
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

  // Extraer lista de módulos o conferencias desde modulosLista o renglones de descripción/título
  let itemsList: string[] = []
  if (Array.isArray(modulosLista)) {
    itemsList = modulosLista.filter(Boolean)
  } else if (typeof modulosLista === 'string' && modulosLista.trim()) {
    itemsList = modulosLista.split('|||').map(s => s.trim()).filter(Boolean)
  }

  // Descartar placeholders genéricos como "Módulo General"
  itemsList = itemsList.filter(s => !/^mó?dulo general$/i.test(s))

  if (itemsList.length === 0) {
    const rawText = [descripcion, titulo].filter(Boolean).join('\n')
    const lines = rawText
      .split(/\r?\n|;|\u2022|\u25cf/)
      .map(s => s.trim().replace(/^[-*•\d+.]\s*/, ''))
      .filter(s => s.length > 0 && !/^conferencias?\s*:?$/i.test(s) && !/^modulos?\s*:?$/i.test(s) && !/^curso test$/i.test(s) && !/^test$/i.test(s) && !/^mó?dulo general$/i.test(s))
    if (lines.length >= 1) {
      itemsList = lines
    }
  }

  const isPlural = itemsList.length > 1

  let baseType = 'CURSO'
  if (modLower.includes('conferencia') || catLower.includes('conferencia') || titLower.includes('conferencia')) {
    baseType = 'CONFERENCIA'
  } else if (modLower.includes('taller') || catLower.includes('taller') || titLower.includes('taller')) {
    baseType = 'TALLER'
  } else if (modLower.includes('seminario') || catLower.includes('seminario') || titLower.includes('seminario')) {
    baseType = 'SEMINARIO'
  } else if (modLower.includes('masterclass') || catLower.includes('masterclass') || titLower.includes('masterclass')) {
    baseType = 'MASTERCLASS'
  } else if (modLower.includes('diplomado') || catLower.includes('diplomado') || titLower.includes('diplomado')) {
    baseType = 'DIPLOMADO'
  } else if (modLower.includes('charla') || catLower.includes('charla') || titLower.includes('charla')) {
    baseType = 'CHARLA'
  } else if (modLower.includes('conversatorio') || catLower.includes('conversatorio') || titLower.includes('conversatorio')) {
    baseType = 'CONVERSATORIO'
  }

  let prefix = ''
  if (isPlural) {
    if (baseType === 'CONFERENCIA') prefix = 'POR SU PARTICIPACIÓN EN LAS CONFERENCIAS:'
    else if (baseType === 'TALLER') prefix = 'POR SU PARTICIPACIÓN EN LOS TALLERES:'
    else if (baseType === 'SEMINARIO') prefix = 'POR SU PARTICIPACIÓN EN LOS SEMINARIOS:'
    else if (baseType === 'MASTERCLASS') prefix = 'POR SU PARTICIPACIÓN EN LAS MASTERCLASSES:'
    else if (baseType === 'DIPLOMADO') prefix = 'POR SU PARTICIPACIÓN EN LOS DIPLOMADOS:'
    else if (baseType === 'CHARLA') prefix = 'POR SU PARTICIPACIÓN EN LAS CHARLAS:'
    else if (baseType === 'CONVERSATORIO') prefix = 'POR SU PARTICIPACIÓN EN LOS CONVERSATORIOS:'
    else prefix = 'POR SU PARTICIPACIÓN EN LOS MÓDULOS:'
  } else {
    if (baseType === 'CONFERENCIA') prefix = 'POR SU PARTICIPACIÓN EN LA CONFERENCIA:'
    else if (baseType === 'TALLER') prefix = 'POR SU PARTICIPACIÓN EN EL TALLER:'
    else if (baseType === 'SEMINARIO') prefix = 'POR SU PARTICIPACIÓN EN EL SEMINARIO:'
    else if (baseType === 'MASTERCLASS') prefix = 'POR SU PARTICIPACIÓN EN LA MASTERCLASS:'
    else if (baseType === 'DIPLOMADO') prefix = 'POR SU PARTICIPACIÓN EN EL DIPLOMADO:'
    else if (baseType === 'CHARLA') prefix = 'POR SU PARTICIPACIÓN EN LA CHARLA:'
    else if (baseType === 'CONVERSATORIO') prefix = 'POR SU PARTICIPACIÓN EN EL CONVERSATORIO:'
    else prefix = 'POR SU PARTICIPACIÓN EN EL CURSO:'
  }

  let cleanTitle = titulo || 'FORMACIÓN PROFESIONAL'
  cleanTitle = cleanTitle
    .replace(/^taller\s*:?\s*/i, '')
    .replace(/^conferencia\s*:?\s*/i, '')
    .replace(/^seminario\s*:?\s*/i, '')
    .replace(/^masterclass\s*:?\s*/i, '')
    .replace(/^diplomado\s*:?\s*/i, '')
    .replace(/^charla\s*:?\s*/i, '')
    .replace(/^conversatorio\s*:?\s*/i, '')
    .replace(/^curso\s*:?\s*/i, '')

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
  vigente,
  cedula,
  modulosLista,
}) => {
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(urlVerificacion)}`

  const [width, setWidth] = useState(1000)
  const trackerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
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
  const { prefix, cleanTitle, itemsList } = getPrefijoParticipacion(modalidad, categoria, programaOCurso, descripcion, modulosLista)

  // Firma izquierda por defecto si no viene instructor asignado
  const nombreFirmaIzq = instructorNombre?.trim() || 'WILMER SABALLO'
  const cargoFirmaIzq = instructorCargo?.trim() || (instructorNombre ? 'FACILITADOR / INSTRUCTOR' : 'DIRECTOR REGIONAL DE CENTURY 21')

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

          {/* =========================================
              ESQUINA SUPERIOR IZQUIERDA (POLÍGONOS GEOMÉTRICOS)
          ========================================= */}
          <div
            className="absolute pointer-events-none z-10"
            style={{ top: '-4px', left: '-4px', width: 'calc(35% + 8px)', height: 'calc(45% + 8px)', background: '#F6A644', clipPath: 'polygon(0 0, 60% 0, 0 40%)' }}
          />
          <div
            className="absolute pointer-events-none z-10"
            style={{ top: '-4px', left: '-4px', width: 'calc(23% + 8px)', height: 'calc(32% + 8px)', background: '#2E6F44', clipPath: 'polygon(0 0, 70% 0, 0 30%)' }}
          />
          <div
            className="absolute pointer-events-none z-10"
            style={{ top: '-4px', left: '-4px', width: 'calc(13% + 8px)', height: 'calc(20% + 8px)', background: '#2F5496', clipPath: 'polygon(0 0, 60% 0, 0 40%)' }}
          />

          {/* =========================================
              ESQUINA SUPERIOR DERECHA (POLÍGONOS CIBIR)
          ========================================= */}
          <div
            className="absolute pointer-events-none z-10"
            style={{ top: '-4px', right: '-4px', width: 'calc(40% + 8px)', height: 'calc(50% + 8px)', background: '#2F5496', clipPath: 'polygon(100% 0, 40% 0, 100% 60%)' }}
          />
          <div
            className="absolute pointer-events-none z-10"
            style={{ top: '-4px', right: '-4px', width: 'calc(25% + 8px)', height: 'calc(35% + 8px)', background: '#2E6F44', clipPath: 'polygon(100% 0, 30% 0, 100% 70%)' }}
          />
          <div
            className="absolute pointer-events-none z-10"
            style={{ top: '-4px', right: '-4px', width: 'calc(12% + 8px)', height: 'calc(25% + 8px)', background: '#F6A644', clipPath: 'polygon(100% 0, 40% 0, 100% 60%)' }}
          />

          {/* =========================================
              ESQUINA INFERIOR DERECHA (POLÍGONOS CIBIR)
          ========================================= */}
          <div
            className="absolute pointer-events-none z-10"
            style={{ bottom: '-4px', right: '-4px', width: 'calc(35% + 8px)', height: 'calc(35% + 8px)', background: '#F6A644', clipPath: 'polygon(100% 100%, 100% 40%, 40% 100%)' }}
          />
          <div
            className="absolute pointer-events-none z-10"
            style={{ bottom: '-4px', right: '-4px', width: 'calc(20% + 8px)', height: 'calc(25% + 8px)', background: '#2F5496', clipPath: 'polygon(100% 100%, 100% 40%, 60% 100%)' }}
          />

          {/* =========================================
              ESQUINA INFERIOR IZQUIERDA (POLÍGONOS CIBIR)
          ========================================= */}
          <div
            className="absolute pointer-events-none z-10"
            style={{ bottom: '-4px', left: '-4px', width: 'calc(45% + 8px)', height: 'calc(45% + 8px)', background: '#2E6F44', clipPath: 'polygon(0% 100%, 45% 100%, 0% 55%)' }}
          />
          <div
            className="absolute pointer-events-none z-10"
            style={{ bottom: '-4px', left: '-4px', width: 'calc(35% + 8px)', height: 'calc(35% + 8px)', background: '#2F5496', clipPath: 'polygon(0% 100%, 65% 100%, 25% 75%)' }}
          />
          <div
            className="absolute pointer-events-none z-10"
            style={{ bottom: '-4px', left: '-4px', width: 'calc(25% + 8px)', height: 'calc(25% + 8px)', background: '#F6A644', clipPath: 'polygon(0% 100%, 80% 100%, 0% 80%)' }}
          />

          {/* ══════════════════════════════════════════════════════════════════
              3. MARCA DE AGUA CENTRAL
          ══════════════════════════════════════════════════════════════════ */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <img
              src={logoImg}
              alt=""
              className="w-[580px] h-auto object-contain opacity-[0.06] grayscale contrast-125 translate-y-8"
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
                  className="h-20 w-auto object-contain drop-shadow-sm"
                />
                <h2 className="text-[#0f5431] font-black uppercase tracking-[0.12em] text-[18px] text-center leading-tight font-sans">
                  CÁMARA INMOBILIARIA<br />DE BOLÍVAR
                </h2>
              </div>

              {/* Otorgamiento */}
              <p
                className="text-slate-800 font-extrabold uppercase text-[12.5px] tracking-[0.22em] mt-6 font-sans"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                La Cámara Inmobiliaria del estado Bolívar<br />otorga el siguiente reconocimiento a:
              </p>
            </div>

            {/* ── SECCIÓN CENTRAL: NOMBRE DEL DESTINATARIO ── */}
            <div className="w-full flex flex-col items-center my-auto max-w-[820px]">
              {/* Nombre en Fuente Caligráfica Cursiva */}
              <div className="relative w-full flex items-center justify-center py-2">
                <div className="absolute left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-slate-400 to-transparent bottom-0" />
                <span
                  className="text-[68px] sm:text-[76px] text-slate-900 text-center leading-tight tracking-wide px-8 select-all"
                  style={{
                    fontFamily: "'Great Vibes', 'Alex Brush', cursive",
                    textShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  }}
                >
                  {titularNombre}
                </span>
              </div>

              {/* Cédula si está disponible */}
              {cedula && (
                <p className="text-slate-600 font-bold text-[11px] tracking-widest font-mono mt-1">
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

            {/* ── SECCIÓN INFERIOR: 5 FIRMAS Y FECHA ABAJO ── */}
            <div className="w-full flex flex-col items-center gap-2 px-4 pb-3">
              {/* 5 Firmas (Arriba) */}
              <div className="w-full grid grid-cols-5 gap-1 items-end px-2">
                {[1, 2, 3, 4, 5].map((firmaNum) => (
                  <div key={`firma-slot-${firmaNum}`} className="flex flex-col items-center justify-center text-center">
                    <div className="relative h-11 w-32 flex items-center justify-center">
                      <img
                        src={firmaFranciscoImg}
                        className="absolute bottom-[-4px] h-16 w-auto object-contain select-none pointer-events-none"
                        alt="Firma Francisco Piñango"
                      />
                    </div>
                    <div className="w-32 h-[1px] bg-slate-800 mb-1" />
                    <span className="text-[9px] font-black text-slate-800 uppercase tracking-wider font-sans leading-tight">
                      FRANCISCO PIÑANGO
                    </span>
                    <span className="text-[6.5px] font-bold text-slate-500 uppercase tracking-wider font-sans mt-0.5 text-center leading-tight max-w-[130px]">
                      PRESIDENTE DE LA CAMARA
                      <br />
                      INMOBILIARIA DE BOLIVAR
                    </span>
                  </div>
                ))}
              </div>

              {/* Fecha de Emisión (Abajo de las firmas) */}
              <span className="text-[11px] font-black text-[#0f2e59] uppercase tracking-wider font-sans mt-3">
                {formatFecha(fechaEmisionIso).toUpperCase()}
              </span>
            </div>

          </div>
        </article>
      </div>
    </div>
  )
}

export default CertificadoCursoView
