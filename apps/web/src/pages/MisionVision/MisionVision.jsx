import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../features/landing/assets/Logo.png";
import bgBolivar from "../../features/landing/assets/Camara_Metropolitana.jpg";
import Navbar2 from "../../features/landing/Components/Navbar_sc";

const useScrollReveal = () => {
  const [ref, setRef] = useState(null);

  useEffect(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref]);

  return setRef;
};

export default function MisionVision() {
  const navigate = useNavigate();
  const [darkMode] = useState(true);
  const setRevealMision = useScrollReveal();
  const setRevealVision = useScrollReveal();

  return (
    <div className="min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30 scroll-smooth">

      <Navbar2 />
      {/* --- HERO SECTION --- */}
      <header
        className="relative px-6 lg:px-20 py-16 lg:py-24 flex items-center justify-center min-h-[40vh] bg-cover animate-header-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.85), rgba(2, 44, 34, 0.85)), url(${bgBolivar})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="text-center space-y-4">
          <p
            className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs animate-header-text"
            style={{ animationDelay: "0.2s", opacity: 0 }}
          >
            Propósito Gremial
          </p>
          <h1
            className="text-5xl lg:text-7xl font-black tracking-tighter animate-header-text"
            style={{ animationDelay: "0.4s", opacity: 0 }}
          >
            Nuestra <span className="text-emerald-500 italic">Esencia</span>
          </h1>
          <p
            className="text-emerald-100/60 text-sm tracking-widest uppercase font-medium animate-header-text"
            style={{ animationDelay: "0.5s", opacity: 0 }}
          >
            Valores y Compromiso
          </p>
        </div>
      </header>

      {/* --- CONTENIDO --- */}
      <main className="bg-white text-slate-900 rounded-t-[4rem] -mt-12 relative z-10 px-6 lg:px-20 py-24">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 lg:gap-20">

          {/* SECCIÓN MISIÓN */}
          <div className="group space-y-6 p-8 rounded-[2.5rem] bg-slate-50 border border-emerald-100 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500">
            <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-4xl font-black text-[#022c22] tracking-tight uppercase">Misión</h2>
            <p className="text-lg text-slate-600 leading-relaxed italic">
              "Promover iniciativas para el desarrollo del ramo inmobiliario en el estado Bolívar
              con la participación de los diferentes actores y sectores públicos y privados;
              además de defender los intereses de todos los afiliados y el cumplimiento de sus
              deberes."
            </p>
          </div>

          {/* SECCIÓN VISIÓN */}
          <div className="group space-y-6 p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-sm hover:border-emerald-500 transition-all duration-500">
            <div className="w-14 h-14 bg-[#022c22] text-emerald-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h2 className="text-4xl font-black text-[#022c22] tracking-tight uppercase">Visión</h2>
            <p className="text-lg text-slate-600 leading-relaxed italic">
              "Transformar a la cámara inmobiliaria del estado Bolívar en la institución de
              vanguardia y sostenible que impulsa un desarrollo inmobiliario desde una
              perspectiva enmarcada en principios, valores y profesionalismo; así como en las
              alianzas estratégicas con los sectores públicos y privados."
            </p>
          </div>

        </div>

        {/* --- FOOTER BANNER --- */}
        <div className="max-w-4xl mx-auto mt-20 pt-10 border-t border-slate-100 text-center">
          <p className="text-emerald-600 font-black uppercase tracking-widest text-xs mb-4">
            Comprometidos con Bolívar
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-10 py-4 border-2 border-[#022c22] text-[#022c22] rounded-full font-black uppercase text-xs tracking-widest hover:bg-[#022c22] hover:text-white transition-all"
          >
            Conoce más sobre nosotros
          </button>
        </div>
      </main>

      {/* --- FOOTER INFORMATIVO --- */}
      <footer className="bg-[#011a14] px-6 lg:px-20 py-12 text-center border-t border-white/5">
        <p className="text-gray-600 text-[10px] uppercase tracking-[0.2em]">
          © 2026 Cámara Inmobiliaria del Estado Bolívar • RIF J-30462520-0
        </p>
      </footer>
    </div>
  );
}