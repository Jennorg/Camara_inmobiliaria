import React, { useState } from "react";
import { Link } from "react-router-dom";
import logoA from "../assets/Logo2.png";
import logo from "../assets/Logo3.png";

const NavItem = ({ title, options, Tpath }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
        <Link to={!options ? Tpath : "#"}>
      <button className="flex items-center gap-1 hover:text-emerald-400 transition py-2 font-medium font-bold text-sm">
        {title}
        {options && (
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
            </Link>
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

export default function Navbar({ darkMode, setDarkMode, setIsSesionModalOpen, setIsRegisterModalOpen }) {
  const menuConfig = [
    {
      title: "Nosotros",
      items: [
        { label: "Misión y Visión", path: "/mision_vision" },
        { label: "Junta Directiva", path: "/junta_directiva" },
        { label: "Historia", path: "/historia" },
        {label:"Dirección", path:"/direccion"}
      ],Tpath:''
    },
    { title: "CIV", items: null, Tpath:'/codigo_etica' },
    { title: "Eventos", items: null, Tpath:''},
    { title: "Afiliados", items: [{label:"Directorio", path:'/junta_directiva'}, "Beneficios", "Requisitos"],Tpath:'' },
    { title: "Formación", items: [{ label:"PREANI", path:'/talleres'}, "CIBIR","PEGI", "PADI"],Tpath:'' },
    { title: "Convenios", items: ["Institucionales", "Comerciales", "Internacionales"],Tpath:'' },
    { title: "Normativas", items: null,Tpath:'' },
    { title: "Prensa", items: [{label:"Noticias", path:'#noticias'}, "Galería", "Comunicados"],Tpath:'' },
    { title: "Contacto", items: null,Tpath:'' },
  ];

  return (
    <nav
      className={`${
        darkMode ? "dark bg-[#011a14]/90 border-white/10" : "bg-white/90 border-[#011a14]/10"
      } flex items-center justify-between px-6 py-5 lg:px-20 backdrop-blur-md sticky top-0 z-50 border-b`}
    >
      {/* LOGO CON LINK AL INICIO */}
      <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <img
          src={darkMode ? logo : logoA}
          alt="Logo Cámara"
          className="h-23 w-auto object-contain"
        />
      </Link>

      {/* Links principales */}
      <div className="hidden xl:flex ml-auto gap-6 text-[11px] font-bold uppercase tracking-wider dark:text-gray-300 text-slate-600">
        <a href="#inicio" className="text-emerald-500 py-2 flex items-center">
          Inicio
        </a>
        {menuConfig.map((item, index) => (
          <NavItem key={index} title={item.title} options={item.items} Tpath={item.Tpath || "/"} />
        ))}
      </div>

      <div className="flex items-center gap-4 ml-7">
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
          className={`p-3 rounded-2xl shadow-xl transition-all hover:rotate-12 ${
            darkMode ? "bg-white text-black" : "bg-[#022c22] text-white"
          }`}
        >
          {darkMode ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
      </div>
    </nav>
  );
}