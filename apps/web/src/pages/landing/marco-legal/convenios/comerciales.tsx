import React, { useState, useEffect } from "react";
import bgBolivar from "@/assets/Pzo.jpg";
import Navbar from '@/pages/landing/components/navbar/Navbar'
import { API_URL } from '@/config/env'

interface ConvenioPublico {
  id: number
  nombre: string
  logo_url: string
  orden: number
  activo: number | boolean
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(url)
}

export default function Comerciales() {
  const [darkMode, setDarkMode] = useState(false)
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ConvenioPublico[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`${API_URL}/api/cms/convenios`)
        const j = await r.json()
        if (!j.success) throw new Error(j.message || 'Error al cargar convenios')
        const convenios = Array.isArray(j.data)
          ? (j.data as ConvenioPublico[]).filter((it) => it.activo === 1 || it.activo === true)
          : []
        if (!cancelled) setItems(convenios)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar los convenios')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <header
        className="relative px-6 lg:px-20 py-16 lg:py-24 flex items-center justify-center min-h-[40vh] bg-cover"
        style={{
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.85), rgba(2, 44, 34, 0.85)), url(${bgBolivar})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="text-center space-y-3 md:space-y-4">
          <p className="text-emerald-400 font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] text-[10px] md:text-xs">
            Alianzas Estratégicas
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter drop-shadow-lg">
            Convenios{" "}
            <span className="text-emerald-400 italic">y documentos</span>
          </h1>
          <p className="text-emerald-100/80 text-xs md:text-sm tracking-widest uppercase font-medium">
            Repositorio de documentos oficiales de convenios
          </p>
        </div>
      </header>

      <main className="bg-slate-50 text-slate-900 rounded-t-[2.5rem] md:rounded-t-[4rem] -mt-8 md:-mt-12 relative z-10 px-4 sm:px-6 lg:px-24 py-12 md:py-20 min-h-[60vh] shadow-2xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-t-4 border-b-4 border-emerald-600"></div>
            <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest animate-pulse">
              Cargando convenios...
            </p>
          </div>
        ) : error ? (
          <div className="max-w-xl mx-auto text-center py-16 px-4 rounded-3xl bg-white border border-red-100 text-red-700 text-sm">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="max-w-xl mx-auto text-center py-16 px-4 rounded-3xl bg-white border border-slate-100 text-slate-500 text-sm">
            Aún no hay convenios publicados. Vuelve pronto.
          </div>
        ) : (
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6 md:gap-8">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="group relative bg-white rounded-[1.5rem] md:rounded-[2rem] p-4 sm:p-6 md:p-8 flex flex-col h-full border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-900/10 hover:-translate-y-1 md:hover:-translate-y-2 transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 md:h-1.5 bg-gradient-to-r from-emerald-400 to-[#022c22] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="flex justify-center md:justify-start mb-4 md:mb-6">
                    <span className="inline-block px-2 py-1 md:px-3 bg-emerald-50 text-emerald-700 text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] rounded-full border border-emerald-100/50 truncate max-w-full">
                      Convenio
                    </span>
                  </div>

                  <div className="flex flex-col flex-grow gap-3">
                    <div className="w-full h-40 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center shrink-0 group-hover:border-emerald-200 transition-colors shadow-inner overflow-hidden">
                      {isImageUrl(item.logo_url) ? (
                        <img src={item.logo_url} alt={item.nombre} className="w-full h-full object-contain p-3" />
                      ) : (
                        <span className="text-4xl" aria-hidden>📄</span>
                      )}
                    </div>
                    <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 tracking-tight group-hover:text-[#022c22] transition-colors leading-snug">
                      {item.nombre}
                    </h2>
                  </div>

                  <a
                    href={item.logo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#022c22] text-white text-[10px] md:text-xs font-black uppercase tracking-widest px-5 py-3 hover:bg-emerald-600 transition-colors"
                  >
                    {isImageUrl(item.logo_url) ? 'Ver imagen' : 'Abrir PDF'}
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </article>
              ))}
            </div>

            <div className="mt-20 md:mt-32 bg-gradient-to-br from-[#022c22] to-[#011a14] rounded-[2rem] md:rounded-[3rem] p-8 md:p-20 text-center text-white relative overflow-hidden shadow-2xl border border-emerald-900/50">
              <div className="absolute top-0 right-0 w-64 h-64 md:w-80 md:h-80 bg-emerald-500/10 rounded-full -mr-20 -mt-20 blur-2xl md:blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 md:w-64 md:h-64 bg-emerald-700/10 rounded-full -ml-20 -mb-20 blur-2xl md:blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl mx-auto space-y-6 md:space-y-8">
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter">
                  ¿Quieres formar parte <br /> de nuestra{" "}
                  <span className="text-emerald-400">red de aliados?</span>
                </h2>
                <p className="text-emerald-100/70 text-sm md:text-lg leading-relaxed font-medium max-w-xl mx-auto">
                  Estos convenios se gestionan desde el CMS y sus documentos se publican como enlaces PDF.
                </p>
                <div className="pt-4 md:pt-6">
                  <a href="/normativas" className="inline-block bg-emerald-500 text-[#022c22] w-full sm:w-auto px-8 py-4 md:px-12 md:py-5 rounded-full font-black text-xs md:text-sm uppercase tracking-[0.2em] hover:bg-white hover:scale-105 transition-all duration-300 shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)] active:scale-95">
                    Ver normativas
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-[#011a14] px-4 sm:px-6 lg:px-20 py-8 md:py-12 text-center relative z-10">
        <p className="text-slate-500 text-[9px] md:text-xs uppercase tracking-[0.2em] font-medium">
          © 2026 Cámara Inmobiliaria del Estado Bolívar • RIF J-30462520-0
        </p>
      </footer>
    </div>
  );
}
