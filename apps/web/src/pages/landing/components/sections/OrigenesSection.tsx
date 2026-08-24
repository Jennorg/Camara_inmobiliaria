import React from 'react'

export default function OrigenesSection() {
  return (
    <section id="origenes" className="bg-[#022c22] py-24 px-6 lg:px-20 overflow-hidden relative">

      {/* LUZ DE AMBIENTE: Un toque de luz esmeralda al fondo a la izquierda */}
      <div className="absolute top-0 -left-20 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">

          <div className="lg:col-span-5 flex flex-col justify-center">
            <p className="text-emerald-400 font-black uppercase tracking-[0.3em] text-xs mb-4">
              Fechas Fundacionales
            </p>
            <h2 className="text-5xl lg:text-7xl font-black text-white tracking-tighter mb-8 leading-[0.9]">
              Nuestros <br />
              <span className="text-emerald-500">Orígenes</span>
            </h2>
            <div className="w-24 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"></div>
          </div>

          <div className="lg:col-span-7 flex flex-col gap-6">

            {/* TARJETA 1966: Efecto de profundidad sutil */}
            <div className="group bg-[#011a14]/60 border border-white/5 hover:border-emerald-500/40 p-8 md:p-10 rounded-[2.5rem] transition-colors duration-500 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                <h3 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-teal-200">
                  1966
                </h3>
                <div className="hidden md:block w-px h-16 bg-white/10"></div>
                <p className="text-white/70 text-lg leading-relaxed font-light">
                  Fundación de la <span className="text-white font-medium">Cámara Inmobiliaria de Venezuela.</span>
                </p>
              </div>
            </div>

            {/* TARJETA 1999: Destacada */}
            <div className="group bg-gradient-to-br from-emerald-800/20 to-[#011a14]/80 border border-emerald-500/20 hover:border-emerald-400/60 p-8 md:p-10 rounded-[2.5rem] transition-colors duration-500 shadow-2xl relative overflow-hidden">
              {/* Brillo interno en la esquina */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-3xl group-hover:bg-emerald-500/20 transition-colors" />

              <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10 relative z-10">
                <h3 className="text-6xl md:text-7xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                  1999
                </h3>
                <div className="hidden md:block w-px h-16 bg-emerald-500/30"></div>
                <p className="text-white text-lg leading-relaxed font-medium">
                  Fundación de la <span className="text-emerald-400">Cámara Inmobiliaria del estado Bolívar.</span>
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
