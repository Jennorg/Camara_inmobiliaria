import React, { useState, useEffect, useRef } from "react";
import logoA from "./assets/Logo2.png";
import logo from "./assets/Logo3.png";
import heroImg from "./assets/empresaria.png";
import featureImg from "./assets/empresaria_3.png";
import LoginModal from "./Components/LoginModal";
import RegisterModal from "./Components/RegisterModal";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";


import Mision_img from "./assets/Mision.jpeg";
import Navbar from "./Components/Navbar";
import Header from "./Components/Header";

const Counter = ({ end, duration = 2000, suffix = "" }) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasStarted(true);
        }
      },
      { threshold: 0.5 } // Se activa cuando el 50% del número es visible
    );

    if (elementRef.current) observer.observe(elementRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasStarted) return;

    let start = 0;
    const increment = end / (duration / 16); // 16ms aprox por frame (60fps)
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [hasStarted, end, duration]);

  return <span ref={elementRef}>{count}{suffix}</span>;
};

const FormacionSection = ({ revealTitle, revealPanels }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const cursos = [
    { 
      id: "PREANI", 
      titulo: "Programa de Estudios Académicos", 
      sub: "Inmobiliarios Nivel Inicial",
      img: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=1200"
    },
    { 
      id: "CIBIR", 
      titulo: "Curso Intensivo de Bienes Raíces", 
      sub: "Capacitación Técnica Avanzada",
      img: "https://observatorio.tec.mx/wp-content/uploads/2020/04/CC3B3mohacerunaclaseenvivoefectivaysincomplicaciones.jpg"
    },
    { 
      id: "PEGI", 
      titulo: "Programa Ejecutivo", 
      sub: "Gestión Inmobiliaria Estratégica",
      img: "https://static.studyusa.com/article/aws_bEqqGGmAziTXnqDcljdFyWoFhYcnEMGI_sm_2x.jpg?format=webp"
    }, 
    { 
      id: "PADI", 
      titulo: "Programa de Administración", 
      sub: "Administración en inmuebles",
      img: "https://cms.usanmarcos.ac.cr/sites/default/files/tips-para-el-primer-dia-de-clases.png"
    }
  ];

  const nextSlide = () => {
    if (currentIndex < cursos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <section id="formacion" className="bg-[#022c22] py-24 px-6 lg:px-20 overflow-hidden relative">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
        <div ref={revealTitle} className="reveal-on-scroll">
          <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs mb-4">Potencia tu carrera</p>
          <h2 className="text-5xl lg:text-7xl font-black text-white tracking-tighter">Formación</h2>
        </div>

        {/* Botones de Control */}
        <div className="flex gap-4">
          <button 
            onClick={prevSlide}
            disabled={currentIndex === 0}
            className={`p-4 rounded-full border ${currentIndex === 0 ? 'border-white/5 text-white/10' : 'border-white/20 text-white hover:bg-emerald-500 hover:text-[#022c22]'} transition-all`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button 
            onClick={nextSlide}
            disabled={currentIndex >= cursos.length - 3}
            className={`p-4 rounded-full border ${currentIndex >= cursos.length - 3 ? 'border-white/5 text-white/10' : 'border-white/20 text-white hover:bg-emerald-500 hover:text-[#022c22]'} transition-all`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>

      {/* Contenedor del Carrusel */}
      <div className="relative overflow-visible">
        <div 
          ref={revealPanels}
          className="flex transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] gap-8 reveal-on-scroll"
          style={{ transform: `translateX(-${currentIndex * (100 / (window.innerWidth < 1024 ? 1 : 3.1))}%)` }}
        >
          {cursos.map((curso, index) => (
            <div
              key={curso.id}
              className="min-w-full md:min-w-[48%] lg:min-w-[32%] group relative h-[500px] overflow-hidden rounded-[3rem] border border-white/10 bg-emerald-900/20 transition-all duration-500"
            >
              {/* Imagen de fondo */}
              <div className="absolute inset-0 z-0">
                <img 
                  src={curso.img} 
                  alt={curso.titulo}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                {/* SOLUCIÓN OSCURIDAD: Gradiente más suave y menos opaco */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#022c22] via-[#022c22]/40 to-transparent opacity-70 group-hover:opacity-50 transition-opacity duration-500" />
              </div>

              {/* Contenido */}
              <div className="relative z-10 h-full flex flex-col justify-end p-10 space-y-4">
                <div className="flex justify-between items-start">
                  {/* SOLUCIÓN ID: Más grande (text-sm), más padding y más legible */}
                  <span className="bg-emerald-500 backdrop-blur-md text-white px-6 py-2 rounded-xl text-sm font-black uppercase tracking-widest shadow-lg">
                    {curso.id}
                  </span>
                  <span className="text-4xl font-black text-white/20 group-hover:text-emerald-500/40 transition-colors">
                    0{index + 1}
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl lg:text-3xl font-black text-white leading-tight mb-2">
                    {curso.titulo}
                  </h3>
                  <p className="text-white/80 text-sm font-medium leading-relaxed">
                    {curso.sub}
                  </p>
                </div>

                <div className="pt-4">
                  <button className="w-full py-4 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white font-bold text-xs uppercase tracking-widest transition-all hover:bg-emerald-500 hover:border-emerald-500 hover:text-[#022c22] shadow-xl">
                    Ver detalles del programa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ConveniosSection = ({ revealTextConvenios }) => {
  const logos = [
    { name: "UCAB", url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYIgmOl4EASpo1hjggjQq_xP61myeh_nkr9w&s" },
    { name: "Total Salud", url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYIgmOl4EASpo1hjggjQq_xP61myeh_nkr9w&s" },
    { name: "Fénix Salud", url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYIgmOl4EASpo1hjggjQq_xP61myeh_nkr9w&s" },
    { name: "Aliado 4", url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYIgmOl4EASpo1hjggjQq_xP61myeh_nkr9w&s" },
  ];

  // Inyectamos el CSS de la animación directamente para asegurar que funcione
  const marqueeStyle = `
    @keyframes marquee-infinite {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    .animate-marquee-infinite {
      display: flex;
      width: max-content;
      animation: marquee-infinite 20s linear infinite;
    }
    .pause-on-hover:hover {
      animation-play-state: paused;
    }
  `;

  return (
    <section id="convenios" className="bg-white py-10 scroll-mt-24 overflow-hidden">
      <style>{marqueeStyle}</style>
      
      <div className="max-w-7xl mx-auto px-6 lg:px-20 mb-16">
        <div ref={revealTextConvenios} className="space-y-4 reveal-on-scroll -ml-8">
          <h2 className="text-5xl lg:text-7xl font-bold text-[#333333] tracking-tighter -ml-4">
            Convenios y beneficios
          </h2>
        </div>

        {/* Contenedor Capsular */}
        <div className="relative mt-16 bg-slate-50 border border-gray-100 rounded-[3rem] py-12 overflow-hidden">
          
          {/* Sombras laterales para efecto de desvanecimiento */}
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none" />
          
          <div className="flex">
            {/* Esta es la tira que se mueve */}
            <div className="animate-marquee-infinite pause-on-hover flex items-center">
              {/* Duplicamos los logos 2 veces para el loop perfecto */}
              {[...logos, ...logos, ...logos, ...logos].map((logo, i) => (
                <div 
                  key={i} 
                  className="mx-10 lg:mx-16 flex-shrink-0 grayscale opacity-40 hover:opacity-100 hover:grayscale-0 transition-all duration-500 transform hover:scale-110"
                >
                  <img src={logo.url} alt={logo.name} className="h-12 w-auto object-contain" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Link inferior */}
        <div className="pt-10 border-t border-gray-100">
            <a href="#cursos" className="group flex items-center gap-3">
              <span className="text-emerald-600 font-black uppercase tracking-widest text-xs group-hover:mr-4 transition-all">
                Conoce nuestros programas de formación inmobiliaria
              </span>
              <div className="h-[2px] w-12 bg-emerald-500 group-hover:w-24 transition-all"></div>
            </a>
          </div>
      </div>
    </section>
  );
};

const NoticiasSection = ({ scrollRef }) => {
  const noticiasOriginales = [
    {
      t: "Nuevas tasas de registro 2026",
      d: "Bolívar actualiza aranceles para transacciones de bienes raíces este trimestre.",
      img: "https://www.24horas.cl/24horas/site/artic/20260209/imag/foto_0000000320260209041236/MOCHILA_NOCTURNA_4.1_frame_159829.jpeg",
      tag: "Legal",
    },
    {
      t: "Crecimiento en Puerto Ordaz",
      d: "La zona industrial y comercial muestra signos de recuperación tras nuevas inversiones.",
      img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800",
      tag: "Mercado",
    },
    {
      t: "Taller de Ventas Digitales",
      d: "Éxito total en el último evento presencial realizado en el Hotel Eurobuilding.",
      img: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=800",
      tag: "Eventos",
    },
    {
      t: "Innovación Inmobiliaria",
      d: "Nuevas tecnologías aplicadas al sector de bienes raíces en la región.",
      img: "https://www.elnuevoherald.com/public/ultimas-noticias/5hl2um/picture314557289/alternates/LANDSCAPE_1140/CONDO11.jpg",
      tag: "Tecnología",
    }
  ];

  // Duplicamos las noticias para crear el efecto de loop infinito
  const noticias = [...noticiasOriginales, ...noticiasOriginales];

  const scroll = (direction) => {
    const { current } = scrollRef;
    if (!current) return;

    const cardWidth = current.offsetWidth / 3;
    const maxScroll = current.scrollWidth - current.offsetWidth;

    if (direction === 'right') {
      // Si estamos cerca del final del set duplicado, saltamos al inicio sin que se note
      if (current.scrollLeft >= maxScroll - 10) {
        current.scrollTo({ left: 0, behavior: 'instant' });
      } else {
        current.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    } else {
      if (current.scrollLeft <= 0) {
        current.scrollTo({ left: maxScroll, behavior: 'instant' });
      } else {
        current.scrollBy({ left: -cardWidth, behavior: 'smooth' });
      }
    }
  };

  // Efecto para movimiento automático cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      scroll('right');
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section id="noticias" className="bg-white text-slate-900 px-6 lg:px-10 pt-10 pb-10 lg:pb-24 scroll-mt-20 overflow-hidden  rounded-b-[4rem]">
      
      {/* Encabezado */}
      <div className="max-w-8xl mx-auto flex justify-between items-end mb-12">
        <div>
          <h2 className="text-4xl lg:text-5xl font-bold text-[#022c22] tracking-tighter">
            Actualidad y Noticias
          </h2>
          <p className="text-slate-500 mt-2 font-medium">
            Mantente informado sobre el mercado inmobiliario.
          </p>
        </div>
        <button className="hidden md:flex text-emerald-600 font-bold hover:text-emerald-800 transition-colors items-center gap-2">
          Ver todas <span className="text-xl">→</span>
        </button>
      </div>

      {/* Contenedor Relativo para Flechas y Scroll */}
      <div className="relative max-w-8xl mx-auto group">
        
        {/* Flecha Izquierda */}
        <button 
          onClick={() => scroll('left')}
          className="absolute -left-4 lg:-left-12 top-1/3 z-30 p-4 rounded-full bg-white shadow-2xl text-slate-800 hover:bg-emerald-500 hover:text-white transition-all duration-300 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 hidden md:block"
        >
          <span className="block rotate-180 text-xl font-bold">→</span>
        </button>

        {/* Contenedor del Scroll */}
        <div 
          ref={scrollRef}
          className="flex gap-10 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-8"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {noticias.map((news, i) => (
            <div 
              key={i} 
              className="min-w-full md:min-w-[calc(50%-20px)] lg:min-w-[calc(33.333%-27px)] snap-start group/card cursor-pointer"
            >
              <div className="relative aspect-[16/10] mb-6 overflow-hidden rounded-[2.5rem] shadow-xl shadow-emerald-900/5">
                <div className="absolute inset-0 bg-emerald-900/20 opacity-0 group-hover/card:opacity-100 transition-opacity z-10 duration-500" />
                <img
                  src={news.img}
                  alt={news.t}
                  className="w-full h-full object-cover group-hover/card:scale-110 transition duration-700 ease-out"
                />
                <span className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-sm text-emerald-700 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                  {news.tag}
                </span>
              </div>

              <div className="space-y-3 px-2">
                <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em]">
                  Bolívar • Feb 2026
                </p>
                <h4 className="text-2xl font-bold leading-tight text-[#022c22] group-hover/card:text-emerald-600 transition-colors">
                  {news.t}
                </h4>
                <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">
                  {news.d}
                </p>
                <div className="pt-2">
                  <span className="text-xs font-bold text-slate-400 group-hover/card:text-emerald-500 transition-colors italic">
                    Leer más...
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Flecha Derecha */}
        <button 
          onClick={() => scroll('right')}
          className="absolute -right-4 lg:-right-12 top-1/3 z-30 p-4 rounded-full bg-white shadow-2xl text-slate-800 hover:bg-emerald-500 hover:text-white transition-all duration-300 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 hidden md:block"
        >
          <span className="text-xl font-bold block">→</span>
        </button>
      </div>
    </section>
  );
};

export default function Home() {
  const [isModalSesionOpen, setIsSesionModalOpen] = useState(false);
  const [isModalRegisterOpen, setIsRegisterModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true); // Estado para el tema
  const [scrollY, setScrollY] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      { threshold: 0.2 } // Se activa cuando el 20% es visible
    );
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref]);

  return setRef;
};

  const opacity = scrollY > 10 ? 0.6 : 0;
  const textOpacity = scrollY > 10 ? 1 : 0;
  const revealImg = useScrollReveal();
  const revealStats = useScrollReveal();
  const revealText = useScrollReveal();
  const revealJunta = useScrollReveal();
  const revealTitle = useScrollReveal();
  const revealPanels = useScrollReveal();
  const revealTextConvenios = useScrollReveal();
    const scrollRef = useRef(null);

  return (
    <div className="min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30 scroll-smooth">
      <div
        className={`${darkMode ? "dark bg-[#022c22]" : "bg-slate-50"} min-h-screen transition-colors duration-300 font-sans selection:bg-emerald-500/30 scroll-smooth`}
      >
      <Navbar 
        darkMode={darkMode} 
        setDarkMode={setDarkMode}
        setIsSesionModalOpen={setIsSesionModalOpen}
        setIsRegisterModalOpen={setIsRegisterModalOpen}
      />

        {/* --- HERO SECTION --- */}
        <Header darkMode={darkMode}/>
      </div>

      {/* --- SECCIÓN NOSOTROS --- */}
      <section
        id="nosotros"
        className=" scroll-mt-24 bg-white text-slate-900 rounded-t-[4rem] px-6 lg:px-20 py-20 border-b border-gray-100"
      >
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-[#022c22]">
            Sobre la Cámara
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed italic">
            La CÁMARA INMOBILIARIA DEL ESTADO BOLÍVAR (CIEBO) es una
            Asociación Civil sin fines de lucro, agrupa a instituciones, a personas jurídicas y
            naturales y que como actores del sector inmobiliario contribuyen con su acción e
            inversión al desarrollo del sector inmobiliario regional y nacional.
          </p>
          {/* Grid de Cards  */}
          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                title: "Reseña histórica",
                img: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800",
                desc: "Décadas de compromiso con el desarrollo regional.",
                path: "/historia"
              },
              {
                title: "Propósito",
                img: "https://gentecompetente.com/wp-content/uploads/2023/10/las-empresas-que-se-hacen-querer.jpg",
                desc: "Nuestra razón de ser y motor de cambio diario.",
                path: "/proposito"
              },
              {
                title: "Misión y Visión",
                img: "https://escalas.org/wp-content/uploads/2019/10/4-1.jpg",
                desc: "Hacia dónde proyectamos el futuro del sector.",
                path: "/mision_vision"
              },
            ].map((card, i) => (
              <Link 
                key={i} 
                to={card.path} 
                className="group cursor-pointer block" >
              <div key={i} className="group cursor-pointer">
                {/* Contenedor de Imagen */}
                <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] mb-4 shadow-2xl shadow-emerald-900/10">
                  <img
                    src={card.img}
                    alt={card.title}
                    className="w-full h-full object-cover  group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700 ease-in-out"
                  />
                  {/* Overlay sutil hover */}
                  <div className="absolute inset-0 bg-emerald-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>

                {/* Botón Inferior Estilo Card */}
                <div className="bg-emerald-600 group-hover:bg-emerald-500 text-white p-5 rounded-2xl flex items-center justify-between transition-colors duration-300 shadow-lg shadow-emerald-600/20">
                  <span className="font-bold uppercase tracking-wider text-sm">
                    {card.title}
                  </span>
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <span className="text-xl">→</span>
                  </div>
                </div>
              </div>
              </Link>
            ))}
          </div>

          {/* Botón de Contacto Final */}
          <div className="flex justify-center pt-8">
            <button className="px-10 py-3 border-2 border-emerald-500 text-emerald-600 rounded-full font-black uppercase text-xs tracking-widest hover:bg-emerald-500 hover:text-white transition-all">
              Contáctanos
            </button>
          </div>
        </div>
      </section>

      {/* --- SECCIÓN AFILIADOS --- */}
      <section
        id="afiliados"
        className=" scroll-mt-24 bg-slate-50 text-slate-900 px-6 lg:px-20 py-20"
      >
        <div className="flex flex-col lg:flex-row gap-16 items-center">
          <div className="lg:w-1/2 grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-100 text-center">
                <div className="text-emerald-600 font-bold text-3xl mb-2">
                 <Counter end={220} />
                </div>
                <p className="text-sm text-slate-500 font-medium uppercase tracking-tighter">
                  Afiliados
                </p>
              </div>
             <img
              src={featureImg}
              alt="Gestión"
              ref={revealImg} // Usamos su propio ref
              className="rounded-[2rem] h-64 w-full object-cover shadow-lg reveal-on-scroll"
            />
            </div>
            <div className="pt-12 space-y-4">
              <div ref={revealStats} className="bg-emerald-600 p-8 rounded-[2rem] text-white shadow-xl shadow-emerald-900/20 reveal-on-scroll">
                <p className="font-bold text-xl leading-snug"  >
                  Respaldo Gremial de Alto Nivel
                </p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-100 text-center">
                <div className="text-emerald-600 font-bold text-3xl mb-2">
                 <Counter end={30} />+
                </div>
                <p className="text-sm text-slate-500 font-medium uppercase">
                  Años de Historia
                </p>
              </div>
            </div>
          </div>

          <div ref={revealText} className="lg:w-1/2 space-y-6 reveal-on-scroll">
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-[#022c22]">
              ¿Por qué afiliarse?
            </h2>
            <p className="text-slate-600 text-lg">
              Al formar parte de la Cámara, accedes a una red nacional de
              contactos, asesoría legal de primera y programas de formación
              exclusivos.
            </p>
            <ul className="space-y-4 pt-4">
              {[
                "Certificación Profesional",
                "Respaldo Gremial Nacional",
                "Asesoría Legal Especializada",
                "Networking Estratégico",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 font-semibold text-slate-700"
                >
                  <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      {/* --- SECCION FORMACION --- */}
      <FormacionSection revealPanels={revealPanels} revealTitle={revealTitle}/>
      {/* --- SECCIÓN JUNTA DIRECTIVA --- */}
      <section
        id="directiva"
        className="bg-white px-6 lg:px-20 py-24 scroll-mt-24 " 
      >
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Encabezado con Botón Lateral */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <p className="text-emerald-600 font-black uppercase tracking-[0.3em] text-xs">
                Nuestro Equipo
              </p>
              <h2 className="text-5xl lg:text-7xl font-black text-[#022c22] tracking-tighter">
                Junta Directiva
              </h2>
            </div>
            <button className="px-8 py-4 bg-emerald-500 text-white rounded-full font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 self-start md:self-auto">
              Conócela
            </button>
          </div>
        
        <Link to={'/junta_directiva'}>
          <div className="max-w-4xl mx-auto group cursor-pointer">
            <div className="relative aspect-video overflow-hidden rounded-[2.5rem] mb-4 shadow-2xl shadow-emerald-900/10">
              <img
                src={Mision_img}
                alt="Junta Directiva"
                className="w-full h-full object-cover group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 ease-in-out"
              />
              <div className="absolute inset-0 bg-emerald-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
     
            {/* Botón Inferior de la Card */}
            <div className="bg-white border-2 border-gray-100 group-hover:border-emerald-500 p-6 rounded-[1.5rem] flex items-center justify-center transition-all duration-300 shadow-sm">
              <span className="font-black text-emerald-700 uppercase tracking-widest text-sm group-hover:scale-105 transition-transform">
                Conozca a la Junta Directiva
              </span>
            </div>
          </div>
        </Link>
        </div>
      </section>
      
      {/* --- SECCIÓN CONVENIOS Y BENEFICIOS --- */}
      <ConveniosSection revealTextConvenios={revealTextConvenios}/>

      <NoticiasSection scrollRef={scrollRef}/>
      {/* --- SECCIÓN NOTICIAS --- */}


      {/* --- FOOTER INFORMATIVO --- */}
      <footer className="bg-[#011a14] px-6 lg:px-20 py-16 text-center border-t border-white/5 space-y-6">
        <img src={logo} alt="Logo" className="h-10 mx-auto opacity-50" />
        <p className="text-gray-500 text-sm max-w-lg mx-auto leading-relaxed">
          Cámara Inmobiliaria del Estado Bolívar. Afiliada a la CIV. <br />
         Carrera Guri, Nro. 255-03-14, Alta Vista.
Sede de la Cámara de la Construcción.
        </p>
        <div className="flex justify-center gap-6 text-gray-400 text-xs">
          <a href="#" className="hover:text-emerald-400">
            Instagram
          </a>
          <a href="#" className="hover:text-emerald-400">
            Facebook
          </a>
          <a href="#" className="hover:text-emerald-400">
            LinkedIn
          </a>
        </div>
        <p className="text-gray-600 text-[10px] pt-4">
          © 2026 Cámara Inmobiliaria del Estado Bolívar.
        </p>
      </footer>

      {/* MODALES */}
      {isModalSesionOpen && (
        <LoginModal onClose={() => setIsSesionModalOpen(false)} />
      )}
      {isModalRegisterOpen && (
        <RegisterModal onClose={() => setIsRegisterModalOpen(false)} />
      )}
    </div>
  );
}
