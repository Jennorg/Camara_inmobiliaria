import React from "react";
import Navbar2 from "../../features/landing/Components/Navbar_sc";

export default function Direccion() {
  const puntosAgenda = [
    "Formalización de la nueva Junta Directiva (2025-2027)",
    "Información sobre situación legal y financiera de CIEBO",
    "Propuesta para la sostenibilidad financiera",
    "Propuesta de un contrato de prestación de servicios",
    "Propuesta del Plan de Gestión 2026",
    "Información sobre el diseño del sistema de gestión y página web"
  ];

  return (
    <div className="min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30">
      <Navbar2 />

      {/* HEADER: Enfoque en el Evento */}
      <header className="px-6 lg:px-20 py-24 bg-gradient-to-b from-[#011a14] to-[#022c22] text-center relative overflow-hidden">
        <div className="absolute top-10 right-10 opacity-10 rotate-12">
          <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" /></svg>
        </div>

        <div className="relative z-10 space-y-4">

          <h1 className="text-5xl lg:text-8xl font-black tracking-tighter leading-none">
            Convocatoria a Asamblea <br />
            <span className="text-emerald-500 italic">Extraordinaria</span>
          </h1>
          <p className="text-emerald-100/60 max-w-2xl mx-auto font-medium pt-4">
            Dando cumplimiento al Documento Constitutivo y Estatutos Sociales (1999),
            se convoca a todos los Afiliados de la Cámara Inmobiliaria del estado Bolívar.
          </p>
        </div>
      </header>
      {/* CONTENIDO PRINCIPAL */}
      <main className="bg-white text-slate-900 rounded-t-[4rem] -mt-12 relative z-10 px-6 lg:px-24 py-20 shadow-xl">
        <div className="max-w-4xl mx-auto space-y-12">

          {/* Encabezado y Contexto Legal */}
          <header className="text-center space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">
              CONVOCATORIA A ASAMBLEA EXTRAORDINARIA
            </h1>
            <p className="text-sm uppercase tracking-widest text-slate-500 font-semibold">
              Cámara Inmobiliaria del estado Bolívar, S.C | RIF: J-30640738-3
            </p>
            <div className="h-1 w-20 bg-blue-600 mx-auto rounded-full"></div>
          </header>

          {/* Cuerpo de la Convocatoria */}
          <section className="leading-relaxed text-slate-700 text-lg">
            <p className="mb-6">
              La Junta Directiva, actuando en plena vigencia de sus funciones para el
              <strong> período 2025-2027</strong> y en cumplimiento de los Estatutos Sociales (1999),
              Título IV, Capítulo I, Artículo 21, convoca oficialmente a sus Afiliados a la
              deliberación de la siguiente agenda:
            </p>

            {/* Agenda / Puntos a tratar */}
            <div className="bg-slate-50 border-l-4 border-blue-500 p-8 my-8 rounded-r-lg shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 uppercase text-sm">Orden del Día:</h3>
              <ul className="space-y-3 list-disc list-inside text-slate-600">
                <li>Formalización de la nueva Junta Directiva CIEBO (2025-2027).</li>
                <li>Información sobre situación legal y financiera.</li>
                <li>Propuesta para la sostenibilidad financiera.</li>
                <li>Propuesta de un contrato de prestación de servicios.</li>
                <li>Presentación del Plan de Gestión 2026.</li>
                <li>Información sobre el nuevo sistema de gestión y página web.</li>
              </ul>
            </div>
          </section>

          {/* Detalles del Evento */}
          <footer className="grid md:grid-cols-2 gap-8 border-t border-slate-100 pt-10">
            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-400 uppercase">¿Cuándo?</p>
              <p className="text-slate-700">
                <strong>18 de febrero de 2026</strong><br />
                Hora: 2:00 P.M.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-400 uppercase">¿Dónde?</p>
              <p className="text-slate-700 italic">
                Sede de la Cámara de la Construcción, Carrera Guri, Nro. 255-03-14,
                Alta Vista, Ciudad Guayana.
              </p>
            </div>
          </footer>

        </div>
      </main>

      <footer className="bg-[#011a14] py-12 text-center">
        <p className="text-gray-600 text-[10px] uppercase tracking-[0.2em]">
          Cámara Inmobiliaria del Estado Bolívar | Ciudad Guayana, 2026
        </p>
      </footer>
    </div>
  );
}