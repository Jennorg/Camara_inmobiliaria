import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function RegisterModal({ onClose }: { onClose: () => void }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
      <div
        className='absolute inset-0 bg-black/60 backdrop-blur-sm'
        onClick={onClose}
      />
      <div className='relative bg-white w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl text-center'>
        <button
          type="button"
          onClick={onClose}
          className='absolute top-6 right-6 text-gray-400 hover:text-emerald-600 transition'
        >
          <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12' />
          </svg>
        </button>
        <h2 className='text-gray-600 text-lg mb-8 leading-snug font-medium'>
          Crea tu cuenta para unirte a la <br />
          <span className='text-emerald-600 font-bold text-xl'>Cámara Inmobiliaria</span>
        </h2>
        <form className='space-y-4'>
          <div className='text-left'>
            <input type='text' placeholder='Nombre completo:' className='w-full px-6 py-3.5 border border-gray-400 rounded-full text-gray-700 focus:outline-none focus:border-emerald-500 transition-colors' />
          </div>
          <div className='text-left'>
            <input type='tel' placeholder='Teléfono:' className='w-full px-6 py-3.5 border border-gray-400 rounded-full text-gray-700 focus:outline-none focus:border-emerald-500 transition-colors' />
          </div>
          <div className='text-left'>
            <input type='email' placeholder='Correo electrónico:' className='w-full px-6 py-3.5 border border-gray-400 rounded-full text-gray-700 focus:outline-none focus:border-emerald-500 transition-colors' />
          </div>
          <div className='text-left relative flex items-center'>
            <input 
              type={showPassword ? 'text' : 'password'} 
              placeholder='Crea una contraseña:' 
              className='w-full px-6 py-3.5 border border-gray-400 rounded-full text-gray-700 focus:outline-none focus:border-emerald-500 transition-colors pr-12' 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 text-gray-400 hover:text-emerald-600 focus:outline-none transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <div className='flex items-center gap-2 px-2 pt-2'>
            <input type='checkbox' className='w-4 h-4 accent-emerald-600' id='terms' />
            <label htmlFor='terms' className='text-xs text-gray-500 text-left'>
              Acepto los términos y condiciones de la Cámara Inmobiliaria.
            </label>
          </div>
          <div className='pt-6'>
            <button type="submit" className='w-full px-10 py-3.5 bg-emerald-500 text-white rounded-full font-bold hover:bg-[#022c22] transition-colors shadow-lg shadow-emerald-500/20'>
              Registrarme ahora
            </button>
          </div>
          <p className='text-sm text-gray-500 mt-4'>
            ¿Ya tienes cuenta? <a href='#' className='text-emerald-600 font-bold hover:underline'>Inicia sesión</a>
          </p>
        </form>
      </div>
    </div>
  )
}
