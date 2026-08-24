import bgBolivar from '@/assets/Pzo.webp'
import { Link } from 'react-router-dom'
import { useCachedConfig } from '@/hooks/useCachedConfig'
import { STATIC } from '@/pages/landing/config/staticContent'

const s = STATIC.hero

// Tier 1: Buttons and subtitle text are static.
// Tier 2: Hero image and title can be override from CMS (cached).
export default function Header({ darkMode }: { darkMode?: boolean }) {
  const cfg = useCachedConfig()

  return (
    <header
      id='inicio'
      className='relative overflow-hidden px-6 lg:px-20 py-16 lg:py-16 grid lg:grid-cols-2 gap-12 items-center min-h-[90dvh]'
    >
      {/* CAPA 1: IMAGEN CON ZOOM */}
      <div
        className='absolute inset-0 z-0 animate-bg-zoom'
        style={{
          backgroundImage: `linear-gradient(rgba(2, 99, 76, 0.49), rgba(2, 102, 79, 0.35)), url(${cfg['hero_img'] || bgBolivar})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      />

      {/* CAPA 2: TELÓN VERDE (Baja desde arriba) */}
      <div
        className='absolute inset-0 z-10 animate-curtain'
        style={{
          background: 'linear-gradient(to bottom, rgba(4, 47, 36, 0.75), rgba(2, 44, 34, 0))'
        }}
      />

      {/* CAPA 3: CONTENIDO (Aparece después) */}
      <div
        className='relative z-20 space-y-6 animate-text-reveal'
        style={{ animationDelay: '0.8s', opacity: 0 }}
      >
        <h1
          className='text-white text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.1]'
          dangerouslySetInnerHTML={{ __html: cfg['hero_titulo'] || s.titulo }}
        />

        <p className='text-gray-300 text-lg max-w-md leading-relaxed'>
          {cfg['hero_subtitulo'] || s.subtitulo}
        </p>

        <div className='pt-6 flex flex-wrap items-center gap-4'>
          <Link to='/afiliate#formulario' className='cursor-pointer px-8 py-3.5 bg-emerald-500 text-[#011a14] rounded-full font-bold uppercase text-sm tracking-widest hover:bg-emerald-400 hover:-translate-y-1 transition-colors transition-transform shadow-[0_0_20px_rgba(16,185,129,0.3)]'>
            {s.btnPrimario}
          </Link>
          <Link to='/afiliate' className='cursor-pointer px-8 py-3.5 bg-transparent border border-white/30 text-white rounded-full font-bold uppercase text-sm tracking-widest hover:bg-white/10 transition-colors'>
            {s.btnSecundario}
          </Link>
        </div>
      </div>
    </header>
  )
}
