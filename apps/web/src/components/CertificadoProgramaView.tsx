import React, { useState, useRef, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'
import logoImg from '@/assets/logo_ciebo_green.svg'
import { formatNombreCard } from '@/utils/formatters'
import cibirBg from '@/assets/Cibir.webp'
import pegiBg from '@/assets/Pegi.webp'
import preaniBg from '@/assets/Preani.webp'
import padiBg from '@/assets/Padi.webp'

export interface Firmante {
  id?: string | number
  nombre: string
  cargo: string
  firma_url?: string | null
  mostrar_firma?: boolean
}

export interface CertificadoProgramaViewProps {
  codigo: string
  fechaEmisionIso: string
  titularNombre: string
  programaOCurso: string
  programaCodigo: string // 'CIBIR' | 'PEGI' | 'PREANI' | 'PADI'
  urlVerificacion: string
  qrDataUrl?: string
  vigente: boolean
  cedula?: string | null
  firmantes?: Firmante[]
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
  qrDataUrl,
  vigente,
  cedula,
  firmantes,
}) => {
  const info = PROGRAM_INFO[programaCodigo.toUpperCase()] || {
    abbr: programaCodigo,
    title: programaOCurso.toUpperCase(),
  }

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
            backgroundColor: '#ffffff',
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
              {(() => {
                const pCode = (programaCodigo || '').toUpperCase();
                let badge = cibirBg;
                if (pCode === 'PEGI') badge = pegiBg;
                else if (pCode === 'PREANI') badge = preaniBg;
                else if (pCode === 'PADI') badge = padiBg;
                return (
                  <img
                    src={badge}
                    alt={pCode || 'CIBIR'}
                    className="w-full h-full object-cover object-center"
                  />
                );
              })()}
            </div>
          </div>

          {/* ── POLÍGONOS DECORATIVOS ESQUINAS (SVG NATIVO 100% FIEL Y NÍTIDO) ── */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 1000 707" fill="none">
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
              MARCA DE AGUA CENTRAL
          ══════════════════════════════════════════════════════════════════ */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <img
              src={logoImg}
              alt=""
              className="w-[640px] h-auto object-contain opacity-[0.08] grayscale-0 translate-y-6"
            />
          </div>

          {/* ── SEPARADOR HEADER ── */}
          <div className="absolute top-[155px] left-[161px] right-[24px] border-b border-slate-800/80 pointer-events-none" />

          {/* ── CONTENIDO DEL CERTIFICADO ── */}
          {/* Header Left: Logo Cámara (Centrado verticalmente entre la línea perimetral superior y=24 y la divisoria y=155) */}
          <div className="absolute top-[24px] left-[180px] w-[280px] h-[131px] flex items-center justify-center z-10">
            <img src={logoImg} className="max-h-[105px] max-w-[270px] w-auto h-auto object-contain drop-shadow-sm" alt="Logo CIEBO" />
          </div>

          {/* Header Right: Info del Programa (CIBIR) */}
          <div className="absolute top-[32px] right-[150px] w-[280px] h-[110px] flex flex-col items-center justify-center font-sans z-10">
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
            <h2 className="text-[#0f5431] font-black tracking-[0.10em] text-[26px] uppercase leading-tight">
              <span className="block whitespace-nowrap">CÁMARA INMOBILIARIA</span>
              <span className="block whitespace-nowrap">DE BOLÍVAR</span>
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
              {(() => {
                const nombreMostrado = formatNombreCard(titularNombre) || titularNombre;
                return (
                  <span
                    className="font-extrabold text-slate-900 px-4 text-center leading-none italic"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: (() => {
                        const len = (nombreMostrado || '').length;
                        if (len > 34) return '1.65rem';
                        if (len > 26) return '1.9rem';
                        return '2.25rem';
                      })(),
                    }}
                  >
                    {nombreMostrado}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Cédula del Alumno */}
          {cedula && (
            <div className="absolute top-[368px] left-[24px] right-[24px] flex flex-col items-center text-center z-10">
              <p className="text-[#0f2e59] font-black text-[14px] tracking-widest font-mono">
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
          {(() => {
            const activeFirmantes = (firmantes && firmantes.length > 0) ? [...firmantes] : [];

            const leftFirmante = activeFirmantes[0] || {
              nombre: 'FRANCISCO PIÑANGO',
              cargo: 'PRESIDENTE DE LA CÁMARA INMOBILIARIA DEL ESTADO BOLÍVAR',
              firma_url: null,
              mostrar_firma: true
            };

            const rightFirmante = (activeFirmantes.length > 1 ? activeFirmantes[1] : null) || {
              nombre: 'GRACIELA LEDEZMA',
              cargo: 'DIRECTORA DE FORMACIÓN',
              firma_url: null,
              mostrar_firma: true
            };

            const getFirmaImage = (f: Firmante) => {
              if (!f) return null;
              if (f.firma_url) return f.firma_url;
              return null;
            };

            const formatCargo = (cargoStr?: string) => {
              const str = (cargoStr || '').toString().trim();
              const upper = str.toUpperCase();
              if (
                (upper.includes('PRESIDENTE') || upper.includes('VICEPRESIDENTE')) &&
                !upper.includes('CAMARA INMOBILIARIA') &&
                !upper.includes('DEL ESTADO BOLIVAR') &&
                !upper.includes('DE BOLIVAR')
              ) {
                return `${str} DE LA CÁMARA INMOBILIARIA DEL ESTADO BOLÍVAR`;
              }
              return str;
            };

            return (
              <div className="absolute bottom-[50px] left-[24px] right-[24px] grid grid-cols-3 items-start px-12 z-10">
                {/* Firma Izquierda */}
                <div className="flex flex-col items-center justify-start text-center">
                  <div className="relative w-48 h-16 flex items-end justify-center">
                    {leftFirmante.mostrar_firma !== false && getFirmaImage(leftFirmante) ? (
                      <img
                        src={getFirmaImage(leftFirmante)!}
                        crossOrigin="anonymous"
                        className="max-h-20 max-w-[170px] w-auto h-auto object-contain select-none pointer-events-none drop-shadow-xs"
                        alt={`Firma ${leftFirmante.nombre}`}
                      />
                    ) : null}
                  </div>
                  <div className="w-48 h-[1px] bg-slate-800 mb-1.5 shrink-0" />
                  <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider font-sans text-center whitespace-nowrap">
                    {leftFirmante.nombre}
                  </span>
                  <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider font-sans mt-1 text-center leading-normal max-w-[200px]">
                    {formatCargo(leftFirmante.cargo)}
                  </span>
                </div>

                {/* Centro: QR y Fecha de Emisión */}
                <div className="flex flex-col items-center justify-center pt-2">
                  <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-200/50 mb-2">
                    <img
                      src={qrApiUrl}
                      className="h-[76px] w-[76px] object-contain"
                      alt="Código QR de Verificación"
                    />
                  </div>
                  <span className="text-[11px] font-black text-[#0f2e59] uppercase tracking-wider font-sans whitespace-nowrap">
                    {formatFecha(fechaEmisionIso).toUpperCase()}
                  </span>
                </div>

                {/* Firma Derecha */}
                <div className="flex flex-col items-center justify-start text-center">
                  {rightFirmante ? (
                    <>
                      <div className="relative w-48 h-16 flex items-end justify-center">
                        {rightFirmante.mostrar_firma !== false && getFirmaImage(rightFirmante) ? (
                          <img
                            src={getFirmaImage(rightFirmante)!}
                            crossOrigin="anonymous"
                            className="max-h-20 max-w-[170px] w-auto h-auto object-contain select-none pointer-events-none drop-shadow-xs"
                            alt={`Firma ${rightFirmante.nombre}`}
                          />
                        ) : null}
                      </div>
                      <div className="w-48 h-[1px] bg-slate-800 mb-1.5 shrink-0" />
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider font-sans text-center whitespace-nowrap">
                        {rightFirmante.nombre}
                      </span>
                      <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider font-sans mt-1 text-center leading-normal max-w-[200px]">
                        {formatCargo(rightFirmante.cargo)}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })()}
        </article>
      </div>
    </div>
  )
}

export default CertificadoProgramaView
