import React from 'react'
import logo from '@/assets/Logo3.png'
import { useCachedConfig } from '@/hooks/useCachedConfig'
import { STATIC } from '@/pages/landing/config/staticContent'
import { Instagram, Facebook } from 'lucide-react'

const s = STATIC.footer

export default function Footer() {
  const cfg = useCachedConfig()

  const sociallinks = [
    { name: 'Instagram', icon: <Instagram size={20} />, url: 'https://www.instagram.com/ciebolivar' },
    { name: 'Facebook', icon: <Facebook size={20} />, url: 'https://www.facebook.com/CIEBOLIVAR' },
  ]

  return (
    <footer className='relative z-50 bg-[#022c22] px-6 lg:px-20 py-16 text-center border-t border-white/5 space-y-6'>
      <img
        src={logo}
        alt='Logo Cámara Inmobiliaria de Bolívar - Inmobiliarias en Puerto Ordaz y Ciudad Bolívar'
        className='h-26 mx-auto '
      />
      <p className='text-white text-sm max-w-lg mx-auto leading-relaxed'>
        {s.descripcion} <br />
        {s.direccion}
      </p>
      <div className='flex justify-center gap-8 text-white'>
        {sociallinks.map((social) => (
          <a
            key={social.name}
            href={social.url || '#'}
            target='_blank'
            rel='noopener noreferrer'
            className='flex flex-col items-center gap-2 transition-all duration-300 hover:text-emerald-400 hover:scale-110'
            aria-label={social.name}
          >
            <div className='group-hover:scale-110 transition-transform duration-300'>
              {social.icon}
            </div>
            <span className='text-[10px] uppercase tracking-[0.15em] font-medium'>
              {social.name}
            </span>
          </a>
        ))}
      </div>
      <p className='text-white text-[10px] pt-4'>
        {s.copyright}
      </p>
    </footer>
  )
}
