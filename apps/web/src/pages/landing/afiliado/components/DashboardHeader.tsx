import React, { useRef, useState, useEffect } from 'react';
import { Menu, User, X, Download, Loader2, Award, RefreshCw, Pencil, Image as ImageIcon } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { toast } from 'sonner';
import { AfiliadoDTO } from '@/types/afiliados';
import LogoBgImg from '@/assets/logo_ciebo_green.svg';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/env';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/utils/cropImage';
import { compressImage } from '@/utils/imageCompressor';
import { uploadFileStorage } from '@/pages/admin/components/Cms/CmsShared';
import NotificationCenter from '@/components/NotificationCenter';
import QRCode from 'qrcode';
import { drawCarnetCanvas } from '@/utils/carnetCanvasRenderer';
import { CarnetCardPreview } from '@/components/CarnetCardPreview';

interface DashboardHeaderProps {
  onMenuOpen: () => void;
  userName?: string;
  userCode?: string;
  userFotoUrl?: string | null;
  onProfileClick?: () => void;
  afiliado?: AfiliadoDTO | null;
  onUpdateAfiliado?: (updatedFields: Partial<AfiliadoDTO>) => void;
}

function CarnetAvatarImg({
  src,
  alt,
  isCropped,
  onError,
}: {
  src: string;
  alt?: string;
  isCropped: boolean;
  onError?: () => void;
}) {
  const [imgAspect, setImgAspect] = useState<number | null>(null);

  return (
    <img
      src={src}
      alt={alt || 'Foto'}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth && img.naturalHeight) {
          setImgAspect(img.naturalWidth / img.naturalHeight);
        }
      }}
      onError={onError}
      className="w-full h-full object-cover"
      style={
        isCropped
          ? (imgAspect && imgAspect > (155 / 185) * 1.08
              ? { objectPosition: 'center 35%', transform: `scale(${imgAspect / (155 / 185)})`, transformOrigin: 'center center' }
              : { objectPosition: 'center center' })
          : { transform: 'scale(2.1)', transformOrigin: 'center top' }
      }
    />
  );
}

const DashboardHeader = ({
  onMenuOpen,
  userName = 'Juan Pérez',
  userCode = 'CIBIR-2026-001',
  userFotoUrl,
  onProfileClick,
  afiliado,
  onUpdateAfiliado,
}: DashboardHeaderProps) => {
  const [imgError, setImgError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [useJuntaPhoto, setUseJuntaPhoto] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const { token, isAdmin } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const carnetPanelRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para el editor de foto del carnet (react-easy-crop)
  const [cropper, setCropper] = useState({
    show: false,
    ready: false,
    crop: { x: 0, y: 0 },
    zoom: 1.4,
    croppedAreaPixels: null as any,
    imageToCrop: null as string | null,
    imageFile: null as File | null,
    saving: false,
  });

  const showCropper = cropper.show;
  const isCropperReady = cropper.ready;
  const crop = cropper.crop;
  const cropperZoom = cropper.zoom;
  const croppedAreaPixels = cropper.croppedAreaPixels;
  const imageToCrop = cropper.imageToCrop;
  const imageFile = cropper.imageFile;
  const savingCrop = cropper.saving;

  const setShowCropper = (show: boolean) => setCropper(c => ({ ...c, show }));
  const setIsCropperReady = (ready: boolean) => setCropper(c => ({ ...c, ready }));
  const setCrop = (cropVal: any) => setCropper(c => ({ ...c, crop: typeof cropVal === 'function' ? cropVal(c.crop) : cropVal }));
  const setCropperZoom = (zoomVal: any) => setCropper(c => ({ ...c, zoom: typeof zoomVal === 'function' ? zoomVal(c.zoom) : zoomVal }));
  const setCroppedAreaPixels = (croppedAreaPixels: any) => setCropper(c => ({ ...c, croppedAreaPixels }));
  const setImageToCrop = (imageToCrop: string | null) => setCropper(c => ({ ...c, imageToCrop }));
  const setImageFile = (imageFile: File | null) => setCropper(c => ({ ...c, imageFile }));
  const setSavingCrop = (saving: boolean) => setCropper(c => ({ ...c, saving }));

  const [prevUserFotoUrl, setPrevUserFotoUrl] = useState(userFotoUrl);
  const [prevAfiliadoId, setPrevAfiliadoId] = useState(afiliado?.id_afiliado);
  if (prevUserFotoUrl !== userFotoUrl || prevAfiliadoId !== afiliado?.id_afiliado) {
    setPrevUserFotoUrl(userFotoUrl);
    setPrevAfiliadoId(afiliado?.id_afiliado);
    setImgError(false);
  }

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCropper) return;
      const target = event.target as Node;
      if (
        dropdownRef.current?.contains(target) ||
        carnetPanelRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCropper]);

  useEffect(() => {
    if (afiliado) {
      const redes = parseRedes(afiliado.redes_sociales);
      setUseJuntaPhoto(!!redes?.prefer_junta_photo);
    }
  }, [afiliado]);

  // delay para react-easy-crop
  useEffect(() => {
    if (showCropper) {
      const timer = setTimeout(() => {
        setIsCropperReady(true);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setIsCropperReady(false);
    }
  }, [showCropper]);

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

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const redes = parseRedes(afiliado?.redes_sociales);
    const activePhoto =
      useJuntaPhoto && afiliado?.foto_junta_url
        ? (redes?.foto_junta_original_url || afiliado.foto_junta_url)
        : (redes?.foto_original_url || afiliado?.foto_url);

    if (activePhoto) {
      setImageToCrop(activePhoto);

      const cropConfig = useJuntaPhoto
        ? redes?.junta_carnet_crop
        : redes?.carnet_crop;

      setCrop(cropConfig ? { x: cropConfig.x, y: cropConfig.y } : { x: 0, y: 0 });
      setCropperZoom(cropConfig ? cropConfig.zoom : 1.4);
      setImageFile(null);
      setShowCropper(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageToCrop(ev.target?.result as string);
        setCrop({ x: 0, y: 0 });
        setCropperZoom(1.4);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropSave = async () => {
    if (!imageToCrop || !croppedAreaPixels || !afiliado) return;
    setSavingCrop(true);
    try {
      const fileType = 'image/webp';
      const fileName = `foto_carnet_${
        afiliado.codigo || afiliado.id_afiliado
      }_${Date.now()}.webp`;

      const croppedImageBlob = await getCroppedImg(
        imageToCrop,
        croppedAreaPixels,
        0,
        { horizontal: false, vertical: false },
        fileType
      );

      if (!croppedImageBlob) throw new Error('No se pudo generar el recorte');

      const rawFile = new File([croppedImageBlob], fileName, { type: fileType });
      const fileToUpload = await compressImage(rawFile, 800, 0.85);

      const publicUrl = await uploadFileStorage(fileToUpload, useJuntaPhoto ? 'fotos/junta' : 'fotos/afiliados', true);

      const currentRedes = parseRedes(afiliado.redes_sociales);
      const cropData = { x: crop.x, y: crop.y, zoom: cropperZoom };

      let originalUrl = currentRedes.foto_original_url || (!afiliado.foto_url?.includes('foto_carnet_') ? afiliado.foto_url : null);
      if (imageFile) {
        try {
          const rawFileName = `foto_original_${afiliado.codigo || afiliado.id_afiliado}_${Date.now()}.${imageFile.name.split('.').pop() || 'jpg'}`;
          const compressedRaw = await compressImage(imageFile, 1200, 0.9);
          const rawFileWithCleanName = new File([compressedRaw], rawFileName, { type: compressedRaw.type });
          originalUrl = await uploadFileStorage(rawFileWithCleanName, useJuntaPhoto ? 'fotos/junta' : 'fotos/afiliados', true);
        } catch (e) {
          console.warn('Could not save raw original photo, continuing with crop:', e);
        }
      }

      const updatedRedes: Record<string, any> = {
        ...currentRedes,
        [useJuntaPhoto ? 'foto_junta_carnet_url' : 'foto_carnet_url']: publicUrl,
        [useJuntaPhoto ? 'junta_carnet_crop' : 'carnet_crop']: cropData,
      };

      // Guardar la foto original en redes_sociales ÚNICAMENTE (nunca en foto_url).
      // foto_url es la foto pública de /miembros y NO debe cambiar al editar el carnet.
      if (originalUrl) {
        updatedRedes.foto_original_url = originalUrl;
      }

      const payload: any = { redes_sociales: updatedRedes };
      const updateRes = await fetch(
        `${API_URL}/api/afiliados/${afiliado.id_afiliado}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const updateData = await updateRes.json();
      if (!updateRes.ok || !updateData.success) {
        throw new Error(
          updateData.message || 'Error al guardar los datos del afiliado'
        );
      }

      toast.success('Encuadre de credencial guardado con éxito');
      setShowCropper(false);
      setImageFile(null);

      onUpdateAfiliado?.(payload);
    } catch (err: any) {
      console.error('Error al recortar/subir imagen:', err);
      toast.error(err.message || 'Error al guardar el nuevo encuadre');
    } finally {
      setSavingCrop(false);
    }
  };

  const busyTogglePhotoRef = useRef(false);
  const handleTogglePhotoPreference = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!afiliado || busyTogglePhotoRef.current) return;
    busyTogglePhotoRef.current = true;
    const nextVal = !useJuntaPhoto;
    setUseJuntaPhoto(nextVal);
    try {
      const currentRedes = parseRedes(afiliado.redes_sociales);
      const updatedRedes: Record<string, any> = {
        ...currentRedes,
        prefer_junta_photo: nextVal
      };
      const payload: any = { 
        redes_sociales: updatedRedes
      };
      const res = await fetch(`${API_URL}/api/afiliados/${afiliado.id_afiliado}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al guardar preferencia');
      }
      toast.success(nextVal ? 'Usando foto de Junta Directiva' : 'Usando foto de perfil normal');
      onUpdateAfiliado?.(payload);
    } catch (err: any) {
      console.error('Error toggling photo preference:', err);
      toast.error('No se pudo guardar la preferencia de foto');
      setUseJuntaPhoto(!nextVal);
    } finally {
      busyTogglePhotoRef.current = false;
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!afiliado || !afiliado?.codigo) return;
    setExporting(true);

    try {
      let blob: Blob | null = null;
      try {
        blob = await drawCarnetCanvas(afiliado, qrCodeUrl);
      } catch (canvasErr) {
        console.warn('drawCarnetCanvas failed, falling back to toJpeg:', canvasErr);
        if (cardRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const dataUrl = await toJpeg(cardRef.current, {
            quality: 0.98,
            canvasWidth: 649.61,
            canvasHeight: 1003.94,
            pixelRatio: 1,
            backgroundColor: '#ffffff',
            filter: (node) =>
              !(
                node instanceof Element &&
                node.classList.contains('hide-on-export')
              ),
            style: {
              width: '310px',
              height: '479.09px',
              transform: 'none',
              borderRadius: '0px',
            },
          });
          const resBlob = await fetch(dataUrl);
          blob = await resBlob.blob();
        }
      }

      if (!blob) throw new Error('No se pudo generar la imagen del carnet.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `carnet-ciebo-${afiliado.codigo}.jpg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Credencial descargada con éxito como imagen JPG.');
    } catch (err) {
      console.error('Error generando carnet:', err);
      toast.error('No se pudo generar la descarga de la credencial.');
    } finally {
      setExporting(false);
    }
  };

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
      color: {
        dark: '#000000',
        light: '#00000000'
      },
      errorCorrectionLevel: 'H'
    })
      .then(setQrCodeUrl)
      .catch(console.error);
  }, [profileUrl]);

  const hasCredential = Boolean(afiliado && afiliado.id_afiliado && afiliado.codigo);

  return (
    <header
      className="sticky top-0 z-40 px-4 sm:px-8 py-3 h-18 flex items-center justify-between gap-4 shadow-sm border-b"
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border-accent)',
      }}
    >
      {/* Left: Hamburger */}
      <div className="flex items-center gap-3 flex-grow max-w-xl">
        <button
          onClick={onMenuOpen}
          className="md:hidden p-2 rounded-lg transition-colors flex-shrink-0"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Right: Notifications + Profile */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div
          className="flex items-center gap-1 pr-4"
          style={{ borderRight: '1px solid var(--color-border)' }}
        >
          <NotificationCenter />
        </div>

        {/* Profile Trigger + Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <div
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-3 cursor-pointer group select-none"
            title="Ver Credencial / Carnet Digital"
          >
            <div className="hidden sm:flex flex-col text-right leading-tight">
              <span className="font-bold text-sm" style={{ color: 'var(--color-text-base)' }}>
                {userName}
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-accent-hover)' }}
              >
                {userCode}
              </span>
            </div>
            <div
              className="w-11 sm:w-12 rounded-2xl border-2 border-emerald-600/40 shadow-sm flex items-center justify-center overflow-hidden transition-colors transition-transform group-hover:border-emerald-500 group-hover:scale-105 group-hover:shadow-md shrink-0 bg-slate-100"
              style={{ aspectRatio: '155 / 185' }}
            >
              {(() => {
                const redes = parseRedes(afiliado?.redes_sociales);
                const carnetPhotoUrl = useJuntaPhoto
                  ? (redes?.foto_junta_carnet_url || redes?.foto_carnet_url)
                  : (redes?.foto_carnet_url || redes?.foto_junta_carnet_url);

                const activePhoto =
                  carnetPhotoUrl ||
                  (useJuntaPhoto && afiliado?.foto_junta_url
                    ? afiliado.foto_junta_url
                    : userFotoUrl || afiliado?.foto_url) ||
                  (afiliado?.tipo_afiliado === 'Corporativo' ? afiliado.empresa_logo_url : null);

                const isCorpLogo = afiliado?.tipo_afiliado === 'Corporativo' && activePhoto === afiliado?.empresa_logo_url;
                const isCropped = Boolean(carnetPhotoUrl || (activePhoto && activePhoto.includes('foto_carnet_')));

                if (!activePhoto || imgError) {
                  return <User size={24} style={{ color: 'var(--color-accent-hover)' }} />;
                }

                if (isCorpLogo) {
                  return (
                    <img
                      src={activePhoto}
                      alt={userName}
                      onError={() => setImgError(true)}
                      className="w-full h-full object-contain p-1"
                    />
                  );
                }

                return (
                  <CarnetAvatarImg
                    src={activePhoto}
                    alt={userName}
                    isCropped={isCropped}
                    onError={() => setImgError(true)}
                  />
                );
              })()}
            </div>
          </div>

          {/* Floating Dropdown anchored to photo bubble */}
          {isOpen && (
            <>
              <div
                className="fixed inset-0 z-[100] bg-slate-900/10 backdrop-blur-[1px]"
                aria-hidden="true"
                onClick={() => setIsOpen(false)}
              />
              <div
                ref={carnetPanelRef}
                className="absolute right-0 top-full mt-2.5 z-[101] bg-white dark:bg-[#022c22] rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-emerald-500/20 fade-in slide-in-from-top-2 duration-200 w-[min(420px,calc(100vw-2rem))] max-h-[calc(100vh-6.5rem)] overflow-y-auto overscroll-y-contain custom-scrollbar-light select-none flex flex-col items-center gap-4"
                onClick={(e) => e.stopPropagation()}
              >
              {hasCredential ? (
                <>
                  <div className="text-center w-full">
                    <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">
                      Credencial Digital
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-emerald-100/70 font-medium">
                      Identificación digital oficial de CIEBO.
                    </p>
                  </div>

                  {/* AREA DE CAPTURA DEL CARNET */}
                  <div className="p-1.5 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-inner overflow-hidden select-none flex items-center justify-center shrink-0 max-w-full">
                    {afiliado && (
                      <CarnetCardPreview
                        cardRef={cardRef}
                        afiliado={afiliado}
                        useJuntaPhoto={useJuntaPhoto}
                        qrCodeUrl={qrCodeUrl}
                        onEditClick={isAdmin ? handleEditClick : undefined}
                        onToggleJuntaPhoto={afiliado.foto_junta_url ? handleTogglePhotoPreference : undefined}
                      />
                    )}
                  </div>


                </>
              ) : (
                <div className="py-4 text-center space-y-3 flex flex-col items-center">
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/20 rounded-full flex items-center justify-center text-amber-500">
                    <Award size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                    Credencial No Disponible
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-emerald-100/70 leading-relaxed">
                    Las credenciales gremiales digitales están reservadas exclusivamente para los
                    miembros activos.
                  </p>
                </div>
              )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Input invisible para fotos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Modal Cropper Overlay */}
      {showCropper && imageToCrop && (
        <div
          className="transition-opacity fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-sm fade-in duration-200"
          onClick={() => !savingCrop && setShowCropper(false)}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="transition-transform bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4 zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-800 text-lg">Encuadrar Foto</h3>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                  Aspecto carnet (155x185)
                </p>
              </div>
              <button
                type="button"
                disabled={savingCrop}
                onClick={() => setShowCropper(false)}
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
                    objectFit="contain"
                    aspect={155 / 185}
                    onCropChange={setCrop}
                    onZoomChange={setCropperZoom}
                    onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
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
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Zoom
                </span>
                <span className="text-[10px] font-bold text-slate-600">
                  {Math.round(cropperZoom * 100)}%
                </span>
              </div>
              <input
                type="range"
                value={cropperZoom}
                min={1}
                max={8}
                step={0.02}
                disabled={savingCrop}
                onChange={(e) => setCropperZoom(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
              />
            </div>

            <button
              type="button"
              disabled={savingCrop}
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-[10px] font-extrabold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center justify-center gap-1 uppercase tracking-widest cursor-pointer"
            >
              <ImageIcon size={12} /> Cargar foto diferente
            </button>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={savingCrop}
                onClick={() => setShowCropper(false)}
                className="flex-1 bg-slate-100 text-slate-600 text-sm font-bold py-3 rounded-2xl hover:bg-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingCrop}
                onClick={handleCropSave}
                className="flex-[2] bg-emerald-600 text-white text-sm font-bold py-3 rounded-2xl hover:bg-emerald-700 transition-colors transition-opacity shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer"
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
    )}
    </header>
  );
};

export default DashboardHeader;
