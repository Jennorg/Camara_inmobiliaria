import React, { useRef, useState, useEffect, useReducer } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2, Award, CheckCircle, RefreshCw, Pencil, Image as ImageIcon, Trash2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { AfiliadoDTO } from '@/types/afiliados';
import LogoImg from '@/assets/Logo2.webp';
import LogoBgImg from '@/assets/Logo4.webp';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/env';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/utils/cropImage';
import { compressImage } from '@/utils/imageCompressor';
import QRCode from 'qrcode';

interface CarnetAfiliadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  afiliado: AfiliadoDTO | null;
  onUpdateAfiliado?: (updatedFields: Partial<AfiliadoDTO>) => void;
}

const parseRedes = (redes: any): Record<string, any> => {
  if (!redes) return {};
  if (typeof redes === 'string') {
    try { return JSON.parse(redes); } catch { return {}; }
  }
  return redes;
};

/* ── SUB-COMPONENT: CarnetCardPreview (El carnet físico imprimible/descargable) ── */
interface CarnetCardPreviewProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
  afiliado: AfiliadoDTO;
  useJuntaPhoto: boolean;
  qrCodeUrl: string;
  onEditClick: (e: React.MouseEvent) => void;
  onToggleJuntaPhoto: (e: React.MouseEvent) => void;
}

function CarnetCardPreview({
  cardRef,
  afiliado,
  useJuntaPhoto,
  qrCodeUrl,
  onEditClick,
  onToggleJuntaPhoto
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

  return (
    <div
      ref={cardRef}
      id="carnet-card-capture"
      className="w-[280px] xs:w-[310px] h-[440px] xs:h-[490px] bg-white text-slate-800 flex flex-col justify-between relative shadow-lg rounded-2xl overflow-hidden border border-slate-200 py-3.5 px-5"
      style={{
        backgroundImage: 'radial-gradient(circle at 100% 0%, #e6f4ea 0%, transparent 45%), radial-gradient(circle at 0% 100%, #e6f4ea 0%, transparent 45%)'
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none z-0">
        <img src={LogoBgImg} alt="Fondo de agua" className="h-200 w-auto object-contain opacity-[0.14] filter blur-[1.5px] transform translate-y-5" />
      </div>
      <div className="absolute -bottom-22 -left-36 pointer-events-none select-none z-10 w-70 h-70 overflow-hidden">
        <img src={LogoBgImg} alt="Fondo de agua secundario" className="w-full h-full object-contain opacity-[0.14]" />
      </div>
      <div className="absolute -bottom-22 -right-36 pointer-events-none select-none z-10 w-70 h-70 overflow-hidden">
        <img src={LogoBgImg} alt="Fondo de agua secundario" className="w-full h-full object-contain opacity-[0.14]" />
      </div>

      <div className="relative z-10 flex items-center justify-center gap-0.5 w-full border-b border-emerald-600/10 py-1.5 xs:py-2.5">
        <img src={LogoBgImg} alt="Logo CIEBO" className="h-12 xs:h-16 w-auto object-contain" />
        <p className="text-[12px] xs:text-[15px] font-bold text-black leading-tight uppercase text-center">
          <span className="block whitespace-nowrap text-emerald-800">Cámara Inmobiliaria</span>
          <span className="block whitespace-nowrap text-emerald-800">de Bolívar</span>
        </p>
      </div>

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
              {afiliado.nombres ? afiliado.nombres.charAt(0) : 'A'}
            </div>
          )}

          <button
            type="button"
            onClick={onEditClick}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-700 active:scale-90 text-white transition-colors transition-transform shadow-md z-30 flex items-center justify-center border border-white/20 hover:scale-105 hide-on-export cursor-pointer"
            title="Ajustar encuadre / recortar foto"
          >
            <Pencil size={12} />
          </button>

          {afiliado.foto_junta_url && (
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
            {afiliado.nombres}  {afiliado.apellidos}
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
              <img src={qrCodeUrl} alt="Código QR Perfil" crossOrigin="anonymous" className="w-full h-full" />
            </div>
            <span className="text-[6.5px] xs:text-[7.5px] text-black font-extrabold tracking-wider uppercase opacity-65 text-center leading-none">
              Verificar QR
            </span>
          </div>

          {afiliado.empresa_logo_url && (
            <>
              <div className="w-[1px] h-12 xs:h-14 bg-emerald-600/15 shrink-0 self-center mx-1" />
              <div className="flex-1 flex flex-col items-center justify-center gap-1">
                <div className="w-[64px] xs:w-[78px] h-[64px] xs:h-[78px] flex items-center justify-center shrink-0">
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

/* ── SUB-COMPONENT: CarnetCropperModal ── */
interface CarnetCropperModalProps {
  showCropper: boolean;
  imageToCrop: string | null;
  savingCrop: boolean;
  isCropperReady: boolean;
  crop: { x: number; y: number };
  cropperZoom: number;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onCropChange: (crop: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (pixels: any) => void;
  onCropSave: () => void;
}

function CarnetCropperModal({
  showCropper,
  imageToCrop,
  savingCrop,
  isCropperReady,
  crop,
  cropperZoom,
  fileInputRef,
  onClose,
  onCropChange,
  onZoomChange,
  onCropComplete,
  onCropSave
}: CarnetCropperModalProps) {
  if (!showCropper || !imageToCrop) return null;

  return (
    <div className="transition-opacity fixed inset-0 z-[99999] overflow-y-auto bg-slate-900/50 backdrop-blur-sm fade-in duration-200" aria-hidden="true" onClick={() => !savingCrop && onClose()}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="transition-transform bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4 zoom-in-95 duration-200" aria-hidden="false" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-black text-slate-800 text-lg">Encuadrar Foto de Credencial</h3>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Aspecto exacto del carnet (155x185)</p>
            </div>
            <button
              type="button"
              disabled={savingCrop}
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <X size={16} />
            </button>
          </div>

          <div className="relative w-full h-72 bg-slate-100 rounded-2xl overflow-hidden border border-slate-100">
            {isCropperReady ? (
              <>
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={cropperZoom}
                  minZoom={1}
                  maxZoom={8}
                  restrictPosition={true}
                  objectFit="cover"
                  aspect={155 / 185}
                  onCropChange={onCropChange}
                  onZoomChange={onZoomChange}
                  onCropComplete={(_, pixels) => onCropComplete(pixels)}
                  cropShape="rect"
                  showGrid={true}
                />
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] border-l-2 border-dashed border-white/60 drop-shadow-md pointer-events-none z-10" />
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-emerald-600" size={24} />
              </div>
            )}
          </div>

          <div className="px-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zoom</span>
              <span className="text-[10px] font-bold text-slate-600">{Math.round(cropperZoom * 100)}%</span>
            </div>
            <input
              type="range"
              value={cropperZoom}
              min={1}
              max={8}
              step={0.02}
              disabled={savingCrop}
              onChange={(e) => {
                const val = e.currentTarget.valueAsNumber;
                if (Number.isFinite(val)) onZoomChange(val);
              }}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            disabled={savingCrop}
            onClick={() => fileInputRef.current?.click()}
            className="w-full text-[10px] font-extrabold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center justify-center gap-1 uppercase tracking-widest"
          >
            <ImageIcon size={12} /> Cargar una foto diferente
          </button>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={savingCrop}
              onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-600 text-sm font-bold py-3 rounded-2xl hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={savingCrop}
              onClick={onCropSave}
              className="flex-[2] bg-emerald-600 text-white text-sm font-bold py-3 rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {savingCrop ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Guardando...
                </>
              ) : (
                'Aplicar Recorte'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── REDUCER PARA EL ESTADO DEL CROPPER DE FOTO ── */
type CropperState = {
  showCropper: boolean;
  isCropperReady: boolean;
  crop: { x: number; y: number };
  cropperZoom: number;
  croppedAreaPixels: any;
  imageToCrop: string | null;
  imageFile: File | null;
  savingCrop: boolean;
};

type CropperAction =
  | { type: 'OPEN_CROPPER'; payload: { imageToCrop: string; imageFile?: File | null } }
  | { type: 'SET_READY'; payload: boolean }
  | { type: 'SET_CROP'; payload: { x: number; y: number } }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_PIXELS'; payload: any }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'CLOSE_CROPPER' };

const initialCropperState: CropperState = {
  showCropper: false,
  isCropperReady: false,
  crop: { x: 0, y: 0 },
  cropperZoom: 1.4,
  croppedAreaPixels: null,
  imageToCrop: null,
  imageFile: null,
  savingCrop: false,
};

function cropperReducer(state: CropperState, action: CropperAction): CropperState {
  switch (action.type) {
    case 'OPEN_CROPPER':
      return {
        ...state,
        showCropper: true,
        isCropperReady: false,
        imageToCrop: action.payload.imageToCrop,
        imageFile: action.payload.imageFile ?? null,
        crop: { x: 0, y: 0 },
        cropperZoom: 1.4,
      };
    case 'SET_READY':
      return { ...state, isCropperReady: action.payload };
    case 'SET_CROP':
      return { ...state, crop: action.payload };
    case 'SET_ZOOM':
      return { ...state, cropperZoom: action.payload };
    case 'SET_PIXELS':
      return { ...state, croppedAreaPixels: action.payload };
    case 'SET_SAVING':
      return { ...state, savingCrop: action.payload };
    case 'CLOSE_CROPPER':
      return { ...state, showCropper: false, isCropperReady: false, savingCrop: false };
    default:
      return state;
  }
}

/* ── MAIN COMPONENT: CarnetAfiliadoModal ── */
export default function CarnetAfiliadoModal({ isOpen, onClose, afiliado, onUpdateAfiliado }: CarnetAfiliadoModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [useJuntaPhoto, setUseJuntaPhoto] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const memberCode = (afiliado?.codigo && String(afiliado.codigo).trim() !== '') ? String(afiliado.codigo).trim() : null;
  const profileUrl = afiliado
    ? (memberCode
        ? `${window.location.origin}/miembros/${memberCode}`
        : `${window.location.origin}/miembros/${afiliado.id_afiliado}?by=id`)
    : window.location.origin;

  useEffect(() => {
    if (!profileUrl) return;
    QRCode.toDataURL(profileUrl, {
      margin: 1,
      width: 240,
      color: { dark: '#000000', light: '#00000000' },
      errorCorrectionLevel: 'H'
    })
      .then(setQrCodeUrl)
      .catch(console.error);
  }, [profileUrl]);

  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cropperState, dispatch] = useReducer(cropperReducer, initialCropperState);

  useEffect(() => {
    if (cropperState.showCropper) {
      const timer = setTimeout(() => dispatch({ type: 'SET_READY', payload: true }), 250);
      return () => clearTimeout(timer);
    } else {
      dispatch({ type: 'SET_READY', payload: false });
    }
  }, [cropperState.showCropper]);

  useEffect(() => {
    if (afiliado) {
      const redes = parseRedes(afiliado.redes_sociales);
      setUseJuntaPhoto(Boolean(redes?.use_junta_photo));
    }
  }, [afiliado]);

  const handleToggleJuntaPhoto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!afiliado) return;
    const nextVal = !useJuntaPhoto;
    setUseJuntaPhoto(nextVal);

    try {
      const currentRedes = parseRedes(afiliado.redes_sociales);
      const updatedRedes = { ...currentRedes, use_junta_photo: nextVal };

      const res = await fetch(`${API_URL}/api/afiliados/perfil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ redes_sociales: updatedRedes })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(nextVal ? 'Usando foto de Junta Directiva para la credencial' : 'Usando foto de Perfil para la credencial');
        if (onUpdateAfiliado) onUpdateAfiliado({ redes_sociales: updatedRedes });
      }
    } catch {
      toast.error('No se pudo guardar la preferencia de foto');
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!afiliado) return;
    const redes = parseRedes(afiliado.redes_sociales);
    const carnetPhotoUrl = useJuntaPhoto ? redes?.foto_junta_carnet_url : redes?.foto_carnet_url;
    const currentPhoto = carnetPhotoUrl || ((useJuntaPhoto && afiliado.foto_junta_url) ? afiliado.foto_junta_url : afiliado.foto_url);

    if (currentPhoto) {
      dispatch({ type: 'OPEN_CROPPER', payload: { imageToCrop: currentPhoto } });
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen válido');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      dispatch({ type: 'OPEN_CROPPER', payload: { imageToCrop: reader.result as string, imageFile: file } });
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const handleCropSave = async () => {
    if (!cropperState.imageToCrop || !cropperState.croppedAreaPixels || !afiliado) return;
    dispatch({ type: 'SET_SAVING', payload: true });

    try {
      const croppedBlob = await getCroppedImg(cropperState.imageToCrop, cropperState.croppedAreaPixels);
      if (!croppedBlob) throw new Error('No se pudo procesar la imagen recortada');
      const croppedFile = new File([croppedBlob], 'cropped.jpg', { type: 'image/jpeg' });
      const compressedBlob = await compressImage(croppedFile, 720, 0.88);

      const formData = new FormData();
      const filename = useJuntaPhoto ? `carnet_junta_${afiliado.id_afiliado}.jpg` : `carnet_${afiliado.id_afiliado}.jpg`;
      formData.append('foto_carnet', compressedBlob, filename);
      formData.append('tipo_foto', useJuntaPhoto ? 'junta' : 'perfil');

      const res = await fetch(`${API_URL}/api/afiliados/perfil/foto-carnet`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.message || 'Error al guardar encuadre');

      const newPhotoUrl = json.foto_carnet_url;
      const currentRedes = parseRedes(afiliado.redes_sociales);
      const updatedRedes = {
        ...currentRedes,
        [useJuntaPhoto ? 'foto_junta_carnet_url' : 'foto_carnet_url']: newPhotoUrl
      };

      toast.success('¡Encuadre de foto guardado con éxito!');
      dispatch({ type: 'CLOSE_CROPPER' });

      if (onUpdateAfiliado) onUpdateAfiliado({ redes_sociales: updatedRedes });
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar encuadre de la foto');
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  };

  const handleRemoveCroppedPhoto = async () => {
    if (!afiliado) return;
    try {
      const currentRedes = parseRedes(afiliado.redes_sociales);
      const targetKey = useJuntaPhoto ? 'foto_junta_carnet_url' : 'foto_carnet_url';
      const updatedRedes = { ...currentRedes };
      delete updatedRedes[targetKey];

      const res = await fetch(`${API_URL}/api/afiliados/perfil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ redes_sociales: updatedRedes })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Se ha restablecido el encuadre original de la foto');
        if (onUpdateAfiliado) onUpdateAfiliado({ redes_sociales: updatedRedes });
      }
    } catch {
      toast.error('No se pudo restablecer el encuadre');
    }
  };

  if (!isOpen) return null;
  const hasCredential = afiliado && afiliado.id_afiliado && afiliado.codigo;

  const handleDownload = async () => {
    if (!cardRef.current || !hasCredential) return;
    setExporting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        filter: (node) => !(node instanceof Element && node.classList.contains('hide-on-export')),
        style: {
          width: '310px',
          height: '490px',
          transform: 'none',
          borderRadius: '0px',
        }
      });

      const link = document.createElement('a');
      link.download = `carnet-ciebo-${afiliado.codigo}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Credencial descargada con éxito como imagen PNG.');
    } catch (err) {
      console.error('Error generando carnet:', err);
      toast.error('No se pudo generar la descarga de la credencial.');
    } finally {
      setExporting(false);
    }
  };

  return createPortal(
    <>
      <div className="transition-opacity fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm fade-in duration-300" aria-hidden="true" onClick={onClose} />
      <div className="fixed inset-0 z-[101] overflow-y-auto overscroll-y-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="transition-transform relative bg-white dark:bg-[#022c22] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-emerald-500/20 my-4 zoom-in-95 duration-200" aria-hidden="false" onClick={(e) => e.stopPropagation()}>
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-emerald-950/40 text-slate-400 hover:text-slate-600 dark:hover:text-emerald-200 transition-colors z-50" title="Cerrar ventana">
              <X size={20} />
            </button>

            <div className="w-full flex flex-col items-center gap-6">
              {hasCredential ? (
                <>
                  <div className="text-center space-y-1">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center justify-center gap-2">
                      Credencial Digital
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-emerald-100/70 font-medium">
                      Esta es tu identificación digital oficial de CIEBO.
                    </p>
                  </div>

                  <div className="p-1 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner overflow-hidden select-none">
                    <CarnetCardPreview
                      cardRef={cardRef}
                      afiliado={afiliado}
                      useJuntaPhoto={useJuntaPhoto}
                      qrCodeUrl={qrCodeUrl}
                      onEditClick={handleEditClick}
                      onToggleJuntaPhoto={handleToggleJuntaPhoto}
                    />
                  </div>

                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

                  <div className="w-full flex flex-col gap-2">
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={handleDownload}
                        disabled={exporting}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors transition-transform flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-98 disabled:opacity-60 cursor-pointer"
                      >
                        {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                        {exporting ? 'Generando...' : 'Descargar Carnet PNG'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 px-1 pt-1">
                      {parseRedes(afiliado?.redes_sociales)?.[useJuntaPhoto ? 'foto_junta_carnet_url' : 'foto_carnet_url'] && (
                        <button
                          type="button"
                          onClick={handleRemoveCroppedPhoto}
                          className="text-[10px] font-bold text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1 uppercase tracking-wider cursor-pointer"
                        >
                          <Trash2 size={12} /> Restablecer encuadre original
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-500/20">
                    <Award size={32} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Sin Credencial Emitida</h3>
                  <p className="text-xs text-slate-500 dark:text-emerald-100/70 max-w-xs mx-auto leading-relaxed">
                    Tu expediente de afiliación aún está en proceso de asignación de número de código oficial.
                  </p>
                  <button onClick={onClose} className="mt-2 bg-slate-100 hover:bg-slate-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-emerald-100 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors">
                    Entendido
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CarnetCropperModal
        showCropper={cropperState.showCropper}
        imageToCrop={cropperState.imageToCrop}
        savingCrop={cropperState.savingCrop}
        isCropperReady={cropperState.isCropperReady}
        crop={cropperState.crop}
        cropperZoom={cropperState.cropperZoom}
        fileInputRef={fileInputRef}
        onClose={() => dispatch({ type: 'CLOSE_CROPPER' })}
        onCropChange={(c) => dispatch({ type: 'SET_CROP', payload: c })}
        onZoomChange={(z) => dispatch({ type: 'SET_ZOOM', payload: z })}
        onCropComplete={(px) => dispatch({ type: 'SET_PIXELS', payload: px })}
        onCropSave={handleCropSave}
      />
    </>,
    document.body
  );
}
