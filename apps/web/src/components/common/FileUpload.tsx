import React, { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon, FileUp } from 'lucide-react';
import { API_URL } from '@/config/env';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/utils/cropImage';

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

  // Estados para el recorte
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: defaultCropPosition === 'bottom' ? -50 : 0 });
  const [zoom, setZoom] = useState(enableCrop && cropAspect !== 1 ? 1.1 : 1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const startUpload = async (targetFile: File) => {
    setUploading(true);
    try {
      // 1. Get presigned URL
      const presignRes = await fetch(`${API_URL}/api/public/uploads/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: targetFile.name,
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
          'Content-Type': targetFile.type,
        },
        body: targetFile,
      });

      if (!uploadRes.ok) {
        throw new Error('Error al subir el archivo a storage');
      }

      // 3. Success
      setUploadedUrl(publicUrl);
      setRestoredFileName(targetFile.name);
      onUploadSuccess(publicUrl, targetFile.name);
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

    // Basic validation
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('El archivo es demasiado grande (Máx 5MB)');
      return;
    }

    // Reset state
    setError(null);

    // Si es imagen y el recorte está habilitado
    if (enableCrop && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      setCrop({ x: 0, y: 0 }); // Reset before media loads
      setZoom(1);
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setFile(selectedFile);
      await startUpload(selectedFile);
    }
  };

  const handleCropSave = async () => {
    if (!imageToCrop || !croppedAreaPixels || !file) return;
    
    try {
      const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels, 0, { horizontal: false, vertical: false }, file.type);
      if (croppedImageBlob) {
        const croppedFile = new File([croppedImageBlob], file.name, { type: file.type });
        setShowCropper(false);
        setImageToCrop(null);
        await startUpload(croppedFile);
      }
    } catch (err) {
      console.error('Error cropping image:', err);
      setError('Error al procesar el recorte');
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImageToCrop(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  return (
    <div className="space-y-2.5">
      <label className="text-xs md:text-sm font-black uppercase tracking-wider ml-1 text-slate-500 flex justify-between items-center">
        <span>{label} {required && <span className="text-rose-500">*</span>}</span>
        {uploadedUrl && (
          <span className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full text-xs border border-emerald-100">
            <CheckCircle2 size={12} /> CARGADO
          </span>
        )}
      </label>

      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploadedUrl && !uploading && !disabled && fileInputRef.current?.click()}
        className={`relative group transition-all duration-300 rounded-2xl border-2 border-dashed cursor-pointer overflow-hidden ${
          disabled
            ? 'border-slate-200 bg-slate-100/50 cursor-not-allowed opacity-60'
            : isDragging
              ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-500/10'
              : uploadedUrl 
                ? 'border-emerald-500/30 bg-emerald-50/30 hover:bg-emerald-50/50' 
                : error 
                  ? 'border-rose-500/30 bg-rose-50/30'
                  : 'border-slate-200 bg-slate-50/50 hover:border-emerald-400 hover:bg-white hover:shadow-md'
        }`}
      >
        {!file && !uploadedUrl ? (
          <div className="w-full flex flex-col items-center justify-center py-8 px-6 text-center space-y-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
              isDragging ? 'bg-emerald-500 text-white scale-110' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'
            }`}>
              <FileUp size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">
                {isDragging ? 'Suelta el archivo aquí' : 'Haz clic o arrastra un archivo'}
              </p>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-normal">
                Soporta PDF, JPG, PNG (Máx 5MB)
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full flex items-center gap-4 px-5 py-5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              uploading ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500 text-white'
            }`}>
              {uploading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : isImage ? (
                <ImageIcon size={24} />
              ) : (
                <FileText size={24} />
              )}
            </div>
            
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-bold text-slate-800 truncate">
                {file?.name || restoredFileName || (uploadedUrl ? uploadedUrl.split('/').pop()?.split('?')[0] || 'Archivo cargado' : 'Archivo cargado')}
              </span>
              <div className="flex items-center gap-3 mt-0.5">
                <span className={`text-xs font-black uppercase tracking-widest ${uploading ? 'text-emerald-500 animate-pulse' : 'text-emerald-600'}`}>
                  {uploading ? 'Subiendo...' : 'Listo para procesar'}
                </span>
                {uploadedUrl && !uploading && (
                  <a 
                    href={uploadedUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-bold underline uppercase tracking-widest"
                  >
                    Ver archivo
                  </a>
                )}
              </div>
            </div>

            {!uploading && !disabled && (
              <button
                type="button"
                onClick={handleRemove}
                className="p-2 hover:bg-rose-50 rounded-lg text-slate-300 hover:text-rose-500 transition-all"
                title="Eliminar archivo"
              >
                <X size={20} />
              </button>
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
        <div className="flex items-center gap-1.5 text-rose-500 px-1 animate-in slide-in-from-top-1">
          <AlertCircle size={14} />
          <span className="text-xs font-bold uppercase tracking-tight">{error}</span>
        </div>
      )}

      {showCropper && imageToCrop && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
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
                aspect={cropAspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
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

            <div className="px-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zoom</span>
                <span className="text-[10px] font-bold text-slate-600">{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
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
                Aplicar y Subir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

