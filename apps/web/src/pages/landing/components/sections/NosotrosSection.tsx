import React from 'react'
import { Link } from 'react-router-dom'
import { STATIC } from '@/pages/landing/config/staticContent'
import { useScrollReveal } from '@/hooks/useScrollReveal'

const s = STATIC.nosotros

export default function NosotrosSection() {
  const revealTitle = useScrollReveal()
  const revealCards = useScrollReveal()

  return (
    <section id='nosotros' className='scroll-mt-24 bg-white text-slate-900 px-6 lg:px-20 py-24 border-b border-slate-100 relative z-10 -mt-12'>
      <div className='max-w-6xl mx-auto text-center space-y-12'>
        <div ref={revealTitle} className='space-y-4 reveal-on-scroll'>
          <p className='text-emerald-600 font-black uppercase tracking-[0.3em] text-xs'>
            Nuestra Institución
          </p>
          <h2 className='text-4xl lg:text-6xl font-black text-[#022c22] tracking-tighter'>
            {s.titulo}
          </h2>
          <div className='w-20 h-1.5 bg-emerald-500 mx-auto rounded-full' />
          <p className='text-xl text-slate-600 leading-relaxed italic max-w-3xl mx-auto pt-4'>
            {s.descripcion}
          </p>
        </div>

        <div ref={revealCards} className='grid md:grid-cols-3 gap-8 lg:gap-12 reveal-on-scroll' style={{ transitionDelay: '0.2s' }}>
          {s.cards.map((card: any) => (
            <Link
              key={card.path || card.title}
              to={card.path}
              className="group cursor-pointer block" >
              <div className="group cursor-pointer">
                {/* Contenedor de Imagen */}
                <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] mb-4 shadow-2xl shadow-emerald-900/10">
                  <img
                    src={card.img}
                    alt={card.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover  group-hover:grayscale-0 group-hover:scale-110 transition-transform duration-700 ease-in-out"
                  />
                  {/* Overlay sutil hover */}
                  <div className="absolute inset-0 bg-emerald-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>

                {/* Botón Inferior Estilo Card */}
                <div className="bg-emerald-600 group-hover:bg-emerald-500 text-white p-5 rounded-2xl flex items-center justify-between transition-colors duration-300 shadow-lg shadow-emerald-600/20">
                  <span className="font-bold uppercase tracking-wider text-sm">
                    {card.title}
                  </span>
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <span className="text-xl">→</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

