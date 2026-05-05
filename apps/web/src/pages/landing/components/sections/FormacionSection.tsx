import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { STATIC } from "@/pages/landing/config/staticContent";
import { API_URL } from "@/config/env";

const s = STATIC.formacion;

const FALLBACK_CURSOS = [
  {
    id: "CIBIR",
    codigo: "CIBIR",
    link: "/cibir",
    titulo: "CIBIR",
    subtitulo: "Curso Introductorio de Bienes Raíces",
    imagen_url:
      "https://observatorio.tec.mx/wp-content/uploads/2020/04/CC3B3mohacerunaclaseenvivoefectivaysincomplicaciones.jpg",
  },
  {
    id: "PREANI",
    codigo: "PREANI",
    link: "/preani",
    titulo: "PREANI",
    subtitulo: "Programa de Estudios Avanzados en Negocios Inmobiliarios",
    imagen_url:
      "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: "PEGI",
    codigo: "PEGI",
    link: "/pegi",
    titulo: "PEGI",
    subtitulo: "Programa de Especializacion en Gerencia Inmobiliaria",
    imagen_url:
      "https://static.studyusa.com/article/aws_bEqqGGmAziTXnqDcljdFyWoFhYcnEMGI_sm_2x.jpg?format=webp",
  },
  {
    id: "PADI",
    codigo: "PADI",
    link: "/padi",
    titulo: "PADI",
    subtitulo: "Programa de Administración de Inmuebles",
    imagen_url:
      "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=1200",
  },
];

export default function FormacionSection() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cursos, setCursos] = useState(FALLBACK_CURSOS);
  const [isHovered, setIsHovered] = useState(false);
  const revealTitle = useScrollReveal();
  const revealPanels = useScrollReveal();

  const getVisibleCards = () =>
    typeof window !== "undefined" && window.innerWidth < 768
      ? 1
      : window.innerWidth < 1024
        ? 2
        : 4;
  const maxIndex = Math.max(0, cursos.length - getVisibleCards());

  const nextSlide = () =>
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  const prevSlide = () =>
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, 2000);
    return () => clearInterval(interval);
  }, [maxIndex, isHovered]);

  const getTranslatePercentage = () => {
    if (typeof window === "undefined") return 0;
    if (window.innerWidth < 768) return currentIndex * 100;
    if (window.innerWidth < 1024) return currentIndex * 50;
    return currentIndex * 25;
  };

  return (
    <section
      id="formacion"
      className="bg-[#022c22] py-24 px-6 lg:px-12 overflow-hidden relative"
    >
      <div className="mb-12">
        <div
          ref={revealTitle}
          className="reveal-on-scroll text-center md:text-left"
        >
          <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs mb-4">
            {s.subtitulo}
          </p>
          <h2 className="text-5xl lg:text-7xl font-black text-white tracking-tighter">
            {s.titulo}
          </h2>
        </div>
      </div>

      <div
        className="relative max-w-8xl mx-auto group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          onClick={prevSlide}
          className="lg:hidden absolute -left-2 md:-left-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full border border-white/20 bg-[#022c22]/90 backdrop-blur-sm text-white hover:bg-emerald-500 hover:text-[#022c22] hover:scale-110 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 shadow-2xl"
        >
          <svg
            className="w-6 h-6 md:w-8 md:h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div
          ref={revealPanels}
          className="overflow-hidden -mx-3 reveal-on-scroll"
        >
          <div
            className="flex transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ transform: `translateX(-${getTranslatePercentage()}%)` }}
          >
            {cursos.map((curso, index) => (
              <div
                key={`${curso.id}-${index}`}
                className="w-full md:w-1/2 lg:w-1/4 flex-shrink-0 px-3"
              >
                <div className="group relative h-[450px] overflow-hidden rounded-[2.5rem] border border-white/10 bg-emerald-900/20 transition-all duration-500">
                  <div className="absolute inset-0 z-0">
                    <img
                      src={curso.imagen_url}
                      alt={curso.titulo}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#022c22] via-[#022c22]/50 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-500" />
                  </div>
                  <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-8 space-y-4">
                    <div>
                      <h3 className="text-xl lg:text-2xl font-black text-white leading-tight mb-2">
                        {curso.titulo}
                      </h3>
                      <p className="text-emerald-50/80 text-xs font-medium leading-relaxed">
                        {curso.subtitulo}
                      </p>
                    </div>
                    <div className="pt-2">
                      <button
                        onClick={() => navigate(curso.link || "#")}
                        className="block w-full text-center py-3 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white font-bold text-[10px] uppercase tracking-widest transition-all hover:bg-emerald-500 hover:border-emerald-500 hover:text-[#022c22] shadow-xl"
                      >
                        {s.boton}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={nextSlide}
          className="lg:hidden absolute -right-2 md:-right-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full border border-white/20 bg-[#022c22]/90 backdrop-blur-sm text-white hover:bg-emerald-500 hover:text-[#022c22] hover:scale-110 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 shadow-2xl"
        >
          <svg
            className="w-6 h-6 md:w-8 md:h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </section>
  );
}
