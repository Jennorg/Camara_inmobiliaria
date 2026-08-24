import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import logo from '@/assets/Logo2.webp'
import ForgotPasswordModal from '@/pages/landing/components/ForgotPasswordModal'
import { Eye, EyeOff } from 'lucide-react'
import { FloatingInput } from '@/components/ui/FloatingInput'
import { toast } from 'sonner'

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [shake, setShake] = useState(false)
  const [hasError, setHasError] = useState(false)
  const passwordRef = React.useRef<HTMLInputElement | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setHasError(false)
    try {
      await login(email, password)
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Credenciales incorrectas')
      setHasError(true)
      setShake(true)
      setTimeout(() => setShake(false), 600)
      setTimeout(() => {
        passwordRef.current?.focus()
      }, 50)
    } finally {
      setLoading(false)
    }
  }

  const modalContent = (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
      {/* Fondo con desenfoque profundo */}
      <div className='absolute inset-0 bg-[#011a14]/60 backdrop-blur-md' onClick={onClose} />

      {/* Contenedor del Modal */}
      <div className={`relative bg-white w-full max-w-[440px] rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden ${shake ? 'animate-shake' : ''}`}>

        {/* Botón Cerrar Minimalista */}
        <button
          onClick={onClose}
          className='absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors'
        >
          <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='M6 18L18 6M6 6l12 12' />
          </svg>
        </button>

        <div className='p-8 sm:p-10'>
          {/* Título e Icono Sutil */}
          <div className='mb-8 flex flex-col items-center text-center'>
            <div className='mb-6 flex flex-col items-center'>
              <img
                src={logo}
                alt="Logo"
                className='h-28 w-auto object-contain transition-transform hover:scale-105 duration-300'
              />
            </div>
            <h2 className='text-3xl font-black text-slate-900 tracking-tight'>
              Bienvenido
            </h2>
            <p className='text-slate-500 text-sm mt-2'>
              Inicie sesión para gestionar su cuenta institucional.
            </p>
          </div>

          <form className='space-y-5' onSubmit={handleSubmit}>
            {/* Campo Email */}
            <div className='space-y-2'>
              <FloatingInput
                type='email'
                value={email}
                onChange={e => {
                  setEmail(e.target.value)
                  setHasError(false)
                }}
                required
                label="Correo electrónico"
                error={hasError}
              />
            </div>

            {/* Campo Password */}
            <div className='space-y-2'>
              <FloatingInput
                type={showPassword ? 'text' : 'password'}
                ref={passwordRef}
                value={password}
                onChange={e => {
                  setPassword(e.target.value)
                  setHasError(false)
                }}
                required
                label="Contraseña"
                error={hasError}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-300 hover:text-emerald-600 transition-colors focus:outline-none pb-2 pt-2"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
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



            {/* Botón Submit */}
            <div className='pt-4'>
              <button
                type='submit'
                disabled={loading}
                className='w-full py-4 bg-[#022c22] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-emerald-900 transition-colors transition-transform active:scale-[0.98] disabled:opacity-50'
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
