import React, { useRef, useState, useEffect } from 'react';
import { Download, Loader2, Award, RefreshCw, Pencil, Image as ImageIcon, X } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { AfiliadoDTO } from '@/types/afiliados';
import LogoBgImg from '@/assets/Logo4.webp';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/env';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/utils/cropImage';
import { compressImage } from '@/utils/imageCompressor';
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard';

import QRCode from 'qrcode';

interface WidgetCarnetAfiliadoProps {
  afiliado: AfiliadoDTO | null;
  onUpdateAfiliado?: (updatedFields: Partial<AfiliadoDTO>) => void;
  loading?: boolean;
}

export default function WidgetCarnetAfiliado({
  afiliado,
  onUpdateAfiliado,
  loading = false,
}: WidgetCarnetAfiliadoProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [useJuntaPhoto, setUseJuntaPhoto] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const { token, isAdmin } = useAuth();

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

  // delay para evitar que react-easy-crop se inicialice durante la animación
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

  useEffect(() => {
    if (afiliado) {
      const redes = parseRedes(afiliado.redes_sociales);
      setUseJuntaPhoto(!!redes?.prefer_junta_photo);
    }
  }, [afiliado]);

  // Helper para parsear redes_sociales
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
      const fileName = `foto_carnet_${afiliado.codigo || afiliado.id_afiliado
        }_${Date.now()}.webp`;

      // 1. Recortar la imagen
      const croppedImageBlob = await getCroppedImg(
        imageToCrop,
        croppedAreaPixels,
        0,
        { horizontal: false, vertical: false },
        fileType
      );

      if (!croppedImageBlob) throw new Error('No se pudo generar el recorte');

      // Comprimir antes de subir
      const rawFile = new File([croppedImageBlob], fileName, { type: fileType });
      const fileToUpload = await compressImage(rawFile, 800, 0.85);

      // 2. Obtener URL firmada de subida
      const presignRes = await fetch(`${API_URL}/api/public/uploads/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileToUpload.name,
          folder: useJuntaPhoto ? 'fotos/junta' : 'fotos/afiliados',
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok || !presignData.success) {
        throw new Error(presignData.message || 'Error al obtener URL de subida');
      }

      const { signedUploadUrl, token: uploadToken, publicUrl } = presignData.data;

      // 3. Subir a Supabase Storage
      const uploadRes = await fetch(signedUploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${uploadToken}`,
          'Content-Type': fileToUpload.type,
        },
        body: fileToUpload,
      });

      if (!uploadRes.ok) {
        throw new Error('Error al subir la imagen al storage');
      }

      // 4. Guardar en backend
      const currentRedes = parseRedes(afiliado.redes_sociales);
      const cropData = { x: crop.x, y: crop.y, zoom: cropperZoom };

      let originalUrl = currentRedes.foto_original_url || (!afiliado.foto_url?.includes('foto_carnet_') ? afiliado.foto_url : null);
      if (imageFile) {
        try {
          const rawFileName = `foto_original_${afiliado.codigo || afiliado.id_afiliado}_${Date.now()}.${imageFile.name.split('.').pop() || 'jpg'}`;
          const compressedRaw = await compressImage(imageFile, 1200, 0.9);
          const presignRaw = await fetch(`${API_URL}/api/public/uploads/presign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: rawFileName,
              folder: useJuntaPhoto ? 'fotos/junta' : 'fotos/afiliados',
            }),
          });
          const presignRawData = await presignRaw.json();
          if (presignRaw.ok && presignRawData.success) {
            const { signedUploadUrl: sUrl, token: uTok, publicUrl: origPubUrl } = presignRawData.data;
            const uRes = await fetch(sUrl, {
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${uTok}`, 'Content-Type': compressedRaw.type },
              body: compressedRaw,
            });
            if (uRes.ok) {
              originalUrl = origPubUrl;
            }
          }
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

      // Notificar al componente padre
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

  const handleDownload = async () => {
    if (!cardRef.current || !afiliado?.codigo) return;
    setExporting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));

      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        filter: (node) =>
          !(
            node instanceof Element &&
            node.classList.contains('hide-on-export')
          ),
        style: {
          transform: 'none',
          borderRadius: '0px',
        },
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

  if (loading) {
    return (
      <DashboardCard title="Mi Credencial Digital" icon={Award}>
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
        </div>
      </DashboardCard>
    );
  }

  const hasCredential = afiliado && afiliado.id_afiliado && afiliado.codigo;

  if (!hasCredential) {
    return (
      <DashboardCard
        title="Mi Credencial Digital"
        icon={Award}
        description="Identificación digital oficial"
      >
        <div className="py-6 text-center space-y-4 max-w-sm mx-auto flex flex-col items-center">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/20 rounded-full flex items-center justify-center text-amber-500">
            <Award size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            Credencial No Disponible
          </h3>
          <p className="text-xs text-slate-500 dark:text-emerald-100/70 leading-relaxed">
            Las credenciales gremiales digitales están reservadas exclusivamente para los
            miembros afiliados que tengan un código de membresía activo en el sistema.
          </p>
          {afiliado && !afiliado.codigo && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 rounded-lg">
              Estado actual: Tu expediente aún no tiene un código asignado. Contacta a
              administración para formalizar.
            </p>
          )}
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title="Mi Credencial Digital"
      icon={Award}
      description="Identificación digital oficial de CIEBO"
      scrollable
    >
      <div
        id="dashboard-carnet-widget"
        className="flex flex-col items-center transition-colors duration-300 w-full"
      >
        {/* AREA DE CAPTURA DEL CARNET */}
        <div className="p-1.5 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner overflow-hidden select-none">
          <div
            ref={cardRef}
            id="carnet-card-capture"
            className="w-[280px] xs:w-[310px] h-[440px] xs:h-[490px] bg-white text-slate-800 flex flex-col justify-between relative shadow-lg rounded-2xl overflow-hidden border border-slate-200 py-3.5 px-5"
            style={{
              backgroundImage:
                'radial-gradient(circle at 100% 0%, #e6f4ea 0%, transparent 45%), radial-gradient(circle at 0% 100%, #e6f4ea 0%, transparent 45%)',
            }}
          >
            {/* Fondo de agua con logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none z-0">
              <img
                src={LogoBgImg}
                alt="Fondo de agua"
                className="h-200 w-auto object-contain opacity-[0.14] filter blur-[1.5px] transform translate-y-5"
              />
            </div>

            <div className="absolute -bottom-22 -left-36 pointer-events-none select-none z-10 w-70 h-70 overflow-hidden">
              <img
                src={LogoBgImg}
                alt="Fondo de agua secundario"
                className="w-full h-full object-contain opacity-[0.14]"
              />
            </div>

            <div className="absolute -bottom-22 -right-36 pointer-events-none select-none z-10 w-70 h-70 overflow-hidden">
              <img
                src={LogoBgImg}
                alt="Fondo de agua secundario"
                className="w-full h-full object-contain opacity-[0.14]"
              />
            </div>

            {/* 1. Encabezado del Carnet */}
            <div className="relative z-10 flex items-center justify-center gap-0.5 w-full border-b border-emerald-600/10 py-1.5 xs:py-2.5">
              <img
                src={LogoBgImg}
                alt="Logo CIEBO"
                className="h-12 xs:h-16 w-auto object-contain"
              />
              <p className="text-[12px] xs:text-[15px] font-bold text-black leading-tight uppercase text-center">
                <span className="block whitespace-nowrap text-emerald-800">
                  Cámara Inmobiliaria
                </span>
                <span className="block whitespace-nowrap text-emerald-800">
                  de Bolívar
                </span>
              </p>
            </div>

            {/* 2. Cuerpo del Carnet */}
            <div className="relative z-10 flex-grow flex flex-col items-center justify-center gap-1.5 xs:gap-2 pt-1 pb-1">
              {/* Contenedor de Fotografía */}
              <div className="w-[130px] xs:w-[155px] h-[155px] xs:h-[185px] rounded-2xl overflow-hidden border-2 border-emerald-600 bg-slate-100 shadow-md flex items-center justify-center relative shrink-0">
                {(() => {
                  const redes = parseRedes(afiliado?.redes_sociales);
                  const carnetPhotoUrl = useJuntaPhoto
                    ? redes?.foto_junta_carnet_url
                    : redes?.foto_carnet_url;

                  const activePhoto =
                    carnetPhotoUrl ||
                    (useJuntaPhoto && afiliado?.foto_junta_url
                      ? afiliado.foto_junta_url
                      : afiliado?.foto_url);
                  const isCropped = !!carnetPhotoUrl;

                  return activePhoto ? (
                    <img
                      src={activePhoto}
                      alt="Foto Afiliado"
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover"
                      style={
                        isCropped
                          ? {
                            objectPosition: 'center center',
                          }
                          : {
                            transform: 'scale(2)',
                            transformOrigin: 'center top',
                          }
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-black text-5xl xs:text-6xl text-emerald-700 bg-emerald-50">
                      {afiliado.nombres ? afiliado.nombres.charAt(0) : 'A'}
                    </div>
                  );
                })()}

                {/* Botón flotante para EDITAR/RECORTAR (Lápiz) - Solo para admins */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleEditClick}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-700 active:scale-90 text-white transition-colors transition-transform shadow-md z-30 flex items-center justify-center border border-white/20 hover:scale-105 hide-on-export cursor-pointer"
                    title="Ajustar encuadre / recortar foto"
                  >
                    <Pencil size={12} />
                  </button>
                )}

                {/* Botón para alternar foto de perfil / junta directiva */}
                {typeof afiliado?.foto_junta_url === 'string' && (
                  <button
                    type="button"
                    onClick={handleTogglePhotoPreference}
                    className="absolute bottom-2 right-2 p-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-700 active:scale-90 text-white transition-colors transition-transform shadow-md z-30 flex items-center justify-center border border-white/20 hover:scale-105 hide-on-export cursor-pointer"
                    title="Cambiar foto (Perfil / Junta Directiva)"
                  >
                    <RefreshCw
                      size={12}
                      className={
                        useJuntaPhoto
                          ? 'rotate-180 transition-transform duration-500'
                          : 'transition-transform duration-500'
                      }
                    />
                  </button>
                )}
              </div>

              {/* Bloque Nombre, Apellido y Código */}
              <div className="text-center leading-none my-0.5 xs:my-1">
                <div className="text-[10px] xs:text-[11px] font-extrabold text-black uppercase tracking-wider leading-snug">
                  {afiliado.nombres} {afiliado.apellidos}
                </div>
                <span className="text-[10px] xs:text-[11px] font-extrabold text-black tracking-wider block mt-0.5">
                  <span className="font-extrabold">AFILIADO - CÓDIGO:</span>{' '}
                  {afiliado.codigo}
                </span>
                {afiliado.tipo_afiliado &&
                  (() => {
                    const tipoLabel: Record<string, string | string[]> = {
                      Natural: 'Agente Independiente',
                      Agente: 'Agente Independiente',
                      'Agente Corporativo': 'Agente Corporativo',
                      Corporativo: ['Corporativo', 'Repr. Legal'],
                    };
                    const label =
                      tipoLabel[afiliado.tipo_afiliado] ?? afiliado.tipo_afiliado;
                    return (
                      <span className="text-[9px] xs:text-[11px] font-extrabold text-black uppercase tracking-[0.14em] block mt-1 leading-none">
                        {Array.isArray(label)
                          ? label.map((line) => (
                            <span key={line} className="block">
                              {line}
                            </span>
                          ))
                          : label}
                      </span>
                    );
                  })()}
              </div>

              {/* Bloque Código QR y Detalles de la Empresa */}
              <div className="flex flex-row items-center justify-center gap-1.5 xs:gap-2 w-full px-2 pt-2 xs:pt-4 min-h-[82px] xs:min-h-[96px]">
                <div className="flex-1 flex flex-col items-center justify-center gap-1">
                  <div className="w-[64px] xs:w-[78px] h-[64px] xs:h-[78px] flex items-center justify-center shrink-0 relative">
                    <img
                      src={qrCodeUrl}
                      alt="Código QR Perfil"
                      crossOrigin="anonymous"
                      className="w-full h-full"
                    />
                  </div>
                  <span className="text-[6.5px] xs:text-[7.5px] text-black font-extrabold tracking-wider uppercase opacity-65 text-center leading-none">
                    Verificar QR
                  </span>
                </div>

                {(() => {
                  const logo = afiliado?.empresa_logo_url;

                  // Sin logo → solo se muestra el QR, sin columna extra
                  if (!logo) return null;

                  return (
                    <>
                      <div className="w-[1px] h-12 xs:h-14 bg-emerald-600/15 shrink-0 self-center mx-1" />
                      <div className="flex-1 flex flex-col items-center justify-center gap-1">
                        <div className="w-full max-w-[105px] xs:max-w-[125px] h-[64px] xs:h-[78px] flex items-center justify-center shrink-0 px-1">
                          <img
                            src={logo}
                            alt="Logo Empresa"
                            crossOrigin="anonymous"
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              if (e.currentTarget.getAttribute('crossOrigin') === 'anonymous') {
                                e.currentTarget.removeAttribute('crossOrigin');
                                e.currentTarget.src = logo;
                              } else {
                                e.currentTarget.style.display = 'none';
                              }
                            }}
                          />
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Input de archivo invisible para cargar foto */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* BOTONES DE ACCIÓN */}
        <div className="w-full max-w-[280px] xs:max-w-[310px] space-y-2 mt-4">
          <button
            onClick={handleDownload}
            disabled={exporting}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs tracking-wider uppercase shadow-md hover:shadow-lg transition-colors transition-transform flex items-center justify-center gap-2 disabled:opacity-75 disabled:pointer-events-none active:scale-95 cursor-pointer"
          >
            {exporting ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Generando...
              </>
            ) : (
              <>
                <Download size={14} />
                Descargar PNG
              </>
            )}
          </button>
        </div>

        {/* Modal Cropper Overlay */}
        {showCropper && imageToCrop && (
          <div
            className="transition-opacity fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm fade-in duration-200"
            onClick={() => !savingCrop && setShowCropper(false)}
          >
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
                      objectFit="cover"
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
        )}
      </div>
    </DashboardCard>
  );
}
