import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'
import Swal from 'sweetalert2'
import { CourseSkeletonGrid } from '@/components/Skeletons'
import Footer from '@/pages/landing/components/Footer'
import SEO from '@/components/SEO'
import Navbar from '@/pages/landing/components/navbar/Navbar'

interface CursoDB {
  id_curso: number
  nombre: string
  titulo?: string
  nivel_academico: string | null
  precio: string | null
  imagen_url: string | null
  estatus: string
  solo_informativo?: number | boolean
  instructor_nombre: string | null
  categoria?: string | null
}

/** Catálogo público de cursos/talleres (`/cursos`, `/talleres`). */
export default function CursosCatalogPage() {
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(false)
  const [cursos, setCursos] = useState<CursoDB[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    apiFetch(`${API_URL}/api/public/cursos`)
      .then((json) => {
        if (!active) return
        if (json.success) setCursos(json.data)
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const handleInscribir = (curso: CursoDB) => {
    const isInformative = curso.solo_informativo === 1 || curso.solo_informativo === true || curso.estatus === 'Solo Informativo';
    
    if (isInformative) {
      Swal.fire({
        title: `Portal Informativo`,
        html: `
          <div class="text-left space-y-3 text-slate-700 text-sm">
            <p class="font-bold text-[#022c22] text-base">${curso.titulo || curso.nombre}</p>
            <p>Las inscripciones para esta actividad funcionan bajo la modalidad <strong>informativa</strong> y son gestionadas directamente por el equipo administrativo de la Cámara Inmobiliaria del Estado Bolívar.</p>
            <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-semibold">
              Por favor, comunícate con la administración para coordinar tu registro e inscripción formal.
            </div>
          </div>
        `,
        icon: 'info',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#10b981',
      })
      return
    }

    Swal.fire({
      title: `Preinscripción a: ${curso.titulo || curso.nombre}`,
      text: 'Se enviará una solicitud de inscripción. Por favor ingresa tus datos de contacto básicos.',
      icon: 'info',
      html: `
        <div class="text-left mt-3" style="color: black;">
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Nombre Completo</label>
          <input id="swal-nombre" class="w-full border rounded p-2 mb-3">
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Correo Electrónico</label>
          <input id="swal-email" type="email" class="w-full border rounded p-2">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Formalizar Inscripción',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      preConfirm: () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement).value
        const email = (document.getElementById('swal-email') as HTMLInputElement).value
        if (!nombre || !email) {
          Swal.showValidationMessage('Nombre y correo son requeridos')
          return false
        }
        return { nombre, email }
      },
    }).then((result) => {
      if (result.isConfirmed) {
        fetch(`${API_URL}/api/public/cursos/${curso.id_curso}/preinscribir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombreCompleto: result.value.nombre, email: result.value.email }),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
          })
          .then((json) => {
            if (json.success) Swal.fire('¡Solicitud enviada!', json.message || 'Te contactaremos pronto.', 'success')
            else Swal.fire('Atención', json.message || 'Hubo un error al procesar tu solicitud.', 'warning')
          })
          .catch(() => Swal.fire('Error', 'Hubo un fallo de conexión al enviar la solicitud.', 'error'))
      }
    })
  }

  return (
    <div className={`${darkMode ? 'dark bg-[#011a14]' : 'bg-[#f8fafc]'} min-h-screen`}>
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <section id='cursos' className={`relative w-full max-w-full overflow-x-hidden transition-colors duration-700 px-4 sm:px-6 lg:px-20 pt-16 pb-24 scroll-mt-24 ${darkMode ? 'bg-[#011a14] text-white' : 'bg-[#f8fafc] text-slate-900'}`}>
        <SEO 
          title="Catálogo de Formación Inmobiliaria"
          description="Explora nuestra oferta académica para profesionales de bienes raíces en Bolívar. Cursos, talleres y certificaciones avaladas por la CIBIR."
          keywords="cursos inmobiliarios bolivar, capacitacion bienes raices, certificacion inmobiliaria venezuela, puerto ordaz formacion"
        />
        <div className={`absolute inset-0 opacity-20 pointer-events-none ${darkMode ? 'opacity-10' : 'opacity-40'}`} style={{ backgroundImage: 'radial-gradient(#10b981 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />

        <div className='relative text-center max-w-4xl mx-auto mb-20 space-y-6 pt-10'>
          <p className='text-emerald-500 font-black uppercase tracking-[0.3em] text-xs mb-4'>
            Cámara Inmobiliaria del Estado Bolívar
          </p>
          <h2 className={`text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter transition-colors ${darkMode ? 'text-white' : 'text-[#022c22]'}`}>
            Centro de <span className='text-emerald-500 italic'>Formación</span>
          </h2>
          <p className={`text-base sm:text-lg font-medium max-w-2xl mx-auto ${darkMode ? 'text-emerald-50/60' : 'text-slate-600'}`}>
            Programas de alto nivel diseñados para los líderes del mercado inmobiliario actual.
          </p>
        </div>

        <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 relative z-10 mb-20'>
          {loading ? (
            <CourseSkeletonGrid count={8} />
          ) : cursos.length === 0 ? (
            <div className="col-span-full text-center text-slate-400 font-bold p-10">No hay cursos disponibles actualmente.</div>
          ) : cursos.map((curso) => {
            const isInformative = curso.solo_informativo === 1 || curso.solo_informativo === true || curso.estatus === 'Solo Informativo';
            return (
            <div key={curso.id_curso} className={`group rounded-[2.5rem] overflow-hidden border-2 transition-transform duration-500 hover:-translate-y-3 flex flex-col h-full ${darkMode ? 'bg-[#022c22]/50 backdrop-blur-md border-white shadow-[0_20px_50px_rgba(0,0,0,0.3)]' : 'bg-white border-emerald-50 shadow-[0_15px_35px_rgba(16,185,129,0.05)] border-emerald-500'}`}>
              <div className='relative h-56 overflow-hidden bg-slate-100 flex items-center justify-center shrink-0'>
                {curso.imagen_url ? (
                  <img src={curso.imagen_url} alt={curso.titulo || curso.nombre} loading="lazy" decoding="async" className='w-full h-full object-cover group-hover:scale-110 transition duration-1000' />
                ) : (
                  <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                )}
                <div className='absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none' />
                <div className='absolute top-5 left-5 bg-emerald-500 text-[#022c22] px-4 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-lg'>
                  {curso.categoria || curso.nivel_academico || 'Curso'}
                </div>
                {isInformative ? (
                  <div className="absolute top-5 right-5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-lg bg-purple-600">Solo Informativo</div>
                ) : (
                  <>
                    {curso.estatus === 'Próximamente' && (
                      <div className="absolute top-5 right-5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-lg bg-blue-500">Próximamente</div>
                    )}
                    {curso.estatus === 'En curso' && (
                      <div className="absolute top-5 right-5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-lg bg-amber-500">En curso</div>
                    )}
                    {curso.estatus === 'Cerrado' && (
                      <div className="absolute top-5 right-5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-lg bg-red-500">Cerrado</div>
                    )}
                  </>
                )}
              </div>
              <div className='p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-4'>
                <h3 className={`font-black text-xl leading-[1.2] transition-colors min-h-[3rem] ${darkMode ? 'text-white group-hover:text-emerald-400' : 'text-[#022c22] group-hover:text-emerald-600'}`}>{curso.titulo || curso.nombre}</h3>
                <div className='pt-2 mt-auto'>
                  {curso.estatus === 'Cerrado' ? (
                    <div className="w-full text-center text-xs font-black uppercase bg-red-100 text-red-700 py-3 rounded-2xl">
                      Finalizado
                    </div>
                  ) : isInformative ? (
                    <button 
                      type='button' 
                      onClick={() => handleInscribir(curso)} 
                      className='w-full py-3.5 flex items-center justify-center gap-2 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-colors transition-transform shadow-lg hover:shadow-purple-500/20'
                    >
                      <span>Portal Informativo</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  ) : (
                    <button 
                      type='button' 
                      onClick={() => handleInscribir(curso)} 
                      className='w-full py-3.5 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-[#022c22] font-black text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-colors transition-transform shadow-lg hover:shadow-emerald-500/20'
                    >
                      <span>Formalizar Inscripción</span>
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )})}
        </div>
      </section>
      <Footer />
    </div>
  )
}
