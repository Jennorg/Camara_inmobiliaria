import React from 'react';
import { Pencil, RefreshCw } from 'lucide-react';
import { AfiliadoDTO } from '@/types/afiliados';
import LogoBgImg from '@/assets/logo_ciebo_green.svg';
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

  const [imgAspect, setImgAspect] = React.useState<number | null>(null);

  return (
    <div
      ref={cardRef}
      id="carnet-card-capture"
      className="w-[310px] h-[479px] bg-white text-slate-800 flex flex-col relative shadow-lg rounded-2xl overflow-hidden border border-slate-200 py-3.5 px-5"
    >
      {/* Encabezado */}
      <div className="relative z-10 flex items-center justify-center gap-2 w-full py-1 shrink-0">
        <img src={LogoBgImg} alt="Logo CIEBO" className="h-14 w-auto object-contain" />
        <p className="text-[14px] font-black text-[#0a523d] leading-tight uppercase text-center tracking-tight">
          <span className="block whitespace-nowrap text-[#0a523d]">Cámara Inmobiliaria</span>
          <span className="block whitespace-nowrap text-[#0a523d]">de Bolívar</span>
        </p>
      </div>

      {/* Cuerpo Centrado Verticalmente */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-1.5 py-1">
        <div className="w-[155px] aspect-[155/185] rounded-2xl overflow-hidden border-2 border-[#0d6e50] bg-slate-100 shadow-md flex items-center justify-center relative shrink-0">
          {activePhoto ? (
            <img
              src={activePhoto}
              alt="Foto Afiliado"
              crossOrigin="anonymous"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setImgAspect(img.naturalWidth / img.naturalHeight);
                }
              }}
              onError={(e) => {
                if (e.currentTarget.getAttribute('crossOrigin') === 'anonymous') {
                  e.currentTarget.removeAttribute('crossOrigin');
                  e.currentTarget.src = activePhoto;
                }
              }}
              className="w-full h-full object-cover"
              style={
                isCropped
                  ? (imgAspect && imgAspect > (155 / 185) * 1.08
                      ? { objectPosition: 'center 35%', transform: `scale(${imgAspect / (155 / 185)})`, transformOrigin: 'center center' }
                      : { objectPosition: 'center center' })
                  : { transform: 'scale(2.1)', transformOrigin: 'center top' }
              }
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-black text-6xl text-[#0a523d] bg-[#e6f3ed]">
              {nombreCarnet ? nombreCarnet.charAt(0) : 'A'}
            </div>
          )}

          {!hideActionButtons && onEditClick && (
            <button
              type="button"
              onClick={onEditClick}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-[#0d6e50]/90 hover:bg-[#0a523d] active:scale-90 text-white transition-colors transition-transform shadow-md z-30 flex items-center justify-center border border-white/20 hover:scale-105 hide-on-export cursor-pointer"
              title="Ajustar encuadre / recortar foto"
            >
              <Pencil size={12} />
            </button>
          )}

          {!hideActionButtons && afiliado.foto_junta_url && onToggleJuntaPhoto && (
            <button
              type="button"
              onClick={onToggleJuntaPhoto}
              className="absolute bottom-2 right-2 p-1.5 rounded-full bg-[#0d6e50]/90 hover:bg-[#0a523d] active:scale-90 text-white transition-colors transition-transform shadow-md z-30 flex items-center justify-center border border-white/20 hover:scale-105 hide-on-export cursor-pointer"
              title="Cambiar foto (Perfil / Junta Directiva)"
            >
              <RefreshCw size={12} className={useJuntaPhoto ? "rotate-180 transition-transform duration-500" : "transition-transform duration-500"} />
            </button>
          )}
        </div>

        <div className="text-center leading-none my-0.5">
          <div className="text-[17px] font-black text-[#0a523d] uppercase tracking-wide leading-tight">
            {nombreCarnet}
          </div>
          <span className="text-[12px] font-black text-[#0a523d] tracking-wide block mt-1.5 uppercase leading-tight">
            AFILIADO - CÓDIGO: {afiliado.codigo}
          </span>
          {label && (
            <span className="text-[12px] font-black text-[#0a523d] uppercase tracking-wide block mt-1 leading-tight">
              {Array.isArray(label) ? label.map((line) => <span key={line} className="block">{line}</span>) : label}
            </span>
          )}
        </div>

        <div className="flex flex-row items-center justify-center gap-2 w-full px-2 pt-1.5 min-h-[96px]">
          <div className="flex-1 flex flex-col items-center justify-center gap-1">
            <div className="w-[78px] h-[78px] flex items-center justify-center shrink-0 relative">
              {qrCodeUrl && (
                <img src={qrCodeUrl} alt="Código QR Perfil" crossOrigin="anonymous" className="w-full h-full" />
              )}
            </div>
            <span className="text-[9.5px] text-[#525b62] font-bold tracking-wider uppercase text-center leading-none">
              Verificar QR
            </span>
          </div>

          {afiliado.empresa_logo_url && (
            <div className="flex-1 flex flex-col items-center justify-center gap-1">
              <div className="w-full max-w-[125px] h-[78px] flex items-center justify-center shrink-0 px-1">
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
          )}
        </div>
      </div>
    </div>
  );
}

export default CarnetCardPreview;
