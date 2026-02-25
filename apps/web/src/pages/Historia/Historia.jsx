import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import bgBolivar from "../../features/landing/assets/Camara_Metropolitana.jpg";
import Navbar2 from "../../features/landing/Components/Navbar_sc";

// Hook de revelado (mismo que usas en las otras pestañas)
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

const HitoHistoria = ({ año, titulo, descripcion, index }) => {
  const setReveal = useScrollReveal();
  const isEven = index % 2 === 0;

  return (
    <div
      ref={setReveal}
      className="reveal-on-scroll relative mb-12 md:mb-24 flex flex-col md:flex-row items-center"
    >
      {/* Círculo central en la línea de tiempo */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex w-10 h-10 rounded-full bg-emerald-500 border-4 border-white z-20 shadow-lg shadow-emerald-900/20" />

      {/* Contenido */}
      <div className={`w-full md:w-1/2 ${isEven ? 'md:pr-16 md:text-right' : 'md:pl-16 md:order-last text-left'}`}>
        <span className="text-emerald-500 font-black text-4xl md:text-5xl tracking-tighter block mb-2">
          {año}
        </span>
        <h3 className="text-2xl font-black text-[#022c22] mb-4 uppercase tracking-tight">
          {titulo}
        </h3>
        <p className="text-slate-600 leading-relaxed text-lg italic">
          {descripcion}
        </p>
      </div>

      {/* Espaciador para el lado opuesto */}
      <div className="hidden md:block md:w-1/2" />
    </div>
  );
};

export default function Historia() {
  const navigate = useNavigate();

  const hitos = [
    {
      año: "1994",
      titulo: "Fundación",
      descripcion: "Nace la Cámara Inmobiliaria del Estado Bolívar con la visión de profesionalizar el sector en la región."
    },
    {
      año: "2005",
      titulo: "Crecimiento Gremial",
      descripcion: "Se alcanzan los primeros 100 afiliados activos, fortaleciendo la presencia en Puerto Ordaz y Ciudad Bolívar."
    },
    {
      año: "2015",
      titulo: "Innovación Digital",
      descripcion: "Implementación de los primeros sistemas de formación online para corredores inmobiliarios de la zona."
    },
    {
      año: "2024",
      titulo: "Nueva Gestión",
      descripcion: "Inicio del periodo 2024-2026 enfocado en la vanguardia, sostenibilidad y alianzas estratégicas."
    }
  ];

  return (
    <div className="min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30 scroll-smooth">
      <Navbar2 />

      {/* --- HEADER ANIMADO --- */}
      <header
        className="relative px-6 lg:px-20 py-16 lg:py-24 flex items-center justify-center min-h-[45vh] bg-cover animate-header-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.88), rgba(2, 44, 34, 0.88)), url(${bgBolivar})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="text-center space-y-4">
          <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs animate-header-text" style={{ animationDelay: "0.2s", opacity: 0 }}>
            Nuestra Trayectoria
          </p>
          <h1 className="text-5xl lg:text-7xl font-black tracking-tighter animate-header-text" style={{ animationDelay: "0.4s", opacity: 0 }}>
            Décadas de <span className="text-emerald-500 italic">Historia</span>
          </h1>
          <div className="w-20 h-1 bg-emerald-500 mx-auto mt-6 animate-header-text" style={{ animationDelay: "0.6s", opacity: 0 }} />
        </div>
      </header>

      {/* --- CUERPO DE LA HISTORIA --- */}
      <main className="bg-white text-slate-900 rounded-t-[4rem] -mt-12 relative z-10 px-6 lg:px-20 py-24">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-20 space-y-4">
            <h2 className="text-3xl font-black text-[#022c22] uppercase tracking-tight">Un legado en movimiento</h2>
            <p className="max-w-2xl mx-auto text-slate-500">
              Desde nuestros inicios, hemos trabajado para ser el pilar del desarrollo inmobiliario en el sur de Venezuela.
            </p>
          </div>

          {/* LÍNEA DE TIEMPO */}
          <div className="relative">
            {/* Línea vertical central (solo desktop) */}
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-slate-100 hidden md:block" />

            {hitos.map((hito, index) => (
              <HitoHistoria
                key={index}
                index={index}
                año={hito.año}
                titulo={hito.titulo}
                descripcion={hito.descripcion}
              />
            ))}
          </div>

          {/* --- BANNER FINAL --- */}
          <div className="mt-20 p-12 rounded-[3rem] bg-slate-50 border border-emerald-100 text-center space-y-6">
            <h3 className="text-2xl font-black text-[#022c22]">¿Quieres ser parte de nuestra historia futura?</h3>
            <button
              onClick={() => navigate('/contacto')}
              className="px-10 py-4 bg-[#022c22] text-emerald-400 rounded-full font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-xl shadow-emerald-900/10"
            >
              Afíliate hoy mismo
            </button>
          </div>
        </div>
      </main>

      {/* --- FOOTER --- */}
      <footer className="bg-[#011a14] px-6 lg:px-20 py-12 text-center border-t border-white/5">
        <p className="text-gray-600 text-[10px] uppercase tracking-[0.2em]">
          © 2026 Cámara Inmobiliaria del Estado Bolívar • RIF J-30462520-0
        </p>
      </footer>
    </div>
  );
}