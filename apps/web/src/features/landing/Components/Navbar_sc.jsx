import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/Logo.png"; // Ajusta la ruta según tu carpeta

export default function Navbar2(){
    const navigate = useNavigate();
    return(
           <nav className="flex items-center justify-between px-6 py-5 lg:px-20 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 bg-[#011a14]/90">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
                  <img src={logo} alt="Logo Cámara" className="h-10 w-auto object-contain" />
                  <div className="hidden sm:block leading-tight">
                    <p className="text-white font-bold text-sm tracking-widest uppercase">Cámara Inmobiliaria</p>
                    <p className="text-emerald-500 text-[10px] font-bold">Estado Bolívar</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/")}
                  className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-[#022c22] rounded-full text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Volver
                </button>
              </nav>
    )
}