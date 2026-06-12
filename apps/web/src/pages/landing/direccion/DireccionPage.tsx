import React, { useState } from 'react'
import Navbar from '@/pages/landing/components/navbar/Navbar'
import Footer from '@/pages/landing/components/Footer'

export default function Direccion() {
  const [darkMode, setDarkMode] = useState(false)
  return (
    <div className='min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30'>
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <header className='px-6 lg:px-20 py-24 bg-gradient-to-b from-[#011a14] to-[#022c22] text-center relative overflow-hidden'>
        <div className='relative z-10 space-y-4'>
          <h1 className='text-5xl lg:text-8xl font-black tracking-tighter leading-none'>
            Convocatoria a Asamblea <br />
            <span className='text-emerald-500 italic'>Extraordinaria</span>
          </h1>
          <p className='text-emerald-100/60 max-w-2xl mx-auto font-medium pt-4'>
            Dando cumplimiento al Documento Constitutivo y Estatutos Sociales (1999), se convoca a todos los Afiliados de la Cámara Inmobiliaria del estado Bolívar.
          </p>
        </div>
      </header>
      <main className='bg-white text-slate-900 rounded-t-[4rem] -mt-12 relative z-10 px-6 lg:px-24 py-20 shadow-xl'>
        <div className='max-w-4xl mx-auto space-y-12'>
          <header className='text-center space-y-4'>
            <h1 className='text-3xl font-bold tracking-tight text-slate-800'>CONVOCATORIA A ASAMBLEA EXTRAORDINARIA</h1>
            <p className='text-sm uppercase tracking-widest text-slate-500 font-semibold'>Cámara Inmobiliaria del estado Bolívar, S.C | RIF: J-30640738-3</p>
            <div className='h-1 w-20 bg-blue-600 mx-auto rounded-full' />
          </header>
          <section className='leading-relaxed text-slate-700 text-lg'>
            <p className='mb-6'>
              La Junta Directiva, actuando en plena vigencia de sus funciones para el <strong> período 2025-2027</strong> y en cumplimiento de los Estatutos Sociales (1999), Título IV, Capítulo I, Artículo 21, convoca oficialmente a sus Afiliados.
            </p>
            <div className='bg-slate-50 border-l-4 border-blue-500 p-8 my-8 rounded-r-lg shadow-sm'>
              <h3 className='font-bold text-slate-800 mb-4 uppercase text-sm'>Orden del Día:</h3>
              <ul className='space-y-3 list-disc list-inside text-slate-600'>
                <li>Formalización de la nueva Junta Directiva CIEBO (2025-2027).</li>
                <li>Información sobre situación legal y financiera.</li>
                <li>Propuesta para la sostenibilidad financiera.</li>
                <li>Propuesta de un contrato de prestación de servicios.</li>
                <li>Presentación del Plan de Gestión 2026.</li>
                <li>Información sobre el nuevo sistema de gestión y página web.</li>
              </ul>
            </div>
          </section>
          <footer className='grid md:grid-cols-2 gap-8 border-t border-slate-100 pt-10'>
            <div className='space-y-2'>
              <p className='text-sm font-bold text-slate-400 uppercase'>¿Cuándo?</p>
              <p className='text-slate-700'><strong>18 de febrero de 2026</strong><br />Hora: 2:00 P.M.</p>
            </div>
            <div className='space-y-2'>
              <p className='text-sm font-bold text-slate-400 uppercase'>¿Dónde?</p>
              <p className='text-slate-700 italic'>Sede de la Cámara de la Construcción, Carrera Guri, Nro. 255-03-14, Alta Vista, Ciudad Guayana.</p>
            </div>
          </footer>
        </div>
      </main>
      <Footer />
    </div>
  )
}
