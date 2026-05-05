import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import bgCaracas from "../assets/Pzo.jpg";
import logoPadi from "../assets/Padi.jpg";
import Estudiosa from "../assets/estudiosa1.png";
import Estudioso from "../assets/estudioso1.png";
import Navbar from '@/pages/landing/components/navbar/Navbar';

// --- INTERFACES ---
interface ModuloProps {
  numero: string;
  titulo: string;
  descripcion: string;
  index: number;
}

// --- HOOKS ---
const useScrollReveal = () => {
  const [ref, setRef] = useState<HTMLElement | null>(null);

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

// --- COMPONENTES ---

const ModuloPadi: React.FC<ModuloProps> = ({ numero, titulo, descripcion, index }) => {
  const setReveal = useScrollReveal();
  const isEven = index % 2 === 0;

  return (
    <div
      ref={(el) => setReveal(el)}
      className="reveal-on-scroll relative mb-16 md:mb-20 flex flex-col md:flex-row items-center"
    >
      {/* Indicador de Módulo */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex w-12 h-12 rounded-xl bg-emerald-500 items-center justify-center z-20 shadow-lg border-2 border-white text-white font-black">
        {numero}
      </div>

      {/* Contenido Dinámico */}
      <div className={`w-full md:w-1/2 ${isEven ? 'md:pr-20 md:text-right' : 'md:pl-20 md:order-last text-left'}`}>
        <h3 className="text-2xl font-black text-[#022c22] mb-3 uppercase tracking-tight">
          {titulo}
        </h3>
        <p className="text-slate-600 leading-relaxed text-lg italic">
          {descripcion}
        </p>
      </div>

      <div className="hidden md:block md:w-1/2" />
    </div>
  );
};

export default function Padi() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(true);
  const setRevealEstudiosa = useScrollReveal();
  const setRevealEstudioso = useScrollReveal();

  const modulos: Omit<ModuloProps, "index">[] = [
    {
      numero: "01",
      titulo: "Gestión de Condominios",
      descripcion: "Fundamentos legales y operativos para la administración eficiente de comunidades residenciales."
    },
    {
      numero: "02",
      titulo: "Centros Comerciales",
      descripcion: "Estrategias especializadas en el manejo de áreas comunes y arrendamientos comerciales de alto nivel."
    },
    {
      numero: "03",
      titulo: "Marco Jurídico",
      descripcion: "Análisis profundo de la Ley de Propiedad Horizontal y normativas vigentes en el sector inmobiliario."
    },
    {
      numero: "04",
      titulo: "Mantenimiento Preventivo",
      descripcion: "Planificación técnica para la preservación de activos inmobiliarios y optimización de recursos."
    }
  ];

  return (
    <div className="min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30 scroll-smooth">

      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <header
        className="relative px-6 lg:px-20 py-20 lg:py-32 flex items-center justify-center min-h-[55vh] bg-cover animate-header-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.8), rgba(2, 44, 34, 0.9)), url(${bgCaracas})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="text-center space-y-6 max-w-4xl">
          <p className="text-emerald-500 font-black uppercase tracking-[0.4em] text-xs animate-header-text" style={{ animationDelay: "0.2s", opacity: 0 }}>
            Especialización Profesional
          </p>
          <h1 className="text-5xl lg:text-8xl font-black tracking-tighter animate-header-text" style={{ animationDelay: "0.4s", opacity: 0 }}>
            PROGRAMA <span className="text-emerald-500 italic">PADI</span>
          </h1>
          <p className="text-emerald-100/60 text-lg md:text-xl font-light max-w-2xl mx-auto animate-header-text" style={{ animationDelay: "0.6s", opacity: 0 }}>
            Programa de Especialización en Administración de Inmuebles. Materias de alto nivel dictadas por expertos calificados.
          </p>
        </div>
      </header>

      <main className="bg-white text-slate-900 rounded-t-[4rem] -mt-12 relative z-10 px-6 lg:px-20 py-24">
        <div className="max-w-6xl mx-auto">

          <div className="flex flex-col lg:flex-row items-center gap-12 mb-20 bg-slate-50 p-8 lg:p-16 rounded-[3rem] border border-emerald-50">
            <div className="w-full lg:w-1/3 flex justify-center">
              <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070&auto=format&fit=crop" alt="Logo PADI" className="w-64 h-auto drop-shadow-2xl" />
            </div>
            <div className="w-full lg:w-2/3 space-y-6">
              <h2 className="text-3xl font-black text-[#022c22] uppercase tracking-tight">Sobre el Programa</h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                Amplía tus servicios inmobiliarios e incursiona en la administración de condominios, arrendamientos y centros comerciales.
                Nuestro programa consta de materias actualizadas diseñadas para la excelencia profesional.
              </p>
              <div className="flex gap-4">
                <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold">Formación Avanzada</span>
                <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold">Certificación Gremial</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-32 items-stretch">
            <div className="relative rounded-[3rem] overflow-hidden group">
              <div className="absolute inset-0 bg-[#022c22]/90 flex flex-col justify-end p-12 text-white">
                <p className="text-emerald-500 font-black uppercase tracking-widest text-xs mb-3">PADI</p>
                <h3 className="text-4xl font-black tracking-tight mb-6">Administración Profesional de Inmuebles</h3>
                <p className="text-emerald-100/80 leading-relaxed mb-8">
                  Incursiona en la gestión profesional de condominios, arrendamientos y centros comerciales con el Programa de Especialización en Administración de Inmuebles (PADI). Lidera proyectos con bases sólidas y visión estratégica.
                </p>
                <button
                  onClick={() => window.open('/ruta-al-pensum.pdf', '_blank')}
                  className="inline-block px-10 py-4 bg-emerald-500 text-[#022c22] rounded-full font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-all shadow-xl self-start"
                >
                  Descarga el Pensum (PDF)
                </button>
              </div>
            </div>

            <div className="relative rounded-[3rem] overflow-hidden flex items-end">
              <img
                src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070&auto=format&fit=crop"
                alt="Inscripciones Abiertas PADI"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="relative z-10 w-full p-12 bg-white/95 backdrop-blur-sm m-6 rounded-2xl shadow-2xl space-y-8">
                <h3 className="text-3xl font-black text-[#022c22] tracking-tight border-b border-emerald-100 pb-4">¿Cómo Inscribirse?</h3>
                <ol className="list-decimal list-outside pl-6 space-y-4 text-slate-700 text-lg">
                  <li><strong>Descarga</strong> los formularios oficiales desde nuestro portal.</li>
                  <li><strong>Completa</strong> todos los requisitos y documentos solicitados.</li>
                  <li><strong>Envía</strong> la documentación digitalizada por correo electrónico.</li>
                </ol>
                <p className="text-sm text-slate-500 italic">Una vez recibidos, la Coordinación de Formación se pondrá en contacto contigo.</p>
              </div>
            </div>
          </div>

          <div className="text-center mb-20">
            <h2 className="text-4xl font-black text-[#022c22] uppercase tracking-tight">Estructura Académica</h2>
            <div className="w-20 h-1 bg-emerald-500 mx-auto mt-4" />
          </div>

          <div className="relative">
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-slate-200 hidden md:block" />
            {modulos.map((mod, index) => (
              <ModuloPadi
                key={index}
                index={index}
                numero={mod.numero}
                titulo={mod.titulo}
                descripcion={mod.descripcion}
              />
            ))}
          </div>

          <div className="relative mt-16 group">
            <div
              ref={(el) => setRevealEstudiosa(el)}
              className="reveal-on-scroll absolute -bottom-40 -left-80 pointer-events-none hidden lg:block transition-all duration-1000 opacity-0 [&.active]:opacity-20"
            >
              <img
                src={Estudiosa}
                alt="Decoración"
                className="h-[800px] w-auto max-w-none transform"
              />
            </div>
            <div
              ref={(el) => setRevealEstudioso(el)}
              className="reveal-on-scroll absolute -bottom-40 -right-60 z-10 pointer-events-none hidden lg:block transition-all duration-1000 opacity-0 [&.active]:opacity-20"
            >
              <img
                src={Estudioso}
                alt="Decoración"
                className="h-[650px] w-auto max-w-none transform"
              />
            </div>

            <div className="relative z-10 p-12 rounded-[4rem] bg-[#022c22]/95 backdrop-blur-sm text-white text-center space-y-8 overflow-hidden border border-white/5">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />

              <div className="relative z-10">
                <h3 className="text-3xl md:text-4xl font-black mb-4 uppercase tracking-tighter">
                  ¿Quieres certificarte como Profesional?
                </h3>
                <p className="text-emerald-200/70 mb-8 max-w-xl mx-auto">
                  Inicia tu proceso de preinscripción para nuestra próxima cohorte. Fórmate con los mejores especialistas del sector inmobiliario.
                </p>
                <div className="flex flex-col md:flex-row gap-4 justify-center">
                  <button
                    onClick={() => navigate('/contacto')}
                    className="px-10 py-4 bg-emerald-500 text-[#022c22] rounded-full font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-all shadow-xl"
                  >
                    Deseo más información
                  </button>
                  <a
                    href="https://wa.me/584241554321"
                    className="px-10 py-4 border border-emerald-500/50 text-emerald-400 rounded-full font-black uppercase text-xs tracking-widest hover:bg-white/5 transition-all"
                  >
                    Contactar por WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-[#011a14] px-6 lg:px-20 py-12 pt-16 text-center border-t border-white/5 relative z-10">
        <p className="text-gray-600 text-[10px] uppercase tracking-[0.2em]">
          PADI • Coordinación de Formación • Cámara Inmobiliaria de Bolívar
        </p>
      </footer>
    </div>
  );
}
