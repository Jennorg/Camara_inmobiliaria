import React from 'react';
import { GraduationCap, Briefcase, User } from 'lucide-react';
import { AfiliadoData } from '../AfiliadoCard';

interface ProfileMainContentProps {
  afiliado: AfiliadoData;
}

export const ProfileMainContent = ({ afiliado }: ProfileMainContentProps) => {
  return (
    <div className="space-y-8 w-full">
      {(afiliado.nivel_academico || afiliado.profesion) && (
        <section className="bg-white dark:bg-[#04432f] rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-200 dark:border-emerald-500/10">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <GraduationCap size={16} className="text-emerald-500" />
            </div>
            Perfil Académico y Profesional
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {afiliado.nivel_academico && (
              <div className="p-4 rounded-[1.25rem] bg-slate-100/50 dark:bg-[#022c22] border border-slate-100 dark:border-emerald-500/5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Nivel Académico</p>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-emerald-50">{afiliado.nivel_academico}</p>
                </div>
              </div>
            )}
            {afiliado.profesion && (
              <div className="p-4 rounded-[1.25rem] bg-slate-100/50 dark:bg-[#022c22] border border-slate-100 dark:border-emerald-500/5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Briefcase size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Profesión / Especialidad</p>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-emerald-50">{afiliado.profesion}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {(afiliado.descripcion || afiliado.notas) && (
        <section className="bg-white dark:bg-[#04432f] rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-200 dark:border-emerald-500/10">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <User size={16} className="text-emerald-500" />
            </div>
            Sobre el Miembro
          </h3>
          <p className="text-sm text-slate-600 dark:text-emerald-100/70 leading-relaxed font-medium whitespace-pre-wrap">
            {afiliado.descripcion || afiliado.notas}
          </p>
        </section>
      )}
    </div>
  );
};
