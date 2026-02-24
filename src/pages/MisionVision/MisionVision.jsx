import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/Logo.png";
import bgBolivar from "../../assets/Camara_Metropolitana.jpg";

export default function MisionVision() {
  const navigate = useNavigate();
  const [darkMode] = useState(true);

  return (
    <div className="min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30 scroll-smooth">
      {/* --- NAVBAR SIMPLIFICADO --- */}
      <nav className="flex items-center justify-between px-6 py-5 lg:px-20 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 bg-[#011a14]/90">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
          <img src={logo} alt="Logo Cámara" className="h-10 w-auto object-contain" />
          <div className="hidden sm:block leading-tight">
            <p className="text-white font-bold text-sm tracking-widest uppercase">Cámara Inmobiliaria</p>
            <p className="text-emerald-500 text-[10px] font-bold">Estado Bolívar</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-[#022c22] rounded-full text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Inicio
        </button>
      </nav>

      {/* --- HERO SECTION --- */}
      <header
        className="relative px-6 lg:px-20 py-16 lg:py-24 flex items-center justify-center min-h-[40vh] bg-cover"
        style={{
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.85), rgba(2, 44, 34, 0.85)), url(${bgBolivar})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="text-center space-y-4">
          <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs">Propósito Gremial</p>
          <h1 className="text-5xl lg:text-7xl font-black tracking-tighter">
            Nuestra <span className="text-emerald-500 italic">Esencia</span>
          </h1>
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
