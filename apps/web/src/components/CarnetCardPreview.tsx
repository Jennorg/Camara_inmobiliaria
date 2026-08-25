import React from 'react';
import { Pencil, RefreshCw } from 'lucide-react';
import { AfiliadoDTO } from '@/types/afiliados';
import LogoBgImg from '@/assets/Logo4.webp';

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

  const nombreMostrar = afiliado.nombres || (afiliado as any).representante_nombre || (afiliado as any).nombre_completo || '';
  const apellidoMostrar = afiliado.apellidos || '';

  return (
    <div
      ref={cardRef}
      id="carnet-card-capture"
      className="w-[280px] xs:w-[310px] h-[440px] xs:h-[490px] bg-white text-slate-800 flex flex-col justify-between relative shadow-lg rounded-2xl overflow-hidden border border-slate-200 py-3.5 px-5"
      style={{
        backgroundImage: 'radial-gradient(circle at 100% 0%, #e6f4ea 0%, transparent 45%), radial-gradient(circle at 0% 100%, #e6f4ea 0%, transparent 45%)'
      }}
    >
      {/* Fondo de agua con logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none z-0">
        <img src={LogoBgImg} alt="Fondo de agua" className="h-200 w-auto object-contain opacity-[0.14] filter blur-[1.5px] transform translate-y-5" />
      </div>
      <div className="absolute -bottom-22 -left-36 pointer-events-none select-none z-10 w-70 h-70 overflow-hidden">
        <img src={LogoBgImg} alt="Fondo de agua secundario" className="w-full h-full object-contain opacity-[0.14]" />
      </div>
      <div className="absolute -bottom-22 -right-36 pointer-events-none select-none z-10 w-70 h-70 overflow-hidden">
        <img src={LogoBgImg} alt="Fondo de agua secundario" className="w-full h-full object-contain opacity-[0.14]" />
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
        <div className="w-[130px] xs:w-[155px] h-[155px] xs:h-[185px] rounded-2xl overflow-hidden border-2 border-emerald-600 bg-slate-100 shadow-md flex items-center justify-center relative shrink-0">
          {activePhoto ? (
            <img
              src={activePhoto}
              alt="Foto Afiliado"
              crossOrigin="anonymous"
              className="w-full h-full object-cover"
              style={isCropped ? { objectPosition: 'center center' } : { transform: 'scale(2)', transformOrigin: 'center top' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-black text-5xl xs:text-6xl text-emerald-700 bg-emerald-50">
              {nombreMostrar ? nombreMostrar.charAt(0) : 'A'}
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
            {nombreMostrar} {apellidoMostrar}
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
                  <img src={afiliado.empresa_logo_url} alt="Logo Empresa" crossOrigin="anonymous" className="max-h-full max-w-full object-contain" />
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
