import React from 'react'
import logoImg from '@/assets/Logo2.png'
import firmaFranciscoImg from '@/assets/firma-francisco.png'

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
  CIBIR: { abbr: 'CIBIR', title: 'CURSO INTRODUCTORIO A LOS BIENES RAÍCES' },
  PEGI: { abbr: 'PEGI', title: 'PROGRAMA DE ESPECIALIZACIÓN EN GERENCIA INMOBILIARIA' },
  PREANI: { abbr: 'PREANI', title: 'PROGRAMA DE ESTUDIOS AVANZADOS EN NEGOCIOS INMOBILIARIOS' },
  PADI: { abbr: 'PADI', title: 'PROGRAMA AVANZADO EN DESARROLLO INMOBILIARIO' },
}

function formatFecha(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('es-VE', {
      month: 'long',
      year: 'numeric',
    })
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

  return (
    <article
      id="certificate-print-area"
      className="print-full-page relative bg-white border border-slate-200 w-[1000px] h-[707px] rounded-3xl shadow-2xl overflow-hidden flex flex-col justify-between p-12 select-none"
      style={{
        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.88)), url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* ── BORDES DECORATIVOS ── */}
      {/* Doble borde interno */}
      <div className="absolute inset-4.5 border border-slate-300 pointer-events-none rounded-2xl" />
      <div className="absolute inset-5 border-2 border-emerald-800/20 pointer-events-none rounded-2xl" />

      {/* ── ESQUINA SUPERIOR IZQUIERDA: CÍRCULO CON LA LLAVE ── */}
      <div className="absolute top-[-10px] left-[-10px] z-20 pointer-events-none">
        <div className="relative w-48 h-48 overflow-hidden rounded-full border-[6px] border-amber-500 shadow-lg">
          <img
            src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=300&auto=format&fit=crop"
            alt="Llaves"
            className="w-full h-full object-cover scale-110 -translate-y-2"
          />
        </div>
      </div>

      {/* ── ESQUINA SUPERIOR DERECHA: GEOMETRÍA VERDE/AMARILLA ── */}
      <div
        className="absolute top-0 right-0 w-[30%] h-[20%] opacity-95 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(225deg, #022c22 35%, #047857 60%, #eab308 90%, transparent 90%)',
          clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
        }}
      />
      <div
        className="absolute top-0 right-0 w-[32%] h-[22%] opacity-20 pointer-events-none"
        style={{
          background: 'linear-gradient(225deg, #eab308 50%, transparent 50%)',
          clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
        }}
      />

      {/* ── ESQUINA INFERIOR IZQUIERDA: GEOMETRÍA VERDE OSCURO/DORADO ── */}
      <div
        className="absolute bottom-0 left-0 w-[25%] h-[22%] opacity-95 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(45deg, #022c22 45%, #047857 70%, #eab308 90%, transparent 90%)',
          clipPath: 'polygon(0 100%, 0 0, 100% 100%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-[27%] h-[24%] opacity-25 pointer-events-none"
        style={{
          background: 'linear-gradient(45deg, #eab308 50%, transparent 50%)',
          clipPath: 'polygon(0 100%, 0 0, 100% 100%)',
        }}
      />

      {/* ── ESQUINA INFERIOR DERECHA: GEOMETRÍA VERDE Y DORADA ── */}
      <div
        className="absolute bottom-0 right-0 w-[25%] h-[22%] opacity-95 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(315deg, #022c22 45%, #047857 70%, #eab308 90%, transparent 90%)',
          clipPath: 'polygon(100% 100%, 100% 0, 0 100%)',
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-[27%] h-[24%] opacity-25 pointer-events-none"
        style={{
          background: 'linear-gradient(315deg, #eab308 50%, transparent 50%)',
          clipPath: 'polygon(100% 100%, 100% 0, 0 100%)',
        }}
      />

      {/* ── CONTENIDO DEL CERTIFICADO ── */}
      {/* Header: Logo CIEBO e Info del Programa */}
      <div className="relative z-10 flex items-center justify-between mt-4 pl-44 pr-36">
        {/* Logo Cámara */}
        <div className="flex items-center">
          <img src={logoImg} className="h-34 w-auto drop-shadow-sm" alt="Logo CIEBO" />
        </div>

        {/* Info del Programa (CIBIR / PEGI / etc.) */}
        <div className="text-right max-w-[280px]">
          <h1 className="text-emerald-900 font-black uppercase text-4xl tracking-tighter leading-none font-sans">
            {info.abbr}
          </h1>
          <div className="h-[2px] bg-amber-500 w-full my-1.5" />
          <p className="text-emerald-950 font-black text-[9px] tracking-wide uppercase leading-tight font-sans">
            {info.title}
          </p>
        </div>
      </div>

      {/* Cuerpo Central */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto px-16">
        <h2 className="text-emerald-900 font-extrabold tracking-widest text-[16px] uppercase font-sans">
          Cámara Inmobiliaria del Estado Bolívar
        </h2>
        <p className="text-slate-600 font-semibold text-[10px] tracking-widest uppercase mt-1.5 font-sans">
          Otorga el presente certificado a:
        </p>

        {/* Nombre del Alumno */}
        <h1 className="text-emerald-950 font-sans font-extrabold text-5xl my-4 tracking-tight drop-shadow-xs leading-none"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic' }}>
          {titularNombre}
        </h1>

        {/* Cédula del Alumno */}
        {cedula && (
          <p className="text-emerald-900 font-bold text-lg tracking-widest font-mono border-b border-slate-300 pb-1.5 px-10 mb-4 min-w-[220px]">
            C.I.: {cedula.replace(/\D/g, '').length >= 5 ? Number(cedula.replace(/\D/g, '')).toLocaleString('es-VE') : cedula}
          </p>
        )}

        {/* Descripción de Aprobación */}
        <p className="text-emerald-900 font-black text-[11px] tracking-wider uppercase max-w-[700px] leading-relaxed font-sans">
          Por haber participado y aprobado satisfactoriamente los requisitos académicos del
          <br />
          <span className="text-emerald-950 font-extrabold text-xs tracking-widest">
            {programaOCurso.toUpperCase()}
          </span>
        </p>
      </div>

      {/* Pie de Página: Firmas, QR y Fecha */}
      <div className="relative z-10 grid grid-cols-3 items-end w-full px-12 pb-4">
        {/* Firma Izquierda: Francisco Piñango */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-48 h-12 flex items-center justify-center">
            <img
              src={firmaFranciscoImg}
              className="absolute bottom-[-12px] h-28 w-auto object-contain select-none pointer-events-none max-w-none"
              alt="Firma Francisco Piñango"
            />
          </div>
          <div className="w-48 h-[1px] bg-slate-400 mb-1" />
          <span className="text-[9px] font-black text-emerald-950 uppercase tracking-widest font-sans">
            Francisco Piñango
          </span>
          <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider font-sans mt-0.5 text-center leading-none">
            Presidente de la Cámara
            <br />
            Inmobiliaria del Estado Bolívar
          </span>
        </div>

        {/* Centro: QR y Fecha de Emisión */}
        <div className="flex flex-col items-center justify-center pb-2">
          <div className="bg-white p-1.5 rounded-xl shadow-xs border border-slate-200/50 mb-3">
            <img
              src={qrApiUrl}
              className="h-20 w-20 object-contain"
              alt="Código QR de Verificación"
            />
          </div>
          <span className="text-[9px] font-black text-emerald-950 uppercase tracking-widest font-sans">
            {formatFecha(fechaEmisionIso).toUpperCase()}
          </span>
        </div>

        {/* Firma Derecha: Graciela Ledezma */}
        <div className="flex flex-col items-center justify-center">
          <span
            className="text-slate-800 text-[2.5rem] leading-none mb-1 select-none pointer-events-none"
            style={{ fontFamily: "'Alex Brush', cursive" }}
          >
            Graciela Ledezma
          </span>
          <div className="w-48 h-[1px] bg-slate-400 mb-1" />
          <span className="text-[9px] font-black text-emerald-950 uppercase tracking-widest font-sans">
            Graciela Ledezma
          </span>
          <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider font-sans mt-0.5 text-center leading-none">
            Directora de Formación
          </span>
        </div>
      </div>
    </article>
  )
}

export default CertificadoProgramaView
