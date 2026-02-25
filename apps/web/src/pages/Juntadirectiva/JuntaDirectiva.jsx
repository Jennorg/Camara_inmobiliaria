import React, { useRef, useEffect, useState } from "react"; // IMPORTANTE: Agregamos useState
import { useNavigate } from "react-router-dom";
import logo from "../../features/landing/assets/Logo.png";
import bgBolivar from "../../features/landing/assets/Camara_Metropolitana.jpg";
import Navbar2 from "../../features/landing/Components/Navbar_sc";

// 1. EL HOOK DEBE ESTAR AQUÍ AFUERA
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
      { threshold: 0.1 } // Un poco menos de threshold para que active más fácil
    );
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref]);

  return setRef;
};

// Datos de la directiva
const directiva = [
  { nombre: "Francisco Piñango", cargo: "Presidente", foto: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400&h=400" },
  { nombre: "Zulay Amaya", cargo: "Vice-Presidente", foto: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=400" },
  { nombre: "Margaret Vásquez", cargo: "Directora General", foto: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400&h=400" },
  { nombre: "Romelina Rodríguez", cargo: "Directora de Finanzas", foto: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400&h=400" },
  { nombre: "Margot Castro", cargo: "Directora de Asuntos Legales", foto: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=400&h=400" },
  { nombre: "Pedro Vallenilla", cargo: "Director de Comunicaciones", foto: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400&h=400" },
  { nombre: "Graciela Ledezma", cargo: "Director de Formación", foto: "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&q=80&w=400&h=400" },
  { nombre: "Yorjharry Vicent", cargo: "Director de Eventos", foto: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400&h=400" },
  { nombre: "Rina Centeno", cargo: "Directora de Responsabilidad Social", foto: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400&h=400" },
  { nombre: "Pedro Castro", cargo: "Director de Relaciones Interinstitucionales", foto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400" },
];

const DirectorCard = ({ nombre, cargo, foto, index }) => {
  const setReveal = useScrollReveal();
  return (
    <div
      ref={setReveal}
      style={{ transitionDelay: `${index * 0.1}s` }}
      className="reveal-on-scroll group bg-white rounded-[2.5rem] p-5 border border-emerald-100 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-700"
    >
      <div className="relative overflow-hidden rounded-[2rem] aspect-square mb-6 bg-slate-100">
        <img
          src={foto}
          alt={nombre}
          className="w-full h-full object-cover group-hover:grayscale-0 transition-all duration-700 ease-in-out group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#022c22]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-xl font-black text-[#022c22] leading-tight group-hover:text-emerald-600 transition-colors">
          {nombre}
        </h3>
        <p className="text-emerald-500 font-black uppercase tracking-[0.15em] text-[10px] bg-emerald-50 py-1 px-3 rounded-full inline-block">
          {cargo}
        </p>
      </div>
    </div>
  );
};

export default function EquipoDirectivo() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30 scroll-smooth">
      <Navbar2 />

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
          <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs animate-header-text" style={{ animationDelay: "0.2s", opacity: 0 }}>Liderazgo Gremial</p>
          <h1 style={{ animationDelay: "0.4s", opacity: 0 }} className="text-5xl lg:text-7xl font-black tracking-tighter animate-header-text">
            Junta <span className="text-emerald-500 italic">Directiva</span>
          </h1>
          <p className="text-emerald-100/60 text-sm tracking-widest uppercase font-medium animate-header-text" style={{ animationDelay: "0.5s", opacity: 0 }} >Gestión 2024 - 2026</p>
        </div>
      </header>

      <main className="bg-white text-slate-900 rounded-t-[4rem] -mt-12 relative z-10 px-6 lg:px-20 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {directiva.map((miembro, index) => (
              <DirectorCard
                key={index}
                index={index} // PASAMOS EL INDEX PARA EL DELAY
                nombre={miembro.nombre}
                cargo={miembro.cargo}
                foto={miembro.foto}
              />
            ))}
          </div>

          <div className="mt-24 p-12 rounded-[3rem] bg-[#022c22] text-white text-center space-y-6 shadow-2xl shadow-emerald-900/20">
            <h2 className="text-3xl font-black tracking-tight">¿Deseas contactar con alguna dirección?</h2>
            <button className="px-10 py-4 bg-emerald-500 text-[#022c22] rounded-full font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-all">
              Enviar un mensaje
            </button>
          </div>
        </div>
      </main>

      <footer className="bg-[#011a14] px-6 lg:px-20 py-12 text-center border-t border-white/5">
        <p className="text-gray-600 text-[10px] uppercase tracking-[0.2em]">
          © 2026 Cámara Inmobiliaria del Estado Bolívar • RIF J-30462520-0
        </p>
      </footer>
    </div>
  );
}