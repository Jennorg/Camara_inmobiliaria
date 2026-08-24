import React, { useState, useRef, useCallback } from 'react'
import logoImg from '@/assets/Logo2.webp'
import firmaFranciscoImg from '@/assets/firma-francisco.webp'
import firmaGracielaImg from '@/assets/firma-graciela-ledezma.webp'

export interface CertificadoProgramaViewProps {
  codigo: string
  fechaEmisionIso: string
  titularNombre: string
  programaOCurso: string
  programaCodigo: string // 'CIBIR' | 'PEGI' | 'PREANI' | 'PADI'
  urlVerificacion: string
  vigente: boolean
  cedula?: string | null
}

const PROGRAM_INFO: Record<string, { abbr: string; title: string }> = {
  CIBIR: { abbr: 'CIBIR', title: 'CURSO INTRODUCTORIO\nA LOS BIENES RAÍCES' },
  PEGI: { abbr: 'PEGI', title: 'PROGRAMA DE ESPECIALIZACIÓN\nEN GERENCIA INMOBILIARIA' },
  PREANI: { abbr: 'PREANI', title: 'PROGRAMA DE ESTUDIOS AVANZADOS\nEN NEGOCIOS INMOBILIARIOS' },
  PADI: { abbr: 'PADI', title: 'PROGRAMA AVANZADO\nEN DESARROLLO INMOBILIARIO' },
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

const CertificadoProgramaView: React.FC<CertificadoProgramaViewProps> = ({
  codigo,
  fechaEmisionIso,
  titularNombre,
  programaOCurso,
  programaCodigo,
  urlVerificacion,
  vigente,
  cedula,
}) => {
  const info = PROGRAM_INFO[programaCodigo.toUpperCase()] || {
    abbr: programaCodigo,
    title: programaOCurso.toUpperCase(),
  }

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(urlVerificacion)}`

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

  return (
    <div className="w-full relative">
      <div ref={trackerRef} className="absolute inset-x-0 top-0 h-0 pointer-events-none" />
      <div
        className="w-full flex justify-center items-start overflow-hidden print:!h-auto print:!overflow-visible"
        style={{ height: scale < 1 ? `${707 * scale}px` : 'auto' }}
      >
        <article
          id="certificate-print-area"
          className="print-full-page relative bg-white border border-slate-200 w-[1000px] h-[707px] rounded-3xl shadow-2xl overflow-hidden select-none print:!transform-none shrink-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: scale < 1 ? `scale(${scale})` : 'none',
            transformOrigin: 'top center',
          }}
        >
          {/* ── BORDES DECORATIVOS ── */}
          {/* Borde negro fino perimetral */}
          <div className="absolute inset-6 border border-slate-800/80 pointer-events-none rounded-none" />

          {/* ── ESQUINA SUPERIOR IZQUIERDA: CÍRCULO CON LA LLAVE ── */}
          <div className="absolute top-[-15px] left-[-15px] z-20 pointer-events-none">
            <div className="relative w-44 h-44 overflow-hidden rounded-full border-[6px] border-[#cf9f2d] shadow-md bg-white">
              <img
                src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=300&auto=format&fit=crop"
                alt="Llaves"
                className="w-full h-full object-cover object-center"
              />
            </div>
          </div>

          {/* =========================================
              ESQUINA SUPERIOR DERECHA (NUEVOS POLÍGONOS)
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
              ESQUINA INFERIOR DERECHA (NUEVOS POLÍGONOS)
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
              ESQUINA INFERIOR IZQUIERDA (NUEVOS POLÍGONOS)
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

          {/* ── SEPARADOR HEADER ── */}
          <div className="absolute top-[155px] left-[161px] right-[24px] border-b border-slate-800/80 pointer-events-none" />

          {/* ── CONTENIDO DEL CERTIFICADO ── */}
          {/* Header Left: Logo Cámara */}
          <div className="absolute top-[25
          px] left-[190px] w-[280px] h-[140px] flex items-center justify-center z-10">
            <img src={logoImg} className="h-[128px] w-auto object-contain drop-shadow-sm" alt="Logo CIEBO" />
          </div>

          {/* Header Right: Info del Programa (CIBIR) */}
          <div className="absolute top-[32px] right-[110px] w-[280px] h-[110px] flex flex-col items-center justify-center font-sans z-10">
            <h1 className="text-[#0f5431] font-black uppercase text-[42px] tracking-wider leading-none mb-1">
              {info.abbr}
            </h1>
            <div className="w-full border-y border-[#0f5431]/60 py-1 px-2">
              <p className="text-[#0f5431] font-extrabold text-[8.5px] tracking-wider uppercase leading-tight text-center">
                {info.title.split('\n').map((line, idx) => (
                  <React.Fragment key={`${line}-${idx}`}>
                    {line}
                    {idx < info.title.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            </div>
          </div>

          {/* Cuerpo Central */}
          {/* Título de la Cámara */}
          <div className="absolute top-[180px] left-[24px] right-[24px] flex flex-col items-center text-center font-sans z-10">
            <h2 className="text-[#0f5431] font-black tracking-[0.12em] text-[28px] uppercase leading-[1.25]">
              CAMARA INMOBILIARIA DEL
              <br />
              ESTADO BOLIVAR
            </h2>
          </div>

          {/* Otorgamiento */}
          <div className="absolute top-[265px] left-[24px] right-[24px] flex flex-col items-center text-center z-10">
            <p className="text-[#0f2e59] font-black text-[12px] tracking-[0.2em] uppercase">
              OTORGA EL PRESENTE CERTIFICADO A:
            </p>
          </div>

          {/* Nombre del Alumno con su Línea */}
          <div className="absolute top-[305px] left-[150px] right-[150px] flex flex-col items-center z-10">
            <div className="w-full border-b border-slate-700/80 pb-1 flex flex-col items-center min-h-[55px] justify-end">
              <span
                className="text-4xl font-extrabold text-slate-900 px-4 text-center leading-none italic"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {titularNombre}
              </span>
            </div>
          </div>

          {/* Cédula del Alumno */}
          {cedula && (
            <div className="absolute top-[368px] left-[24px] right-[24px] flex flex-col items-center text-center z-10">
              <p className="text-[#0f2e59] font-bold text-xs tracking-widest font-mono">
                C.I.: {cedula.replace(/\D/g, '').length >= 5 ? Number(cedula.replace(/\D/g, '')).toLocaleString('es-VE') : cedula}
              </p>
            </div>
          )}

          {/* Descripción de Aprobación */}
          <div className="absolute top-[405px] left-[100px] right-[100px] flex flex-col items-center text-center font-sans z-10">
            <p className="text-[#0f2e59] font-black text-[13px] tracking-[0.1em] uppercase leading-relaxed max-w-[650px]">
              {programaCodigo.toUpperCase() === 'CIBIR' ? (
                <>
                  POR HABER PARTICIPADO EN EL CURSO CURSO INTRODUCTORIO A LOS
                  <br />
                  BIENES RAÍCES
                </>
              ) : (
                `POR HABER PARTICIPADO EN EL ${programaOCurso.toUpperCase()}`
              )}
            </p>
          </div>

          {/* Pie de Página: Firmas, QR y Fecha */}
          <div className="absolute bottom-[50px] left-[24px] right-[24px] h-[160px] grid grid-cols-3 items-end px-12 z-10">
            {/* Firma Izquierda: Francisco Piñango */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-48 h-16 flex items-center justify-center">
                <img
                  src={firmaFranciscoImg}
                  className="absolute bottom-[-8px] h-28 w-auto object-contain select-none pointer-events-none"
                  alt="Firma Francisco Piñango"
                />
              </div>
              <div className="w-48 h-[1px] bg-slate-800 mb-1.5" />
              <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider font-sans">
                FRANCISCO PIÑANGO
              </span>
              <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider font-sans mt-0.5 text-center leading-normal">
                PRESIDENTE DE LA CAMARA
                <br />
                INMOBILIARIA DEL ESTADO BOLIVAR
              </span>
            </div>

            {/* Centro: QR y Fecha de Emisión */}
            <div className="flex flex-col items-center justify-center pb-1">
              <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-200/50 mb-2">
                <img
                  src={qrApiUrl}
                  className="h-[76px] w-[76px] object-contain"
                  alt="Código QR de Verificación"
                />
              </div>
              <span className="text-[11px] font-black text-[#0f2e59] uppercase tracking-wider font-sans">
                {formatFecha(fechaEmisionIso).toUpperCase()}
              </span>
            </div>

            {/* Firma Derecha: Graciela Ledezma */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-48 h-16 flex items-center justify-center">
                <img
                  src={firmaGracielaImg}
                  className="absolute bottom-[-2px] h-[72px] w-auto object-contain select-none pointer-events-none"
                  alt="Firma Graciela Ledezma"
                />
              </div>
              <div className="w-48 h-[1px] bg-slate-800 mb-1.5" />
              <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider font-sans">
                GRACIELA LEDEZMA
              </span>
              <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider font-sans mt-0.5 text-center leading-normal">
                DIRECTORA DE FORMACIÓN
              </span>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}

export default CertificadoProgramaView
