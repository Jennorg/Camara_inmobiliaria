import React, { useState, useEffect } from "react";
import logo from "./assets/Logo.png";
import heroImg from "./assets/empresaria.png";
import featureImg from "./assets/empresaria_3.png";
import LoginModal from "./Components/LoginModal";
import RegisterModal from "./Components/RegisterModal";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import bgBolivar from "./assets/Camara_Metropolitana.jpg";
import Mision_img from "./assets/Mision.jpeg";

const NavItem = ({ title, options }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="flex items-center gap-1 hover:text-emerald-400 transition py-2 font-medium font-bold text-sm">
        {title}
        {options && (
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </button>

      {options && isOpen && (
        <div className="absolute top-full left-0 w-48 bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xl rounded-xl py-2 mt-0 border border-emerald-500/10 z-[60]">
          {options.map((opt, idx) => {
            const label = typeof opt === "string" ? opt : opt.label;
            const path = typeof opt === "string" ? "/" : opt.path;
            return (
              <Link
                key={idx}
                to={path}
                className="block px-4 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 transition text-xs font-bold"
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
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

  const menuConfig = [
    {
      title: "Nosotros",
      isDropdown: true,
      items: [
        { label: "Misión y Visión", path: "/mision_vision"},
        {label: "Junta Directiva", path: "/"},
        {label: "Historia", path: "/"},
      ],
    },
    { title: "Eventos", isDropdown: false , path:"/"},
    {
      title: "Afiliados",
      isDropdown: true,
      items: ["Directorio", "Beneficios", "Requisitos"],
    },
    {
      title: "Formación",
      isDropdown: true,
      items: ["Cursos", "Talleres", "Diplomados"],
    },
    {
      title: "Convenios",
      isDropdown: true,
      items: ["Institucionales", "Comerciales", "Internacionales"],
    },
    { title: "Normativas", isDropdown: false },
    {
      title: "Prensa",
      isDropdown: true,
      items: ["Noticias", "Galería", "Comunicados"],
    },
    { title: "Contacto", isDropdown: false },
  ];

  const opacity = scrollY > 10 ? 0.6 : 0;
  const textOpacity = scrollY > 10 ? 1 : 0;

  return (
    <div className="min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30 scroll-smooth">
      <div
        className={`${darkMode ? "dark bg-[#022c22]" : "bg-slate-50"} min-h-screen transition-colors duration-300 font-sans selection:bg-emerald-500/30 scroll-smooth`}
      >
        {/* --- NAVBAR --- */}
        <nav
          className={`${darkMode ? "dark bg-[#011a14]/90  border-white/10" : "bg-white/90  border-[#011a14]/10"} flex items-center justify-between px-6 py-5 lg:px-20 backdrop-blur-md sticky top-0 z-50 border-b `}
        >
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Logo Cámara"
              className="h-10 w-auto object-contain"
            />
            <div className="hidden sm:block leading-tight">
              <p
                className={`${darkMode ? "dark:text-white" : "dark:text-black"} font-bold text-sm tracking-widest uppercase`}
              >
                Cámara Inmobiliaria
              </p>
              <p
                className={`${darkMode ? "dark:text-white" : "dark:text-black"} text-emerald-500 text-[10px] font-bold`}
              >
                Estado Bolívar
              </p>
            </div>
          </div>

          {/* Links principales*/}
          <div className="hidden xl:flex gap-6 text-[11px] font-bold uppercase tracking-wider dark:text-gray-300 text-slate-600">
            <a href="#inicio" className="text-emerald-500 py-2">
              Inicio
            </a>
            {menuConfig.map((item, index) => (
              <NavItem key={index} title={item.title} options={item.items} />
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSesionModalOpen(true)}
              className="hidden md:block px-5 py-2 text-emerald-500 text-xs font-bold hover:text-emerald-600 transition"
            >
              Login
            </button>
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="px-6 py-2 bg-emerald-500 text-white dark:text-[#022c22] rounded-full text-xs font-bold hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
            >
              Registro
            </button>
            {/* Botón Modo Oscuro/Claro */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`pointer-events-auto p-3 rounded-2xl shadow-xl transition-all hover:rotate-12 ${
                darkMode ? "bg-white text-black" : "bg-[#022c22] text-white"
              }`}
            >
              {darkMode ? (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>
        </nav>

        {/* --- HERO SECTION --- */}
        <header
          id="inicio"
          className="relative scroll-mt-24 px-6 lg:px-20 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center min-h-[95vh] bg-cover"
          style={{
            backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.8), rgba(2, 44, 34, 0.8)), url(${bgBolivar})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
          }}
        >
          <div className="space-y-6">
            <h1
              className={`${darkMode ? "dark:text-white" : "dark:text-white"} text-5xl lg:text-7xl font-bold leading-[1.1] `}
            >
              Unidos por el{" "}
              <span className="text-emerald-500 italic">progreso</span>{" "}
              inmobiliario de Bolívar
            </h1>
            <p className="text-gray-300 text-lg max-w-md leading-relaxed">
              Representamos y fortalecemos a los profesionales del sector en el
              estado, impulsando la ética y el desarrollo sostenible.
            </p>
          </div>
        </header>
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
            Somos una Asociación Civil sin fines de lucro, que se rige por la
            Cámara Inmobiliaria del Estado Bolivar. Agrupa a instituciones y
            personas tanto naturales como jurídicas, quienes como actores de la
            industria inmobiliaria y dentro del marco de una visión compartida
            para el logro de su misión, contribuyen con su acción e inversión al
            desarrollo del Sector Inmobiliario Venezolano.
          </p>
          {/* Grid de Cards  */}
          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                title: "Reseña histórica",
                img: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800",
                desc: "Décadas de compromiso con el desarrollo regional.",
              },
              {
                title: "Propósito",
                img: "https://gentecompetente.com/wp-content/uploads/2023/10/las-empresas-que-se-hacen-querer.jpg",
                desc: "Nuestra razón de ser y motor de cambio diario.",
              },
              {
                title: "Misión y Visión",
                img: "https://escalas.org/wp-content/uploads/2019/10/4-1.jpg",
                desc: "Hacia dónde proyectamos el futuro del sector.",
              },
            ].map((card, i) => (
              <div key={i} className="group cursor-pointer">
                {/* Contenedor de Imagen */}
                <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] mb-4 shadow-2xl shadow-emerald-900/10">
                  <img
                    src={card.img}
                    alt={card.title}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700 ease-in-out"
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
                  220
                </div>
                <p className="text-sm text-slate-500 font-medium uppercase tracking-tighter">
                  Afiliados
                </p>
              </div>
              <img
                src={featureImg}
                alt="Gestión"
                className="rounded-[2rem] h-64 w-full object-cover shadow-lg"
              />
            </div>
            <div className="pt-12 space-y-4">
              <div className="bg-emerald-600 p-8 rounded-[2rem] text-white shadow-xl shadow-emerald-900/20">
                <p className="font-bold text-xl leading-snug">
                  Respaldo Gremial de Alto Nivel
                </p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-100 text-center">
                <div className="text-emerald-600 font-bold text-3xl mb-2">
                  30+
                </div>
                <p className="text-sm text-slate-500 font-medium uppercase">
                  Años de Historia
                </p>
              </div>
            </div>
          </div>

          <div className="lg:w-1/2 space-y-6">
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
      {/* --- SECCIÓN JUNTA DIRECTIVA --- */}
      <section
        id="directiva"
        className="bg-white px-6 lg:px-20 py-24 scroll-mt-24"
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

          <div className="max-w-4xl mx-auto group cursor-pointer">
            <div className="relative aspect-video overflow-hidden rounded-[2.5rem] mb-4 shadow-2xl shadow-emerald-900/10">
              <img
                src={Mision_img}
                alt="Junta Directiva"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 ease-in-out"
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
        </div>
      </section>
      {/* --- SECCIÓN CONVENIOS Y BENEFICIOS --- */}
      <section
        id="convenios"
        className="bg-white px-6 lg:px-50 py-24 scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Encabezado Principal */}
          <div className="space-y-4">
            <h2 className="text-5xl lg:text-7xl font-bold text-[#333333] tracking-tighter">
              Convenios y beneficios
            </h2>
          </div>

          {/* Grilla de Logotipos de Aliados */}
          {/* Usamos flex-wrap y items-center para que los logos de diferentes tamaños se vean alineados */}
          <div className="flex flex-wrap items-center justify-between gap-12 grayscale opacity-70 hover:grayscale-0 transition-all duration-700">
            {/* Logo UCAB */}
            <div className="h-12 w-auto group cursor-pointer">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYIgmOl4EASpo1hjggjQq_xP61myeh_nkr9w&s"
                alt="UCAB"
                className="h-full object-contain group-hover:scale-110 transition-transform"
              />
            </div>

            {/* Logo TotalSalud */}
            <div className="h-10 w-auto group cursor-pointer">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYIgmOl4EASpo1hjggjQq_xP61myeh_nkr9w&s"
                alt="Total Salud"
                className="h-full object-contain group-hover:scale-110 transition-transform"
              />
            </div>

            {/* Logo Fénix Salud */}
            <div className="h-12 w-auto group cursor-pointer">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYIgmOl4EASpo1hjggjQq_xP61myeh_nkr9w&s"
                alt="Fénix Salud"
                className="h-full object-contain group-hover:scale-110 transition-transform"
              />
            </div>
          </div>

          {/* Link inferior estilo Banner */}
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
      {/* --- SECCIÓN NOTICIAS --- */}
      <section
        id="noticias"
        className="bg-white text-slate-900 px-6 lg:px-20 py-20 rounded-b-[4rem] scroll-mt-24"
      >
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-4xl lg:text-5xl font-bold text-[#022c22] tracking-tighter">
              Actualidad y Noticias
            </h2>
            <p className="text-slate-500 mt-2 font-medium">
              Mantente informado sobre el mercado inmobiliario.
            </p>
          </div>
          <button className="text-emerald-600 font-bold hover:text-emerald-800 transition-colors flex items-center gap-2">
            Ver todas <span className="text-xl">→</span>
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          {[
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
          ].map((news, i) => (
            <div key={i} className="group cursor-pointer">
              <div className="relative aspect-[16/10] mb-6 overflow-hidden rounded-[2.5rem] shadow-xl shadow-emerald-900/5">
                {/* Overlay de color al hacer hover */}
                <div className="absolute inset-0 bg-emerald-900/20 opacity-0 group-hover:opacity-100 transition-opacity z-10 duration-500"></div>

                <img
                  src={news.img}
                  alt={news.t}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-700 ease-out"
                />

                {/* Badge sobre la imagen */}
                <span className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-sm text-emerald-700 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                  {news.tag}
                </span>
              </div>

              <div className="space-y-3 px-2">
                <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em]">
                  Bolívar • Feb 2026
                </p>
                <h4 className="text-2xl font-bold leading-tight text-[#022c22] group-hover:text-emerald-600 transition-colors">
                  {news.t}
                </h4>
                <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">
                  {news.d}
                </p>
                <div className="pt-2">
                  <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-500 transition-colors italic">
                    Leer más...
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- FOOTER INFORMATIVO --- */}
      <footer className="bg-[#011a14] px-6 lg:px-20 py-16 text-center border-t border-white/5 space-y-6">
        <img src={logo} alt="Logo" className="h-10 mx-auto opacity-50" />
        <p className="text-gray-500 text-sm max-w-lg mx-auto leading-relaxed">
          Cámara Inmobiliaria del Estado Bolívar. Afiliada a la CIV. <br />
          Piso 1, Centro Comercial Ciudad Alta Vista II, Puerto Ordaz.
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
