import React, { useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { STATIC } from '@/pages/landing/config/staticContent'
import { formatNombreCard } from '@/utils/formatters'

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

const s = STATIC.directiva

const directivaMembers = [
  { nombre: 'Francisco Piñango', cargo: 'Presidente', foto_url: imgFrancisco },
  { nombre: 'Zulay Amaya', cargo: 'Vicepresidenta', foto_url: imgZulay },
  { nombre: 'Margaret Vásquez', cargo: 'Directora General', foto_url: imgMargaret },
  { nombre: 'Romelina Rodríguez', cargo: 'Directora de Finanzas', foto_url: imgRomelia },
  { nombre: 'Margot Castro', cargo: 'Directora de Asuntos Legales', foto_url: imgMargot },
  { nombre: 'Pedro Vallenilla', cargo: 'Director de Comunicaciones', foto_url: imgPedro },
  { nombre: 'Graciela Ledezma', cargo: 'Directora de Formación', foto_url: imgGraciela },
  { nombre: 'Yorjharry Vicent', cargo: 'Director de Eventos', foto_url: imgYorjharry },
  { nombre: 'Rina Centeno', cargo: 'Directora de Responsabilidad Social', foto_url: imgRina },
  { nombre: 'Pedro Castro', cargo: 'Director de Relaciones Interinstitucionales', foto_url: imgPedroC }
]

export default function DirectivaSection() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = useCallback((direction: 'left' | 'right') => {
    const current = scrollRef.current
    if (!current) return
    const containerWidth = current.offsetWidth
    const maxScroll = current.scrollWidth - current.offsetWidth
    if (direction === 'right') {
      if (current.scrollLeft >= maxScroll - 10) {
        current.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        current.scrollBy({ left: containerWidth, behavior: 'smooth' })
      }
    } else {
      if (current.scrollLeft <= 0) {
        current.scrollTo({ left: maxScroll, behavior: 'smooth' })
      } else {
        current.scrollBy({ left: -containerWidth, behavior: 'smooth' })
      }
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => scroll('right'), 5000)
    return () => clearInterval(interval)
  }, [scroll])

  return (
    <section id='directiva' className='bg-white px-6 lg:px-20 pt-0 pb-24 scroll-mt-24 overflow-hidden relative'>
      <div className='max-w-7xl mx-auto space-y-16 relative'>
        <div className='flex flex-col md:flex-row md:items-end justify-between gap-6'>
          <div className='space-y-4'>
            <p className='text-emerald-600 font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs'>
              {s.subtitulo}
            </p>
            <h2 className='text-4xl sm:text-5xl lg:text-7xl font-black text-[#022c22] tracking-tighter'>
              {s.titulo}
            </h2>
          </div>
        </div>

        <div className="relative group w-full">
          <button 
            onClick={() => scroll('left')} 
            className='absolute -left-2 md:-left-12 lg:-left-16 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white border border-emerald-50 shadow-xl text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0'
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M15 19l-7-7 7-7' /></svg>
          </button>

          <div 
            ref={scrollRef} 
            className="flex gap-8 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory w-full"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {directivaMembers.map((m, i) => (
              <div key={i} className="group relative flex flex-col items-center text-center space-y-4 w-full sm:w-[calc(50%-16px)] lg:w-[calc(25%-24px)] flex-shrink-0 snap-start max-w-xs">
                <div className="relative w-40 h-40 lg:w-48 lg:h-48 rounded-[2.5rem] overflow-hidden shadow-xl ring-4 ring-emerald-50 transition-all group-hover:ring-emerald-500/20">
                  <img
                    src={m.foto_url}
                    alt={m.nombre}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-[#022c22]">{formatNombreCard(m.nombre)}</h4>
                  <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mt-1 opacity-80">{m.cargo}</p>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={() => scroll('right')} 
            className='absolute -right-2 md:-right-12 lg:-right-16 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white border border-emerald-50 shadow-xl text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 translate-x-2 group-hover:translate-x-0'
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M9 5l7 7-7 7' /></svg>
          </button>
        </div>

        <div className="flex justify-center pt-8">
          <Link to="/junta-directiva" className="px-10 py-3 border-2 border-emerald-500 text-emerald-600 rounded-full font-black uppercase text-xs tracking-widest hover:bg-emerald-500 hover:text-white transition-all">
            {s.verTodos}
          </Link>
        </div>
      </div>
    </section>
  )
}
