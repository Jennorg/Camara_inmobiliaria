import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import bgBolivar from "@/assets/Pzo.jpg";
import Navbar2 from "@/pages/landing/components/Navbar_sc";
import Footer from '@/pages/landing/components/Footer'

const CONVENIOS_INTERNACIONALES = [
  {
    id: 1,
    nombre: "NAR - National Association of Realtors",
    pais: "Estados Unidos",
    categoria: "Gremial",
    logo: null,
  },
  {
    id: 2,
    nombre: "FIABCI - Federación Internacional",
    pais: "Global",
    categoria: "Inmobiliaria",
    logo: null,
  },
  {
    id: 3,
    nombre: "CILA - Confederación Inmobiliaria",
    pais: "Latinoamérica",
    categoria: "Gremial",
    logo: null,
  },
  {
    id: 4,
    nombre: "REALTOR® Global",
    pais: "Internacional",
    categoria: "Certificación",
    logo: null,
  },
];

export default function Internacionales() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30">
      <Navbar2 />

      <header
        className="relative px-6 lg:px-20 py-16 lg:py-24 flex items-center justify-center min-h-[40vh] bg-cover"
        style={{
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.85), rgba(2, 44, 34, 0.85)), url(${bgBolivar})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="text-center space-y-3 md:space-y-4">
          <p className="text-emerald-400 font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] text-[10px] md:text-xs">
            Alianzas Globales
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter drop-shadow-lg">
            Convenios{" "}
            <span className="text-emerald-400 italic">Internacionales</span>
          </h1>
          <p className="text-emerald-100/80 text-xs md:text-sm tracking-widest uppercase font-medium">
            Conectando con el mercado inmobiliario mundial
          </p>
        </div>
      </header>

      <main className="bg-slate-50 text-slate-900 rounded-t-[2.5rem] md:rounded-t-[4rem] -mt-8 md:-mt-12 relative z-10 px-4 sm:px-6 lg:px-24 py-12 md:py-20 min-h-[60vh] shadow-2xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-t-4 border-b-4 border-emerald-600"></div>
            <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest animate-pulse">
              Buscando alianzas internacionales...
            </p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 md:gap-8">
              {CONVENIOS_INTERNACIONALES.map((item) => (
                <div
                  key={item.id}
                  className="group relative bg-white rounded-[1.5rem] md:rounded-[2rem] p-4 sm:p-6 md:p-8 flex flex-col h-full border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-900/10 hover:-translate-y-1 md:hover:-translate-y-2 transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 md:h-1.5 bg-gradient-to-r from-emerald-400 to-[#022c22] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="flex justify-center md:justify-start mb-4 md:mb-6">
                    <span className="inline-block px-2 py-1 md:px-3 bg-slate-100 text-slate-600 text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] rounded-full border border-slate-200 truncate">
                      {item.pais}
                    </span>
                  </div>

                  <div className="flex flex-col items-center flex-grow justify-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-24 md:h-24 rounded-full bg-slate-50 border-2 border-slate-100 flex items-center justify-center overflow-hidden mb-3 md:mb-5 group-hover:bg-white group-hover:border-emerald-100 transition-all duration-500 shadow-inner">
                      {item.logo ? (
                        <img
                          src={item.logo}
                          alt={item.nombre}
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <span className="text-xl md:text-3xl font-black text-slate-300 group-hover:text-emerald-500 transition-colors">
                          {item.nombre.charAt(0)}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs sm:text-sm md:text-lg font-bold text-slate-800 tracking-tight text-center group-hover:text-[#022c22] transition-colors leading-snug">
                      {item.nombre}
                    </h3>
                    <p className="text-[10px] md:text-xs text-emerald-600 font-bold mt-2 uppercase tracking-tighter">
                      {item.categoria}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-20 md:mt-32 bg-gradient-to-br from-[#022c22] to-[#011a14] rounded-[2rem] md:rounded-[3rem] p-8 md:p-20 text-center text-white relative overflow-hidden shadow-2xl border border-emerald-900/50">
              <div className="absolute top-0 right-0 w-64 h-64 md:w-80 md:h-80 bg-emerald-500/10 rounded-full -mr-20 -mt-20 blur-2xl md:blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 md:w-64 md:h-64 bg-emerald-700/10 rounded-full -ml-20 -mb-20 blur-2xl md:blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl mx-auto space-y-6 md:space-y-8">
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-tight">
                  ¿Buscas expandir tu <br />
                  <span className="text-emerald-400 italic">
                    alcance internacional?
                  </span>
                </h2>
                <p className="text-emerald-100/70 text-sm md:text-lg leading-relaxed font-medium max-w-xl mx-auto">
                  Si representas a una cámara u organización extranjera,
                  contáctanos para establecer puentes de cooperación con el
                  estado Bolívar.
                </p>
                <div className="pt-4 md:pt-6">
                  <button className="bg-emerald-500 text-[#022c22] w-full sm:w-auto px-10 py-4 md:px-14 md:py-5 rounded-full font-black text-xs md:text-sm uppercase tracking-[0.2em] hover:bg-white hover:scale-105 transition-all duration-300 shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)] active:scale-95">
                    Contactar con nosotros
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
