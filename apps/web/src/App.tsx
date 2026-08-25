import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import ScrollToHash from '@/components/ScrollToHash'
import ScrollToTop from '@/components/ScrollToTop'
import SEO from '@/components/SEO'

// Static imports (Removing lazy/preload)
import LandingPage from '@/pages/landing/LandingPage'
import CursosCatalogPage from '@/pages/landing/courses/CursosCatalogPage'
import MisionVisionPage from '@/pages/landing/mision-vision/MisionVisionPage'
import JuntaDirectivaPage from '@/pages/landing/junta-directiva/JuntaDirectivaPage'
import HistoriaPage from '@/pages/landing/historia/HistoriaPage'
import CivPage from '@/pages/landing/courses/CIV/CivPage'
import AdminPage from '@/pages/admin/AdminPage'
import DireccionPage from '@/pages/landing/direccion/DireccionPage'
import PropositoPage from '@/pages/landing/proposito/PropositoPage'
import PanelPage from '@/pages/panel/PanelPage'
import CibirPage from '@/pages/landing/courses/CIBIR/CibirPage'
import VerificarEmailPage from '@/pages/landing/courses/CIBIR/VerificarEmailPage'
import DirectorioPage from '@/pages/landing/directorio/DirectorioPage'
import PreaniPage from '@/pages/landing/courses/PREANI/PreaniPage'
import PegiPage from '@/pages/landing/courses/PEGI/PegiPage'
import PadiPage from '@/pages/landing/courses/PADI/PadiPage'
import VerificarPreinscripcionProgramaPage from '@/pages/landing/courses/VerificarPreinscripcionProgramaPage'
import SetupPasswordPage from '@/pages/auth/SetupPasswordPage'
import LobbyPage from '@/pages/lobby/LobbyPage'
import ComprobantePublicoPage from '@/pages/comprobante/ComprobantePublicoPage'
import CertificadoAfiliacionPage from '@/pages/comprobante/CertificadoAfiliacionPage'
import MarcoLegalPage from '@/pages/landing/marco-legal/MarcoLegalPage'
import RequisitosPage from '@/pages/landing/afiliado/RequisitosPage'
import InvitacionCorporativaPage from '@/pages/landing/afiliado/InvitacionCorporativaPage'
import AfiliadoProfilePage from '@/pages/landing/directorio/AfiliadoProfilePage'

import { Toaster } from '@/components/ui/sonner'

function PreservingQueryNavigate({ to }: { to: string }) {
  const [searchParams] = useSearchParams()
  const q = searchParams.toString()
  return <Navigate to={q ? `${to}?${q}` : to} replace />
}


import ImpersonationBanner from '@/components/ImpersonationBanner'

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <ScrollToHash />
        <ScrollToTop />
        <ToastProvider>
        <Toaster position="bottom-right" />
        <AuthProvider>
        <ImpersonationBanner />
        <Routes>
          {/* Rutas principales dependientes del host */}
          <Route path='/' element={<><SEO /><LandingPage /></>} />
          <Route path='/cursos'        element={<CursosCatalogPage />} />
          <Route path='/talleres'      element={<CursosCatalogPage />} />
          <Route path='/mision-vision' element={<MisionVisionPage />} />
          <Route path='/mision_vision' element={<Navigate to='/mision-vision' replace />} />
          <Route path='/junta-directiva' element={<JuntaDirectivaPage />} />
          <Route path='/junta_directiva' element={<Navigate to='/junta-directiva' replace />} />
          <Route path='/historia'      element={<HistoriaPage />} />
          <Route path='/codigo-etica'  element={<CivPage />} />
          <Route path='/codigo_etica'  element={<Navigate to='/codigo-etica' replace />} />
          <Route path='/direccion'     element={<DireccionPage />} />
          <Route path='/proposito'     element={<PropositoPage />} />
          <Route path='/cibir'         element={<CibirPage />} />
          <Route path='/cibir/verificar' element={<PreservingQueryNavigate to='/cursos/verificar' />} />
          <Route path='/cursos/verificar' element={<VerificarPreinscripcionProgramaPage />} />
          <Route path='/formacion/verificar' element={<PreservingQueryNavigate to='/cursos/verificar' />} />
          <Route path='/marco-legal/:category' element={<MarcoLegalPage />} />
          <Route path='/convenios' element={<Navigate to='/marco-legal/normas-y-procedimientos' replace />} />
          <Route path='/normativas' element={<Navigate to='/marco-legal/leyes-y-decretos' replace />} />
          <Route path='/miembros'      element={<DirectorioPage />} />
          <Route path='/miembros/:id'  element={<AfiliadoProfilePage />} />
          <Route path='/afiliate'      element={<RequisitosPage />} />
          <Route path='/requisitos'    element={<Navigate to='/afiliate' replace />} />
          <Route path='/beneficios'    element={<Navigate to='/#afiliados' replace />} />
          <Route path='/comprobante/:codigo' element={<ComprobantePublicoPage />} />
          <Route path='/comprobante/afiliacion/:id' element={<CertificadoAfiliacionPage />} />
          <Route path='/establecer-contrasena' element={<SetupPasswordPage />} />
          <Route path='/afiliacion/invitacion/:token' element={<InvitacionCorporativaPage />} />

          {/* Rutas Dinámicas */}
          <Route path='/preani' element={<PreaniPage />} />
          <Route path='/pegi'   element={<PegiPage />} />
          <Route path='/padi'   element={<PadiPage />} />
          
          {/* ── Panel Unificado (afiliado + admin en una sola vista) ── */}
          <Route element={<ProtectedRoute />}>
            <Route path='/panel' element={<PanelPage />} />
            <Route path='/lobby' element={<LobbyPage />} />
          </Route>

          {/* ── CMS Visual Editor / Intranet Administrativa ── */}
          <Route element={<ProtectedRoute requiredRoles={['admin', 'super_admin', 'asistente', 'administrativo', 'secretario', 'secretaria', 'personal', 'personal_admin']} />}>
            <Route path='/admin' element={<AdminPage />} />
          </Route>

          {/* Redireccion de rutas antiguas al panel unificado */}
          <Route path='/afiliado' element={<Navigate to='/panel' replace />} />
        </Routes>
      </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
    </HelmetProvider>
  )
}
