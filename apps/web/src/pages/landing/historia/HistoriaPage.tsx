import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import bgBolivar from '@/assets/Camara_Metropolitana.jpg'
import Navbar from '@/pages/landing/components/navbar/Navbar'
import Footer from '@/pages/landing/components/Footer'
import SEO from '@/components/SEO'
import { API_URL } from '@/config/env'

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

const HitoHistoria = ({ año, titulo, descripcion, index }: { año: string, titulo: string, descripcion: string, index: number }) => {
  const setReveal = useScrollReveal()
  const isEven = index % 2 === 0
  return (
    <div ref={setReveal} className='reveal-on-scroll relative mb-12 md:mb-24 flex flex-col md:flex-row items-center'>
      <div className='absolute left-1/2 -translate-x-1/2 hidden md:flex w-10 h-10 rounded-full bg-emerald-500 border-4 border-white z-20 shadow-lg shadow-emerald-900/20' />
      <div className={`w-full md:w-1/2 ${isEven ? 'md:pr-16 md:text-right' : 'md:pl-16 md:order-last text-left'}`}>
        <span className='text-emerald-500 font-black text-4xl md:text-5xl tracking-tighter block mb-2'>{año}</span>
        <h3 className='text-2xl font-black text-[#022c22] mb-4 uppercase tracking-tight'>{titulo}</h3>
        <p className='text-slate-600 leading-relaxed text-lg italic'>{descripcion}</p>
      </div>
      <div className='hidden md:block md:w-1/2' />
    </div>
  )
}

export default function Historia() {
  const [darkMode, setDarkMode] = useState(false)
  const navigate = useNavigate()
  const [hitos, setHitos] = useState<{ año: string, titulo: string, descripcion: string }[]>([])

  useEffect(() => {
    fetch(`${API_URL}/api/cms/hitos`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data.length > 0) {
          setHitos(data.data.map((h: any) => ({ año: h.anio, titulo: h.titulo, descripcion: h.descripcion })))
        }
      })
      .catch(() => {})
  }, [])
  return (
    <div className='min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30 scroll-smooth'>
      <SEO 
        title="Nuestra Historia" 
        description="Conoce la trayectoria de la Cámara Inmobiliaria del Estado Bolívar. Décadas impulsando el profesionalismo inmobiliario en la región."
      />
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <header
        className='relative px-6 lg:px-20 py-16 lg:py-24 flex items-center justify-center min-h-[45vh] bg-cover animate-header-bg'
        style={{ backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.88), rgba(2, 44, 34, 0.88)), url(${bgBolivar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
      >
        <div className='text-center space-y-4'>
          <p className='text-emerald-500 font-black uppercase tracking-[0.3em] text-xs animate-header-text' style={{ animationDelay: '0.2s', opacity: 0 }}>Nuestra Trayectoria</p>
          <h1 className='text-5xl lg:text-7xl font-black tracking-tighter animate-header-text' style={{ animationDelay: '0.4s', opacity: 0 }}>
            Décadas de <span className='text-emerald-500 italic'>Historia</span>
          </h1>
          <div className='w-20 h-1 bg-emerald-500 mx-auto mt-6 animate-header-text' style={{ animationDelay: '0.6s', opacity: 0 }} />
        </div>
      </header>
      <main className='bg-white text-slate-900 rounded-t-[4rem] -mt-12 relative z-10 px-6 lg:px-20 py-24'>
        <div className='max-w-6xl mx-auto'>
          <div className='text-center mb-20 space-y-4'>
            <h2 className='text-3xl font-black text-[#022c22] uppercase tracking-tight'>Un legado en movimiento</h2>
            <p className='max-w-2xl mx-auto text-slate-500'>Desde nuestros inicios, hemos trabajado para ser el pilar del desarrollo inmobiliario en el sur de Venezuela.</p>
          </div>
          <div className='relative'>
            <div className='absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-slate-100 hidden md:block' />
            {hitos.map((hito, index) => (
              <HitoHistoria key={index} index={index} año={hito.año} titulo={hito.titulo} descripcion={hito.descripcion} />
            ))}
          </div>
          <div className='mt-20 p-12 rounded-[3rem] bg-slate-50 border border-emerald-100 text-center space-y-6'>
            <h3 className='text-2xl font-black text-[#022c22]'>¿Quieres ser parte de nuestra historia futura?</h3>
            <button onClick={() => navigate('/contacto')} className='px-10 py-4 bg-[#022c22] text-emerald-400 rounded-full font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-xl shadow-emerald-900/10'>
              Afíliate hoy mismo
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
