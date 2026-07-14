import React, { useState } from 'react'

import Navbar from '@/pages/landing/components/navbar/Navbar'
import Header from '@/pages/landing/components/Header'
import NosotrosSection from '@/pages/landing/components/sections/NosotrosSection'
import OrigenesSection from '@/pages/landing/components/sections/OrigenesSection'
import AfiliadosSection from '@/pages/landing/components/sections/AfiliadosSection'
import FormacionSection from '@/pages/landing/components/sections/FormacionSection'
import DirectivaSection from '@/pages/landing/components/sections/DirectivaSection'
import BentoGallerySection from '@/pages/landing/components/sections/BentoGallerySection'
import Footer from '@/pages/landing/components/Footer'
import LoginModal from '@/pages/landing/components/LoginModal'
import RegisterModal from '@/pages/landing/components/RegisterModal'
import SEO from '@/components/SEO'

import ConveniosSection from '@/pages/landing/components/sections/ConveniosSection'
import NoticiasSection from '@/pages/landing/components/sections/NoticiasSection'
import { useCachedConfig } from '@/hooks/useCachedConfig'

export default function LandingPage() {
  const [darkMode, setDarkMode] = useState(false)
  const cfg = useCachedConfig()

  return (
    <div className={`${darkMode ? 'dark bg-[#022c22]' : 'bg-[#ffffff]'} transition-colors duration-300`}>
      <SEO
        title="Inmobiliaria Bolívar | Cámara Inmobiliaria del Estado Bolívar"
        description="Cámara Inmobiliaria del Estado Bolívar (CIBIR) — Tu gremio de inmobiliarias y corredores certificados en Bolívar, Venezuela. Compra, venta y alquiler de casas y apartamentos en Puerto Ordaz y Ciudad Bolívar."
        keywords="inmobiliaria bolivar, inmobiliarias bolivar venezuela, camara inmobiliaria del estado bolivar, CIBIR, bienes raices bolivar, casas en venta puerto ordaz, apartamentos puerto ordaz, alquiler inmuebles bolivar, corredores inmobiliarios bolivar, agentes inmobiliarios certificados"
        url="https://camarainmobiliariadebolivar.com"
      />

      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      <div className='bg-[#022c22]'>
        <Header darkMode={darkMode} />
      </div>

      <NosotrosSection />
      <FormacionSection />

      <AfiliadosSection />

      <OrigenesSection />

      <NoticiasSection />

      <DirectivaSection />

      <ConveniosSection cfg={cfg} />

      <BentoGallerySection />

      <Footer />
    </div >
  )
}
