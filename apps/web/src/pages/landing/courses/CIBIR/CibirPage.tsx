import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Footer from '@/pages/landing/components/Footer';
import bgCibir from "@/assets/Pzo.webp";
import heroCibir from "@/assets/Cibir.webp";
import pegiImg from "@/assets/Pegi.webp";
import cibirImg from "@/assets/Cibir.webp";
import Navbar from "@/pages/landing/components/navbar/Navbar";
import Estudiosa from "@/assets/estudiosa1.webp";
import Estudioso from "@/assets/estudioso1.webp";
import PreinscripcionProgramaForm from "@/pages/landing/components/PreinscripcionProgramaForm";

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
      { threshold: 0.1 },
    );
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref]);

  return setRef;
};

// --- COMPONENTES ---

const ModuloCibir: React.FC<ModuloProps> = ({
  numero,
  titulo,
  descripcion,
  index,
}) => {
  const setReveal = useScrollReveal();
  const isEven = index % 2 === 0;

  return (
    <div
      ref={(el) => setReveal(el)}
      className="reveal-on-scroll relative mb-16 md:mb-20 flex flex-col md:flex-row items-center"
    >
      {/* Indicador de Módulo con Diseño PADI */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex w-12 h-12 rounded-xl bg-emerald-500 items-center justify-center z-20 shadow-lg border-2 border-white text-white font-black">
        {numero}
      </div>

      <div
        className={`w-full md:w-1/2 ${isEven ? "md:pr-20 md:text-right" : "md:pl-20 md:order-last text-left"}`}
      >
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

export default function Cibir() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const setRevealEstudiosa = useScrollReveal();
  const setRevealEstudioso = useScrollReveal();

  // Definimos los módulos con la misma estructura detallada
  const modulos: Omit<ModuloProps, "index">[] = [
    {
      numero: "01",
      titulo: "Negocio de Bienes Raíces",
      descripcion:
        "Introducción técnica al mercado inmobiliario, analizando el entorno económico y los conceptos fundamentales del corretaje.",
    },
    {
      numero: "02",
      titulo: "Nociones Jurídicas",
      descripcion:
        "Estudio del marco legal, contratos, registros y notarías para garantizar operaciones seguras y transparentes.",
    },
    {
      numero: "03",
      titulo: "Comercialización Inmobiliaria",
      descripcion:
        "Técnicas avanzadas de captación, marketing digital inmobiliario y cierre de ventas efectivo.",
    },
    {
      numero: "04",
      titulo: "Hábitos y Buenas Prácticas",
      descripcion:
        "Desarrollo de la ética profesional, gestión del tiempo y estándares internacionales de calidad en el servicio.",
    },
    {
      numero: "05",
      titulo: "Principios de Valoración",
      descripcion:
        "Fundamentos de tasación para determinar el valor real de mercado basándose en métodos comparativos y técnicos.",
    },
  ];

  return (
    <div className="w-full max-w-full bg-[#022c22] text-white font-sans selection:bg-emerald-500/30">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

      {/* HEADER CON ANIMACIÓN DE FONDO Y TEXTO SINCRONIZADA */}
      <header
        className="relative px-4 sm:px-6 lg:px-20 py-20 lg:py-32 flex items-center justify-center min-h-[55vh] bg-cover animate-header-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.8), rgba(2, 44, 34, 0.9)), url(${bgCibir})`,
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
            Formación Básica Inicial
          </p>
          <h1
            className="text-4xl sm:text-5xl lg:text-8xl font-black tracking-tighter animate-header-text text-white"
            style={{ animationDelay: "0.4s", opacity: 0 }}
          >
            <span className="text-emerald-500 italic">CIBIR</span>
          </h1>
          <p
            className="text-emerald-100/60 text-lg md:text-xl font-light max-w-2xl mx-auto animate-header-text"
            style={{ animationDelay: "0.6s", opacity: 0 }}
          >
            Curso Introductorio de Bienes Raíces.
          </p>
        </div>
      </header>

      <main className="bg-white text-slate-900 rounded-t-[3rem] sm:rounded-t-[4rem] -mt-12 relative z-10 px-4 sm:px-6 lg:px-20 py-24">
        <div className="max-w-6xl mx-auto">
          {/* SECCIÓN SOBRE EL PROGRAMA EQUIPARADA AL PADI */}
          <div className="flex flex-col lg:flex-row items-center gap-12 mb-20 bg-slate-50 p-8 lg:p-16 rounded-[3rem] border border-emerald-50 relative overflow-hidden">
            <div className="w-full lg:w-1/3 flex justify-center relative z-10">
              <img
                src={heroCibir}
                alt="Capacitación CIBIR"
                className="w-full h-auto drop-shadow-2xl rounded-2xl"
              />
            </div>
            <div className="w-full lg:w-2/3 space-y-6 relative z-10">
              <h2 className="text-3xl font-black text-[#022c22] uppercase tracking-tight">
                Sobre la Formación
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                El CIBIR es nuestro programa insignia presencial, diseñado para
                cimentar las bases de cualquier carrera inmobiliaria exitosa.
                Dictado por líderes de la industria, este curso combina teoría
                rigurosa con la práctica real del mercado venezolano.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <span className="px-5 py-2.5 bg-emerald-100 text-emerald-800 rounded-full text-sm font-bold flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Modalidad Presencial
                </span>
                <span className="px-5 py-2.5 bg-emerald-100 text-emerald-800 rounded-full text-sm font-bold flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Aval Gremial
                </span>
              </div>
            </div>
          </div>

          {/* GRID DE ACCIÓN DETALLADO (PENSUM + INSCRIPCIÓN) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-32 items-stretch">
            <div className="relative rounded-[3rem] overflow-hidden group min-h-[400px]">
              <img
                src={pegiImg}
                alt="Networking"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-[#022c22]/90 flex flex-col justify-end p-12 text-white">
                <p className="text-emerald-500 font-black uppercase tracking-widest text-xs mb-3">
                  Contenido Académico
                </p>
                <h3 className="text-4xl font-black tracking-tight mb-6">
                  Aprende de los Mejores
                </h3>
                <p className="text-emerald-100/80 leading-relaxed mb-8">
                  Accede a un pensum actualizado que cubre desde la ética
                  profesional hasta las herramientas digitales más potentes del
                  sector.
                </p>
                <button
                  onClick={() => window.open("/brochure-cibir.pdf", "_blank")}
                  className="px-10 py-4 bg-emerald-500 text-[#022c22] rounded-full font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-colors shadow-xl self-start"
                >
                  Descargar Pensum (PDF)
                </button>
              </div>
            </div>

            <div className="relative rounded-[3rem] overflow-hidden flex items-end">
              <img
                src={cibirImg}
                alt="Inscripción"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="relative z-10 w-full p-12 bg-white/95 backdrop-blur-sm m-6 rounded-2xl shadow-2xl space-y-8">
                <h3 className="text-3xl font-black text-[#022c22] tracking-tight border-b border-emerald-100 pb-4">
                  Proceso de Ingreso
                </h3>
                <ul className="space-y-4 text-slate-700 text-lg">
                  <li className="flex gap-3">
                    <span className="text-emerald-500 font-bold">01.</span>
                    <span>
                      <strong>Solicitud:</strong> Completa el formulario de
                      contacto o escríbenos.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-emerald-500 font-bold">02.</span>
                    <span>
                      <strong>Requisitos:</strong> Consigna copia de CI y
                      síntesis curricular.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-emerald-500 font-bold">03.</span>
                    <span>
                      <strong>Pago:</strong> Formaliza tu inversión para
                      asegurar el cupo.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-center mb-20">
            <h2 className="text-4xl font-black text-[#022c22] uppercase tracking-tight">
              Estructura Curricular
            </h2>
            <div className="w-20 h-1 bg-emerald-500 mx-auto mt-4" />
          </div>

          {/* LÍNEA DE TIEMPO DE MÓDULOS */}
          <div className="relative">
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-slate-200 hidden md:block" />
            {modulos.map((mod, index) => (
              <ModuloCibir
                key={mod.numero || mod.titulo}
                index={index}
                numero={mod.numero}
                titulo={mod.titulo}
                descripcion={mod.descripcion}
              />
            ))}
          </div>

          {/* SECCIÓN DE CONTACTO CON MARCAS DE AGUA ANIMADAS */}
          <div className="relative mt-16 group">
            <div
              ref={(el) => setRevealEstudiosa(el)}
              className="reveal-on-scroll absolute -bottom-50 -left-150 z-10 pointer-events-none hidden lg:block transition-colors duration-1000 opacity-0 [&.active]:opacity-20"
            >
              <img
                src={Estudiosa}
                alt="Watermark"
                className="h-[800px] w-auto max-w-none transform"
              />
            </div>
            <div
              ref={(el) => setRevealEstudioso(el)}
              className="reveal-on-scroll absolute -bottom-40 left-270 z-10 pointer-events-none hidden lg:block transition-colors duration-1000 opacity-0 [&.active]:opacity-20"
            >
              <img
                src={Estudioso}
                alt="Watermark"
                className="h-[650px] w-auto max-w-none transform"
              />
            </div>

            {/* 
            <div
              id="formulario"
              className="relative z-10 p-6 sm:p-12 rounded-[2rem] sm:rounded-[4rem] bg-[#022c22]/95 backdrop-blur-sm text-white text-center space-y-8 overflow-hidden border border-white/5"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />

              <div className="relative z-10">
                <h3 className="text-3xl md:text-4xl font-black mb-4 uppercase tracking-tighter">
                  Inicia tu Formación Inmobiliaria
                </h3>
                <p className="text-emerald-200/70 mb-8 max-w-xl mx-auto italic">
                  No pierdas la oportunidad de formarte con los líderes del
                  gremio. La próxima cohorte del CIBIR te está esperando.
                </p>
              </div>
              <PreinscripcionProgramaForm
                programaCodigo="CIBIR"
                ctaLabel="Confirmar"
              />
            </div>
            */}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
