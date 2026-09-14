import React from 'react';
import { Pencil, RefreshCw } from 'lucide-react';
import { AfiliadoDTO } from '@/types/afiliados';
import LogoBgImg from '@/assets/Logo4.webp';
import { formatNombreCard } from '@/utils/formatters';

interface CarnetCardPreviewProps {
  cardRef?: React.RefObject<HTMLDivElement | null>;
  afiliado: AfiliadoDTO;
  useJuntaPhoto?: boolean;
  qrCodeUrl: string;
  onEditClick?: (e: React.MouseEvent) => void;
  onToggleJuntaPhoto?: (e: React.MouseEvent) => void;
  hideActionButtons?: boolean;
}

const parseRedes = (redes: any): Record<string, any> => {
  if (!redes) return {};
  if (typeof redes === 'string') {
    try {
      return JSON.parse(redes);
    } catch {
      return {};
    }
  }
  return redes;
};

export function CarnetCardPreview({
  cardRef,
  afiliado,
  useJuntaPhoto = false,
  qrCodeUrl,
  onEditClick,
  onToggleJuntaPhoto,
  hideActionButtons = false
}: CarnetCardPreviewProps) {
  const redes = parseRedes(afiliado.redes_sociales);
  const carnetPhotoUrl = useJuntaPhoto ? redes?.foto_junta_carnet_url : redes?.foto_carnet_url;
  const activePhoto = carnetPhotoUrl || ((useJuntaPhoto && afiliado.foto_junta_url) ? afiliado.foto_junta_url : afiliado.foto_url);
  const isCropped = !!carnetPhotoUrl;

  const tipoLabelMap: Record<string, string | string[]> = {
    'Natural': 'Agente Independiente',
    'Agente': 'Agente Independiente',
    'Agente Corporativo': 'Agente Corporativo',
    'Corporativo': ['Corporativo', 'Repr. Legal'],
  };
  const label = afiliado.tipo_afiliado ? (tipoLabelMap[afiliado.tipo_afiliado] ?? afiliado.tipo_afiliado) : null;

  const nombreCarnet = formatNombreCard(
    afiliado.nombres || (afiliado as any).representante_nombre || (afiliado as any).nombre_completo,
    afiliado.apellidos
  );

  return (
    <div
      ref={cardRef}
      id="carnet-card-capture"
      className="w-[280px] xs:w-[310px] h-[433px] xs:h-[479px] bg-white text-slate-800 flex flex-col justify-between relative shadow-lg rounded-2xl overflow-hidden border border-slate-200 py-3.5 px-5"
      style={{
        backgroundImage: 'radial-gradient(circle at 100% 0%, #e6f4ea 0%, transparent 45%), radial-gradient(circle at 0% 100%, #e6f4ea 0%, transparent 45%)'
      }}
    >
      {/* Marca de agua vectorial de fondo (sin opacidades relativas ni blur para evitar artefactos amarillos en CMYK) */}
      <div className="watermark-container absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[72%] pointer-events-none select-none z-0">
        <svg
          viewBox="0 0 630 370"
          className="watermark-svg w-full h-auto block"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#E5E7EB"
            d="M235.8 68.8c-12.5 5.9-23.6 11.6-24.7 12.6-2 1.8-2.1 3-2.1 22.2 0 11.2-.3 20.5-.7 20.7-.5.2-10.4-4-22.2-9.4-13-6-22.7-9.9-24.6-9.9-3.2 0-49.2 20.8-52.7 23.8-1.7 1.4-1.8 5.8-1.8 64.7v63.2l3.8 2.6c5.6 4 47.8 23.7 50.6 23.7 1.3 0 7.5-2.3 13.7-5.1 22-9.9 31.2-13.9 32-13.9.5 0 .9 9.2.9 20.4v20.5l2.8 1.9c1.5 1.1 9.5 5.2 17.9 9.1 30.4 14.2 33.4 15.4 36.7 14.8 1.7-.3 13.2-5.3 25.5-11.1 12.2-5.8 22.7-10.6 23.2-10.6s11.6 4.9 24.7 11c13.8 6.4 25 11 26.7 11 3.2 0 48.1-20.1 53.5-24l3-2.1v-20.5c0-14.2.3-20.4 1.1-20.4.6 0 9.9 4.1 20.8 9.1 10.8 5 21 9.3 22.8 9.6 2.5.4 8-1.7 28-10.7 13.6-6.2 25.8-12 27.1-12.8l2.2-1.4V130.3l-2.2-1.9c-1.3-1.1-5.9-3.6-10.3-5.6-35.2-16-39.7-17.8-43.3-17.8-2.9 0-9.5 2.6-24.2 9.5-11.2 5.2-20.9 9.5-21.6 9.5-1.1 0-1.4-3.8-1.4-20.3 0-18.2-.2-20.6-1.7-21.9-1-.9-12.4-6.5-25.3-12.7-20.3-9.6-24.1-11.1-28.5-11.1s-8.1 1.4-27.3 10.5C326 74.3 315.6 79 315 79c-.5 0-11.4-4.7-24.1-10.5-19.1-8.7-23.9-10.5-27.8-10.4-3.7 0-8.9 2.1-27.3 10.7m47.3 7.3c9.6 4.4 17.8 8.4 18.3 8.9.6.6 0 1.3-1.5 1.8-1.3.6-9.8 4.4-18.7 8.6-9 4.2-16.7 7.6-17.2 7.6-.8 0-15.9-6.7-35.5-15.9l-4-1.8 4.5-2.1c2.5-1.1 10.8-5 18.5-8.6s15-6.5 16.1-6.6c1.2 0 10 3.6 19.5 8.1m94-3.7c23.4 10.9 27.1 12.7 26.5 13.3-.3.3-8.9 4.3-19.1 8.9l-18.5 8.2-11.2-4.9c-6.2-2.8-13.1-5.8-15.3-6.7s-5.8-2.6-7.9-3.8l-3.9-2.3 14.4-6.8c7.9-3.8 16-7.6 17.9-8.5 5.2-2.5 6.8-2.2 17.1 2.6M329 97.6c7.4 3.6 15.6 7.5 18.3 8.6 2.6 1.2 4.7 2.4 4.7 2.8 0 .5-36 18-37.2 18-.4 0-7.1-3.1-15-6.9s-16-7.6-18-8.4c-2.1-.9-3.8-2-3.8-2.4 0-.5 1.5-1.6 3.3-2.4 1.7-.9 10-4.8 18.2-8.7 8.3-4 15.2-7.2 15.5-7.2.3.1 6.6 3 14 6.6m-94.1 3.7c7.9 4 14.4 7.6 14.3 8-.1.9-28.8 14.7-30.4 14.7-.4 0-.8-6.8-.8-15 0-11.4.3-15 1.3-14.9.6 0 7.7 3.3 15.6 7.2M412 109c0 8.2-.3 15-.7 15-1.3 0-31.3-14.4-31.2-15 0-.7 29.1-14.8 30.7-14.9.9-.1 1.2 3.5 1.2 14.9m-236 12.7c20.1 9.3 23 10.7 23 11.3 0 .4-2.3 1.8-5.2 3-5.6 2.4-25.3 11.6-28 13.1-1 .5-2.7.9-3.7.9-2.8 0-38.1-16.2-37.5-17.2.5-.8 10.4-5.7 21.4-10.6 2.5-1.1 6.9-3.2 9.8-4.5 6.1-2.8 5-3.1 20.2 4m94.6-3.6c3.8 1.7 12.5 5.8 19.4 9.1l12.5 6-3 1.3c-1.7.7-9.9 4.4-18.2 8.4-8.4 3.9-16.2 7.1-17.3 7.1s-8.2-2.9-15.8-6.4c-7.5-3.5-15.4-7.1-17.4-8-6.3-2.5-6.7-2.2 17.7-13.5 8.3-3.9 15.1-7 15.1-7.1.1 0 3.2 1.4 7 3.1m106.6 2.2c6.2 3 14.6 6.8 18.6 8.7 3.9 1.8 7.2 3.6 7.2 4s-3 2.1-6.7 3.8c-3.8 1.7-11.6 5.3-17.6 8.1-5.9 2.8-11.5 5.1-12.4 5.1-1.9 0-37.3-16.2-37.3-17.1 0-.4 27.9-13.9 36.7-17.8.1-.1 5.3 2.3 11.5 5.2m110.3 3.7c9.4 4.4 17 8.5 17 9.1s-7.6 4.6-17 9c-19.3 9-19.1 9-30.6 3.6-4.1-2-11.9-5.6-17.3-8.1l-10-4.5 14-6.5c7.6-3.6 15.7-7.5 17.9-8.5 2.2-1.1 5.1-2 6.5-2 1.4-.1 10.2 3.5 19.5 7.9m-154.6 23.3c9.6 4.5 17.6 8.8 17.8 9.4.3.7-2.6 2.6-6.4 4.4-3.7 1.7-11.5 5.4-17.2 8-5.7 2.7-11.2 4.9-12.3 4.9-1 0-6.4-2.2-12.1-4.8-5.6-2.7-13.5-6.3-17.4-8.2-4-1.8-7.3-3.6-7.3-3.9 0-.4 1.5-1.4 3.3-2.4 4.3-2.3 33.1-15.6 33.7-15.6.3 0 8.3 3.7 17.9 8.2m-194.7 4.5 18.7 8.7.1 55.2c0 30.4-.2 55.3-.4 55.3-.8 0-8.6-3.5-21-9.4-7.2-3.4-14.6-6.8-16.3-7.5l-3.3-1.3v-55.5c0-52.5.1-55.5 1.8-54.9.9.4 10.1 4.6 20.4 9.4m69.6 45.4-.3 55.1-19 8.9c-10.4 4.8-19.5 8.8-20.2 8.8-1 0-1.3-10.6-1.3-54.8v-54.7l4.3-2.2c2.3-1.1 6.7-3.2 9.7-4.6s9.8-4.6 15-7.1 10.1-4.5 10.8-4.6c1 0 1.2 11.4 1 55.2m14.8-53.6C233.2 148 249 156 249 157c0 .6-1.6 1.8-3.5 2.6s-6.8 3-10.8 5c-3.9 2-9.3 4.4-11.9 5.5L218 172v-15c0-8.3.2-15 .4-15s2.1.7 4.2 1.6M412 157v15l-3.2-1.3c-10.9-4.6-27.8-13.3-27.5-14.1.3-1 28.3-14.6 30-14.6.4 0 .7 6.8.7 15m20.7-10.8c4.9 2.3 13.5 6.3 19.3 8.9l10.5 4.7.3 55.1c.2 46.1 0 55.1-1.2 55.1-.7 0-7.3-2.9-14.7-6.4s-16-7.5-19.1-8.9l-5.8-2.6v-55c0-35.4.4-55.1 1-55.1.5 0 4.9 1.9 9.7 4.2m81.3 51v55.3l-19.8 9.1c-10.8 5.1-20 8.9-20.5 8.5-.4-.4-.6-25.2-.5-55.1l.3-54.5 3-1.4c12-5.9 36.1-17.1 36.8-17.1.4 0 .7 24.9.7 55.2m-229.8-24.9c9.2 4.4 16.8 8.3 16.8 8.7s-2.8 2-6.2 3.5c-3.5 1.6-11.4 5.2-17.7 8.2-6.2 2.9-12.1 5.3-13.1 5.3-2.6 0-37.1-16.2-36.8-17.2.6-1.8 36.3-17.8 38.2-17.2 1.1.4 9.5 4.3 18.8 8.7m101.6-.2c9.2 4.3 16.8 8.3 17 8.7.3 1.1-34.3 17.2-36.8 17.2-1.1 0-5.7-1.8-10.2-4-4.6-2.3-12.5-5.9-17.5-8.2-5.1-2.2-9.3-4.4-9.3-4.9s1-1.4 2.3-1.9c1.2-.5 9.4-4.2 18.2-8.4 9.2-4.3 16.8-7.3 17.8-7s9.3 4.1 18.5 8.5m-156.2 22.2c5.4 2.4 14.3 6.5 19.7 9.2l9.7 4.8v54.8c0 51.3-.1 54.9-1.7 54.9-1.7 0-35.7-15.4-38-17.3-1-.7-1.3-13.1-1.3-55.8 0-30.2.4-54.9.9-54.9.4 0 5.3 2 10.7 4.3M310 245v55l-6.7 3.4c-7.3 3.6-28.1 13.2-32 14.7l-2.3.9V208l5.3-2.4c2.8-1.4 11.5-5.4 19.2-9s14.6-6.5 15.3-6.6c.9 0 1.2 11.6 1.2 55m16.2-53.1c5.9 2.6 16 7.2 26.2 12.1l8.6 4.1v110.8l-2.7-1c-1.6-.5-10.7-4.7-20.3-9.2l-17.5-8.3-.3-55.2c-.1-33.4.1-55.2.7-55.2.5 0 2.9.8 5.3 1.9m85.8 53c0 42.7-.3 55.1-1.2 55.8-1.4 1.1-38.3 18.3-39.2 18.3-.3 0-.6-24.9-.6-55.4v-55.3l13.7-6.4c7.5-3.5 16.2-7.6 19.2-9.1 3.1-1.4 6.2-2.7 6.9-2.7.9-.1 1.2 11.5 1.2 54.8"
          />
        </svg>
      </div>

      {/* Encabezado */}
      <div className="relative z-10 flex items-center justify-center gap-0.5 w-full border-b border-emerald-600/10 py-1.5 xs:py-2.5">
        <img src={LogoBgImg} alt="Logo CIEBO" className="h-12 xs:h-16 w-auto object-contain" />
        <p className="text-[12px] xs:text-[15px] font-bold text-black leading-tight uppercase text-center">
          <span className="block whitespace-nowrap text-emerald-800">Cámara Inmobiliaria</span>
          <span className="block whitespace-nowrap text-emerald-800">de Bolívar</span>
        </p>
      </div>

      {/* Cuerpo */}
      <div className="relative z-10 flex-grow flex flex-col items-center justify-center gap-1.5 xs:gap-2 pt-1 pb-1">
        <div className="w-[130px] xs:w-[155px] aspect-[155/185] rounded-2xl overflow-hidden border-2 border-emerald-600 bg-slate-100 shadow-md flex items-center justify-center relative shrink-0">
          {activePhoto ? (
            <img
              src={activePhoto}
              alt="Foto Afiliado"
              crossOrigin="anonymous"
              onError={(e) => {
                if (e.currentTarget.getAttribute('crossOrigin') === 'anonymous') {
                  e.currentTarget.removeAttribute('crossOrigin');
                  e.currentTarget.src = activePhoto;
                }
              }}
              className="w-full h-full object-cover"
              style={isCropped ? { objectPosition: 'center center' } : { transform: 'scale(2)', transformOrigin: 'center top' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-black text-5xl xs:text-6xl text-emerald-700 bg-emerald-50">
              {nombreCarnet ? nombreCarnet.charAt(0) : 'A'}
            </div>
          )}

          {!hideActionButtons && onEditClick && (
            <button
              type="button"
              onClick={onEditClick}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-700 active:scale-90 text-white transition-colors transition-transform shadow-md z-30 flex items-center justify-center border border-white/20 hover:scale-105 hide-on-export cursor-pointer"
              title="Ajustar encuadre / recortar foto"
            >
              <Pencil size={12} />
            </button>
          )}

          {!hideActionButtons && afiliado.foto_junta_url && onToggleJuntaPhoto && (
            <button
              type="button"
              onClick={onToggleJuntaPhoto}
              className="absolute bottom-2 right-2 p-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-700 active:scale-90 text-white transition-colors transition-transform shadow-md z-30 flex items-center justify-center border border-white/20 hover:scale-105 hide-on-export cursor-pointer"
              title="Cambiar foto (Perfil / Junta Directiva)"
            >
              <RefreshCw size={12} className={useJuntaPhoto ? "rotate-180 transition-transform duration-500" : "transition-transform duration-500"} />
            </button>
          )}
        </div>

        <div className="text-center leading-none my-0.5 xs:my-1">
          <div className="text-[10px] xs:text-[11px] font-extrabold text-black uppercase tracking-wider leading-snug">
            {nombreCarnet}
          </div>
          <span className="text-[10px] xs:text-[11px] font-extrabold text-black tracking-wider block mt-0.5">
            <span className="font-extrabold">AFILIADO - CÓDIGO:</span> {afiliado.codigo}
          </span>
          {label && (
            <span className="text-[9px] xs:text-[11px] font-extrabold text-black uppercase tracking-[0.14em] block mt-1 leading-none">
              {Array.isArray(label) ? label.map((line) => <span key={line} className="block">{line}</span>) : label}
            </span>
          )}
        </div>

        <div className="flex flex-row items-center justify-center gap-1.5 xs:gap-2 w-full px-2 pt-2 xs:pt-4 min-h-[82px] xs:min-h-[96px]">
          <div className="flex-1 flex flex-col items-center justify-center gap-1">
            <div className="w-[64px] xs:w-[78px] h-[64px] xs:h-[78px] flex items-center justify-center shrink-0 relative">
              {qrCodeUrl && (
                <img src={qrCodeUrl} alt="Código QR Perfil" crossOrigin="anonymous" className="w-full h-full" />
              )}
            </div>
            <span className="text-[6.5px] xs:text-[7.5px] text-black font-extrabold tracking-wider uppercase opacity-65 text-center leading-none">
              Verificar QR
            </span>
          </div>

          {afiliado.empresa_logo_url && (
            <>
              <div className="w-[1px] h-12 xs:h-14 bg-emerald-600/15 shrink-0 self-center mx-1" />
              <div className="flex-1 flex flex-col items-center justify-center gap-1">
                <div className="w-full max-w-[105px] xs:max-w-[125px] h-[64px] xs:h-[78px] flex items-center justify-center shrink-0 px-1">
                  <img
                    src={afiliado.empresa_logo_url}
                    alt="Logo Empresa"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      if (e.currentTarget.getAttribute('crossOrigin') === 'anonymous') {
                        e.currentTarget.removeAttribute('crossOrigin');
                        e.currentTarget.src = afiliado.empresa_logo_url!;
                      }
                    }}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CarnetCardPreview;
