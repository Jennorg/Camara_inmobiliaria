import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { STATIC } from "@/pages/landing/config/staticContent";
import { API_URL } from "@/config/env";
import { apiFetch } from "@/lib/apiClient";

const s = STATIC.formacion;

const FALLBACK_CURSOS = [
  {
    id: "PREANI",
    codigo: "PREANI",
    link: "/preani",
    titulo: "Programa de Estudios Académicos",
    subtitulo: "Inmobiliarios Nivel Inicial",
    imagen_url: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=75&w=600",
  },
  {
    id: "CIBIR",
    codigo: "CIBIR",
    link: "/cibir",
    titulo: "Curso Intensivo de Bienes Raíces",
    subtitulo: "Capacitación Técnica Avanzada",
    imagen_url: "https://observatorio.tec.mx/wp-content/uploads/2020/04/CC3B3mohacerunaclaseenvivoefectivaysincomplicaciones.jpg",
  },
  {
    id: "PEGI",
    codigo: "PEGI",
    link: "/pegi",
    titulo: "Programa Ejecutivo",
    subtitulo: "Gestión Inmobiliaria Estratégica",
    imagen_url: "https://static.studyusa.com/article/aws_bEqqGGmAziTXnqDcljdFyWoFhYcnEMGI_sm_2x.jpg?format=webp",
  },
  {
    id: "PADI",
    codigo: "PADI",
    link: "/padi",
    titulo: "Programa de Administración",
    subtitulo: "Administración en inmuebles",
    imagen_url: "https://cms.usanmarcos.ac.cr/sites/default/files/tips-para-el-primer-dia-de-clases.png",
  },
];

export default function FormacionSection() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cursos, setCursos] = useState<any[]>(FALLBACK_CURSOS);
  const [isHovered, setIsHovered] = useState(false);
  const [selectedPoster, setSelectedPoster] = useState<any | null>(null);
  const revealTitle = useScrollReveal();
  const revealPanels = useScrollReveal();

  useEffect(() => {
    let active = true;
    apiFetch(`${API_URL}/api/academia/cursos`)
      .then(data => {
        if (!active) return;
        if (data.success && Array.isArray(data.data)) {
          const standardCursos = data.data.filter((c: any) => c.solo_informativo !== 1 && c.estatus !== 'Solo Informativo');
          if (standardCursos.length > 0) {
            const mapped = standardCursos.map((c: any) => ({
              id: c.id_curso,
              codigo: c.programa_codigo || `CURSO-${c.id_curso}`,
              link: c.programa_codigo ? `/${c.programa_codigo.toLowerCase()}` : `/cursos`,
              titulo: c.titulo || c.nombre,
              subtitulo: c.descripcion || c.categoria || "Programa de Formación Inmobiliaria",
              imagen_url: c.imagen_url || "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=75&w=600",
              categoria: c.categoria || 'Formación',
              fecha_inicio: c.fecha_inicio
            }));
            setCursos(mapped);
          }
        }
      })
      .catch(() => { });
    return () => { active = false; };
  }, []);

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
    }, 3000);
    return () => clearInterval(interval);
  }, [maxIndex, isHovered]);

  const getTranslatePercentage = () => {
    if (typeof window === "undefined") return 0;
    if (window.innerWidth < 768) return currentIndex * 100;
    if (window.innerWidth < 1024) return currentIndex * 50;
    return currentIndex * 25;
  };

  const handleCardAction = (curso: any) => {
    if (curso.link) {
      navigate(curso.link);
    }
  };

  if (!cursos || cursos.length === 0) return null;

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
        {/* Left Arrow Button */}
        <button
          onClick={prevSlide}
          className="flex absolute -left-3 md:-left-6 lg:-left-8 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full border border-emerald-400/30 bg-[#022c22]/95 backdrop-blur-md text-white hover:bg-emerald-500 hover:text-[#022c22] hover:scale-110 active:scale-95 transition-colors transition-transform shadow-2xl cursor-pointer"
          aria-label="Anterior curso"
        >
          <svg
            className="w-6 h-6 md:w-7 md:h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div
          ref={revealPanels}
          className="overflow-x-auto scrollbar-hide -mx-3 reveal-on-scroll"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div
            className="flex transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ transform: `translateX(-${getTranslatePercentage()}%)` }}
          >
            {cursos.map((curso) => (
              <div
                key={curso.id || (curso as any).id_curso || curso.codigo || curso.titulo}
                className="w-full md:w-1/2 lg:w-1/4 flex-shrink-0 px-3 cursor-pointer"
                onClick={() => handleCardAction(curso)}
              >
                <div className="group relative h-[460px] overflow-hidden rounded-[2.5rem] border border-white/15 bg-emerald-900/20 transition-colors duration-500 hover:border-emerald-400/80 shadow-2xl">
                  <div className="absolute inset-0 z-0">
                    <img
                      src={curso.imagen_url}
                      alt={curso.titulo}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#022c22] via-[#022c22]/60 to-black/20 opacity-85 group-hover:opacity-70 transition-opacity duration-500" />
                  </div>



                  <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-8 space-y-4">
                    <div>
                      <h3 className="text-xl lg:text-2xl font-black text-white leading-tight mb-2">
                        {curso.titulo}
                      </h3>
                      <p className="text-emerald-50/80 text-xs font-medium leading-relaxed line-clamp-2">
                        {curso.subtitulo}
                      </p>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleCardAction(curso); }}
                        className="block w-full text-center py-3 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white font-bold text-[10px] uppercase tracking-widest transition-colors hover:bg-emerald-500 hover:border-emerald-500 hover:text-[#022c22] shadow-xl"
                      >
                        {curso.solo_informativo ? 'Ver más' : s.boton}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Arrow Button */}
        <button
          onClick={nextSlide}
          className="flex absolute -right-3 md:-right-6 lg:-right-8 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full border border-emerald-400/30 bg-[#022c22]/95 backdrop-blur-md text-white hover:bg-emerald-500 hover:text-[#022c22] hover:scale-110 active:scale-95 transition-colors transition-transform shadow-2xl cursor-pointer"
          aria-label="Siguiente curso"
        >
          <svg
            className="w-6 h-6 md:w-7 md:h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Lightbox Modal para afiches de cursos informativos */}
      {selectedPoster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-opacity duration-300"
          onClick={() => setSelectedPoster(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[92vh] flex flex-col items-center justify-center p-2 sm:p-4 rounded-3xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPoster(null)}
              className="absolute top-4 right-4 z-50 p-2.5 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md rounded-full shadow-2xl transition-colors transition-transform border border-white/20 hover:scale-110 active:scale-95 cursor-pointer"
              aria-label="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <img
              src={selectedPoster.imagen_url}
              alt={selectedPoster.titulo}
              className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-2xl shadow-2xl border border-white/10"
            />
            <div className="mt-3 text-center">
              <h4 className="text-white font-black text-lg sm:text-xl">{selectedPoster.titulo}</h4>
              <p className="text-emerald-400 text-xs font-bold mt-0.5">{selectedPoster.categoria || 'Formación Inmobiliaria'}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
