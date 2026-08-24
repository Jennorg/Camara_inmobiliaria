import React, { useState } from 'react';
import { Mail, Instagram, Linkedin, Facebook, Building2, User, Briefcase, Music2, Globe } from 'lucide-react';
import { formatNombreCard, getInitials, formatWhatsAppUrl } from '@/utils/formatters';
import { Link } from 'react-router-dom';

import { AfiliadoDTO } from '@/types/afiliados';

export type AfiliadoData = AfiliadoDTO;

const XIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.486h2.039L6.486 3.24H4.298l13.31 17.399z" />
  </svg>
);

const TikTokIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.14-.1-.27-.2-.4-.31v4.99c0 .24-.01.48-.03.71-.11 2.53-1.44 4.81-3.66 6.03-2.12 1.19-4.81 1.25-6.99.14-2.16-1.07-3.66-3.23-3.92-5.63-.33-2.43.74-4.99 2.82-6.28 1.34-.84 2.97-1.18 4.54-.93V11.1c-1-.22-2.11-.08-3 .42-.9.5-1.52 1.45-1.58 2.47-.07 1.16.51 2.33 1.51 2.89 1 .58 2.34.5 3.24-.22.6-.48.92-1.22.92-1.99V0z" />
  </svg>
);

const CarnetIcon = ({ w = 12, h = 12 }: { w?: number; h?: number }) => {
  const combined_d = "M3 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3zm0 2h18v12H3V6zm3 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 1a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2h-5zm0 4a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2h-5z";
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" fill="currentColor" d={combined_d} />
    </svg>
  );
};


function getTipoAfiliadoMeta(tipo?: string) {
  const norm = String(tipo || 'Natural').trim();
  if (['Corporativo', 'Juridico'].includes(norm)) {
    return {
      label: 'Corporativo',
      fullLabel: 'Corporativo',
      badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40',
      glassClass: 'bg-purple-950/80 text-purple-100 border-purple-400/30 shadow-purple-950/30',
      dotColor: 'bg-purple-400'
    };
  }
  if (['Agente Corporativo', 'Agente'].includes(norm)) {
    return {
      label: 'Agente Corp.',
      fullLabel: 'Agente Corporativo',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40',
      glassClass: 'bg-emerald-950/80 text-emerald-100 border-emerald-400/30 shadow-emerald-950/30',
      dotColor: 'bg-emerald-400'
    };
  }
  return {
    label: 'Agente Indep.',
    fullLabel: 'Agente Independiente',
    badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/40',
    glassClass: 'bg-slate-900/80 text-slate-100 border-slate-700/50 shadow-slate-950/30',
    dotColor: 'bg-sky-400'
  };
}

function getCardImage(afiliado: AfiliadoData, isCorpView: boolean) {
  let redes = afiliado.redes_sociales;
  if (typeof redes === 'string') {
    try { redes = JSON.parse(redes); } catch { redes = {}; }
  }
  // La foto pública en /miembros es SIEMPRE la foto original del afiliado.
  // Nunca se debe usar foto_junta_url, foto_carnet_url ni foto_junta_carnet_url aquí;
  // esas fotos son exclusivas del carnet y del icono interno del header.
  const publicFotoUrl = redes?.foto_original_url || afiliado.foto_url || null;

  if (isCorpView) {
    const url = publicFotoUrl || afiliado.empresa_logo_url || null;
    return { url };
  }
  return { url: publicFotoUrl || null };
}

/** Skeleton pulse placeholder shown while an image is loading */
function ImageSkeleton() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-[#04432f] dark:via-[#033d28] dark:to-[#04432f] animate-pulse" />
  );
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
  const { url } = getCardImage(afiliado, isCorpView);
  const isLogo = !afiliado.foto_url && !!afiliado.empresa_logo_url;
  const initials = getInitials(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos);
  const alt = isCorpView
    ? (isLogo ? `Logo de ${afiliado.empresa_razon_social || afiliado.nombre_completo}` : `Foto del representante de ${afiliado.empresa_razon_social || afiliado.nombre_completo}`)
    : `Foto de ${afiliado.nombre_completo}`;

  const [loaded, setLoaded] = useState(false);

  if (size === 'mini') {
    return (
      <div
        className={`relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 border-white dark:border-[#04432f] shadow-sm flex items-center justify-center ${isLogo ? 'bg-white p-1.5' : 'bg-[#022c22]'
          }`}
      >
        {url ? (
          <div className="relative w-full h-full">
            <div className={`absolute inset-0 transition-opacity duration-500 ${loaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <ImageSkeleton />
            </div>
            <img
              src={url}
              alt={alt}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={`w-full h-full ${isLogo ? 'object-contain' : 'object-cover'} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>
        ) : (
          <span className="text-white font-black text-sm uppercase tracking-tighter">{initials}</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-96 shrink-0 rounded-t-[1.25rem] overflow-hidden">
      <div
        className={`relative w-full h-full flex items-center justify-center ${isLogo ? 'bg-white p-8' : 'bg-[#022c22]'}`}
      >
        {url ? (
          <div className="relative w-full h-full">
            <div className={`absolute inset-0 transition-opacity duration-500 ${loaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <ImageSkeleton />
            </div>
            <img
              src={url}
              alt={alt}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={`w-full h-full ${isLogo ? 'object-contain' : 'object-cover object-top'} group-hover:scale-105 transition-transform duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>
        ) : (
          <span className="text-white font-black text-3xl uppercase tracking-tighter">{initials}</span>
        )}
      </div>
    </div>
  );
}

interface AfiliadoCardProps {
  afiliado: AfiliadoData;
  forceRepMode?: boolean;
  variant?: 'default' | 'mini';
  highlighted?: boolean;
  onViewCarnet?: (afiliado: AfiliadoData) => void;
}

export const AfiliadoCard = ({ 
  afiliado, 
  forceRepMode = false, 
  variant = 'default', 
  highlighted = false,
  onViewCarnet
}: AfiliadoCardProps) => {
  const isCorpView = afiliado.tipo_afiliado === 'Corporativo' && !forceRepMode;
  const tipoMeta = getTipoAfiliadoMeta(afiliado.tipo_afiliado);

  const targetIdentifier = afiliado.codigo || afiliado.id_afiliado;

  if (variant === 'mini') {
    return (
      <Link
        to={forceRepMode ? `/miembros/${targetIdentifier}?mode=rep` : `/miembros/${targetIdentifier}`}
        className="group flex flex-col items-center gap-1 focus:outline-none"
      >
        <CardImage afiliado={afiliado} isCorpView={isCorpView} size="mini" />
        <div className="text-center">
          <h3 className="font-bold text-slate-800 dark:text-emerald-50 text-xs md:text-sm leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors uppercase truncate max-w-[120px]">
            {isCorpView
              ? (afiliado.empresa_razon_social || afiliado.nombre_completo)
              : formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-emerald-100/50 font-bold uppercase truncate max-w-[120px]">
            {isCorpView ? 'Corporativo' : tipoMeta.label}
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
    ? formatWhatsAppUrl(phoneNumber)
    : '#';

  return (
    <div
      className={`relative overflow-hidden bg-white dark:bg-[#04432f] rounded-[1.25rem] p-0 shadow-sm border transition-colors transition-transform duration-500 group hover:-translate-y-1 flex flex-col h-full ${highlighted
        ? 'border-emerald-500 dark:border-emerald-400 shadow-lg shadow-emerald-500/15'
        : 'border-slate-200 dark:border-emerald-500/20 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-xl'
        }`}
    >
      {/* Elemento decorativo de fondo */}
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/5 rounded-full group-hover:scale-150 transition-transform duration-700 pointer-events-none" />

      <Link
        to={forceRepMode ? `/miembros/${targetIdentifier}?mode=rep` : `/miembros/${targetIdentifier}`}
        className="flex-1 flex flex-col cursor-pointer"
      >
        <div className="relative w-full shrink-0">
          <CardImage afiliado={afiliado} isCorpView={isCorpView} />
        </div>

        {/* Información del Miembro */}
        <div className="flex-1 flex flex-col justify-between p-4 pt-5 pb-3">
          <div className="space-y-1 mb-3 w-full text-center px-2">
            {/* Categoría / Tipo sutil */}
            <span className="inline-block text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-0.5">
              {tipoMeta.fullLabel}
            </span>

            <h3 className="font-black text-slate-800 dark:text-emerald-50 text-lg md:text-xl leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors uppercase truncate">
              {isCorpView
                ? (afiliado.empresa_razon_social || afiliado.nombre_completo)
                : formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
            </h3>

            {isCorpView && (
              <p className="text-xs text-slate-500 dark:text-emerald-100/60 font-medium truncate">
                Representante legal: {afiliado.nombres ? `${afiliado.nombres} ${afiliado.apellidos}` : afiliado.nombre_completo}
              </p>
            )}

            {(afiliado.tipo_afiliado === 'Agente Corporativo' || afiliado.tipo_afiliado === 'Agente' || forceRepMode) && afiliado.empresa_razon_social && (
              <p className="text-xs text-slate-500 dark:text-emerald-100/60 font-medium truncate">
                Parte de: {afiliado.empresa_razon_social}
              </p>
            )}

            {/* Código de Afiliado */}
            <div className="pt-2">
              <p className="text-xs font-medium text-slate-500 dark:text-emerald-100/60 truncate">
                Código: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{afiliado.codigo || '---'}</span>
              </p>
            </div>
          </div>
        </div>
      </Link>

      {/* Acciones de Contacto */}
      {((isCorpView ? (afiliado.empresa_email || afiliado.email) : afiliado.email) || afiliado.instagram || afiliado.linkedin || afiliado.facebook || afiliado.twitter || afiliado.tiktok || afiliado.website || (isCorpView && afiliado.empresa_website) || phoneNumber || (onViewCarnet && afiliado.codigo)) && (
        <div className="flex gap-2 items-center justify-center px-4 pt-3 pb-5 border-t border-slate-100 dark:border-emerald-50/10 w-full mt-auto">
          {onViewCarnet && afiliado.codigo && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onViewCarnet(afiliado);
              }}
              className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors duration-300 border border-slate-100/50 dark:border-emerald-800/10"
              title="Ver Carnet de Afiliado"
            >
              <CarnetIcon w={12} h={12} />
            </button>
          )}
          {(isCorpView ? (afiliado.empresa_email || afiliado.email) : afiliado.email) && (
            <a
              href={`mailto:${isCorpView ? (afiliado.empresa_email || afiliado.email) : afiliado.email}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors duration-300"
              title={isCorpView ? "Correo de la Empresa" : "Correo"}
            >
              <Mail size={12} />
            </a>
          )}
          {afiliado.linkedin && (
            <a
              href={afiliado.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-blue-600 transition-colors duration-300"
              title="LinkedIn"
            >
              <Linkedin size={12} />
            </a>
          )}
          {afiliado.instagram && (
            <a
              href={afiliado.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-gradient-to-tr hover:from-purple-600 hover:to-pink-500 transition-colors duration-300"
              title="Instagram"
            >
              <Instagram size={12} />
            </a>
          )}
          {afiliado.facebook && (
            <a
              href={afiliado.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-[#1877F2] transition-colors duration-300"
              title="Facebook"
            >
              <Facebook size={12} />
            </a>
          )}
          {afiliado.twitter && (
            <a
              href={afiliado.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-black transition-colors duration-300"
              title="X"
            >
              <XIcon size={12} />
            </a>
          )}
          {afiliado.tiktok && (
            <a
              href={afiliado.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-black transition-colors duration-300"
              title="TikTok"
            >
              <TikTokIcon size={12} />
            </a>
          )}
          {(afiliado.website || (isCorpView && afiliado.empresa_website)) && (
            <a
              href={isCorpView ? (afiliado.empresa_website || afiliado.website) : afiliado.website}
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors duration-300"
              title="Sitio Web"
            >
              <Globe size={12} />
            </a>
          )}
          {phoneNumber && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-600 dark:text-emerald-400 hover:text-white hover:bg-[#25D366] transition-colors duration-300"
              title={isCorpView ? "WhatsApp de la Empresa" : "WhatsApp"}
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.067 2.877 1.215 3.077.149.2 2.1 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.705 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  );
};