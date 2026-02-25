import React, { useState, useEffect } from "react";
import bgBolivar from "../../features/landing/assets/Camara_Metropolitana.jpg";
import Navbar2 from "../../features/landing/Components/Navbar_sc";
import actaPDF from './acta.pdf';

const useScrollReveal = () => {
  const [ref, setRef] = useState(null);
  useEffect(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) entry.target.classList.add("active"); },
      { threshold: 0.1 }
    );
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref]);
  return setRef;
};

export default function CodigoEtica() {
  const setReveal = useScrollReveal();

  const principios = [
    { t: "Integridad", d: "Actuar con rectitud y honradez en cada asesoría inmobiliaria.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04k" },
    { t: "Secreto Profesional", d: "Garantizar la confidencialidad de la información de nuestros clientes.", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
    { t: "Colegialidad", d: "Fomentar el respeto y la colaboración entre los profesionales del gremio.", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
    { t: "Transparencia", d: "Publicidad veraz y operaciones claras, sin vicios ni ocultamientos.", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" }
  ];

  return (
    <div className="min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30">
      <Navbar2 />

      <header
        className="relative px-6 lg:px-20 py-20 flex items-center justify-center min-h-[40vh] bg-cover animate-header-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.9), rgba(2, 44, 34, 0.9)), url(${bgBolivar})`,
          backgroundAttachment: "fixed",
        }}
      >
        <div className="text-center space-y-4">
          <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs animate-header-text" style={{ animationDelay: "0.2s", opacity: 0 }}>Normativa Profesional</p>
          <h1 className="text-5xl lg:text-7xl font-black tracking-tighter animate-header-text" style={{ animationDelay: "0.4s", opacity: 0 }}>
            Código de <span className="text-emerald-500 italic">Ética</span>
          </h1>
        </div>
      </header>

      <main className="bg-white text-slate-900 rounded-t-[4rem] -mt-12 relative z-10 px-6 lg:px-20 py-24">
        <div className="max-w-6xl mx-auto">

          <div className="grid lg:grid-cols-2 gap-16 items-center mb-24">
            <div ref={setReveal} className="reveal-on-scroll space-y-6">
              <h2 className="text-4xl font-black text-[#022c22] leading-none uppercase">La base de nuestra confianza</h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                El Código de Ética de la Cámara Inmobiliaria de Venezuela (CIV) no es solo un reglamento, es la garantía de que cada operación realizada a través de nuestros afiliados cuenta con el respaldo de los más altos valores profesionales.
              </p>
              <div className="p-6 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-2xl italic text-emerald-900">
                "Ser un profesional inmobiliario de la Cámara es sinónimo de seguridad jurídica y transparencia."
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {principios.map((p, i) => (
                <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-emerald-500 transition-colors group">
                  <svg className="w-8 h-8 text-emerald-600 mb-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={p.icon} />
                  </svg>
                  <h4 className="font-black text-[#022c22] uppercase text-sm mb-2">{p.t}</h4>
                  <p className="text-xs text-slate-500 leading-snug">{p.d}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#022c22] rounded-[3rem] p-8 lg:p-16 text-center text-white overflow-hidden relative">
            <div className="relative z-10 space-y-8">
              <h3 className="text-3xl font-black italic">¿Deseas leer el documento completo?</h3>
              <p className="text-emerald-100/70 max-w-2xl mx-auto">
                Ponemos a disposición de nuestros afiliados y el público general el texto íntegro que rige el ejercicio inmobiliario en Venezuela.
              </p>
              <a
                href={actaPDF}
                download="Acta_Oficial.pdf" // 3. Forzar descarga con un nombre bonito
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-10 py-5 bg-emerald-500 text-[#022c22] rounded-full font-black uppercase text-xs tracking-[0.2em] hover:bg-emerald-400 transition-all shadow-2xl shadow-emerald-500/20 active:scale-95"
              >
                Descargar PDF Oficial
              </a>
            </div>
          </div>

        </div>
      </main>

      <footer className="bg-[#011a14] px-6 lg:px-20 py-12 text-center">
        <p className="text-gray-600 text-[10px] uppercase tracking-[0.2em]">© 2026 Cámara Inmobiliaria del Estado Bolívar</p>
      </footer>
    </div>
  );
}