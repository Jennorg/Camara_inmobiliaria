import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon, FileUp, Crop } from 'lucide-react';
import { API_URL } from '@/config/env';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/utils/cropImage';
import { compressImage } from '@/utils/imageCompressor';

interface FileUploadProps {
  label: string;
  accept?: string;
  folder?: string;
  onUploadSuccess: (url: string, fileName?: string) => void;
  onClear: () => void;
  required?: boolean;
  disabled?: boolean;
  /** URL de un archivo ya subido previamente (p.ej. restaurado de localStorage). */
  initialUrl?: string;
  /** Nombre original del archivo cuando se restaura del progreso guardado. */
  initialFileName?: string;
  /** Si se debe habilitar el recorte de imagen */
  enableCrop?: boolean;
  /** Relación de aspecto del recorte (ej: 1/1, 16/9) */
  cropAspect?: number;
  /** Forma del recorte */
  cropShape?: 'round' | 'rect';
  /** Alineación por defecto del encuadre */
  defaultCropPosition?: 'center' | 'bottom';
  /** Indica si hay un error de validación externo */
  hasError?: boolean;
  /** Si es true, desactiva el preview de imagen y muestra el icono de documento */
  disableImagePreview?: boolean;
  /** Si es true, bloquea la relación de aspecto y no permite cambiarla en el modal */
  lockAspect?: boolean;
  /** Tamaño máximo permitido en MB (por defecto 10MB) */
  maxSizeMB?: number;
}

export default function FileUpload({ 
  label, 
  accept = "image/*,.pdf", 
  folder = "registros", 
  onUploadSuccess, 
  onClear,
  required = false,
  disabled = false,
  initialUrl,
  initialFileName,
  enableCrop = false,
  cropAspect = 1 / 1,
  cropShape = 'rect',
  defaultCropPosition = 'center',
  hasError = false,
  disableImagePreview = false,
  lockAspect = false,
  maxSizeMB = 10,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  // Si se provee una URL inicial (restaurada desde progreso guardado), partimos de ese estado
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(initialUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Nombre original del archivo restaurado (si existe)
  const [restoredFileName, setRestoredFileName] = useState<string | null>(initialFileName ?? null);

  const [prevInitialUrl, setPrevInitialUrl] = useState(initialUrl);
  if (prevInitialUrl !== initialUrl) {
    setPrevInitialUrl(initialUrl);
    if (initialUrl !== undefined) {
      setUploadedUrl(initialUrl);
    }
  }

  const [prevInitialFileName, setPrevInitialFileName] = useState(initialFileName);
  if (prevInitialFileName !== initialFileName) {
    setPrevInitialFileName(initialFileName);
    if (initialFileName !== undefined) {
      setRestoredFileName(initialFileName);
    }
  }

  // Estados para el recorte
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: defaultCropPosition === 'bottom' ? -50 : 0 });
  const [zoom, setZoom] = useState(enableCrop && cropAspect !== 1 ? 1.1 : 1);
  const croppedAreaPixelsRef = useRef<any>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [customAspect, setCustomAspect] = useState<number | null>(null);
  const selectedAspect = customAspect ?? cropAspect;

  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const startUpload = async (targetFile: File) => {
    setUploading(true);
    try {
      let fileToUpload = targetFile;
      if (targetFile.type.startsWith('image/')) {
        try {
          fileToUpload = await compressImage(targetFile, 1000, 0.82);
        } catch (compressErr) {
          console.error('Error compressing image before upload:', compressErr);
        }
      }

      // 1. Get presigned URL
      const presignRes = await fetch(`${API_URL}/api/public/uploads/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileToUpload.name,
          folder,
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok || !presignData.success) {
        throw new Error(presignData.message || 'Error al obtener URL de subida');
      }

      const { signedUploadUrl, token, publicUrl } = presignData.data;

      // 2. Upload to Supabase Storage via PUT
      const uploadRes = await fetch(signedUploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': fileToUpload.type,
        },
        body: fileToUpload,
      });

      if (!uploadRes.ok) {
        throw new Error('Error al subir el archivo a storage');
      }

      // 3. Success
      setUploadedUrl(publicUrl);
      setRestoredFileName(fileToUpload.name);
      onUploadSuccess(publicUrl, fileToUpload.name);
    } catch (err: any) {
      console.error('FileUpload error:', err);
      setError(err.message || 'Error al subir el archivo');
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    if (disabled) return;
    let selectedFile: File | undefined;
    
    if ('target' in e && (e.target as HTMLInputElement).files) {
      selectedFile = (e.target as HTMLInputElement).files?.[0];
    } else if ('dataTransfer' in e) {
      selectedFile = e.dataTransfer.files?.[0];
    }

    if (!selectedFile) return;

    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      setError(`El archivo es demasiado grande (Máx ${maxSizeMB}MB)`);
      return;
    }

    setError(null);
    setFile(selectedFile);

    // Cargar la imagen local base64 de fondo por si el usuario decide recortarla después
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }

    await startUpload(selectedFile);
  };

  const handleCropSave = async () => {
    if (!imageToCrop || !croppedAreaPixelsRef.current) return;
    
    try {
      const fileType = 'image/webp';
      const rawName = file?.name || restoredFileName || 'imagen_recortada.jpg';
      const fileName = rawName.replace(/\.[^/.]+$/, '') + '.webp';
      
      const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixelsRef.current, 0, { horizontal: false, vertical: false }, fileType);
      if (croppedImageBlob) {
        const croppedFile = new File([croppedImageBlob], fileName, { type: fileType });
        setShowCropper(false);
        await startUpload(croppedFile);
      }
    } catch (err) {
      console.error('Error cropping image:', err);
      setError('Error al procesar el recorte');
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
  };

  const handleTriggerCrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || uploading) return;
    
    if (!imageToCrop && uploadedUrl) {
      setImageToCrop(uploadedUrl);
    }
    
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setShowCropper(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(false);
    handleFileChange(e);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setUploadedUrl(null);
    setRestoredFileName(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClear();
  };

  const isImage = file?.type.startsWith('image/');
  const isUrlImage = !disableImagePreview && !!(
    isImage || 
    (uploadedUrl && (
      uploadedUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || 
      uploadedUrl.includes('supabase.co/storage/v1/object/public/logos/') ||
      uploadedUrl.includes('supabase.co/storage/v1/object/public/')
    )) ||
    (restoredFileName && restoredFileName.match(/\.(jpeg|jpg|gif|png|webp|svg)/i))
  );

  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      <label className="text-xs md:text-sm font-black uppercase tracking-wider ml-1 text-slate-500 flex items-center justify-between pb-1 shrink-0">
        <span className="truncate pr-2">{label} {required && <span className="text-rose-500">*</span>}</span>
        {uploadedUrl && (
          <span className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full text-xs border border-emerald-100 shrink-0">
            <CheckCircle2 size={12} /> CARGADO
          </span>
        )}
      </label>

      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploadedUrl && !uploading && !disabled && fileInputRef.current?.click()}
        className={`relative group transition-colors duration-300 rounded-2xl border-2 border-dashed cursor-pointer overflow-hidden w-full max-w-full flex flex-col justify-center min-h-[110px] ${
          disabled
            ? 'border-slate-200 bg-slate-100/50 cursor-not-allowed opacity-60'
            : isDragging
              ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-500/10'
              : uploadedUrl 
                ? 'border-emerald-500/30 bg-emerald-50/30 hover:bg-emerald-50/50' 
                : error || hasError 
                ? 'border-rose-500 bg-rose-50/30 ring-4 ring-rose-500/10'
                : 'border-slate-200 bg-slate-50/50 hover:border-emerald-400 hover:bg-white hover:shadow-md'
        }`}
      >
        {!file && !uploadedUrl ? (
          <div className="w-full flex flex-col items-center justify-center py-6 px-4 text-center space-y-2">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-colors duration-300 ${
              isDragging ? 'bg-emerald-500 text-white scale-110' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'
            }`}>
              <FileUp size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="space-y-0.5 max-w-full">
              <p className="text-xs sm:text-base font-bold text-slate-700 group-hover:text-emerald-700 transition-colors truncate">
                {isDragging ? 'Suelta el archivo aquí' : 'Haz clic o arrastra un archivo'}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium uppercase tracking-normal">
                Soporta PDF, JPG, PNG (Máx {maxSizeMB}MB)
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-full flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-4 min-w-0">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 ${
              uploading ? 'bg-emerald-100 text-emerald-600' : (isUrlImage ? 'bg-slate-50 border border-slate-100' : 'bg-emerald-500 text-white')
            }`}>
              {uploading ? (
                <Loader2 size={20} className="animate-spin text-emerald-600" />
              ) : isUrlImage && uploadedUrl ? (
                <img src={uploadedUrl} alt="Preview" className="transition-opacity w-full h-full object-cover fade-in duration-200" />
              ) : isUrlImage && previewObjectUrl ? (
                <img src={previewObjectUrl} alt="Preview" className="transition-opacity w-full h-full object-cover fade-in duration-200" />
              ) : (
                <FileText size={20} />
              )}
            </div>
            
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <span className="text-xs sm:text-sm font-bold text-slate-800 truncate block">
                {file?.name || restoredFileName || (uploadedUrl ? uploadedUrl.split('/').pop()?.split('?')[0] || 'Archivo cargado' : 'Archivo cargado')}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 mt-0.5 min-w-0">
                <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${uploading ? 'text-emerald-500 animate-pulse' : 'text-emerald-600'}`}>
                  {uploading ? 'Subiendo...' : 'Listo'}
                </span>
                {uploadedUrl && !uploading && (
                  <a 
                    href={uploadedUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] sm:text-xs text-emerald-600 hover:text-emerald-700 font-bold underline uppercase tracking-widest truncate"
                  >
                    Ver archivo
                  </a>
                )}
              </div>
            </div>

            {!uploading && !disabled && (
              <div className="flex items-center gap-1 shrink-0 ml-auto">
                {enableCrop && isUrlImage && (
                  <button
                    type="button"
                    onClick={handleTriggerCrop}
                    className="p-1.5 sm:p-2 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"
                    title="Recortar / Ajustar"
                  >
                    <Crop size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-1.5 sm:p-2 hover:bg-rose-50 rounded-lg text-slate-300 hover:text-rose-500 transition-colors"
                  title="Eliminar archivo"
                >
                  <X size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Progress bar simulation for feel */}
        {uploading && (
          <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 animate-progress-indefinite w-full" />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="transition-transform flex items-center gap-1.5 text-rose-500 px-1 slide-in-from-top-1">
          <AlertCircle size={14} />
          <span className="text-xs font-bold uppercase tracking-tight">{error}</span>
        </div>
      )}

      {showCropper && imageToCrop && (
        <div className="transition-opacity fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm fade-in duration-200">
          <div className="bg-white w-full max-w-sm mx-4 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-lg">Ajustar Imagen</h3>
              <button type="button" onClick={handleCropCancel} className="p-2 bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full">
                <X size={16} />
              </button>
            </div>
            
            <div className="relative w-full h-64 bg-slate-100 rounded-2xl overflow-hidden">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                minZoom={0.2}
                maxZoom={4}
                restrictPosition={false}
                aspect={selectedAspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => { croppedAreaPixelsRef.current = pixels; }}
                cropShape={cropShape}
                showGrid={true}
                onMediaLoaded={(mediaSize) => {
                  if (defaultCropPosition === 'bottom') {
                    setZoom(1.1);
                    setCrop({ x: 0, y: -10 });
                  }
                }}
              />
              {/* Guía central vertical para encuadre */}
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] border-l-2 border-dashed border-white/60 drop-shadow-md pointer-events-none z-10" />
            </div>

            {lockAspect ? (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-100/80 rounded-xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Encuadre:</span>
                <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white text-emerald-700 shadow-sm">
                  Fijo 1:1 (Cuadrado)
                </span>
              </div>
            ) : (folder.includes('logo') || (label && label.toLowerCase().includes('logo'))) ? (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-100/80 rounded-xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Encuadre Logo:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCustomAspect(1)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${selectedAspect === 1 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Cuadrado (1:1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomAspect(16 / 9)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${selectedAspect === 16 / 9 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Horizontal (16:9)
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-100/80 rounded-xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Encuadre:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCustomAspect(1)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${selectedAspect === 1 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Cuadrado (1:1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomAspect(4 / 5)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${selectedAspect === 4 / 5 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    4:5
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomAspect(16 / 9)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${selectedAspect === 16 / 9 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    16:9
                  </button>
                </div>
              </div>
            )}

            <div className="px-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zoom</span>
                <span className="text-[10px] font-bold text-slate-600">{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                value={zoom}
                min={0.2}
                max={4}
                step={0.02}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCropCancel}
                className="flex-1 bg-slate-100 text-slate-600 text-sm font-bold py-3 rounded-2xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCropSave}
                className="flex-[2] bg-emerald-500 text-white text-sm font-bold py-3 rounded-2xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
              >
                Aplicar Recorte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

