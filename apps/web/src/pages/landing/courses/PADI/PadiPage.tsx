import { useNavigate } from "react-router-dom";
import { useState } from "react";
import Footer from '@/pages/landing/components/Footer'
import bgCaracas from "@/assets/Pzo.webp";
import padiImg from "@/assets/Padi.webp";
import Estudiosa from "@/assets/estudiosa1.webp";
import Estudioso from "@/assets/estudioso1.webp";
import Navbar from "@/pages/landing/components/navbar/Navbar";
import PreinscripcionProgramaForm from "@/pages/landing/components/PreinscripcionProgramaForm";
import ProgramTimeline, {
  type ProgramModule,
} from "@/pages/landing/courses/components/ProgramTimeline";
import useScrollReveal from "@/pages/landing/courses/components/useScrollReveal";

const MODULES: ProgramModule[] = [
  {
    numero: "01",
    titulo: "Gestión de Condominios",
    descripcion:
      "Fundamentos legales y operativos para la administración eficiente de comunidades residenciales.",
  },
  {
    numero: "02",
    titulo: "Centros Comerciales",
    descripcion:
      "Estrategias especializadas en el manejo de áreas comunes y arrendamientos comerciales de alto nivel.",
  },
  {
    numero: "03",
    titulo: "Marco Jurídico",
    descripcion:
      "Análisis profundo de la Ley de Propiedad Horizontal y normativas vigentes en el sector inmobiliario.",
  },
  {
    numero: "04",
    titulo: "Mantenimiento Preventivo",
    descripcion:
      "Planificación técnica para la preservación de activos inmobiliarios y optimización de recursos.",
  },
];

export default function PadiPage() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const setRevealEstudiosa = useScrollReveal();
  const setRevealEstudioso = useScrollReveal();

  return (
    <div className="w-full max-w-full bg-[#022c22] text-white font-sans selection:bg-emerald-500/30">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <header
        className="relative px-4 sm:px-6 lg:px-20 py-20 lg:py-32 flex items-center justify-center min-h-[55vh] bg-cover animate-header-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.8), rgba(2, 44, 34, 0.9)), url(${bgCaracas})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="text-center space-y-6 max-w-4xl">
          <p
            className="text-emerald-500 font-black uppercase tracking-[0.4em] text-xs animate-header-text"
            style={{ animationDelay: "0.2s", opacity: 0 }}
          >
            Especialización Profesional
          </p>
          <h1
            className="text-4xl sm:text-5xl lg:text-8xl font-black tracking-tighter animate-header-text text-white"
            style={{ animationDelay: "0.4s", opacity: 0 }}
          >
            <span className="text-emerald-500 italic">PADI</span>
          </h1>
          <p
            className="text-emerald-100/60 text-lg md:text-xl font-light max-w-2xl mx-auto animate-header-text"
            style={{ animationDelay: "0.6s", opacity: 0 }}
          >
            Programa de Administración de Inmuebles.
          </p>
        </div>
      </header>

      <main className="bg-white text-slate-900 rounded-t-[3rem] sm:rounded-t-[4rem] -mt-12 relative z-10 px-4 sm:px-6 lg:px-20 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12 mb-20 bg-slate-50 p-8 lg:p-16 rounded-[3rem] border border-emerald-50">
            <div className="w-full lg:w-1/3 flex justify-center">
              <img
                src={padiImg}
                alt="Logo PADI"
                className="w-64 h-auto drop-shadow-2xl"
              />
            </div>
            <div className="w-full lg:w-2/3 space-y-6">
              <h2 className="text-3xl font-black text-[#022c22] uppercase tracking-tight">
                Sobre el Programa
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                Amplía tus servicios inmobiliarios e incursiona en la
                administración de condominios, arrendamientos y centros
                comerciales. Nuestro programa consta de materias actualizadas
                diseñadas para la excelencia profesional.
              </p>
            </div>
          </div>

          <div className="text-center mb-20">
            <h2 className="text-4xl font-black text-[#022c22] uppercase tracking-tight">
              Estructura Académica
            </h2>
            <div className="w-20 h-1 bg-emerald-500 mx-auto mt-4" />
          </div>
          <ProgramTimeline modules={MODULES} />

          <div className="relative mt-16 group">
            <div
              ref={(el) => setRevealEstudiosa(el)}
              className="reveal-on-scroll absolute -bottom-40 -left-80 pointer-events-none hidden lg:block transition-colors duration-1000 opacity-0 [&.active]:opacity-20"
            >
              <img
                src={Estudiosa}
                alt="Decoración"
                className="h-[800px] w-auto max-w-none transform"
              />
            </div>
            <div
              ref={(el) => setRevealEstudioso(el)}
              className="reveal-on-scroll absolute -bottom-40 -right-60 z-10 pointer-events-none hidden lg:block transition-colors duration-1000 opacity-0 [&.active]:opacity-20"
            >
              <img
                src={Estudioso}
                alt="Decoración"
                className="h-[650px] w-auto max-w-none transform"
              />
            </div>

            <div className="relative z-10 p-6 sm:p-12 rounded-[2rem] sm:rounded-[4rem] bg-[#022c22]/95 backdrop-blur-sm text-white text-center space-y-8 overflow-hidden border border-white/5">
              <div className="relative z-10">
                <h3 className="text-3xl md:text-4xl font-black mb-4 uppercase tracking-tighter">
                  ¿Quieres certificarte como Profesional?
                </h3>
                <p className="text-emerald-200/70 mb-8 max-w-xl mx-auto">
                  Inicia tu proceso de preinscripción para nuestra próxima
                  cohorte. Fórmate con los mejores especialistas del sector
                  inmobiliario.
                </p>
                <PreinscripcionProgramaForm
                  programaCodigo="PADI"
                  ctaLabel="Confirmar"
                />
                <div className="mt-6">
                  <button
                    onClick={() => navigate("/cursos")}
                    className="px-10 py-4 bg-emerald-500 text-[#022c22] rounded-full font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-colors shadow-xl"
                  >
                    Ver catálogo de formación
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
