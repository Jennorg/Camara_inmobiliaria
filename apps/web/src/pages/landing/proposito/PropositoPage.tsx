import React, { useState, useEffect } from "react";
import bgBolivar from "@/assets/Pzo.jpg";
import Navbar from "@/pages/landing/components/navbar/Navbar";
import Footer from "@/pages/landing/components/Footer";

const useScrollReveal = () => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) entry.target.classList.add("active");
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return (element: HTMLElement | null) => setNode(element);
};

export default function Proposito() {
  const [darkMode, setDarkMode] = useState(false);
  const setRevealCuerpo = useScrollReveal();
  const setRevealAgenda = useScrollReveal();

  return (
    <div className="min-h-screen bg-[#022c22] text-white font-sans selection:bg-emerald-500/30">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <header
        className="relative px-6 lg:px-20 py-24 flex items-center justify-center min-h-[50vh] bg-cover animate-header-bg overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.85), rgba(2, 44, 34, 0.85)), url(${bgBolivar})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="relative z-10 text-center space-y-4">
          <p
            className="text-emerald-500 font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs animate-header-text"
            style={{ animationDelay: "0.2s", opacity: 0 }}
          >
            Valores y Compromiso Ético
          </p>
          <h1
            className="text-5xl lg:text-8xl font-black tracking-tighter animate-header-text"
            style={{ animationDelay: "0.4s", opacity: 0 }}
          >
            Nuestro <span className="text-emerald-500 italic">Propósito</span>
          </h1>
          <p
            className="text-emerald-100/60 max-w-2xl mx-auto font-medium animate-header-text uppercase tracking-widest text-[10px] sm:text-sm"
            style={{ animationDelay: "0.6s", opacity: 0 }}
          >
            Pilares fundamentales para el desarrollo del sector inmobiliario
          </p>
        </div>
      </header>
      <main className="bg-white text-slate-900 rounded-t-[4rem] -mt-12 relative z-10 px-6 lg:px-20 py-24">
        <div className="max-w-5xl mx-auto space-y-16">
          <section ref={setRevealCuerpo} className="reveal-slide-up space-y-6">
            <div className="inline-block border-l-4 border-emerald-500 pl-6">
              <h2 className="text-2xl font-black text-[#022c22] uppercase tracking-tight leading-none">
                Cámara Inmobiliaria del estado Bolívar
              </h2>
              <p className="text-sm font-bold text-emerald-600 mt-2">
                RIF: J306407383
              </p>
            </div>
            <p className="text-slate-600 leading-relaxed text-lg">
              Bajo la vigencia de los estatutos sociales (Artículo 21), nuestro
              propósito institucional se centra en el fortalecimiento y
              desarrollo del sector.
            </p>
          </section>

          <section ref={setRevealAgenda} className="reveal-slide-up grid gap-4">
            {[
              "Formalización de la nueva Junta Directiva 2025-2027",
              "Situación legal y financiera de la institución",
              "Sostenibilidad financiera y nuevos convenios",
              "Contratos de prestación de servicios gremiales",
              "Presentación del Plan de Gestión 2026",
              "Innovación digital: Sistema de gestión y Web",
            ].map((punto, idx) => (
              <div
                key={idx}
                className="flex gap-6 p-8 rounded-[2rem] border-2 border-emerald-50 bg-slate-50/50 hover:border-emerald-500 hover:bg-white hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500 group cursor-default overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="text-8xl font-black text-slate-900 leading-none">
                    {idx + 1}
                  </span>
                </div>

                <span className="flex-none w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black group-hover:bg-emerald-500 group-hover:text-white group-hover:rotate-6 transition-all duration-300 relative z-10">
                  {idx + 1}
                </span>

                <p className="text-slate-700 font-bold self-center text-lg group-hover:text-[#022c22] transition-colors relative z-10">
                  {punto}
                </p>
              </div>
            ))}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
