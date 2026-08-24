import React from 'react';
import { GraduationCap, ShieldCheck, TrendingUp, Sparkles, Calendar } from 'lucide-react';
import { AfiliadoData } from '../AfiliadoCard';

interface ProfileMainContentProps {
  afiliado: AfiliadoData;
}

export const ProfileMainContent = ({ afiliado }: ProfileMainContentProps) => {
  const isCibir = !!afiliado.cibir_convalidado;
  const progressPercent = isCibir ? 100 : 60;

  return (
    <div className="w-full">
      {/* ── CARD GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full text-slate-800">
        
        {/* Card 1: Trayectoria / Perfil */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200/50 flex flex-col justify-between min-h-[200px]">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
              <TrendingUp size={18} className="text-emerald-600" />
            </div>
            <h3 className="text-base font-black text-slate-800 tracking-tight mb-2">
              Perfil y Trayectoria
            </h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed line-clamp-3">
              {afiliado.descripcion || afiliado.notas || (
                `Profesional certificado por la Cámara Inmobiliaria de Bolívar, dedicado al asesoramiento, corretaje y gestión integral de propiedades residenciales y comerciales.`
              )}
            </p>

            {/* Academic Level & Profession Tags */}
            {((afiliado.nivel_academico && !afiliado.nivel_academico.toLowerCase().includes('bachiller')) || afiliado.profesion) && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {afiliado.nivel_academico && !afiliado.nivel_academico.toLowerCase().includes('bachiller') && (
                  <span className="inline-flex items-center gap-1 bg-slate-50 text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-lg border border-slate-100">
                    🎓 {afiliado.nivel_academico}
                  </span>
                )}
                {afiliado.profesion && (
                  <span className="inline-flex items-center gap-1 bg-slate-50 text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-lg border border-slate-100">
                    💼 {afiliado.profesion}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span className="text-emerald-600 font-black flex items-center gap-1">
              Ver Trayectoria <span className="text-xs">→</span>
            </span>
            <span>Verificado</span>
          </div>
        </div>

        {/* Card 2: Seguridad y Aval Gremial */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200/50 flex flex-col justify-between min-h-[200px]">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
              <ShieldCheck size={18} className="text-blue-600" />
            </div>
            <h3 className="text-base font-black text-slate-800 tracking-tight mb-2">
              Seguridad y Respaldo
            </h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Operaciones inmobiliarias regidas bajo el código de ética de la Cámara. Convalidación formal garantizada en el estado Bolívar.
            </p>
          </div>
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              Código de Ética CIB
            </span>
            <span className="text-blue-600">Activo</span>
          </div>
        </div>

        {/* Card 3: Highlighted Dark Emerald Card (Estado CIBIR) */}
        <div className="bg-[#043425] text-white rounded-[2.5rem] p-6 shadow-lg flex flex-col justify-between min-h-[200px] relative overflow-hidden">
          {/* Internal ambient glow */}
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />
          
          <div>
            <span className="text-[9px] font-black tracking-widest text-emerald-400 uppercase block mb-3">
              ESTADO DEL AFILIADO
            </span>
            <h3 className="text-base font-black tracking-tight leading-tight">
              {isCibir ? 'Capacitación CIBIR Convalidada' : 'Programa CIBIR en Curso'}
            </h3>
            <p className="text-[10px] text-emerald-100/60 font-semibold mt-1">
              Cámara Inmobiliaria de Bolívar
            </p>
          </div>

          <div className="mt-6">
            <div className="flex justify-between items-center text-[10px] font-bold mb-1.5 text-emerald-300">
              <span>{isCibir ? 'CONVALIDADO' : 'PENDIENTE CONVALIDACIÓN'}</span>
              <span>{progressPercent}%</span>
            </div>
            {/* Progress bar container */}
            <div className="w-full h-1.5 bg-emerald-950 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-400 rounded-full transition-colors duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
