import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import logo from '@/assets/Logo2.png'
import ForgotPasswordModal from '@/pages/landing/components/ForgotPasswordModal'

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Credenciales no autorizadas')
    } finally {
      setLoading(false)
    }
  }

  const modalContent = (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
      {/* Fondo con desenfoque profundo */}
      <div className='absolute inset-0 bg-[#011a14]/60 backdrop-blur-md' onClick={onClose} />

      {/* Contenedor del Modal */}
      <div className='relative bg-white w-full max-w-[420px] rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden'>

        {/* Botón Cerrar Minimalista */}
        <button
          onClick={onClose}
          className='absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors'
        >
          <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='M6 18L18 6M6 6l12 12' />
          </svg>
        </button>

        <div className='p-10 sm:p-12'>
          {/* Título e Icono Sutil */}
          <div className='mb-10 flex flex-col items-center text-center'>
            <div className='mb-8 flex flex-col items-center'>
              <img
                src={logo}
                alt="Logo"
                className='h-32 w-auto object-contain transition-transform hover:scale-105 duration-300'
              />
            </div>
            <h2 className='text-3xl font-black text-slate-900 tracking-tight'>
              Bienvenido
            </h2>
            <p className='text-slate-500 text-sm mt-2'>
              Inicie sesión para gestionar su cuenta institucional.
            </p>
          </div>

          <form className='space-y-6' onSubmit={handleSubmit}>
            {/* Campo Email */}
            <div className='space-y-2'>
              <input
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className='w-full px-0 py-3 border-b-2 border-slate-100 focus:border-emerald-500 transition-colors bg-transparent outline-none text-slate-800 placeholder-slate-300 font-medium'
                placeholder="Correo electrónico"
              />
            </div>

            {/* Campo Password */}
            <div className='space-y-2'>
              <div className='flex justify-between items-center'>
                <input
                  type='password'
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className='w-full px-0 py-3 border-b-2 border-slate-100 focus:border-emerald-500 transition-colors bg-transparent outline-none text-slate-800 placeholder-slate-300 font-medium'
                  placeholder="Contraseña"
                />
              </div>
              <div className='flex justify-end'>
                <button
                  type='button'
                  onClick={() => setShowForgot(true)}
                  className='text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors mt-2'
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className='text-red-500 text-xs font-bold flex items-center gap-2 bg-red-50 p-3 rounded-lg'>
                <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                  <path fillRule='evenodd' d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z' clipRule='evenodd' />
                </svg>
                {error}
              </div>
            )}

            {/* Botón Submit */}
            <div className='pt-4'>
              <button
                type='submit'
                disabled={loading}
                className='w-full py-4 bg-[#022c22] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-emerald-900 transition-all active:scale-[0.98] disabled:opacity-50'
              >
                {loading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>

          <p className='mt-8 text-center text-sm text-slate-500'>
            ¿No estas afiliado?{' '}
            <Link
              to='/afiliate'
              onClick={onClose}
              className='font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-2 decoration-emerald-500/40 hover:decoration-emerald-600 transition-colors'
            >
              Afíliate aquí
            </Link>
          </p>

          {/* Footer del Modal */}
          <div className='mt-8 text-center'>
            <p className='text-slate-400 text-[11px] font-medium'>
              CÁMARA INMOBILIARIA DEL ESTADO BOLÍVAR
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {createPortal(modalContent, document.body)}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </>
  )
}
