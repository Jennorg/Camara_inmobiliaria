import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { API_URL } from '@/config/env'
import { STATIC } from '@/pages/landing/config/staticContent'
import { formatNombreCard } from '@/utils/formatters'

const s = STATIC.directiva

export default function DirectivaSection() {
  const [directivaMembers, setDirectivaMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${API_URL}/api/cms/directiva`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const activos = (data.data || [])
            .filter((m: any) => m.activo !== 0 && m.activo !== false)
            .sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0))
          setDirectivaMembers(activos)
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false))
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
    if (directivaMembers.length <= 4) return
    const interval = setInterval(() => scroll('right'), 5000)
    return () => clearInterval(interval)
  }, [directivaMembers, scroll])

  if (loading || directivaMembers.length === 0) return null

  return (
    <section id='directiva' className='bg-white px-6 lg:px-20 py-24 scroll-mt-24 overflow-hidden relative'>
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
          {directivaMembers.length > 4 && (
            <button 
              onClick={() => scroll('left')} 
              className='absolute -left-2 md:-left-12 lg:-left-16 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white border border-emerald-50 shadow-xl text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0'
            >
              <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M15 19l-7-7 7-7' /></svg>
            </button>
          )}

          <div 
            ref={scrollRef} 
            className="flex gap-8 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory w-full"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {directivaMembers.map((m, i) => (
              <div key={m.id || i} className="group relative flex flex-col items-center text-center space-y-4 w-full sm:w-[calc(50%-16px)] lg:w-[calc(25%-24px)] flex-shrink-0 snap-start max-w-xs">
                <div className="relative w-40 h-40 lg:w-48 lg:h-48 rounded-[2.5rem] overflow-hidden shadow-xl ring-4 ring-emerald-50 transition-all group-hover:ring-emerald-500/20">
                  <img
                    src={m.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nombre)}&background=10b981&color=fff&size=200`}
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

          {directivaMembers.length > 4 && (
            <button 
              onClick={() => scroll('right')} 
              className='absolute -right-2 md:-right-12 lg:-right-16 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white border border-emerald-50 shadow-xl text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 translate-x-2 group-hover:translate-x-0'
            >
              <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M9 5l7 7-7 7' /></svg>
            </button>
          )}
        </div>

        <div className="flex justify-center pt-8">
          <Link to="/junta_directiva" className="px-10 py-3 border-2 border-emerald-500 text-emerald-600 rounded-full font-black uppercase text-xs tracking-widest hover:bg-emerald-500 hover:text-white transition-all">
            {s.verTodos}
          </Link>
        </div>
      </div>
    </section>
  )
}
