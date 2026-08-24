import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Phone, MapPin, User, Globe, Instagram, Linkedin, Facebook,
  GraduationCap, Briefcase, Building2, Share2, Award, CheckCircle,
  Sparkles, MessageSquare, Download, CreditCard, X, ShieldCheck
} from 'lucide-react';
import { formatNombreCard, getInitials, formatRif, formatWhatsAppUrl } from '@/utils/formatters';
import { AfiliadoData } from '../AfiliadoCard';
import logoCibir from '@/assets/Logo3.webp';

interface ProfileHeroProps {
  afiliado: AfiliadoData;
  isRepMode: boolean;
  isCorporativo: boolean;
  displayEmblem: string;
  companyLogo: string | null;
  ubicacionTexto: string;
}

const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.486h2.039L6.486 3.24H4.298l13.31 17.399z" />
  </svg>
);

const TikTokIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.14-.1-.27-.2-.4-.31v4.99c0 .24-.01.48-.03.71-.11 2.53-1.44 4.81-3.66 6.03-2.12 1.19-4.81 1.25-6.99.14-2.16-1.07-3.66-3.23-3.92-5.63-.33-2.43.74-4.99 2.82-6.28 1.34-.84 2.97-1.18 4.54-.93V11.1c-1-.22-2.11-.08-3 .42-.9.5-1.52 1.45-1.58 2.47-.07 1.16.51 2.33 1.51 2.89 1 .58 2.34.5 3.24-.22.6-.48.92-1.22.92-1.99V0z" />
  </svg>
);

export const ProfileHero = ({
  afiliado,
  isRepMode,
  isCorporativo,
  displayEmblem,
  companyLogo,
  ubicacionTexto
}: ProfileHeroProps) => {
  const navigate = useNavigate();
  const [showIdModal, setShowIdModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const yearsExp = afiliado.anos_servicio || (afiliado.ano_inicio_servicio ? (new Date().getFullYear() - afiliado.ano_inicio_servicio) : null) || 0;

  const activePhoto = (() => {
    let redes = afiliado.redes_sociales;
    if (typeof redes === 'string') {
      try { redes = JSON.parse(redes); } catch { redes = {}; }
    }
    // La foto pública del perfil es SIEMPRE la foto original.
    // foto_junta_url, foto_carnet_url y foto_junta_carnet_url son exclusivas
    // del carnet y del icono interno — nunca se muestran en el perfil público.
    return (
      redes?.foto_original_url ||
      afiliado.foto_url ||
      null
    );
  })();

  const phoneForWa = isCorporativo ? afiliado.empresa_telefono || afiliado.telefono : afiliado.telefono;
  const waLink = phoneForWa ? formatWhatsAppUrl(phoneForWa) : null;

  const isAgent = afiliado.tipo_afiliado === 'Agente' || afiliado.tipo_afiliado === 'Agente Corporativo';
  const isIndependent = afiliado.tipo_afiliado === 'Natural' || (!isCorporativo && !isAgent);

  const actualCompanyLogo = companyLogo || afiliado.empresa_logo_url || null;
  const logoToShow = actualCompanyLogo;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Perfil de ${afiliado.nombres} ${afiliado.apellidos}`,
          text: `Conoce el perfil profesional de ${afiliado.nombres} ${afiliado.apellidos} en la Cámara Inmobiliaria de Bolívar.`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const downloadVCard = () => {
    const vcardData = `BEGIN:VCARD
VERSION:3.0
FN:${afiliado.nombres} ${afiliado.apellidos}
ORG:${afiliado.empresa_razon_social || 'Cámara Inmobiliaria de Bolívar'}
TITLE:${isCorporativo ? 'Representante Legal' : afiliado.profesion || 'Asesor Inmobiliario'}
TEL;TYPE=CELL:${isCorporativo ? afiliado.empresa_telefono || afiliado.telefono : afiliado.telefono || ''}
EMAIL;TYPE=PREF,INTERNET:${isCorporativo ? afiliado.empresa_email || afiliado.email : afiliado.email || ''}
URL:${isCorporativo ? afiliado.empresa_website || afiliado.website || '' : afiliado.website || ''}
ADR;TYPE=WORK:;;${afiliado.direccion || ''};;;;
END:VCARD`;

    const blob = new Blob([vcardData], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${afiliado.nombres}_${afiliado.apellidos}.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full">
      {/* ── CARD PRINCIPAL DE PERFIL ── */}
      <div className="relative overflow-hidden bg-white text-slate-800 rounded-[2.5rem] shadow-xl border border-slate-200/60 flex flex-col lg:flex-row min-h-[480px]">

        {/* LADO IZQUIERDO: Foto del representante */}
        <div className="w-full lg:w-[40%] bg-slate-900 relative shrink-0 overflow-hidden flex items-stretch">
          {activePhoto ? (
            <img
              src={activePhoto}
              alt={`Foto de ${afiliado.nombres}`}
              className="w-full h-full object-cover min-h-[350px] lg:min-h-full transition-transform duration-700 hover:scale-105 relative z-0"
            />
          ) : (
            <div className="w-full h-full min-h-[350px] lg:min-h-full flex items-center justify-center bg-gradient-to-br from-emerald-800 to-emerald-950 relative z-0">
              <span className="text-white font-black text-6xl uppercase tracking-tighter">
                {getInitials(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
              </span>
            </div>
          )}
        </div>

        {/* LADO DERECHO: Detalles e información */}
        <div className="w-full lg:w-[60%] p-8 md:p-10 flex flex-col justify-between gap-6 text-left">

          {/* Encabezado e identificación */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start md:items-center justify-between gap-4 mt-1">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight uppercase leading-tight">
                {formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
              </h1>
              <span className="shrink-0 inline-flex items-center text-[9px] font-black tracking-widest text-emerald-700 bg-emerald-100/60 px-3 py-1.5 rounded-md uppercase">
                {isCorporativo ? 'MIEMBRO CORPORATIVO' : isAgent ? 'AGENTE CORPORATIVO' : 'ASESOR INMOBILIARIO'}
              </span>
            </div>

            {/* Subtítulo: Representante Legal de [Logo] [Empresa] */}
            {isCorporativo ? (
              <div className="flex items-center gap-2 mt-2 flex-wrap text-slate-500 font-bold text-xs uppercase tracking-wider">
                <span>Representante Legal de</span>
                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/50 px-2.5 py-1 rounded-lg">
                  {actualCompanyLogo && (
                    <img src={actualCompanyLogo} alt="Logo" className="w-4 h-4 object-contain shrink-0" />
                  )}
                  <span className="text-slate-700 font-black">
                    {afiliado.empresa_razon_social || afiliado.razon_social}
                  </span>
                </div>
              </div>
            ) : isAgent ? (
              <div className="flex items-center gap-2 mt-2 flex-wrap text-slate-500 font-bold text-xs uppercase tracking-wider">
                <span>{afiliado.profesion || 'Asesor Inmobiliario'} en</span>
                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/50 px-2.5 py-1 rounded-lg">
                  {actualCompanyLogo && (
                    <img src={actualCompanyLogo} alt="Logo" className="w-4 h-4 object-contain shrink-0" />
                  )}
                  <span className="text-slate-700 font-black">
                    {afiliado.empresa_razon_social || afiliado.razon_social}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 font-bold text-xs uppercase tracking-wider mt-2">
                {afiliado.profesion || 'Asesor Inmobiliario Independiente'}
              </p>
            )}

            <div className="border-b border-slate-100 my-4 w-full" />

            <div className="space-y-4">
              {afiliado.nivel_academico && !afiliado.nivel_academico.toLowerCase().includes('bachiller') && (
                <p className="text-emerald-600 font-black text-xs uppercase tracking-[0.2em]">
                  {afiliado.nivel_academico}
                </p>
              )}
            </div>
          </div>

          {/* Logo y Código apilados y centrados (Más Grandes) */}
          {(logoToShow || afiliado.codigo) && (
            <div className="flex flex-col items-center gap-4 w-full text-center">
              {logoToShow && (
                <div className="flex flex-col items-center gap-2">
                  {isAgent && (
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                      FORMA PARTE DE:
                    </span>
                  )}
                  <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-3xl bg-white border border-slate-200/60 shadow-md flex items-center justify-center p-5 shrink-0 transition-transform hover:scale-105 duration-500">
                    <img
                      src={logoToShow}
                      alt={isCorporativo ? `Logo de ${afiliado.empresa_razon_social || afiliado.razon_social}` : 'Empresa'}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
              )}
              {afiliado.codigo && (
                <span className="shrink-0 inline-flex items-center text-[10px] font-black tracking-[0.2em] text-emerald-700 bg-emerald-100/60 px-4 py-2 rounded-md uppercase">
                  CÓDIGO: {afiliado.codigo}
                </span>
              )}
            </div>
          )}

          {/* Pie de la tarjeta: Iconos de contacto centrados */}
          <div className="flex items-center justify-center gap-3.5 flex-wrap w-full mt-2 pt-6 border-t border-slate-100">
            {waLink && waLink !== '#' && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-[#25D366] hover:text-white transition-colors transition-transform flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
                title="WhatsApp"
              >
                <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.067 2.877 1.215 3.077.149.2 2.1 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.705 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              </a>
            )}
            {(isCorporativo ? afiliado.empresa_email || afiliado.email : afiliado.email) && (
              <a
                href={`mailto:${isCorporativo ? afiliado.empresa_email || afiliado.email : afiliado.email}`}
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-emerald-600 hover:text-white transition-colors transition-transform flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
                title={isCorporativo ? "Correo de la Empresa" : "Correo"}
              >
                <Mail size={18} />
              </a>
            )}
            {afiliado.linkedin && (
              <a
                href={afiliado.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-blue-600 hover:text-white transition-colors transition-transform flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
                title="LinkedIn"
              >
                <Linkedin size={18} />
              </a>
            )}
            {afiliado.instagram && (
              <a
                href={afiliado.instagram.startsWith('http') ? afiliado.instagram : `https://instagram.com/${afiliado.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-gradient-to-tr hover:from-purple-600 hover:to-pink-500 hover:text-white transition-colors transition-transform flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
                title="Instagram"
              >
                <Instagram size={18} />
              </a>
            )}
            {afiliado.facebook && (
              <a
                href={afiliado.facebook.startsWith('http') ? afiliado.facebook : `https://facebook.com/${afiliado.facebook}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-[#1877F2] hover:text-white transition-colors transition-transform flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
                title="Facebook"
              >
                <Facebook size={18} />
              </a>
            )}
            {afiliado.twitter && (
              <a
                href={afiliado.twitter.startsWith('http') ? afiliado.twitter : `https://x.com/${afiliado.twitter.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-black hover:text-white transition-colors transition-transform flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
                title="X"
              >
                <XIcon size={18} />
              </a>
            )}
            {afiliado.tiktok && (
              <a
                href={afiliado.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-black hover:text-white transition-colors transition-transform flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
                title="TikTok"
              >
                <TikTokIcon size={18} />
              </a>
            )}
            {(afiliado.website || (isCorporativo && afiliado.empresa_website)) && (
              <a
                href={isCorporativo ? (afiliado.empresa_website || afiliado.website) : afiliado.website}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-emerald-600 hover:text-white transition-colors transition-transform flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
                title="Sitio Web"
              >
                <Globe size={18} />
              </a>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

