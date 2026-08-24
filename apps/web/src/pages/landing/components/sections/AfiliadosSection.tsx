import React, { useState, useEffect, useRef } from 'react'
import featureImg from '@/assets/empresaria_3.webp'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { STATIC } from '@/pages/landing/config/staticContent'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'

const s = STATIC.afiliados

// Counter lives only here where needed
const Counter = ({ end, duration = 2000, suffix = '' }: { end: number, duration?: number, suffix?: string }) => {
  const [count, setCount] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const elementRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setHasStarted(true)
    }, { threshold: 0.5 })
    if (elementRef.current) observer.observe(elementRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!hasStarted) return
    let start = 0
    const increment = end / (duration / 16)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [hasStarted, end, duration])

  return <span ref={elementRef}>{count}{suffix}</span>
}

export default function AfiliadosSection() {
  const revealImg = useScrollReveal()
  const revealStats = useScrollReveal()
  const revealText = useScrollReveal()

  const [countAfiliados, setCountAfiliados] = useState<number>(s.contador)

  useEffect(() => {
    let active = true
    apiFetch(`${API_URL}/api/public/afiliados/buscar?limit=1`)
      .then((json) => {
        if (!active) return
        if (json.success && json.counts && typeof json.counts.total === 'number') {
          setCountAfiliados(json.counts.total)
        }
      })
      .catch((err) => console.error('Error cargando total de afiliados para la landing:', err))
    return () => { active = false }
  }, [])

  return (
    <section id='afiliados' className='scroll-mt-24 bg-slate-50 text-slate-900 px-6 lg:px-20 py-20'>
      <div className='flex flex-col lg:flex-row gap-16 items-center'>
        <div className='lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div className='space-y-4'>
            <div className='bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-100 text-center'>
              <div className='text-emerald-600 font-bold text-3xl mb-2'>
                <Counter end={countAfiliados} key={countAfiliados} />
              </div>
              <p className='text-sm text-slate-500 font-medium uppercase tracking-tighter'>
                {s.labelAfiliados}
              </p>
            </div>
            <img 
              src={featureImg} 
              alt='Gestión' 
              loading="lazy"
              decoding="async"
              ref={revealImg} 
              className='rounded-[2rem] h-64 w-full object-cover shadow-lg reveal-on-scroll' 
            />
          </div>
          <div className='pt-12 space-y-4'>
            <div ref={revealStats} className='bg-emerald-600 p-8 rounded-[2rem] text-white shadow-xl shadow-emerald-900/20 reveal-on-scroll'>
              <p className='font-bold text-xl leading-snug'>{s.respaldo}</p>
            </div>
            <div className='bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-100 text-center'>
              <div className='text-emerald-600 font-bold text-3xl mb-2'>25+</div>
              <p className='text-sm text-slate-500 font-medium uppercase'>{s.labelAños}</p>
            </div>
          </div>
        </div>

        <div ref={revealText} className='lg:w-1/2 space-y-6 reveal-on-scroll'>
          <h2 className='text-4xl lg:text-5xl font-bold tracking-tight text-[#022c22]'>
            {s.titulo}
          </h2>
          <p className='text-slate-600 text-lg'>
            {s.descripcion}
          </p>
          <ul className='space-y-4 pt-4'>
            {s.beneficios.map((item) => (
              <li key={item} className='flex items-center gap-3 font-semibold text-slate-700'>
                <span className='w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs'>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
