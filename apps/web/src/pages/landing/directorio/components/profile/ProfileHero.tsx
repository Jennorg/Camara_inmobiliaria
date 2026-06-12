import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Phone, MapPin, User, Globe, Instagram, Linkedin, Facebook,
  GraduationCap, Briefcase, Building2, Share2, Award, CheckCircle,
  Sparkles, MessageSquare, Download, CreditCard, X, ShieldCheck
} from 'lucide-react';
import { formatNombreCard, getInitials, formatRif } from '@/utils/formatters';
import { AfiliadoData } from '../AfiliadoCard';
import logoCibir from '@/assets/Logo3.png';

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

  const phoneForWa = (isCorporativo ? afiliado.empresa_telefono || afiliado.telefono : afiliado.telefono) || '';
  const cleanPhone = phoneForWa.replace(/[^0-9]/g, '');
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

  const actualCompanyLogo = companyLogo || afiliado.empresa_logo_url || null;
  const logoToShow = isCorporativo ? actualCompanyLogo : logoCibir;

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
          {afiliado.foto_url ? (
            <img
              src={afiliado.foto_url}
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
                {isCorporativo ? 'MIEMBRO CORPORATIVO' : 'ASESOR INMOBILIARIO'}
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
              
              <p className="text-slate-500 text-sm font-semibold leading-relaxed max-w-xl">
                {afiliado.descripcion || afiliado.notas || (isCorporativo ? (
                  `Representante legal y asesor verificado de la empresa afiliada a la Cámara Inmobiliaria del Estado Bolívar.`
                ) : (
                  `Profesional inmobiliario registrado y solvente en la Cámara Inmobiliaria del Estado Bolívar.`
                ))}
              </p>
            </div>
          </div>

          {/* Logo y Código apilados y centrados (Más Grandes) */}
          {(logoToShow || afiliado.codigo) && (
            <div className="flex flex-col items-center gap-4 w-full text-center">
              {logoToShow && (
                <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-3xl bg-white border border-slate-200/60 shadow-md flex items-center justify-center p-5 shrink-0 transition-transform hover:scale-105 duration-500">
                  <img
                    src={logoToShow}
                    alt={isCorporativo ? `Logo de ${afiliado.empresa_razon_social || afiliado.razon_social}` : 'Cámara Inmobiliaria'}
                    className="max-h-full max-w-full object-contain"
                  />
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
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-[#25D366] hover:text-white transition-all flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
                title="WhatsApp"
              >
                <MessageSquare size={18} />
              </a>
            )}
            {(isCorporativo ? afiliado.empresa_email || afiliado.email : afiliado.email) && (
              <a
                href={`mailto:${isCorporativo ? afiliado.empresa_email || afiliado.email : afiliado.email}`}
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
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
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
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
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-gradient-to-tr hover:from-purple-600 hover:to-pink-500 hover:text-white transition-all flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
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
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-[#1877F2] hover:text-white transition-all flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
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
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-black hover:text-white transition-all flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
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
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-black hover:text-white transition-all flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
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
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center border border-slate-200/30 text-slate-500 hover:scale-105 active:scale-95"
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

