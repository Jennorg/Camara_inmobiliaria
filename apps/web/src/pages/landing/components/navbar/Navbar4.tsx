import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import logoLight from '@/assets/Logo2.png' // Logo para modo claro
import logoDark from '@/assets/Logo3.png'  // Logo para modo oscuro
import LoginModal from '@/pages/landing/components/LoginModal'
import NavItem from './NavItem'
import { NAV_ITEMS } from './navData'
import { Menu, X, LogOut, Moon, Sun } from 'lucide-react'

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  setIsSesionModalOpen?: (val: boolean) => void;
  setIsRegisterModalOpen?: (val: boolean) => void;
}

const Navbar = ({ darkMode, setDarkMode, setIsSesionModalOpen, setIsRegisterModalOpen }: NavbarProps) => {
  const { user, logout } = useAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const labelLogin = 'Acceder'
  const labelSalir = 'Salir'

  return (
    <>
      <nav className={`sticky top-0 z-50 transition-colors duration-300 border-b ${
        darkMode 
          ? "bg-[#011a14]/95 border-white/10 text-white" 
          : "bg-white border-slate-100 text-emerald-950 shadow-sm"
      }`}>
        <div className="flex items-center  lg:px-2 py-2">
          
          {/* 1. ZONA LOGO: Cambia dinámicamente según darkMode */}
          <div className="flex-1 flex justify-start pl-[5%] ">
            <Link to="/" className="relative group flex items-center p-2 transition-all duration-300 z-50">
              <img 
                src={darkMode ? logoDark : logoLight} 
                className={`h-16 lg:h-24 w-auto object-contain transition-all duration-500 group-hover:scale-105 ${
                  darkMode ? "drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "drop-shadow-[0_0_12px_rgba(5,150,105,0.2)]"
                }`} 
                alt="Logo CIBIR" 
              />
            </Link>
          </div>

          {/* 2. MENU DESKTOP */}
          <div className="hidden xl:block">
            <ul className="flex items-center space-x-8 text-[12px] font-bold uppercase tracking-wider text-emerald-600">
              {NAV_ITEMS.map((item, index) => (
                <NavItem key={index} item={item} />
              ))}
            </ul>
          </div>

          {/* 3. ACCIONES Y AUTENTICACIÓN */}
          <div className="flex-1 flex items-center justify-end space-x-3">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full transition-colors ${darkMode ? "hover:bg-white/10" : "hover:bg-emerald-50"}`}
            >
              {darkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-emerald-700" />}
            </button>

            <div className='relative z-10 flex items-center gap-2 sm:gap-3'>
              {user ? (
                <>
                  <Link
                    to='/panel'
                    className='hidden md:flex items-center gap-2 px-4 py-1.5 bg-emerald-900/30 border border-emerald-500/30 rounded-full text-emerald-300 text-xs font-bold hover:bg-emerald-800/50 hover:border-emerald-400 transition-all shadow-inner'
                  >
                    <span className='relative flex h-2.5 w-2.5'>
                      <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75'></span>
                      <span className='relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500'></span>
                    </span>
                    {user.email.split('@')[0]}
                  </Link>

                  <button
                    onClick={logout}
                    title={labelSalir}
                    className='p-2 text-emerald-500/70 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all flex items-center gap-1 text-xs font-bold'
                  >
                    <LogOut size={20} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className='px-6 py-2 bg-emerald-500 text-white rounded-full text-xs font-bold hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95'
                >
                  {labelLogin}
                </button>
              )}
            </div>

            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className={`xl:hidden p-2 rounded-lg transition-colors ${
                darkMode ? "text-white hover:bg-white/10" : "text-emerald-950 hover:bg-emerald-50"
              }`}
            >
              {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      </nav>

      {/* MOBILE DRAWER */}
      <div className={`fixed inset-0 z-[60] backdrop-blur-sm transition-opacity duration-300 xl:hidden ${
        isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } ${darkMode ? 'bg-black/80' : 'bg-emerald-950/20'}`} onClick={() => setIsMobileMenuOpen(false)} />

      <div className={`fixed inset-y-0 right-0 z-[70] w-[85%] max-w-sm shadow-2xl transition-transform duration-300 ease-in-out xl:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
      } ${darkMode ? 'bg-[#011a14]' : 'bg-white'}`}>
        <div className="flex flex-col h-full">
          <div className={`flex items-center justify-between p-6 border-b ${darkMode ? 'border-white/10' : 'border-emerald-100'}`}>
            {/* Logo dinámico también en el menú móvil */}
            <img src={darkMode ? logoDark : logoLight} alt="Logo" className="h-12 w-auto" />
            <button onClick={() => setIsMobileMenuOpen(false)} className={darkMode ? 'text-white' : 'text-emerald-900'}><X /></button>
          </div>

          <div className="flex-grow overflow-y-auto p-6 space-y-6">
            {NAV_ITEMS.map((item, idx) => (
              <div key={idx} className="space-y-4">
                <Link
                  to={item.items ? '#' : item.Tpath}
                  onClick={() => !item.items && setIsMobileMenuOpen(false)}
                  className={`block text-lg font-black uppercase tracking-wider ${
                    darkMode ? 'text-white hover:text-emerald-400' : 'text-emerald-900 hover:text-emerald-600'
                  }`}
                >
                  {item.title}
                </Link>
                {item.items && (
                  <div className="ml-4 pl-4 border-l-2 border-emerald-500/20 flex flex-col gap-3">
                    {item.items.map((sub, sidx) => (
                      <Link key={sidx} to={sub.path} onClick={() => setIsMobileMenuOpen(false)}
                        className={`text-sm font-bold ${darkMode ? 'text-emerald-400 hover:text-white' : 'text-emerald-600 hover:text-emerald-900'}`}>
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-6">
            <button 
              onClick={() => { setShowLoginModal(true); setIsMobileMenuOpen(false); }}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg bg-emerald-500 text-white"
            >
              {user ? "Mi Panel" : "Iniciar Sesión"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default Navbar;
