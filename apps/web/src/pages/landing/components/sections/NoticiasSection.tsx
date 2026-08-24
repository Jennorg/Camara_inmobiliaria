import React, { useState, useEffect, useRef } from 'react'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'
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
  const isSoloImagen = news.tag === 'solo_imagen' || news.categoria === 'solo_imagen' || news.resumen === '[SOLO_IMAGEN]' || news.extracto === '[SOLO_IMAGEN]' || (typeof news.resumen === 'string' && news.resumen.includes('[SOLO_IMAGEN]')) || (!news.resumen && !news.contenido && !news.extracto && !news.d);

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

  if (isSoloImagen) {
    return (
      <div
        onClick={onClick}
        className='w-[82vw] xs:w-[320px] sm:w-[360px] md:w-[380px] lg:w-[400px] flex-shrink-0 snap-start group/card cursor-pointer flex flex-col'
      >
        <div
          style={{ backgroundColor: bgColor }}
          className='relative overflow-hidden rounded-[2.5rem] shadow-2xl shadow-emerald-950/10 aspect-[3/4] w-full flex items-center justify-center transition-colors duration-500 group-hover/card:scale-[1.02] group-hover/card:shadow-emerald-900/20 ring-1 ring-slate-200/80 group-hover/card:ring-emerald-500/60'
        >
          <div className='absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 opacity-60 group-hover/card:opacity-30 transition-opacity z-20 duration-500' />
          <img
            src={imgUrl}
            alt={news.titulo || 'Afiche'}
            loading="lazy"
            decoding="async"
            className='relative z-10 w-full h-full object-contain transition-transform duration-700 ease-out group-hover/card:scale-105'
          />


        </div>

        {/* Nombre del Curso / Conferencia y detalles debajo de la foto */}
        <div className='px-2 pt-3.5 flex-grow flex flex-col justify-between space-y-2'>
          <div className='space-y-1.5'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em]'>
                {news.fecha_evento || news.fecha?.split('T')[0] || 'Próximamente'}
              </p>
              {news.lugar_evento && (
                <span className="text-[10px] text-slate-400 font-bold truncate max-w-[160px] flex items-center gap-1">
                  <MapPin size={11} className="shrink-0 text-slate-400" />
                  <span className="truncate">{news.lugar_evento}</span>
                </span>
              )}
            </div>

            <h4 className='text-xl md:text-2xl font-bold leading-tight text-[#022c22] group-hover/card:text-emerald-600 transition-colors line-clamp-2'>
              {news.titulo || 'Afiche Informativo'}
            </h4>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className='w-[82vw] xs:w-[320px] sm:w-[360px] md:w-[380px] lg:w-[400px] flex-shrink-0 snap-start group/card cursor-pointer flex flex-col'
    >
      <div
        style={{ backgroundColor: bgColor }}
        className='relative mb-0 overflow-hidden rounded-[2.5rem] shadow-2xl shadow-emerald-950/10 aspect-[3/4] w-full flex items-center justify-center transition-colors duration-500 ring-1 ring-slate-200/80 group-hover/card:ring-emerald-500/60'
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

      <div className='px-2 pt-4 flex-grow flex flex-col justify-between space-y-3'>
        <div className='space-y-2.5'>
          <div className='flex items-center justify-between gap-2'>
            <p className='text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em]'>
              {news.fecha_evento || news.fecha?.split('T')[0] || 'Próximamente'}
            </p>
            {news.lugar_evento && (
              <div className='text-[10px] text-slate-400 font-bold max-w-[150px] overflow-hidden whitespace-nowrap flex items-center gap-1'>
                <MapPin size={11} className="shrink-0 text-slate-400" />
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

          <h4 className='text-xl md:text-2xl font-bold leading-tight text-[#022c22] group-hover/card:text-emerald-600 transition-colors line-clamp-2'>
            {news.titulo || news.t}
          </h4>

          <p className='text-slate-500 text-xs md:text-sm leading-relaxed line-clamp-2 font-medium'>
            {news.resumen || news.extracto || news.d}
          </p>
        </div>

        <div className='pt-3 flex items-center justify-between border-t border-slate-100/80 mt-2'>
          <span className='text-xs font-bold text-slate-400 group-hover/card:text-emerald-500 transition-colors italic'>
            {s.leerMas}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function NoticiasSection() {
  const [noticiasBase, setNoticiasBase] = useState<any[]>([])
  const [selectedNews, setSelectedNews] = useState<any | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    apiFetch(`${API_URL}/api/cms/noticias?publicado=1`)
      .then(data => {
        if (!active) return
        if (data.success && data.data.length > 0) setNoticiasBase(data.data)
      })
      .catch(() => { })
    return () => { active = false }
  }, [])

  const noticias = noticiasBase

  const scroll = React.useCallback((direction: 'left' | 'right') => {
    const current = scrollRef.current
    if (!current) return
    const firstCard = current.firstElementChild as HTMLElement
    const cardStep = firstCard ? firstCard.offsetWidth + 32 : 380
    const maxScroll = current.scrollWidth - current.clientWidth

    if (direction === 'right') {
      if (current.scrollLeft >= maxScroll - 20) {
        current.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        current.scrollBy({ left: cardStep, behavior: 'smooth' })
      }
    } else {
      if (current.scrollLeft <= 20) {
        current.scrollTo({ left: maxScroll, behavior: 'smooth' })
      } else {
        current.scrollBy({ left: -cardStep, behavior: 'smooth' })
      }
    }
  }, [])

  useEffect(() => {
    // Only scroll automatically if there is more than one item and not hovered
    if (noticiasBase.length <= 1 || isHovered) return
    const interval = setInterval(() => scroll('right'), 4500)
    return () => clearInterval(interval)
  }, [noticiasBase, scroll, isHovered])

  if (noticiasBase.length === 0) return null

  return (
    <section id='noticias' className='bg-slate-50/50 text-slate-900 px-6 lg:px-10 pt-12 pb-6 lg:pb-10 scroll-mt-20 overflow-hidden border-y border-slate-100'>
      <div className='max-w-8xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10'>
        <div>
          <h2 className='text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#022c22] tracking-tight'>
            Próximos Eventos y Noticias
          </h2>
        </div>
      </div>

      <div
        className='relative max-w-8xl mx-auto group'
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Left Arrow Button */}
        {noticiasBase.length > 1 && (
          <button
            onClick={() => scroll('left')}
            className='absolute -left-2 md:-left-10 lg:-left-12 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white border border-emerald-50 shadow-xl text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors transition-transform duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0'
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M15 19l-7-7 7-7' /></svg>
          </button>
        )}

        <div
          ref={scrollRef}
          className={`flex gap-10 overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide pb-8 ${noticiasBase.length === 1
            ? 'justify-center'
            : noticiasBase.length === 2
              ? 'justify-start md:justify-center'
              : noticiasBase.length === 3
                ? 'justify-start lg:justify-center'
                : 'justify-start'
            }`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {noticias.map((news: any) => (
            <NewsCard
              key={news.id || news.id_noticia || news.slug || news.titulo}
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
            className='absolute -right-2 md:-right-10 lg:-right-12 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white border border-emerald-50 shadow-xl text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors transition-transform duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 translate-x-2 group-hover:translate-x-0'
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M9 5l7 7-7 7' /></svg>
          </button>
        )}
      </div>

      {/* ── MODAL: NEWS DETAIL VIEW ────────────────────────────────────────── */}
      {selectedNews && (() => {
        const isSoloImagen = selectedNews.tag === 'solo_imagen' || selectedNews.categoria === 'solo_imagen' || selectedNews.resumen === '[SOLO_IMAGEN]' || selectedNews.extracto === '[SOLO_IMAGEN]' || (typeof selectedNews.resumen === 'string' && selectedNews.resumen.includes('[SOLO_IMAGEN]')) || (!selectedNews.contenido && !selectedNews.resumen && !selectedNews.extracto && !selectedNews.d);

        if (isSoloImagen) {
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-opacity duration-300"
              onClick={() => setSelectedNews(null)}
            >
              <div
                className="relative max-w-5xl w-full max-h-[95vh] flex flex-col items-center justify-center p-2 sm:p-4 rounded-3xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedNews(null)}
                  className="absolute top-4 right-4 z-50 p-2.5 bg-black/70 hover:bg-black/90 text-white backdrop-blur-md rounded-full shadow-2xl transition-colors transition-transform border border-white/20 hover:scale-110 active:scale-95 cursor-pointer"
                  aria-label="Cerrar"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <img
                  src={selectedNews.imagen_url || selectedNews.img}
                  alt={selectedNews.titulo || 'Afiche Informativo'}
                  className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-2xl shadow-2xl border border-white/10"
                />
              </div>
            </div>
          );
        }

        return (
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
                  className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 text-white backdrop-blur-md rounded-full shadow-lg transition-colors"
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
                    {selectedNews.fecha_evento ? `Fecha del evento: ${selectedNews.fecha_evento}` : (selectedNews.fecha?.split('T')[0] || '')}
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
                          <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-1">
                            <Calendar size={12} /> Fecha
                          </span>
                          {selectedNews.fecha_evento}
                        </div>
                      )}
                      {selectedNews.hora_evento && (
                        <div className="bg-white/90 rounded-2xl p-3 shadow-xs border border-emerald-100/50 flex flex-col gap-0.5 flex-1">
                          <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-1">
                            <Clock size={12} /> Hora
                          </span>
                          {selectedNews.hora_evento}
                        </div>
                      )}
                      {selectedNews.lugar_evento && (
                        <div className="bg-white/90 rounded-2xl p-3 shadow-xs border border-emerald-100/50 flex flex-col gap-0.5 col-span-1">
                          <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-1">
                            <MapPin size={12} /> Lugar
                          </span>
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
        );
      })()}
    </section>
  )
}
