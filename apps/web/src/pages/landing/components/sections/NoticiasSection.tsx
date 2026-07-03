import React, { useState, useEffect, useRef } from 'react'
import { API_URL } from '@/config/env'
import { STATIC } from '@/pages/landing/config/staticContent'

const s = STATIC.noticias

interface NewsCardProps {
  news: any;
  onClick: () => void;
  s: any;
}

function NewsCard({ news, onClick, s }: NewsCardProps) {
  const [bgColor, setBgColor] = useState('rgba(248, 250, 252, 1)');
  const imgUrl = news.imagen_url || news.img || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=75&w=600';

  useEffect(() => {
    if (!imgUrl) return;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          setBgColor(`rgb(${r}, ${g}, ${b})`);
        }
      } catch (e) {
        // Ignorar si hay problemas de CORS o canvas
      }
    };
    img.src = imgUrl;
  }, [imgUrl]);

  return (
    <div 
      onClick={onClick}
      className='w-full max-w-md md:w-[calc(50%-20px)] lg:w-[calc(33.333%-27px)] md:max-w-sm lg:max-w-[380px] flex-shrink-0 snap-start group/card cursor-pointer flex flex-col'
    >
      <div 
        style={{ backgroundColor: bgColor }}
        className='relative mb-0 overflow-hidden rounded-[2.5rem] shadow-xl shadow-emerald-900/5 aspect-[3/4] w-full flex items-center justify-center transition-colors duration-500'
      >
        <div className='absolute inset-0 bg-emerald-900/10 opacity-0 group-hover/card:opacity-100 transition-opacity z-20 duration-500' />
        <img 
          src={imgUrl} 
          alt={news.titulo} 
          loading="lazy"
          decoding="async"
          className='relative z-10 w-full h-full object-contain group-hover/card:scale-105 transition duration-700 ease-out' 
        />
      </div>
      
      <div className='px-2 pt-4 flex-grow flex flex-col justify-between'>
        <div className='space-y-3'>
          <div className='flex items-center justify-between gap-2'>
            <p className='text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em]'>
              {news.fecha_publicacion?.split('T')[0] || news.fecha?.split('T')[0] || s.cardMeta}
            </p>
            {news.lugar_evento && (
              <div className='text-[10px] text-slate-400 font-bold max-w-[150px] overflow-hidden whitespace-nowrap flex items-center gap-1'>
                <span className="shrink-0">📍</span>
                <div className="overflow-hidden relative w-full flex whitespace-nowrap">
                  {news.lugar_evento.length > 20 ? (
                    <div className="flex animate-marquee hover:[animation-play-state:paused] shrink-0 gap-6" style={{ animationDuration: '12s' }}>
                      <span className="shrink-0">{news.lugar_evento}</span>
                      <span className="shrink-0" aria-hidden="true">{news.lugar_evento}</span>
                    </div>
                  ) : (
                    <span className="truncate">{news.lugar_evento}</span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <h4 className='text-2xl font-bold leading-tight text-[#022c22] group-hover/card:text-emerald-600 transition-colors line-clamp-2'>
            {news.titulo || news.t}
          </h4>
          
          <p className='text-slate-500 text-sm leading-relaxed line-clamp-2'>
            {news.resumen || news.extracto || news.d}
          </p>
        </div>
        
        <div className='pt-4 flex items-center justify-between border-t border-slate-100/80 mt-4'>
          <span className='text-xs font-bold text-slate-400 group-hover/card:text-emerald-500 transition-colors italic'>
            {s.leerMas}
          </span>
          {news.fecha_evento && (
            <span className='text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/50'>
              📅 {news.fecha_evento}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NoticiasSection() {
  const [noticiasBase, setNoticiasBase] = useState<any[]>([])
  const [selectedNews, setSelectedNews] = useState<any | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${API_URL}/api/cms/noticias?publicado=1`)
      .then(r => r.json())
      .then(data => { 
        if (data.success && data.data.length > 0) setNoticiasBase(data.data) 
      })
      .catch(() => { })
  }, [])

  // Use the list of news exactly as it is (no duplication)
  const noticias = noticiasBase

  const scroll = React.useCallback((direction: 'left' | 'right') => {
    const current = scrollRef.current
    if (!current) return
    const cardWidth = current.offsetWidth / 3
    const maxScroll = current.scrollWidth - current.offsetWidth
    if (direction === 'right') {
      if (current.scrollLeft >= maxScroll - 10) current.scrollTo({ left: 0, behavior: 'instant' })
      else current.scrollBy({ left: cardWidth, behavior: 'smooth' })
    } else {
      if (current.scrollLeft <= 0) current.scrollTo({ left: maxScroll, behavior: 'instant' })
      else current.scrollBy({ left: -cardWidth, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    // Only scroll automatically if there is more than one news item
    if (noticiasBase.length <= 1) return
    const interval = setInterval(() => scroll('right'), 4000)
    return () => clearInterval(interval)
  }, [noticiasBase, scroll])

  if (noticiasBase.length === 0) return null

  return (
    <section id='noticias' className='bg-white text-slate-900 px-6 lg:px-10 pt-10 pb-10 lg:pb-24 scroll-mt-20 overflow-hidden'>
      <div className='max-w-8xl mx-auto flex justify-between items-end mb-12'>
        <div>
          <h2 className='text-4xl lg:text-5xl font-bold text-[#022c22] tracking-tighter'>
            {s.titulo}
          </h2>
          <p className='text-slate-500 mt-2 font-medium'>
            {s.subtitulo}
          </p>
        </div>
        <button className='hidden md:flex text-emerald-600 font-bold hover:text-emerald-800 transition-colors items-center gap-2'>
          {s.boton} <span className='text-xl'>→</span>
        </button>
      </div>

      <div className='relative max-w-8xl mx-auto group'>
        {/* Left Arrow Button */}
        {noticiasBase.length > 1 && (
          <button 
            onClick={() => scroll('left')} 
            className='absolute -left-2 md:-left-10 lg:-left-12 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white border border-emerald-50 shadow-xl text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0'
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M15 19l-7-7 7-7' /></svg>
          </button>
        )}

        <div 
          ref={scrollRef} 
          className={`flex gap-10 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-8 ${
            noticiasBase.length === 1 
              ? 'justify-center' 
              : noticiasBase.length === 2 
                ? 'justify-start md:justify-center' 
                : noticiasBase.length === 3
                  ? 'justify-start lg:justify-center'
                  : 'justify-start'
          }`} 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {noticias.map((news: any, i) => (
            <NewsCard 
              key={i} 
              news={news} 
              onClick={() => setSelectedNews(news)} 
              s={s} 
            />
          ))}
        </div>

        {/* Right Arrow Button */}
        {noticiasBase.length > 1 && (
          <button 
            onClick={() => scroll('right')} 
            className='absolute -right-2 md:-right-10 lg:-right-12 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white border border-emerald-50 shadow-xl text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 translate-x-2 group-hover:translate-x-0'
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M9 5l7 7-7 7' /></svg>
          </button>
        )}
      </div>

      {/* ── MODAL: NEWS DETAIL VIEW ────────────────────────────────────────── */}
      {selectedNews && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
          onClick={() => setSelectedNews(null)}
        >
          <div 
            className="bg-white text-slate-900 rounded-[2rem] max-w-2xl w-full max-h-[100dvh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col relative transition-transform duration-300 scale-100 scrollbar-thin"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Image */}
            <div className="relative w-full flex-shrink-0">
              <img 
                src={selectedNews.imagen_url || selectedNews.img || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=75&w=600'} 
                alt={selectedNews.titulo} 
                className="w-full h-auto" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
              
              <button 
                onClick={() => setSelectedNews(null)}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 text-white backdrop-blur-md rounded-full shadow-lg transition-all"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content Body */}
            <div className="p-8 space-y-6">
              <div className="space-y-2 pt-2">
                <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em]">
                  Publicado: {selectedNews.fecha_publicacion?.split('T')[0] || selectedNews.fecha?.split('T')[0]}
                </p>
                <h3 className="text-2xl md:text-3xl font-bold leading-tight text-[#022c22] pr-12">
                  {selectedNews.titulo || selectedNews.t}
                </h3>
              </div>

              {/* Highlighted Event Panel */}
              {(selectedNews.fecha_evento || selectedNews.hora_evento || selectedNews.lugar_evento) && (
                <div className="bg-emerald-50/70 border border-emerald-100 rounded-3xl p-5 space-y-3.5 shadow-sm">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Información Destacada del Evento
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-emerald-950 font-semibold">
                    {selectedNews.fecha_evento && (
                      <div className="bg-white/90 rounded-2xl p-3 shadow-xs border border-emerald-100/50 flex flex-col gap-0.5">
                        <span className="text-[9px] font-black uppercase text-emerald-600">📅 Fecha</span>
                        {selectedNews.fecha_evento}
                      </div>
                    )}
                    {selectedNews.hora_evento && (
                      <div className="bg-white/90 rounded-2xl p-3 shadow-xs border border-emerald-100/50 flex flex-col gap-0.5 flex-1">
                        <span className="text-[9px] font-black uppercase text-emerald-600">⏰ Hora</span>
                        {selectedNews.hora_evento}
                      </div>
                    )}
                    {selectedNews.lugar_evento && (
                      <div className="bg-white/90 rounded-2xl p-3 shadow-xs border border-emerald-100/50 flex flex-col gap-0.5 col-span-1">
                        <span className="text-[9px] font-black uppercase text-emerald-600">📍 Lugar</span>
                        {selectedNews.lugar_evento}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Summary / Extracto */}
              <p className="text-slate-700 text-sm md:text-base font-bold leading-relaxed border-l-4 border-emerald-500 pl-4 py-1 italic bg-slate-50/50 pr-2 rounded-r-xl">
                {selectedNews.resumen || selectedNews.extracto || selectedNews.d}
              </p>

              {/* Main Content */}
              <div className="text-slate-600 leading-relaxed text-sm whitespace-pre-line font-medium pt-2 border-t border-slate-50">
                {selectedNews.contenido || selectedNews.resumen || selectedNews.extracto || selectedNews.d}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
