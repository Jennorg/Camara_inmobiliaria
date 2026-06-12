import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '@/config/env'
import Swal from 'sweetalert2'
import { CourseSkeletonGrid } from '@/components/Skeletons'
import Footer from '@/pages/landing/components/Footer'
import SEO from '@/components/SEO'

interface CursoDB {
  id_curso: number
  nombre: string
  nivel_academico: string | null
  precio: string | null
  imagen_url: string | null
  estatus: string
  instructor_nombre: string | null
}

/** Catálogo público de cursos/talleres (`/cursos`, `/talleres`). */
export default function CursosCatalogPage() {
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(false)
  const [cursos, setCursos] = useState<CursoDB[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/public/cursos`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setCursos(json.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleInscribir = (curso: CursoDB) => {
    Swal.fire({
      title: `Preinscripción a: ${curso.nombre}`,
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
          .then((res) => res.json())
          .then((json) => {
            if (json.success) Swal.fire('¡Solicitud enviada!', json.message || 'Te contactaremos pronto.', 'success')
            else Swal.fire('Atención', json.message || 'Hubo un error al procesar tu solicitud.', 'warning')
          })
          .catch(() => Swal.fire('Error', 'Hubo un fallo de conexión al enviar la solicitud.', 'error'))
      }
    })
  }

  return (
    <section id='cursos' className={`relative min-h-screen w-full max-w-full overflow-x-hidden transition-all duration-700 px-4 sm:px-6 lg:px-20 py-24 scroll-mt-24 ${darkMode ? 'bg-[#011a14] text-white' : 'bg-[#f8fafc] text-slate-900'}`}>
      <SEO 
        title="Catálogo de Formación Inmobiliaria"
        description="Explora nuestra oferta académica para profesionales de bienes raíces en Bolívar. Cursos, talleres y certificaciones avaladas por la CIBIR."
        keywords="cursos inmobiliarios bolivar, capacitacion bienes raices, certificacion inmobiliaria venezuela, puerto ordaz formacion"
      />
      <div className={`absolute inset-0 opacity-20 pointer-events-none ${darkMode ? 'opacity-10' : 'opacity-40'}`} style={{ backgroundImage: 'radial-gradient(#10b981 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
      <div className='fixed top-4 sm:top-6 inset-x-0 box-border px-4 sm:px-6 lg:px-20 flex justify-between items-center z-[60] pointer-events-none'>
        <button type='button' onClick={() => navigate('/')} className='pointer-events-auto flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-emerald-500 text-[#022c22] rounded-2xl font-black text-[10px] sm:text-xs shadow-2xl hover:bg-emerald-400 transition-all active:scale-95'>
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M10 19l-7-7m0 0l7-7m-7 7h18' /></svg>
          VOLVER
        </button>
        <button type='button' onClick={() => setDarkMode(!darkMode)} className={`pointer-events-auto p-2.5 sm:p-3 rounded-2xl shadow-xl transition-all hover:rotate-12 ${darkMode ? 'bg-yellow-400 text-black' : 'bg-[#022c22] text-white'}`}>
          {darkMode
            ? <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 20 20'><path d='M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z' /></svg>
            : <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 20 20'><path d='M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z' /></svg>}
        </button>
      </div>

      <div className='relative text-center max-w-4xl mx-auto mb-20 space-y-6 pt-10'>
        <h2 className={`text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter transition-colors ${darkMode ? 'text-white' : 'text-[#022c22]'}`}>
          Centro de <span className='text-emerald-500 italic'>Formación</span>
        </h2>
        <p className={`text-base sm:text-lg font-medium max-w-2xl mx-auto ${darkMode ? 'text-emerald-50/60' : 'text-slate-600'}`}>
          Programas de alto nivel diseñados para los líderes del mercado inmobiliario actual.
        </p>
        <div className='flex flex-wrap justify-center gap-3 pt-4'>
          {['Todos', 'Libre', 'Principiante', 'Intermedio', 'Avanzado'].map((cat) => (
            <button key={cat} type='button' className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all shadow-sm border ${darkMode ? 'border-white/10 text-white bg-white/5 hover:bg-emerald-500 hover:text-white' : 'border-slate-200 text-slate-600 bg-white hover:border-emerald-500 hover:text-emerald-600'}`}>{cat}</button>
          ))}
        </div>
      </div>

      <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 relative z-10'>
        {loading ? (
          <CourseSkeletonGrid count={8} />
        ) : cursos.length === 0 ? (
          <div className="col-span-full text-center text-slate-400 font-bold p-10">No hay cursos disponibles actualmente.</div>
        ) : cursos.map((curso) => (
          <div key={curso.id_curso} className={`group rounded-[2.5rem] overflow-hidden border-2 transition-all duration-500 hover:-translate-y-3 ${darkMode ? 'bg-[#022c22]/50 backdrop-blur-md border-white shadow-[0_20px_50px_rgba(0,0,0,0.3)]' : 'bg-white border-emerald-50 shadow-[0_15px_35px_rgba(16,185,129,0.05)] border-emerald-500'}`}>
            <div className='relative h-56 overflow-hidden bg-slate-100 flex items-center justify-center'>
              {curso.imagen_url ? (
                <img src={curso.imagen_url} alt={curso.nombre} loading="lazy" decoding="async" className='w-full h-full object-cover group-hover:scale-110 transition duration-1000' />
              ) : (
                <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              )}
              <div className='absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none' />
              <div className='absolute top-5 left-5 bg-emerald-500 text-[#022c22] px-4 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-lg'>
                {curso.nivel_academico || 'Libre'}
              </div>
              {curso.estatus === 'Próximamente' && (
                <div className="absolute top-5 right-5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-lg bg-blue-500">
                  Próximamente
                </div>
              )}
            </div>
            <div className='p-6 sm:p-8 space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-1.5'>
                  <svg className='w-4 h-4 text-yellow-500 fill-current' viewBox='0 0 20 20'><path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3-.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' /></svg>
                  <span className={`text-sm font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>5.0</span>
                </div>
                <span className='text-slate-400 text-[10px] font-bold uppercase tracking-tighter'>Certificado</span>
              </div>
              <h3 className={`font-black text-xl leading-[1.2] transition-colors min-h-[3rem] ${darkMode ? 'text-white group-hover:text-emerald-400' : 'text-[#022c22] group-hover:text-emerald-600'}`}>{curso.nombre}</h3>
              <p className={`text-xs font-bold ${darkMode ? 'text-emerald-200/40' : 'text-slate-400'}`}>CON: <span className={darkMode ? 'text-emerald-400' : 'text-emerald-600'}>{(curso.instructor_nombre || 'Por definir').toUpperCase()}</span></p>
              <div className={`h-[1px] w-full ${darkMode ? 'bg-white/5' : 'bg-emerald-100'}`} />
              <div className='flex items-center justify-between pt-2'>
                <div className='flex flex-col'>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-emerald-200/40' : 'text-slate-400'}`}>Inversión</span>
                  <span className={`text-xl font-black ${darkMode ? 'text-white' : 'text-[#022c22]'}`}>{curso.precio ? `$${curso.precio}` : 'Gratis'}</span>
                </div>
                <button type='button' onClick={() => handleInscribir(curso)} className='w-12 h-12 flex items-center justify-center rounded-2xl bg-emerald-500 text-[#022c22] hover:scale-110 active:scale-95 transition-all shadow-lg hover:shadow-emerald-500/25'>
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M14 5l7 7m0 0l-7 7m7-7H3' /></svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Footer />
    </section>
  )
}
