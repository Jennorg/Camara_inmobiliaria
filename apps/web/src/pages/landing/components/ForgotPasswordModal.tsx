import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { API_URL } from '@/config/env'

type Step = 'email' | 'done'

export default function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep]         = useState<Step>('email')
  const [email, setEmail]       = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Error al procesar la solicitud.')
        return
      }

      setStep('done')
    } catch {
      setError('No se pudo establecer conexión con el servidor. Por favor, comprueba tu conexión a internet.')
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' onClick={onClose} />

      <div className='relative bg-white w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl text-center'>
        {/* Botón cerrar */}
        <button onClick={onClose} className='absolute top-6 right-6 text-gray-400 hover:text-emerald-600 transition' type='button'>
          <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12' />
          </svg>
        </button>

        {/* ── PASO 1: Email ─────────────────────────────────────── */}
        {step === 'email' && (
          <>
            <div className='w-14 h-14 mx-auto mb-5 rounded-full bg-emerald-50 flex items-center justify-center'>
              <svg className='w-7 h-7 text-emerald-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' />
              </svg>
            </div>
            <h2 className='text-2xl font-black text-slate-800 mb-2'>¿Olvidaste tu contraseña?</h2>
            <p className='text-slate-400 text-sm mb-8'>Ingresa tu correo y te enviaremos un enlace para restablecerla.</p>

            <form className='space-y-4' onSubmit={handleReset}>
              <input
                type='email'
                placeholder='tu@correo.com'
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className='w-full px-6 py-4 border border-gray-300 rounded-full text-gray-700 focus:outline-none focus:border-emerald-500 transition-colors text-sm'
              />
              {error && <p className='text-red-500 text-sm bg-red-50 px-4 py-2 rounded-xl'>{error}</p>}
              <button
                type='submit'
                disabled={loading}
                className='w-full px-6 py-3 bg-emerald-500 text-white rounded-full font-bold text-sm hover:bg-emerald-600 transition-colors transition-opacity disabled:opacity-50'
              >
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>
          </>
        )}

        {/* ── PASO 2: Éxito ─────────────────────────────────────── */}
        {step === 'done' && (
          <>
            <div className='w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-500 flex items-center justify-center'>
              <svg className='w-8 h-8 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2.5' d='M5 13l4 4L19 7' />
              </svg>
            </div>
            <h2 className='text-2xl font-black text-slate-800 mb-2'>Revisa tu correo</h2>
            <p className='text-slate-500 text-sm mb-8 leading-relaxed'>
              Si el correo <strong>{email}</strong> está registrado, te hemos enviado un enlace que podrás usar para crear una nueva contraseña.
            </p>
            <button
              onClick={onClose}
              className='px-10 py-3 border-2 border-emerald-500 text-emerald-600 rounded-full font-bold hover:bg-emerald-50 transition-colors'
            >
              Entendido
            </button>
          </>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

