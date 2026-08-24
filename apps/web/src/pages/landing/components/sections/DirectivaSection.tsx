import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { STATIC } from '@/pages/landing/config/staticContent'
import { formatNombreCard } from '@/utils/formatters'
import { apiUrl } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'

// Import directiva images from the repo
import imgFrancisco from '@/assets/Junta_directiva/francisco.webp'
import imgZulay from '@/assets/Junta_directiva/Zulay.webp'
import imgMargaret from '@/assets/Junta_directiva/Margaret.webp'
import imgRomelia from '@/assets/Junta_directiva/Romelia.webp'
import imgMargot from '@/assets/Junta_directiva/Margot.webp'
import imgPedro from '@/assets/Junta_directiva/Pedro.webp'
import imgGraciela from '@/assets/Junta_directiva/Graciela.webp'
import imgYorjharry from '@/assets/Junta_directiva/Yorjharry.webp'
import imgRina from '@/assets/Junta_directiva/Rina.webp'
import imgPedroC from '@/assets/Junta_directiva/Pedro_C.webp'

const s = STATIC.directiva

interface MiembroDirectiva {
  id_afiliado?: number | string
  codigo?: string
  nombre: string
  cargo: string
  foto_url: string
}

const fallbackDirectiva: MiembroDirectiva[] = [
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
  const [directivaMembers, setDirectivaMembers] = useState<MiembroDirectiva[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const fetchDirectiva = async () => {
      try {
        const data = await apiFetch(apiUrl('/api/cms/directiva'))
        if (!active) return
        if (data && data.success && Array.isArray(data.data)) {
          const activeMembers = data.data
            .filter((m: any) => (m.activo === 1 || m.activo === true) && m.foto_url)
            .map((m: any) => ({
              id_afiliado: m.id_afiliado,
              codigo: m.codigo,
              nombre: m.nombre,
              cargo: m.cargo,
              foto_url: m.foto_url
            }))
          setDirectivaMembers(activeMembers.length > 0 ? activeMembers : fallbackDirectiva)
        } else {
          setDirectivaMembers(fallbackDirectiva)
        }
      } catch {
        if (active) setDirectivaMembers(fallbackDirectiva)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchDirectiva()
    return () => { active = false }
  }, [])

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
    <section id='directiva' className='bg-white px-6 lg:px-20 pt-20 lg:pt-24 pb-24 scroll-mt-24 overflow-hidden relative'>
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
          {/* Mobile Grid View */}
          <div className="grid grid-cols-2 gap-3.5 sm:hidden w-full">
            {loading ? (
              Array.from({ length: 4 }).map((_, skelIdx) => (
                <div key={`dir-mob-skel-${skelIdx}`} className="animate-pulse bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col items-center text-center space-y-3">
                  <div className="w-full aspect-[4/5] rounded-xl bg-slate-200" />
                  <div className="space-y-1.5 w-full flex flex-col items-center">
                    <div className="bg-slate-200 h-4 w-3/4 rounded-md" />
                    <div className="bg-slate-200 h-3 w-1/2 rounded-full" />
                  </div>
                </div>
              ))
            ) : (
              directivaMembers.map((m) => {
                const cardContent = (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-3 flex flex-col items-center text-center space-y-2.5 h-full shadow-xs hover:shadow-md transition">
                    <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden shadow-xs bg-slate-100">
                      <img
                        src={m.foto_url}
                        alt={m.nombre}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="w-full flex flex-col items-center">
                      <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">{formatNombreCard(m.nombre)}</h4>
                      <p className="text-[9px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1.5 line-clamp-1 border border-emerald-100">{m.cargo}</p>
                    </div>
                  </div>
                )

                const memberKey = m.id_afiliado || m.codigo || m.nombre;
                if (m.id_afiliado || m.codigo) {
                  return (
                    <Link key={memberKey} to={`/miembros/${m.codigo || m.id_afiliado}`} className="block h-full cursor-pointer">
                      {cardContent}
                    </Link>
                  )
                }
                return <div key={memberKey} className="h-full">{cardContent}</div>
              })
            )}
          </div>

          {/* Desktop & Tablet Carousel View */}
          <button 
            onClick={() => scroll('left')} 
            className='hidden sm:flex absolute -left-2 md:-left-12 lg:-left-16 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white border border-emerald-50 shadow-xl text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors transition-transform duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0'
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M15 19l-7-7 7-7' /></svg>
          </button>

          <div 
            ref={scrollRef} 
            className="hidden sm:flex gap-8 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory w-full"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {loading ? (
              Array.from({ length: 4 }).map((_, skelIdx) => (
                <div key={`dir-desk-skel-${skelIdx}`} className="animate-pulse flex flex-col items-center text-center space-y-4 sm:w-[calc(50%-16px)] lg:w-[calc(25%-24px)] flex-shrink-0 snap-start max-w-xs">
                  <div className="w-full h-52 lg:w-48 lg:h-60 rounded-[2.5rem] bg-slate-200" />
                  <div className="space-y-2 flex flex-col items-center w-full">
                    <div className="bg-slate-200 h-5 w-3/4 rounded-md animate-pulse" />
                    <div className="bg-slate-200 h-3.5 w-1/2 rounded-full animate-pulse" />
                  </div>
                </div>
              ))
            ) : (
              directivaMembers.map((m) => {
                const cardInner = (
                  <>
                    <div className="relative w-full h-52 lg:w-48 lg:h-60 rounded-[2.5rem] overflow-hidden shadow-md ring-4 ring-slate-100 transition-colors group-hover:ring-slate-200 aspect-[4/5]">
                      <img
                        src={m.foto_url}
                        alt={m.nombre}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div>
                      <h4 className="text-base sm:text-lg font-bold text-slate-800">{formatNombreCard(m.nombre)}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{m.cargo}</p>
                    </div>
                  </>
                )

                const memberKey = m.id_afiliado || m.codigo || m.nombre;
                if (m.id_afiliado || m.codigo) {
                  return (
                    <Link
                      key={memberKey}
                      to={`/miembros/${m.codigo || m.id_afiliado}`}
                      className="group relative flex flex-col items-center text-center space-y-3 sm:space-y-4 sm:w-[calc(50%-16px)] lg:w-[calc(25%-24px)] flex-shrink-0 snap-start max-w-xs cursor-pointer"
                    >
                      {cardInner}
                    </Link>
                  )
                }

                return (
                  <div
                    key={memberKey}
                    className="group relative flex flex-col items-center text-center space-y-3 sm:space-y-4 sm:w-[calc(50%-16px)] lg:w-[calc(25%-24px)] flex-shrink-0 snap-start max-w-xs"
                  >
                    {cardInner}
                  </div>
                )
              })
            )}
          </div>

          <button 
            onClick={() => scroll('right')} 
            className='hidden sm:flex absolute -right-2 md:-right-12 lg:-right-16 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white border border-emerald-50 shadow-xl text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors transition-transform duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 translate-x-2 group-hover:translate-x-0'
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M9 5l7 7-7 7' /></svg>
          </button>
        </div>

        <div className="flex justify-center pt-8">
          <Link to="/junta-directiva" className="px-10 py-3 border-2 border-emerald-500 text-emerald-600 rounded-full font-black uppercase text-xs tracking-widest hover:bg-emerald-500 hover:text-white transition-colors">
            {s.verTodos}
          </Link>
        </div>
      </div>
    </section>
  )
}
