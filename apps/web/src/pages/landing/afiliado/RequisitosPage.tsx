import React, { useState } from "react";
import bgCibir from "@/assets/Pzo.jpg";
import Navbar from '@/pages/landing/components/navbar/Navbar';
import Footer from '@/pages/landing/components/Footer';
import Estudiosa from "@/assets/estudiosa1.png";
import Estudioso from "@/assets/estudioso1.png";
import PreinscripcionProgramaForm from '@/pages/landing/components/PreinscripcionProgramaForm'
import { ClipboardList, FileText, UserCheck, ShieldCheck, GraduationCap, PartyPopper } from 'lucide-react'

const AFFILIATION_STEPS = [
  {
    title: "Preinscripción",
    description: "Recopilación de datos básicos",
    details: (
      <>
        Al completar el formulario, recibirás un correo electrónico con un enlace único para continuar tu registro y subir tus recaudos.
      </>
    ),
    icon: ClipboardList,
    color: "#10b981" // Emerald
  },
  {
    title: "Expediente",
    description: "Cargar documentación",
    details: (
      <>
        Síntesis Curricular, Títulos (Bachiller/TSU/Profesional), Postgrados, Diplomados y Talleres de los últimos 5 años.
      </>
    ),
    icon: FileText,
    color: "#0d9488" // Teal
  },
  {
    title: "Entrevista",
    description: "Encuentro presencial",
    details: (
      <>
        Encuentro presencial con miembro de la junta directiva.
      </>
    ),
    icon: UserCheck,
    color: "#2563eb" // Blue
  },
  {
    title: "Verificación",
    description: "Evaluación de tu perfil",
    details: (
      <>
        Analizamos tu experiencia para trazar tu ruta ideal:
        <ul className="text-left list-disc pl-3 mt-1.5 space-y-1">
          <li><b>Acreditación total:</b> Si tu perfil cumple todos los requisitos.</li>
          <li><b>Acreditación parcial:</b> Cursarás solo los módulos del CIBIR que necesites reforzar.</li>
          <li><b>Formación:</b> Realizarás el CIBIR completo para prepararte al 100%.</li>
        </ul>
      </>
    ),
    icon: ShieldCheck,
    color: "#4f46e5" // Indigo
  },
  {
    title: "CIBIR",
    description: "Acreditación o Nivelación",
    details: (
      <>
        Paso vinculado a quienes reciben una acreditación parcial o según lo determine la verificación de expediente.
      </>
    ),
    icon: GraduationCap,
    color: "#e11d48" // Rose
  },
  {
    title: "Inscripción",
    description: "Fase final del proceso",
    details: (
      <>
        Hacia donde convergen los resultados positivos de los pasos anteriores para formalizar tu afiliación.
      </>
    ),
    icon: PartyPopper,
    color: "#d97706" // Amber
  }
]

export default function RequisitosPage() {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#022c22] text-white font-sans selection:bg-emerald-500/30 scroll-smooth">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <header
        className="relative px-4 sm:px-6 lg:px-20 py-24 lg:py-40 flex items-center justify-center min-h-[60vh] bg-cover"
        style={{
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.8), rgba(2, 44, 34, 0.9)), url(${bgCibir})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="text-center space-y-8 max-w-5xl relative z-10">
          <h1 className="text-5xl sm:text-6xl lg:text-8xl font-black tracking-tighter uppercase leading-[0.9]">
            ¡Únete a nuestro <br />
            <span className="text-emerald-500 italic">equipo</span> de profesionales!
          </h1>
          <p className="text-emerald-100/70 text-xl md:text-2xl font-light max-w-3xl mx-auto italic">
            El primer paso para transformar tu carrera inmobiliaria comienza aquí.
            Inicia tu proceso de afiliación y consolida tu trayectoria profesional.
          </p>
        </div>
      </header>

      <main className="bg-white text-slate-900 rounded-t-[3rem] sm:rounded-t-[4rem] -mt-20 relative z-20 px-4 sm:px-6 lg:px-20 py-20">
        <div className="max-w-6xl mx-auto">

          {/* Value Chain Diagram (Straight Flow) */}
          <div className="mb-24 space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-800 leading-none">
                Tu Camino a la <span className="text-emerald-600">Excelencia</span>
              </h2>
              <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
                Una ruta estratégica de profesionalización diseñada para integrarte a la red inmobiliaria de mayor prestigio y respaldo institucional.
              </p>
            </div>

            <div className="relative">
              {/* Desktop Horizontal Flow (Chevron/Arrow Chain) */}
              <div className="hidden lg:flex items-stretch w-full drop-shadow-xl">
                {AFFILIATION_STEPS.map((step, idx) => {
                  const isFirst = idx === 0;

                  // Chevron clip-paths
                  const clipPath = isFirst
                    ? 'polygon(0% 0%, calc(100% - 24px) 0%, 100% 50%, calc(100% - 24px) 100%, 0% 100%)'
                    : 'polygon(0% 0%, calc(100% - 24px) 0%, 100% 50%, calc(100% - 24px) 100%, 0% 100%, 24px 50%)';

                  return (
                    <div
                      key={idx}
                      className={`flex-1 relative group transition-all duration-500 ease-in-out hover:flex-[2.2] hover:-translate-y-1 ${!isFirst ? '-ml-[24px]' : ''}`}
                      style={{
                        backgroundColor: step.color,
                        clipPath: clipPath,
                        paddingLeft: !isFirst ? '24px' : '0'
                      }}
                    >
                      <div className="py-10 px-5 h-full flex flex-col items-center text-center space-y-4 pr-10">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/20 shadow-inner backdrop-blur-sm shrink-0 transition-transform duration-500 group-hover:scale-110">
                          <step.icon size={28} strokeWidth={2} className="text-white" />
                        </div>

                        <div className="flex flex-col items-center flex-1 w-full justify-start overflow-hidden">
                          <span className="text-[10px] font-black text-white/70 uppercase tracking-widest bg-black/10 px-2.5 py-0.5 rounded-full mb-2 shrink-0">
                            Paso 0{idx + 1}
                          </span>
                          <h3 className="font-black text-white text-sm uppercase tracking-wider shrink-0 mb-1">{step.title}</h3>

                          {/* Short Description - Always visible */}
                          <p className="text-xs text-white/90 font-medium leading-tight mb-2 shrink-0">
                            {step.description}
                          </p>

                          {/* Detailed Explanation - Hidden by default, shown on hover */}
                          <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-500 ease-in-out w-full">
                            <div className="overflow-hidden">
                              <div className="text-xs text-white/80 leading-relaxed font-normal pt-3 border-t border-white/20 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                                {step.details}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Mobile / Tablet Grid Flow */}
              <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
                {AFFILIATION_STEPS.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-3xl border border-slate-100 bg-white shadow-sm flex flex-col gap-4 group hover:border-emerald-200 transition-all relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 opacity-5 rounded-full -mr-10 -mt-10 blur-2xl" style={{ backgroundColor: step.color }} />
                    <div className="flex items-center gap-4 relative z-10">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: step.color + '15', color: step.color }}
                      >
                        <step.icon size={24} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-0.5">Paso 0{idx + 1}</p>
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight">{step.title}</h3>
                      </div>
                    </div>
                    <div className="relative z-10 border-t border-slate-50 pt-3">
                      <p className="text-xs font-bold text-slate-700 mb-1">{step.description}</p>
                      <div className="text-xs text-slate-500 font-medium leading-relaxed">{step.details}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative group">
              {/* Watermarks */}
              <div className="absolute -top-40 -left-60 opacity-[0.03] pointer-events-none hidden lg:block">
                <img src={Estudiosa} alt="" className="h-[600px] w-auto" />
              </div>
              <div className="absolute -bottom-20 -right-60 opacity-[0.03] pointer-events-none hidden lg:block">
                <img src={Estudioso} alt="" className="h-[500px] w-auto" />
              </div>

              <div id="formulario" className="relative z-10 p-8 sm:p-16 rounded-[3rem] bg-[#022c22] text-white text-center space-y-10 overflow-hidden shadow-2xl border border-white/5">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full -mr-40 -mt-40 blur-3xl opacity-50" />

                <div className="relative z-10 space-y-4">
                  <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">
                    Solicitud de Afiliación
                  </h2>
                  <p className="text-emerald-200/60 text-lg max-w-2xl mx-auto font-medium">
                    Completa tus datos y nos pondremos en contacto contigo para iniciar tu proceso.
                  </p>
                </div>

                <div className="max-w-3xl mx-auto">
                  <PreinscripcionProgramaForm programaCodigo="AFILIACION" ctaLabel="Enviar Solicitud" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main >

      <Footer />
    </div >
  );
}
