import React from 'react';
import { Mail, Instagram, Linkedin, Facebook, Building2, User, Briefcase } from 'lucide-react';
import { formatNombreCard, getInitials } from '@/utils/formatters';
import { Link } from 'react-router-dom';

import { AfiliadoDTO } from '@/types/afiliados';

export type AfiliadoData = AfiliadoDTO;

/** Tarjeta corporativa: logo con contain; personas: foto con cover. */
function getCardImage(afiliado: AfiliadoData, isCorpView: boolean) {
  if (isCorpView) {
    const url = afiliado.empresa_logo_url || afiliado.foto_url || null;
    return { url, isLogo: !!afiliado.empresa_logo_url };
  }
  return { url: afiliado.foto_url || null, isLogo: false };
}

function CardImage({
  afiliado,
  isCorpView,
  size = 'default',
}: {
  afiliado: AfiliadoData;
  isCorpView: boolean;
  size?: 'default' | 'mini';
}) {
  const { url, isLogo } = getCardImage(afiliado, isCorpView);
  const initials = getInitials(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos);
  const alt = isCorpView
    ? `Logo de ${afiliado.empresa_razon_social || afiliado.nombre_completo}`
    : `Foto de ${afiliado.nombre_completo}`;

  if (size === 'mini') {
    return (
      <div
        className={`relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 border-white dark:border-[#04432f] shadow-sm flex items-center justify-center ${
          isLogo ? 'bg-white p-1.5' : 'bg-[#022c22]'
        }`}
      >
        {url ? (
          <img src={url} alt={alt} className={`w-full h-full ${isLogo ? 'object-contain' : 'object-cover'}`} />
        ) : (
          <span className="text-white font-black text-sm uppercase tracking-tighter">{initials}</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative mb-2.5 w-full -mx-4 -mt-4 pt-2">
      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-teal-300 rounded-[1rem] blur-lg opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
      <div
        className={`relative w-full h-48 rounded-[1rem] overflow-hidden border-2 border-white dark:border-[#04432f] shadow-sm flex items-center justify-center mt-1.5 ${
          isLogo ? 'bg-white p-6' : 'bg-[#022c22]'
        }`}
      >
        {url ? (
          <img
            src={url}
            alt={alt}
            className={`w-full h-full ${isLogo ? 'object-contain' : 'object-cover'} group-hover:scale-105 transition-transform duration-500`}
          />
        ) : (
          <span className="text-white font-black text-2xl uppercase tracking-tighter">{initials}</span>
        )}

        {/* Banner de Código (Dentro de la imagen, al fondo) */}
        <div className="absolute bottom-0 left-0 right-0 bg-[#022c22]/60 backdrop-blur-sm py-2 border-t border-white/10 z-10 text-center">
          <span className="text-xs font-black text-emerald-400 tracking-[0.2em] uppercase">
            CÓDIGO: {afiliado.codigo || '---'}
          </span>
        </div>
      </div>
    </div>
  );
}

interface AfiliadoCardProps {
  afiliado: AfiliadoData;
  forceRepMode?: boolean;
  variant?: 'default' | 'mini';
  highlighted?: boolean;
}

export const AfiliadoCard = ({ afiliado, forceRepMode = false, variant = 'default', highlighted = false }: AfiliadoCardProps) => {
  const isCorpView = afiliado.tipo_afiliado === 'Corporativo' && !forceRepMode;

  if (variant === 'mini') {
    return (
      <Link 
        to={forceRepMode ? `/miembros/${afiliado.id_afiliado}?mode=rep` : `/miembros/${afiliado.id_afiliado}`}
        className="group flex flex-col items-center gap-1 focus:outline-none"
      >
        <CardImage afiliado={afiliado} isCorpView={isCorpView} size="mini" />
        <div className="text-center">
          <h3 className="font-bold text-slate-800 dark:text-emerald-50 text-xs md:text-sm leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors uppercase truncate max-w-[120px]">
            {isCorpView 
              ? (afiliado.empresa_razon_social || afiliado.nombre_completo)
              : formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-emerald-100/50 font-medium uppercase truncate max-w-[120px]">
            {isCorpView ? 'Corporativo' : afiliado.profesion || 'Agente'}
          </p>
        </div>
      </Link>
    );
  }

  // Obtener número de teléfono para WhatsApp de forma segura
  const phoneNumber = isCorpView 
    ? (afiliado.empresa_telefono || afiliado.telefono)
    : afiliado.telefono;
  
  const whatsappUrl = phoneNumber 
    ? `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`
    : '#';

  return (
    <Link 
      to={forceRepMode ? `/miembros/${afiliado.id_afiliado}?mode=rep` : `/miembros/${afiliado.id_afiliado}`}
      className={`relative overflow-hidden bg-white dark:bg-[#04432f] rounded-[1.25rem] p-4 shadow-sm border transition-all duration-500 group hover:-translate-y-1 block h-full ${
        highlighted
          ? 'border-emerald-500 dark:border-emerald-400 shadow-lg shadow-emerald-500/15'
          : 'border-slate-200 dark:border-emerald-500/20 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-xl'
      }`}
    >
      {/* Elemento decorativo de fondo */}
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/5 rounded-full group-hover:scale-150 transition-transform duration-700" />
      
      <div className="relative flex flex-col items-center text-center">
        {/* Badge de tipo y estatus (Sobre la foto) */}
        <div className="absolute top-4 left-0 right-0 px-2 flex justify-between items-center z-20">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/90 dark:bg-[#022c22]/90 backdrop-blur-md rounded-full border border-white/20 shadow-lg">
              {isCorpView ? (
                <>
                  <Building2 size={10} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-emerald-400/90 whitespace-nowrap">Corporativo</span>
                </>
              ) : (afiliado.tipo_afiliado === 'Agente Corporativo' || afiliado.tipo_afiliado === 'Agente' || forceRepMode) ? (
                <>
                  <Briefcase size={10} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-emerald-400/90 whitespace-nowrap">
                    {forceRepMode ? 'Representante' : 'Agente Corp.'}
                  </span>
                </>
              ) : (
                <>
                  <User size={10} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-emerald-400/90 whitespace-nowrap">Agente Indep.</span>
                </>
              )}
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-emerald-500 text-white rounded-full shadow-lg whitespace-nowrap">
              Activo
            </span>
        </div>
        <CardImage afiliado={afiliado} isCorpView={isCorpView} />
        </div>

        {/* Información del Miembro */}
        <div className="space-y-1 mb-4 w-full text-center px-2">
          <h3 className="font-bold text-slate-800 dark:text-emerald-50 text-base md:text-lg leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors uppercase truncate">
            {isCorpView 
              ? (afiliado.empresa_razon_social || afiliado.nombre_completo)
              : formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
          </h3>
          
          {isCorpView && (
            <p className="text-sm text-slate-500 dark:text-emerald-100/60 font-medium truncate">
              Representante: {afiliado.nombres ? `${afiliado.nombres} ${afiliado.apellidos}` : afiliado.nombre_completo}
            </p>
          )}

          {(afiliado.tipo_afiliado === 'Agente Corporativo' || afiliado.tipo_afiliado === 'Agente' || forceRepMode) && afiliado.empresa_razon_social && (
            <p className="text-sm text-slate-500 dark:text-emerald-100/60 font-medium truncate">
              Parte de: {afiliado.empresa_razon_social}
            </p>
          )}
        </div>
        
        {/* Acciones de Contacto */}
        {((isCorpView ? (afiliado.empresa_email || afiliado.email) : afiliado.email) || afiliado.instagram || afiliado.linkedin || afiliado.facebook) && (
          <div className="flex gap-2 items-center justify-center pt-3 border-t border-slate-100 dark:border-emerald-50/10 w-full">
            {(isCorpView ? (afiliado.empresa_email || afiliado.email) : afiliado.email) && (
              <a 
                href={`mailto:${isCorpView ? (afiliado.empresa_email || afiliado.email) : afiliado.email}`}
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-all duration-300"
                title={isCorpView ? "Correo de la Empresa" : "Correo"}
              >
                <Mail size={12} />
              </a>
            )}
            {afiliado.linkedin && (
              <a 
                href={afiliado.linkedin}
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-blue-600 transition-all duration-300"
                title="LinkedIn"
              >
                <Linkedin size={12} />
              </a>
            )}
            {afiliado.instagram && (
              <a 
                href={afiliado.instagram.startsWith('http') ? afiliado.instagram : `https://instagram.com/${afiliado.instagram.replace('@','')}`}
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-gradient-to-tr hover:from-purple-600 hover:to-pink-500 transition-all duration-300"
                title="Instagram"
              >
                <Instagram size={12} />
              </a>
            )}
            {afiliado.facebook && (
              <a 
                href={afiliado.facebook.startsWith('http') ? afiliado.facebook : `https://facebook.com/${afiliado.facebook}`}
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-[#1877F2] transition-all duration-300"
                title="Facebook"
              >
                <Facebook size={12} />
              </a>
            )}
            {phoneNumber && (
              <a 
                href={whatsappUrl}
                onClick={(e) => e.stopPropagation()}
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-[#25D366] transition-all duration-300" 
                title={isCorpView ? "WhatsApp de la Empresa" : "WhatsApp"}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.967C16.528 3.973 14.077 2.945 11.46 2.945c-5.447 0-9.873 4.37-9.877 9.799-.001 1.778.474 3.51 1.378 5.028l-.972 3.548 3.658-.962zm11.786-6.84c-.273-.137-1.616-.797-1.87-.89-.253-.093-.438-.137-.622.137-.184.273-.713.89-.873 1.072-.16.182-.32.205-.593.068-.273-.137-1.155-.426-2.2-1.357-.813-.725-1.36-1.62-1.52-1.894-.16-.273-.017-.42.12-.557.123-.124.273-.32.41-.48.136-.16.182-.273.273-.455.09-.182.046-.341-.023-.48-.068-.137-.622-1.502-.852-2.053-.224-.544-.45-.468-.621-.477-.16-.008-.344-.01-.529-.01-.184 0-.483.07-.736.342-.253.273-.966.945-.966 2.304 0 1.358.988 2.67 1.103 2.828.115.158 1.944 2.97 4.71 4.164.658.284 1.172.453 1.573.58.66.21 1.26.18 1.734.11.53-.08 1.616-.66 1.843-1.298.227-.638.227-1.185.159-1.298-.068-.113-.253-.182-.527-.32z"/>
                </svg>
              </a>
            )}
          </div>
        )}
    </Link>
  );
};