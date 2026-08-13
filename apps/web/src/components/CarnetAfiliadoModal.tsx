import React, { useRef, useState, useEffect } from 'react';
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

interface CarnetAfiliadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  afiliado: AfiliadoDTO | null;
  onUpdateAfiliado?: (updatedFields: Partial<AfiliadoDTO>) => void;
}

export default function CarnetAfiliadoModal({ isOpen, onClose, afiliado, onUpdateAfiliado }: CarnetAfiliadoModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [useJuntaPhoto, setUseJuntaPhoto] = useState(false);

  const { token } = useAuth();

  // Estados para el editor de foto del carnet (react-easy-crop)
  const [showCropper, setShowCropper] = useState(false);
  const [isCropperReady, setIsCropperReady] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [cropperZoom, setCropperZoom] = useState(1.4);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [savingCrop, setSavingCrop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // delay para evitar que react-easy-crop se inicialice durante la animación del modal
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

  // Helper para parsear redes_sociales que puede llegar como string o como objeto del backend
  const parseRedes = (redes: any): Record<string, any> => {
    if (!redes) return {};
    if (typeof redes === 'string') {
      try { return JSON.parse(redes); } catch { return {}; }
    }
    return redes;
  };

  // Cargar preferencia guardada de foto (Perfil / Junta Directiva)
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
      const updatedRedes = {
        ...currentRedes,
        use_junta_photo: nextVal
      };
      const payload = { redes_sociales: updatedRedes };

      const res = await fetch(`${API_URL}/api/afiliados/${afiliado.id_afiliado}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onUpdateAfiliado?.(payload);
        toast.success(nextVal ? 'Usando foto de Junta Directiva para la credencial' : 'Usando foto principal para la credencial');
      }
    } catch (err) {
      console.error('Error al guardar preferencia de foto de credencial:', err);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Recuperamos las coordenadas guardadas de carnet_crop para no perder el encuadre anterior.
    const redes = parseRedes(afiliado?.redes_sociales);
    const activePhoto = (useJuntaPhoto && afiliado?.foto_junta_url)
      ? afiliado.foto_junta_url
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
      const fileName = `foto_carnet_${afiliado.codigo || afiliado.id_afiliado}_${Date.now()}.webp`;

      // 1. Recortar la imagen usando la utilidad
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

      // 3. Subir a Supabase Storage via PUT
      const uploadRes = await fetch(signedUploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${uploadToken}`,
          'Content-Type': fileToUpload.type,
        },
        body: fileToUpload,
      });

      if (!uploadRes.ok) {
        throw new Error('Error al subir la imagen al storage');
      }

      // 4. Guardar tanto la URL recortada física como las coordenadas del cropper en redes_sociales
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
        [useJuntaPhoto ? 'junta_carnet_crop' : 'carnet_crop']: cropData
      };

      // Guardar la foto original en redes_sociales ÚNICAMENTE (nunca en foto_url).
      // foto_url es la foto pública de /miembros y NO debe cambiar al editar el carnet.
      if (originalUrl) {
        updatedRedes.foto_original_url = originalUrl;
      }

      const payload: any = { redes_sociales: updatedRedes };
      // IMPORTANTE: No se actualiza payload.foto_url aquí bajo ninguna circunstancia.
      // foto_url es la foto pública y solo debe cambiar desde el panel de administración.
      const updateRes = await fetch(`${API_URL}/api/afiliados/${afiliado.id_afiliado}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const updateData = await updateRes.json();
      if (!updateRes.ok || !updateData.success) {
        throw new Error(updateData.message || 'Error al guardar los datos del afiliado');
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

  if (!isOpen) return null;

  // Si no hay afiliado o no tiene código/expediente de afiliado, mostrar mensaje informativo
  const hasCredential = afiliado && afiliado.id_afiliado && afiliado.codigo;

  const handleDownload = async () => {
    if (!cardRef.current || !hasCredential) return;
    setExporting(true);

    try {
      // Pequeña espera para asegurar renderizado y fuentes
      await new Promise((resolve) => setTimeout(resolve, 300));

      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 3, // Calidad ultra nítida 3x
        backgroundColor: '#ffffff',
        filter: (node) => !(node instanceof Element && node.classList.contains('hide-on-export')),
        style: {
          width: '310px',
          height: '490px',
          transform: 'none',
          borderRadius: '0px', // Quitar borde redondeado durante exportación para un corte limpio
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

  // URL del perfil público para el QR — usamos el código (estable) en lugar del id_afiliado (variable)
  const profileUrl = afiliado
    ? `${window.location.origin}/miembros/${afiliado.codigo || afiliado.id_afiliado}`
    : window.location.origin;

  // QR Code URL de QuickChart con fondo transparente (light=0000), color negro (dark=000000) y corrección H
  const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(profileUrl)}&dark=000000&light=0000&ecLevel=H&size=180`;

  // Estatus de la credencial
  const isActive = afiliado?.estatus === '5_CIBIR' || afiliado?.estatus === 'Afiliado';

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="fixed inset-0 z-[101] overflow-y-auto overscroll-y-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="relative bg-white dark:bg-[#022c22] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-emerald-500/20 my-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón de Cerrar */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-emerald-950/40 text-slate-400 hover:text-slate-600 dark:hover:text-emerald-200 transition-colors z-50"
              title="Cerrar ventana"
            >
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

                  {/* AREA DE CAPTURA DEL CARNET */}
                  <div className="p-1 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner overflow-hidden select-none">
                    <div
                      ref={cardRef}
                      id="carnet-card-capture"
                      className="w-[280px] xs:w-[310px] h-[440px] xs:h-[490px] bg-white text-slate-800 flex flex-col justify-between relative shadow-lg rounded-2xl overflow-hidden border border-slate-200 py-3.5 px-5"
                      style={{
                        backgroundImage: 'radial-gradient(circle at 100% 0%, #e6f4ea 0%, transparent 45%), radial-gradient(circle at 0% 100%, #e6f4ea 0%, transparent 45%)'
                      }}
                    >
                      {/* Fondo de agua con logo sin letras (mayor opacidad para visibilidad clara, levemente desplazado hacia abajo) */}
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

                      {/* 1. Encabezado del Carnet Minimalista Centrado */}
                      <div className="relative z-10 flex items-center justify-center gap-0.5 w-full border-b border-emerald-600/10 py-1.5 xs:py-2.5">
                        <img
                          src={LogoBgImg}
                          alt="Logo CIEBO"
                          className="h-12 xs:h-16 w-auto object-contain"
                        />
                        <p className="text-[12px] xs:text-[15px] font-bold text-black leading-tight uppercase text-center">
                          <span className="block whitespace-nowrap text-emerald-800">Cámara Inmobiliaria</span>
                          <span className="block whitespace-nowrap text-emerald-800">de Bolívar</span>
                        </p>
                      </div>

                      {/* 2. Cuerpo del Carnet (Máxima relevancia a la foto con espaciado ajustado) */}
                      <div className="relative z-10 flex-grow flex flex-col items-center justify-center gap-1.5 xs:gap-2 pt-1 pb-1">

                        {/* Contenedor de Fotografía Ampliado */}
                        <div className="w-[130px] xs:w-[155px] h-[155px] xs:h-[185px] rounded-2xl overflow-hidden border-2 border-emerald-600 bg-slate-100 shadow-md flex items-center justify-center relative shrink-0">
                          {(() => {
                            const redes = parseRedes(afiliado?.redes_sociales);
                            const carnetPhotoUrl = useJuntaPhoto
                              ? redes?.foto_junta_carnet_url
                              : redes?.foto_carnet_url;

                            const activePhoto = carnetPhotoUrl || ((useJuntaPhoto && afiliado?.foto_junta_url) ? afiliado.foto_junta_url : afiliado?.foto_url);
                            const isCropped = !!carnetPhotoUrl;

                            return activePhoto ? (
                              <img
                                src={activePhoto}
                                alt="Foto Afiliado"
                                crossOrigin="anonymous"
                                className="w-full h-full object-cover"
                                style={isCropped ? {
                                  objectPosition: 'center center'
                                } : {
                                  transform: 'scale(2)',
                                  transformOrigin: 'center top'
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-black text-5xl xs:text-6xl text-emerald-700 bg-emerald-50">
                                {afiliado.nombres ? afiliado.nombres.charAt(0) : 'A'}
                              </div>
                            );
                          })()}

                          {/* Botón flotante para EDITAR/RECORTAR (Lápiz) */}
                          <button
                            type="button"
                            onClick={handleEditClick}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-700 active:scale-90 text-white transition-all shadow-md z-30 flex items-center justify-center border border-white/20 hover:scale-105 hide-on-export cursor-pointer"
                            title="Ajustar encuadre / recortar foto"
                          >
                            <Pencil size={12} />
                          </button>

                          {/* Botón para alternar foto de perfil / junta directiva */}
                          {afiliado?.foto_junta_url && (
                            <button
                              type="button"
                              onClick={handleToggleJuntaPhoto}
                              className="absolute bottom-2 right-2 p-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-700 active:scale-90 text-white transition-all shadow-md z-30 flex items-center justify-center border border-white/20 hover:scale-105 hide-on-export cursor-pointer"
                              title="Cambiar foto (Perfil / Junta Directiva)"
                            >
                              <RefreshCw size={12} className={useJuntaPhoto ? "rotate-180 transition-transform duration-500" : "transition-transform duration-500"} />
                            </button>
                          )}
                        </div>

                        {/* Bloque Nombre, Apellido y Código */}
                        <div className="text-center leading-none my-0.5 xs:my-1">
                          <div className="text-[10px] xs:text-[11px] font-extrabold text-black uppercase tracking-wider leading-snug">
                            {afiliado.nombres}  {afiliado.apellidos}
                          </div>
                          <span className="text-[10px] xs:text-[11px] font-extrabold text-black tracking-wider block mt-0.5">
                            <span className='font-extrabold'>AFILIADO - CÓDIGO:</span> {afiliado.codigo}
                          </span>
                          {/* Tipo de afiliado debajo del código */}
                          {afiliado.tipo_afiliado && (() => {
                            const tipoLabel: Record<string, string | string[]> = {
                              'Natural': 'Agente Independiente',
                              'Agente': 'Agente Independiente',
                              'Agente Corporativo': 'Agente Corporativo',
                              'Corporativo': ['Corporativo', 'Repr. Legal'],
                            };
                            const label = tipoLabel[afiliado.tipo_afiliado] ?? afiliado.tipo_afiliado;
                            return (
                              <span className="text-[9px] xs:text-[11px] font-extrabold text-black uppercase tracking-[0.14em] block mt-1 leading-none">
                                {Array.isArray(label)
                                  ? label.map((line, i) => <span key={i} className="block">{line}</span>)
                                  : label}
                              </span>
                            );
                          })()}
                        </div>

                        {/* Bloque Código QR y Detalles de la Empresa en horizontal (Simétrico) */}
                        <div className="flex flex-row items-center justify-center gap-1.5 xs:gap-2 w-full px-2 pt-2 xs:pt-4 min-h-[82px] xs:min-h-[96px]">
                          {/* QR Code Column */}
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

                          {/* Logo de Empresa/Marca si aplica */}
                          {(() => {
                            const logo = afiliado?.empresa_logo_url;

                            // Sin logo → solo se muestra el QR, sin columna extra
                            if (!logo) return null;

                            return (
                              <>
                                {/* Línea divisoria vertical */}
                                <div className="w-[1px] h-12 xs:h-14 bg-emerald-600/15 shrink-0 self-center mx-1" />

                                {/* Logo Column */}
                                <div className="flex-1 flex flex-col items-center justify-center gap-1">
                                  <div className="w-[64px] xs:w-[78px] h-[64px] xs:h-[78px] flex items-center justify-center shrink-0">
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

                  {/* Input de archivo invisible para subir foto si no tiene */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {/* BOTÓN DE ACCIÓN: DESCARGAR */}
                  <button
                    onClick={handleDownload}
                    disabled={exporting}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm tracking-wide uppercase shadow-lg shadow-emerald-500/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:pointer-events-none active:scale-95 mt-4"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Generando Imagen...
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        Descargar Credencial (PNG)
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="py-8 text-center space-y-4 max-w-sm flex flex-col items-center">
                  <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/20 rounded-full flex items-center justify-center text-amber-500">
                    <Award size={36} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Credencial No Disponible</h3>
                  <p className="text-sm text-slate-500 dark:text-emerald-100/70 leading-relaxed">
                    Las credenciales gremiales digitales están reservadas exclusivamente para los miembros afiliados que tengan un código de membresía activo en el sistema.
                  </p>
                  {afiliado && !afiliado.codigo && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/20 px-4 py-2 rounded-xl">
                      Estado actual: Tu expediente aún no tiene un código asignado. Contacta a administración para formalizar.
                    </p>
                  )}
                  <button
                    onClick={onClose}
                    className="mt-2 bg-slate-100 hover:bg-slate-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-emerald-100 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    Entendido
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL DEL CROPPER DE FOTO PARA EL CARNET (Fondo difuminado z-[99999]) ── */}
      {showCropper && imageToCrop && (
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !savingCrop && setShowCropper(false)}>
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-black text-slate-800 text-lg">Encuadrar Foto de Credencial</h3>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Aspecto exacto del carnet (155x185)</p>
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

              {/* Contenedor del cropper con react-easy-crop */}
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
                    {/* Guía central vertical de encuadre */}
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] border-l-2 border-dashed border-white/60 drop-shadow-md pointer-events-none z-10" />
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                    <Loader2 className="animate-spin text-emerald-600" size={24} />
                  </div>
                )}
              </div>

              {/* Slider de Zoom */}
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
                  onChange={(e) => setCropperZoom(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
                />
              </div>

              {/* Botón para cambiar de foto */}
              <button
                type="button"
                disabled={savingCrop}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="w-full text-[10px] font-extrabold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center justify-center gap-1 uppercase tracking-widest"
              >
                <ImageIcon size={12} /> Cargar una foto diferente
              </button>

              {/* Botones de acción del cropper */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={savingCrop}
                  onClick={() => setShowCropper(false)}
                  className="flex-1 bg-slate-100 text-slate-600 text-sm font-bold py-3 rounded-2xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingCrop}
                  onClick={handleCropSave}
                  className="flex-[2] bg-emerald-600 text-white text-sm font-bold py-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-75"
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
    </>,
    document.body
  );
}
