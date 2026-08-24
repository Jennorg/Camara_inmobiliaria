import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import bgBolivar from '@/assets/Pzo.webp'
import Navbar from '@/pages/landing/components/navbar/Navbar'
import Footer from '@/pages/landing/components/Footer'
import SEO from '@/components/SEO'
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

export function invalidateDirectivaCache() {
  // Función vacía para compatibilidad de importaciones sin romper la compilación
}

// ── Scroll reveal ──────────────────────────────────────────────────────────────
const useScrollReveal = () => {
  const [node, setNode] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) entry.target.classList.add('active') },
      { threshold: 0.1 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return (element: HTMLElement | null) => setNode(element)
}

interface MiembroDirectiva {
  id_afiliado?: number | string
  codigo?: string
  nombre: string
  cargo: string
  foto: string
}

const hardcodedDirectiva: MiembroDirectiva[] = [
  { nombre: 'Francisco Piñango', cargo: 'Presidente', foto: imgFrancisco },
  { nombre: 'Zulay Amaya', cargo: 'Vicepresidenta', foto: imgZulay },
  { nombre: 'Margaret Vásquez', cargo: 'Directora General', foto: imgMargaret },
  { nombre: 'Romelina Rodríguez', cargo: 'Directora de Finanzas', foto: imgRomelia },
  { nombre: 'Margot Castro', cargo: 'Directora de Asuntos Legales', foto: imgMargot },
  { nombre: 'Pedro Vallenilla', cargo: 'Director de Comunicaciones', foto: imgPedro },
  { nombre: 'Graciela Ledezma', cargo: 'Directora de Formación', foto: imgGraciela },
  { nombre: 'Yorjharry Vicent', cargo: 'Director de Eventos', foto: imgYorjharry },
  { nombre: 'Rina Centeno', cargo: 'Directora de Responsabilidad Social', foto: imgRina },
  { nombre: 'Pedro Castro', cargo: 'Director de Relaciones Interinstitucionales', foto: imgPedroC },
]

const DirectorCard = ({ id_afiliado, codigo, nombre, cargo, foto, index }: { id_afiliado?: number | string; codigo?: string; nombre: string; cargo: string; foto: string; index: number }) => {
  const setReveal = useScrollReveal()
  const targetIdentifier = codigo || id_afiliado;
  const cardContent = (
    <>
      <div className='relative overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] aspect-[4/5] mb-3 sm:mb-5 bg-gradient-to-br from-slate-50 to-slate-100'>
        {foto ? (
          <img src={foto} alt={nombre} loading="lazy" decoding="async" className='w-full h-full object-cover object-top transition-transform duration-700 ease-in-out group-hover:scale-105' />
        ) : (
          <div className='w-full h-full flex items-center justify-center text-4xl sm:text-6xl font-black text-slate-300 bg-slate-50'>
            {nombre.charAt(0)}
          </div>
        )}
      </div>
      <div className='text-center space-y-1.5 sm:space-y-2 relative z-10'>
        <h3 className='text-base sm:text-lg font-extrabold text-slate-800 leading-snug transition-colors duration-300'>{nombre}</h3>
        <p className='text-slate-500 font-bold uppercase tracking-[0.1em] sm:tracking-[0.12em] text-[9px] sm:text-[10px] bg-slate-100/80 py-1 sm:py-1.5 px-2.5 sm:px-3.5 rounded-full inline-block border border-slate-200/40 line-clamp-2'>{cargo}</p>
      </div>
    </>
  )

  if (targetIdentifier) {
    return (
      <Link 
        to={`/miembros/${targetIdentifier}`} 
        ref={setReveal as any} 
        style={{ transitionDelay: `${index * 0.03}s` }} 
        className='reveal-on-scroll group relative overflow-hidden rounded-[1.8rem] sm:rounded-[2.5rem] bg-white p-3.5 sm:p-5 border border-slate-200 shadow-sm sm:shadow-md hover:shadow-xl transition-colors transition-transform duration-300 hover:-translate-y-1.5 block cursor-pointer'
      >
        {cardContent}
      </Link>
    )
  }

  return (
    <div ref={setReveal} style={{ transitionDelay: `${index * 0.03}s` }} className='reveal-on-scroll group relative overflow-hidden rounded-[1.8rem] sm:rounded-[2.5rem] bg-white p-3.5 sm:p-5 border border-slate-200 shadow-sm sm:shadow-md hover:shadow-xl transition-colors transition-transform duration-300 hover:-translate-y-1.5'>
      {cardContent}
    </div>
  )
}

export default function EquipoDirectivo() {
  const [darkMode, setDarkMode] = useState(false)
  const [directiva, setDirectiva] = useState<MiembroDirectiva[]>([])
  const [periodo, setPeriodo] = useState('Gestión 2024 - 2026')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.scrollTo(0, 0)
    let active = true

    const fetchDirectiva = async () => {
      try {
        const data = await apiFetch(apiUrl('/api/cms/directiva'))
        if (!active) return
        if (data && data.success && Array.isArray(data.data)) {
          const activeMembers = data.data
            .filter((m: any) => (m.activo === 1 || m.activo === true) && m.foto_url)
            
          if (activeMembers.length > 0) {
            const firstPeriod = activeMembers[0].periodo
            if (firstPeriod && typeof firstPeriod === 'string') {
              setPeriodo(`Gestión ${firstPeriod.replace('/', ' - ')}`)
            } else if (firstPeriod) {
              setPeriodo(`Gestión ${firstPeriod}`)
            }
            
            const mapped = activeMembers.map((m: any) => ({
              id_afiliado: m.id_afiliado,
              codigo: m.codigo,
              nombre: m.nombre,
              cargo: m.cargo,
              foto: m.foto_url
            }))
            setDirectiva(mapped)
          } else {
            setDirectiva(hardcodedDirectiva)
          }
        } else {
          setDirectiva(hardcodedDirectiva)
        }
      } catch {
        if (active) setDirectiva(hardcodedDirectiva)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchDirectiva()
    return () => { active = false }
  }, [])

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'dark bg-[#022c22]' : 'bg-slate-50'}`}>
      <SEO 
        title="Junta Directiva" 
        description="Conoce a los líderes que guían la Cámara Inmobiliaria del Estado Bolívar. Compromiso y visión para el sector inmobiliario."
      />
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <header className='relative px-4 sm:px-6 lg:px-20 py-12 sm:py-16 lg:py-24 flex items-center justify-center min-h-[35vh] sm:min-h-[40vh] bg-cover animate-header-bg' style={{ backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.85), rgba(2, 44, 34, 0.85)), url(${bgBolivar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
        <div className='text-center space-y-3 sm:space-y-4'>
          <p className='text-emerald-500 font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs animate-header-text' style={{ animationDelay: '0.2s', opacity: 0 }}>Liderazgo Gremial</p>
          <h1 style={{ animationDelay: '0.4s', opacity: 0 }} className='text-3xl sm:text-5xl lg:text-7xl font-black tracking-tighter animate-header-text text-white'>
            Junta <span className='text-emerald-500 italic'>Directiva</span>
          </h1>
          <p className='text-emerald-100/60 text-xs sm:text-sm tracking-widest uppercase font-medium animate-header-text' style={{ animationDelay: '0.5s', opacity: 0 }}>{periodo}</p>
        </div>
      </header>
      <main className='bg-[#f1f5f9] text-slate-900 rounded-t-[2.5rem] sm:rounded-t-[4rem] -mt-8 sm:-mt-12 relative z-10 px-4 sm:px-6 lg:px-20 py-12 sm:py-20 lg:py-24'>
        <div className='max-w-7xl mx-auto'>
          <div className='text-center mb-10 sm:mb-16'>
            <h2 className='text-2xl sm:text-3xl lg:text-4xl font-black text-[#022c22] tracking-tight mb-3 sm:mb-4'>Conoce a Nuestra Junta Directiva</h2>
            <p className='text-slate-600 text-sm sm:text-lg max-w-2xl mx-auto leading-relaxed'>Profesionales comprometidos con el desarrollo y fortalecimiento del sector inmobiliario en el estado Bolívar.</p>
          </div>

          {loading ? (
            <div className='grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 lg:gap-8'>
              {Array.from({ length: 8 }).map((_, skelIdx) => (
                <div key={`dir-skel-${skelIdx}`} className='animate-pulse rounded-[1.8rem] sm:rounded-[2.5rem] bg-white p-3.5 sm:p-5 border border-slate-200 shadow-sm space-y-4'>
                  <div className='bg-slate-200 rounded-[1.5rem] aspect-[4/5] w-full' />
                  <div className='space-y-2 flex flex-col items-center'>
                    <div className='bg-slate-200 h-5 w-3/4 rounded-md' />
                    <div className='bg-slate-200 h-3.5 w-1/2 rounded-full' />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 lg:gap-8'>
              {directiva.map((miembro, index) => (
                <DirectorCard key={miembro.id_afiliado || miembro.nombre} index={index} id_afiliado={miembro.id_afiliado} nombre={miembro.nombre} cargo={miembro.cargo} foto={miembro.foto} />
              ))}
            </div>
          )}

          <div className='mt-16 sm:mt-24 relative overflow-hidden rounded-[2rem] sm:rounded-[3rem] bg-gradient-to-br from-[#022c22] via-[#044b3a] to-[#022c22] text-white text-center p-6 sm:p-10 lg:p-12 space-y-6 sm:space-y-8 shadow-2xl shadow-emerald-900/30'>
            <div className='absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full -mr-40 -mt-40 blur-3xl' />
            <div className='absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/10 rounded-full -ml-32 -mb-32 blur-3xl' />
            <div className='relative z-10'>
              <div className='inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 bg-emerald-500/20 rounded-full mb-4 sm:mb-6'>
                <svg className='w-4 h-4 text-emerald-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
                </svg>
                <span className='text-emerald-200 font-bold text-[10px] sm:text-xs uppercase tracking-widest'>Contacto Directo</span>
              </div>
              <h2 className='text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-3 sm:mb-4'>¿Deseas contactar con la Junta Directiva?</h2>
              <p className='text-emerald-100/70 mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-lg italic'>Estamos aquí para escucharte. Envíanos tu mensaje y nos pondremos en contacto contigo.</p>
              <button className='w-full sm:w-auto px-8 sm:px-12 py-4 sm:py-5 bg-gradient-to-r from-emerald-500 to-emerald-400 text-[#022c22] rounded-full font-black uppercase text-xs tracking-widest hover:from-emerald-400 hover:to-emerald-300 transition-colors transition-transform shadow-xl hover:shadow-2xl hover:shadow-emerald-500/30 hover:scale-105 active:scale-95'>Enviar un mensaje</button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
