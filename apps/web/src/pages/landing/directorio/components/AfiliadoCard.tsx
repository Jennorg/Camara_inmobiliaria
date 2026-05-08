import React from 'react';
import { Mail, Instagram, Linkedin, Building2, User, Briefcase } from 'lucide-react';
import { formatNombreCard, getInitials } from '@/utils/formatters';
import { Link } from 'react-router-dom';

interface RedesSociales {
  instagram?: string;
  linkedin?: string;
  facebook?: string;
}

import { AfiliadoDTO } from '@/types/afiliados';

export type AfiliadoData = AfiliadoDTO;

export const AfiliadoCard = ({ afiliado }: { afiliado: AfiliadoData }) => {
  return (
    <Link 
      to={`/miembros/${afiliado.id_afiliado}`}
      className="relative overflow-hidden bg-white dark:bg-[#04432f] rounded-[1.5rem] p-5 shadow-sm border border-slate-200 dark:border-emerald-500/20 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-xl transition-all duration-500 group hover:-translate-y-1 block"
    >
      {/* Elemento decorativo de fondo */}
      <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/5 rounded-full group-hover:scale-150 transition-transform duration-700" />
      
      <div className="relative flex flex-col items-center text-center">
        {/* Badge de tipo y estatus */}
        <div className="w-full flex justify-between items-center mb-4">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-[#022c22] rounded-full border border-slate-200/50 dark:border-emerald-500/10">
              {afiliado.tipo_afiliado === 'Corporativo' ? (
                <>
                  <Building2 size={10} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-emerald-400/70">Corporativo</span>
                </>
              ) : (afiliado.tipo_afiliado === 'Agente Corporativo' || afiliado.tipo_afiliado === 'Agente') ? (
                <>
                  <Briefcase size={10} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-emerald-400/70">Agente Corporativo</span>
                </>
              ) : (
                <>
                  <User size={10} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-emerald-400/70">Independiente</span>
                </>
              )}
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
              Activo
            </span>
        </div>

        {/* Avatar */}
        <div className="relative mb-3">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-teal-300 rounded-full blur-lg opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-white dark:border-[#04432f] shadow-md flex items-center justify-center bg-[#022c22]">
            {afiliado.foto_url ? (
              <img
                src={afiliado.foto_url}
                alt={`Foto de ${afiliado.nombre_completo}`}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            ) : (
              <span className="text-white font-black text-2xl uppercase tracking-tighter">
                {getInitials(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
              </span>
            )}
          </div>
        </div>

        {/* Información del Miembro */}
        <div className="space-y-1 mb-5">
          <h3 className="font-bold text-slate-800 dark:text-emerald-50 text-lg leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
            {afiliado.tipo_afiliado === 'Corporativo' 
              ? (afiliado.empresa_razon_social || afiliado.nombre_completo)
              : (afiliado.nombres ? `${afiliado.nombres} ${afiliado.apellidos}` : afiliado.nombre_completo)}
          </h3>
          
          {afiliado.tipo_afiliado === 'Corporativo' && (
            <p className="text-[10px] text-slate-400 dark:text-emerald-100/40 font-medium">
              Representante: {afiliado.nombres ? `${afiliado.nombres} ${afiliado.apellidos}` : afiliado.nombre_completo}
            </p>
          )}

          {(afiliado.tipo_afiliado === 'Agente Corporativo' || afiliado.tipo_afiliado === 'Agente') && afiliado.empresa_razon_social && (
            <p className="text-[10px] text-slate-400 dark:text-emerald-100/40 font-medium">
              Parte de: {afiliado.empresa_razon_social}
            </p>
          )}

          <div className="inline-flex items-center gap-2 text-[9px] font-bold text-slate-400 dark:text-emerald-100/50 tracking-widest uppercase bg-slate-50 dark:bg-[#022c22] px-2.5 py-0.5 rounded-full border border-slate-100 dark:border-emerald-500/5 mt-1">
            Código: {afiliado.codigo_cibir || 'En proceso'}
          </div>
        </div>

        {/* Acciones de Contacto */}
        <div className="flex gap-2.5 items-center justify-center pt-5 border-t border-slate-100 dark:border-emerald-500/10 w-full">
           <button className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-400 dark:text-emerald-400 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-all duration-300">
              <Mail size={14} />
           </button>
           <button className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-400 dark:text-emerald-400 hover:text-white hover:bg-gradient-to-tr hover:from-purple-600 hover:to-pink-500 transition-all duration-300">
              <Instagram size={14} />
           </button>
           <button className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-400 dark:text-emerald-400 hover:text-white hover:bg-blue-600 transition-all duration-300">
              <Linkedin size={14} />
           </button>
        </div>
      </div>
    </Link>
  );
};
