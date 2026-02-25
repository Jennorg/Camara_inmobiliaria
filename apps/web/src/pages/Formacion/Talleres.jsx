import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const cursos = [
  {
    id: 1,
    titulo: "Diplomado en Derecho Inmobiliario",
    instructor: "Abog. Luis Martínez",
    precio: "45.00",
    rating: 4.9,
    img: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=800",
    nivel: "Avanzado"
  },
  {
    id: 2,
    titulo: "Marketing Digital para Real Estate",
    instructor: "Lic. Elena Pérez",
    precio: "29.99",
    rating: 4.8,
    img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800",
    nivel: "Principiante"
  },
  {
    id: 3,
    titulo: "Tasación de Inmuebles Urbanos",
    instructor: "Ing. Carlos Ruiz",
    precio: "35.00",
    rating: 4.7,
    img: "https://www.cosasdevalor.com/images/categorias_valuatorias/inmuebles-urbanos.jpg",
    nivel: "Intermedio"
  },
  {
    id: 4,
    titulo: "Neuroventas para Corredores",
    instructor: "Coach Mario Vargas",
    precio: "19.99",
    rating: 5.0,
    img: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800",
    nivel: "Intermedio"
  }
];

export default function Cursos() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);

  return (
    <section 
      id="cursos" 
      className={`relative min-h-screen transition-all duration-700 px-6 lg:px-20 py-24 scroll-mt-24 ${
        darkMode 
          ? 'bg-[#011a14] text-white' 
          : 'bg-[#f8fafc] text-slate-900'
      }`}
    >
      {/* --- DECORACIÓN DE FONDO (Para que no sea simplón) --- */}
      <div className={`absolute inset-0 opacity-20 pointer-events-none ${darkMode ? 'opacity-10' : 'opacity-40'}`} 
           style={{ backgroundImage: `radial-gradient(#10b981 0.5px, transparent 0.5px)`, backgroundSize: '24px 24px' }}>
      </div>

      {/* --- BARRA DE CONTROL SUPERIOR --- */}
      <div className="fixed top-6 left-0 w-full px-6 lg:px-20 flex justify-between items-center z-[60] pointer-events-none">
        <button 
          onClick={() => navigate('/')}
          className="pointer-events-auto flex items-center gap-2 px-6 py-3 bg-emerald-500 text-[#022c22] rounded-2xl font-black text-xs shadow-2xl hover:bg-emerald-400 transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          VOLVER
        </button>

        {/* Botón Modo Oscuro/Claro */}

        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`pointer-events-auto p-3 rounded-2xl shadow-xl transition-all hover:rotate-12 ${
            darkMode ? 'bg-yellow-400 text-black' : 'bg-[#022c22] text-white'
          }`}
        >
          {darkMode ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
          )}
        </button>
      </div>

      {/* --- HEADER --- */}
      <div className="relative text-center max-w-4xl mx-auto mb-20 space-y-6 pt-10">
  
        <h2 className={`text-5xl lg:text-7xl font-black tracking-tighter transition-colors ${darkMode ? 'text-white' : 'text-[#022c22]'}`}>
          Centro de <span className="text-emerald-500 italic">Formación</span>
        </h2>
        <p className={`text-lg font-medium max-w-2xl mx-auto ${darkMode ? 'text-emerald-50/60' : 'text-slate-600'}`}>
          Programas de alto nivel diseñados para los líderes del mercado inmobiliario actual.
        </p>
        
        <div className="flex flex-wrap justify-center gap-3 pt-4">
          {['Todos', 'Legal', 'Ventas', 'Tasación', 'Marketing'].map((cat) => (
            <button key={cat} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all shadow-sm border ${
              darkMode 
                ? 'border-white/10 text-white bg-white/5 hover:bg-emerald-500 hover:text-white' 
                : 'border-slate-200 text-slate-600 bg-white hover:border-emerald-500 hover:text-emerald-600'
            }`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* --- GRID DE CURSOS --- */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
  {cursos.map((curso) => (
    <div 
      key={curso.id} 
      className={`group rounded-[2.5rem] overflow-hidden border-2 transition-all duration-500 hover:-translate-y-3 ${
        darkMode 
          ? 'bg-[#022c22]/50 backdrop-blur-md border-white shadow-[0_20px_50px_rgba(0,0,0,0.3)]' 
          // MODO CLARO: Borde verde esmeralda suave que se intensifica al hacer hover
          : 'bg-white border-emerald-50 shadow-[0_15px_35px_rgba(16,185,129,0.05)] border-emerald-500'
      }`}
    >
      <div className="relative h-56 overflow-hidden">
        <img 
          src={curso.img} 
          alt={curso.titulo} 
          className="w-full h-full object-cover group-hover:scale-110 transition duration-1000" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-5 left-5 bg-emerald-500 text-[#022c22] px-4 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-lg">
          {curso.nivel}
        </div>
      </div>

      <div className="p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3-.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className={`text-sm font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{curso.rating}</span>
          </div>
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">Certificado CIV</span>
        </div>
        
        <h3 className={`font-black text-xl leading-[1.2] transition-colors min-h-[3rem] ${
          darkMode ? 'text-white group-hover:text-emerald-400' : 'text-[#022c22] group-hover:text-emerald-600'
        }`}>
          {curso.titulo}
        </h3>
        
        <p className={`text-xs font-bold ${darkMode ? 'text-emerald-200/40' : 'text-slate-400'}`}>
          CON: <span className={darkMode ? 'text-emerald-400' : 'text-emerald-600'}>{curso.instructor.toUpperCase()}</span>
        </p>
        
        {/* Línea divisoria también en verde para el modo claro */}
        <div className={`h-[1px] w-full ${darkMode ? 'bg-white/5' : 'bg-emerald-100'}`} />
        
        <div className="flex items-center justify-between pt-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase">Inversión</span>
            <span className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-[#022c22]'}`}>${curso.precio}</span>
          </div>
          <button className={`p-4 rounded-2xl transition-all active:scale-90 ${
            darkMode 
              ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-[#011a14]' 
              : 'bg-emerald-500 text-white hover:bg-[#022c22] shadow-lg shadow-emerald-200'
          }`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  ))}
</div>
    </section>
  );
}