import React from 'react'
import logo from '@/assets/Logo3.webp'
import { useCachedConfig } from '@/hooks/useCachedConfig'
import { STATIC } from '@/pages/landing/config/staticContent'
import { Instagram, Facebook, Linkedin } from 'lucide-react'

const s = STATIC.footer

const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.486h2.039L6.486 3.24H4.298l13.31 17.399z"/>
  </svg>
)

export default function Footer() {
  const cfg = useCachedConfig()

  const sociallinks = [
    { name: 'Instagram', icon: <Instagram size={20} />, url: cfg['redes_instagram'] || 'https://www.instagram.com/ciebolivar' },
    { name: 'Facebook', icon: <Facebook size={20} />, url: cfg['redes_facebook'] || 'https://www.facebook.com/CIEBOLIVAR' },
    { name: 'LinkedIn', icon: <Linkedin size={20} />, url: cfg['redes_linkedin'] || 'https://linkedin.com/company/ciebolivar' },
    { name: 'Twitter', icon: <XIcon size={20} />, url: cfg['redes_twitter'] || 'https://x.com/ciebolivar' },
  ].filter(link => !!link.url)

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
            className='flex flex-col items-center gap-2 transition-colors transition-transform duration-300 hover:text-emerald-400 hover:scale-110'
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
