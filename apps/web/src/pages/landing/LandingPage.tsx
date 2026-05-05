import React, { useState } from 'react'

import Navbar from '@/pages/landing/components/navbar/Navbar'
import Header from '@/pages/landing/components/Header'
import NosotrosSection from '@/pages/landing/components/sections/NosotrosSection'
import OrigenesSection from '@/pages/landing/components/sections/OrigenesSection'
import AfiliadosSection from '@/pages/landing/components/sections/AfiliadosSection'
import FormacionSection from '@/pages/landing/components/sections/FormacionSection'
import DirectivaSection from '@/pages/landing/components/sections/DirectivaSection'
import Footer from '@/pages/landing/components/Footer'
import LoginModal from '@/pages/landing/components/LoginModal'
import RegisterModal from '@/pages/landing/components/RegisterModal'
import SEO from '@/components/SEO'

import ConveniosSection from '@/pages/landing/components/sections/ConveniosSection'
import NoticiasSection from '@/pages/landing/components/sections/NoticiasSection'

export default function LandingPage() {
  const [isModalSesionOpen, setIsSesionModalOpen] = useState(false)
  const [isModalRegisterOpen, setIsRegisterModalOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  return (
    <div className={`${darkMode ? 'dark bg-[#ffffff]' : 'bg-[#ffffff]'} transition-colors duration-300`}>
      <SEO
        title="Camara Inmobiliaria de Bolivar"
        description="Página oficial de la Cámara Inmobiliaria del Estado Bolívar (CIBIR). Encuentra las mejores inmobiliarias en Bolívar, profesionales certificados y formación de vanguardia."
        keywords="inmobiliarias en estado bolivar, camara inmobiliaria bolivar, bienes raices puerto ordaz, ciudad bolivar inmobiliaria, cursos inmobiliarios bolivar, cibir"
      />

      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        setIsSesionModalOpen={setIsSesionModalOpen}
        setIsRegisterModalOpen={setIsRegisterModalOpen}
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

      <ConveniosSection />

      <Footer />

  {/* MODALS */ }
  { isModalSesionOpen && <LoginModal onClose={() => setIsSesionModalOpen(false)} /> }
  { isModalRegisterOpen && <RegisterModal onClose={() => setIsRegisterModalOpen(false)} /> }
    </div >
  )
}
