import React from 'react';
import { MapPin, Mail, Linkedin, Instagram, Facebook } from 'lucide-react';
import { formatNombreCard, getInitials, formatRif, formatWhatsAppUrl } from '@/utils/formatters';
import { AfiliadoData } from '../AfiliadoCard';
import logoCibir from '@/assets/Logo3.png';

interface ProfileHeroViewProps {
  afiliado: AfiliadoData;
  isCorporativo: boolean;
  displayEmblem: string;
  companyLogo: string | null;
  ubicacionTexto: string;
}

export const ProfileHeroView = ({ 
  afiliado, 
  isCorporativo, 
  displayEmblem, 
  companyLogo, 
  ubicacionTexto 
}: ProfileHeroViewProps) => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#0c121f] via-[#101524] to-[#070b12] text-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-white/5 max-w-4xl mx-auto">
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />

      <div className="relative flex flex-col items-center">
        <div className="flex justify-center mb-8">
          <div className={`flex items-center justify-center rounded-2xl p-4 ${isCorporativo && companyLogo ? 'bg-white' : ''}`}>
            <img
              src={displayEmblem}
              alt={isCorporativo ? `Logo de ${afiliado.empresa_razon_social || 'empresa'}` : 'CIBIR'}
              className="max-h-36 md:max-h-44 max-w-[280px] object-contain"
            />
          </div>
        </div>

        {(isCorporativo || afiliado.empresa_razon_social) ? (
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-4xl font-black tracking-wide uppercase">
              {afiliado.empresa_razon_social || afiliado.razon_social}
            </h2>
            {(afiliado.empresa_rif_numero || afiliado.cedula) && (
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">
                RIF: {formatRif(afiliado.empresa_rif_tipo || 'J', afiliado.empresa_rif_numero || '')}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-black tracking-wide uppercase text-slate-300">
              Cámara Inmobiliaria de Bolívar
            </h2>
            <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest mt-2">
              Afiliado Activo Independiente
            </p>
          </div>
        )}

        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 mt-4 pt-8 border-t border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-[3px] border-white dark:border-[#070b12] shadow-xl shrink-0 bg-slate-900 flex items-center justify-center">
              {afiliado.foto_url ? (
                <img
                  src={afiliado.foto_url}
                  alt={`Foto de ${formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-black text-2xl uppercase tracking-tighter">
                  {getInitials(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
                </span>
              )}
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-base md:text-lg font-black tracking-wide uppercase leading-tight">
                {formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {isCorporativo ? 'Representante Legal' : afiliado.profesion || 'Agente Independiente'}
              </p>
              <div className="flex items-center justify-center md:justify-start gap-1.5 text-xs text-slate-400 mt-2">
                <MapPin size={12} className="text-emerald-500 shrink-0" />
                <span>{ubicacionTexto}</span>
              </div>
            </div>
          </div>

           <div className="flex items-center gap-3">
            {(isCorporativo ? afiliado.empresa_email || afiliado.email : afiliado.email) && (
              <a href={`mailto:${isCorporativo ? afiliado.empresa_email || afiliado.email : afiliado.email}`} className="w-10 h-10 rounded-full bg-white/10 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title={isCorporativo ? "Correo de la Empresa" : "Correo"}>
                <Mail size={16} />
              </a>
            )}
            {afiliado.linkedin && (
              <a href={afiliado.linkedin} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title="LinkedIn">
                <Linkedin size={16} />
              </a>
            )}
            {afiliado.instagram && (
              <a href={afiliado.instagram.startsWith('http') ? afiliado.instagram : `https://instagram.com/${afiliado.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-gradient-to-tr hover:from-purple-600 hover:to-pink-500 hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title="Instagram">
                <Instagram size={16} />
              </a>
            )}
            {afiliado.facebook && (
              <a href={afiliado.facebook.startsWith('http') ? afiliado.facebook : `https://facebook.com/${afiliado.facebook}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#1877F2] hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title="Facebook">
                <Facebook size={16} />
              </a>
            )}
            {afiliado.twitter && (
              <a href={afiliado.twitter.startsWith('http') ? afiliado.twitter : `https://x.com/${afiliado.twitter.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-black hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title="X">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            )}
            {(isCorporativo ? afiliado.empresa_telefono || afiliado.telefono : afiliado.telefono) && (
              <a href={formatWhatsAppUrl(isCorporativo ? afiliado.empresa_telefono || afiliado.telefono : afiliado.telefono)} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#25D366] hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title={isCorporativo ? "WhatsApp de la Empresa" : "WhatsApp"}>
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.067 2.877 1.215 3.077.149.2 2.1 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.705 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
