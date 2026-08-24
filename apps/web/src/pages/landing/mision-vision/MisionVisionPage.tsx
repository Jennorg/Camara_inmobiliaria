import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import bgBolivar from '@/assets/Pzo.webp'
import Navbar from '@/pages/landing/components/navbar/Navbar'
import Footer from '@/pages/landing/components/Footer'
import SEO from '@/components/SEO'

const useScrollReveal = () => {
  const [ref, setRef] = useState(null)
  useEffect(() => {
    if (!ref) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) entry.target.classList.add('active') },
      { threshold: 0.1 }
    )
    observer.observe(ref)
    return () => observer.disconnect()
  }, [ref])
  return setRef
}

export default function MisionVision() {
  const [darkMode, setDarkMode] = useState(false)
  const navigate = useNavigate()
  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'dark bg-[#022c22]' : 'bg-slate-50'}`}>
      <SEO
        title="Misión y Visión"
        description="Nuestro propósito institucional: elevar el estándar del profesional inmobiliario en Bolívar y ser referentes de excelencia."
      />
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <header className='relative px-6 lg:px-20 py-16 lg:py-24 flex items-center justify-center min-h-[40vh] bg-cover animate-header-bg' style={{ backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.85), rgba(2, 44, 34, 0.85)), url(${bgBolivar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
        <div className='text-center space-y-4'>
          <p className='text-emerald-500 font-black uppercase tracking-[0.3em] text-xs animate-header-text' style={{ animationDelay: '0.2s', opacity: 0 }}>Mision y visión</p>
          <h1 className='text-5xl lg:text-7xl font-black tracking-tighter animate-header-text text-white' style={{ animationDelay: '0.4s', opacity: 0 }}>
            Nuestra <span className='text-emerald-500 italic'>Esencia</span>
          </h1>
          <p className='text-emerald-100/60 text-sm tracking-widest uppercase font-medium animate-header-text' style={{ animationDelay: '0.5s', opacity: 0 }}>Valores y Compromiso</p>
        </div>
      </header>
      <main className='bg-white text-slate-900 rounded-t-[4rem] -mt-12 relative z-10 px-6 lg:px-20 py-24'>
        <div className='max-w-5xl mx-auto grid md:grid-cols-2 gap-12 lg:gap-20'>
          <div className='group space-y-6 p-8 rounded-[2.5rem] bg-slate-50 border border-emerald-100 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 transition-colors duration-500'>
            <div className='w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20 group-hover:scale-110 transition-transform'>
              <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 10V3L4 14h7v7l9-11h-7z' /></svg>
            </div>
            <h2 className='text-4xl font-black text-[#022c22] tracking-tight uppercase'>Misión</h2>
            <p className='text-lg text-slate-600 leading-relaxed italic'>Promover el desarrollo inmobiliario del estado Bolívar, mediante la capacitación profesional de sus agremiados. A su vez, proteger los derechos de sus afiliados y clientes en relación al ejercicio de la profesión inmobiliaria de manera ética y transparente.</p>
          </div>
          <div className='group space-y-6 p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-sm hover:border-emerald-500 transition-colors duration-500'>
            <div className='w-14 h-14 bg-[#022c22] text-emerald-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform'>
              <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
              </svg>
            </div>
            <h2 className='text-4xl font-black text-[#022c22] tracking-tight uppercase'>Visión</h2>
            <p className='text-lg text-slate-600 leading-relaxed italic'>Ser fuente de conocimiento en el sector inmobiliario, impulsando el desarrollo sustentable de la profesión a través del tiempo. De igual manera, brindar a todo el público en general alianzas educativas comerciales y ser referentes en el área de bienes raíces.</p>
          </div>
        </div>
        <div className='max-w-4xl mx-auto mt-20 pt-10 border-t border-slate-100 text-center'>
          <p className='text-emerald-600 font-black uppercase tracking-widest text-xs mb-4'>Comprometidos con Bolívar</p>
          <button onClick={() => navigate('/')} className='px-10 py-4 border-2 border-[#022c22] text-[#022c22] rounded-full font-black uppercase text-xs tracking-widest hover:bg-[#022c22] hover:text-white transition-colors'>Conoce más sobre nosotros</button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
