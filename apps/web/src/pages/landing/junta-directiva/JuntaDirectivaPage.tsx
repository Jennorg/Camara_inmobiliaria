import React, { useEffect, useState } from 'react'
import bgBolivar from '@/assets/Pzo.jpg'
import Navbar from '@/pages/landing/components/navbar/Navbar'
import Footer from '@/pages/landing/components/Footer'
import SEO from '@/components/SEO'

// Import directiva images from the repo
import imgFrancisco from '@/assets/Junta_directiva/francisco.png'
import imgZulay from '@/assets/Junta_directiva/Zulay.png'
import imgMargaret from '@/assets/Junta_directiva/Margaret.png'
import imgRomelia from '@/assets/Junta_directiva/Romelia.png'
import imgMargot from '@/assets/Junta_directiva/Margot.png'
import imgPedro from '@/assets/Junta_directiva/Pedro.png'
import imgGraciela from '@/assets/Junta_directiva/Graciela.png'
import imgYorjharry from '@/assets/Junta_directiva/Yorjharry.png'
import imgRina from '@/assets/Junta_directiva/Rina.png'
import imgPedroC from '@/assets/Junta_directiva/Pedro_C.png'

export function invalidateDirectivaCache() {
  // Función vacía para compatibilidad de importaciones sin romper la compilación
}

// ── Scroll reveal ──────────────────────────────────────────────────────────────
const useScrollReveal = () => {
  const [node, setNode] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) entry.target.classList.add('active') },
      { threshold: 0.1 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return (element: HTMLElement | null) => setNode(element)
}

interface MiembroDirectiva {
  nombre: string
  cargo: string
  foto: string
}

const directiva: MiembroDirectiva[] = [
  { nombre: 'Francisco Piñango', cargo: 'Presidente', foto: imgFrancisco },
  { nombre: 'Zulay Amaya', cargo: 'Vicepresidenta', foto: imgZulay },
  { nombre: 'Margaret Vásquez', cargo: 'Directora General', foto: imgMargaret },
  { nombre: 'Romelina Rodríguez', cargo: 'Directora de Finanzas', foto: imgRomelia },
  { nombre: 'Margot Castro', cargo: 'Directora de Asuntos Legales', foto: imgMargot },
  { nombre: 'Pedro Vallenilla', cargo: 'Director de Comunicaciones', foto: imgPedro },
  { nombre: 'Graciela Ledezma', cargo: 'Directora de Formación', foto: imgGraciela },
  { nombre: 'Yorjharry Vicent', cargo: 'Director de Eventos', foto: imgYorjharry },
  { nombre: 'Rina Centeno', cargo: 'Directora de Responsabilidad Social', foto: imgRina },
  { nombre: 'Pedro Castro', cargo: 'Director de Relaciones Interinstitucionales', foto: imgPedroC }
]

const DirectorCard = ({ nombre, cargo, foto, index }: { nombre: string; cargo: string; foto: string; index: number }) => {
  const setReveal = useScrollReveal()
  return (
    <div ref={setReveal} style={{ transitionDelay: `${index * 0.1}s` }} className='reveal-on-scroll group relative overflow-hidden rounded-[2.5rem] bg-white p-6 border border-slate-200 shadow-lg hover:shadow-2xl hover:shadow-emerald-900/20 transition-all duration-700 hover:-translate-y-2'>
      <div className='relative overflow-hidden rounded-[2rem] aspect-square mb-6 bg-gradient-to-br from-emerald-100 to-slate-200'>
        {foto ? (
          <img src={foto} alt={nombre} loading="lazy" decoding="async" className='w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-110' />
        ) : (
          <div className='w-full h-full flex items-center justify-center text-6xl font-black text-emerald-300'>
            {nombre.charAt(0)}
          </div>
        )}
        <div className='absolute inset-0 bg-gradient-to-t from-[#022c22]/80 via-[#022c22]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500' />
      </div>
      <div className='text-center space-y-3 relative z-10'>
        <h3 className='text-xl font-black text-[#022c22] leading-tight transition-colors duration-500 group-hover:text-emerald-500'>{nombre}</h3>
        <p className='text-emerald-700 font-bold uppercase tracking-[0.15em] text-[10px] bg-gradient-to-r from-emerald-50 to-emerald-100/80 py-2 px-4 rounded-full inline-block border border-emerald-200/50'>{cargo}</p>
      </div>
      <div className='absolute -bottom-20 -right-20 w-40 h-40 bg-emerald-500/5 rounded-full group-hover:scale-[4] transition-transform duration-700 ease-out' />
    </div>
  )
}

export default function EquipoDirectivo() {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'dark bg-[#022c22]' : 'bg-slate-50'}`}>
      <SEO 
        title="Junta Directiva" 
        description="Conoce a los líderes que guían la Cámara Inmobiliaria del Estado Bolívar. Compromiso y visión para el sector inmobiliario."
      />
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <header className='relative px-6 lg:px-20 py-16 lg:py-24 flex items-center justify-center min-h-[40vh] bg-cover animate-header-bg' style={{ backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.85), rgba(2, 44, 34, 0.85)), url(${bgBolivar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
        <div className='text-center space-y-4'>
          <p className='text-emerald-500 font-black uppercase tracking-[0.3em] text-xs animate-header-text' style={{ animationDelay: '0.2s', opacity: 0 }}>Liderazgo Gremial</p>
          <h1 style={{ animationDelay: '0.4s', opacity: 0 }} className='text-5xl lg:text-7xl font-black tracking-tighter animate-header-text text-white'>
            Junta <span className='text-emerald-500 italic'>Directiva</span>
          </h1>
          <p className='text-emerald-100/60 text-sm tracking-widest uppercase font-medium animate-header-text' style={{ animationDelay: '0.5s', opacity: 0 }}>Gestión 2024 - 2026</p>
        </div>
      </header>
      <main className='bg-[#f1f5f9] text-slate-900 rounded-t-[4rem] -mt-12 relative z-10 px-6 lg:px-20 py-24'>
        <div className='max-w-7xl mx-auto'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl lg:text-4xl font-black text-[#022c22] tracking-tight mb-4'>Conoce a Nuestra Junta Directiva</h2>
            <p className='text-slate-600 text-lg max-w-2xl mx-auto leading-relaxed'>Profesionales comprometidos con el desarrollo y fortalecimiento del sector inmobiliario en el estado Bolívar.</p>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10'>
            {directiva.map((miembro, index) => (
              <DirectorCard key={index} index={index} nombre={miembro.nombre} cargo={miembro.cargo} foto={miembro.foto} />
            ))}
          </div>

          <div className='mt-24 relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-[#022c22] via-[#044b3a] to-[#022c22] text-white text-center p-12 space-y-8 shadow-2xl shadow-emerald-900/30'>
            <div className='absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full -mr-40 -mt-40 blur-3xl' />
            <div className='absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/10 rounded-full -ml-32 -mb-32 blur-3xl' />
            <div className='relative z-10'>
              <div className='inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 rounded-full mb-6'>
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
                </svg>
                <span className='text-emerald-200 font-bold text-xs uppercase tracking-widest'>Contacto Directo</span>
              </div>
              <h2 className='text-3xl lg:text-4xl font-black tracking-tight mb-4'>¿Deseas contactar con la Junta Directiva?</h2>
              <p className='text-emerald-100/70 mb-8 max-w-xl mx-auto text-lg italic'>Estamos aquí para escucharte. Envíanos tu mensaje y nos pondremos en contacto contigo.</p>
              <button className='px-12 py-5 bg-gradient-to-r from-emerald-500 to-emerald-400 text-[#022c22] rounded-full font-black uppercase text-xs tracking-widest hover:from-emerald-400 hover:to-emerald-300 transition-all shadow-xl hover:shadow-2xl hover:shadow-emerald-500/30 hover:scale-105 active:scale-95'>Enviar un mensaje</button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
