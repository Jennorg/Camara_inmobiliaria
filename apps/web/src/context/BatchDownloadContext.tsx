import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { Loader2, OctagonXIcon } from 'lucide-react';
import { API_URL } from '@/config/env';
import { formatNombreCard } from '@/utils/formatters';
import { captureElementToPdfBuffer } from '@/utils/domToPdf';
import { CarnetCardPreview } from '@/components/CarnetCardPreview';
import CertificadoProgramaView from '@/components/CertificadoProgramaView';
import CertificadoCursoView from '@/components/CertificadoCursoView';
import { useAuth } from '@/context/AuthContext';

const showCancelToast = (message: string) => {
  toast(message, {
    className: '!bg-white !text-red-600 !border-red-200 shadow-md',
    classNames: {
      title: '!text-red-600 font-medium',
      toast: '!bg-white !text-red-600 !border-red-200',
    },
    style: {
      backgroundColor: '#ffffff',
      color: '#dc2626',
      borderColor: '#fecaca',
      border: '1px solid #fecaca',
      '--normal-bg': '#ffffff',
      '--normal-text': '#dc2626',
      '--normal-border': '#fecaca',
    } as React.CSSProperties,
    icon: <OctagonXIcon className="size-4 text-red-600 shrink-0" />,
  });
};

export interface FirmanteItem {
  id?: string | number;
  nombre: string;
  cargo: string;
  firma_url?: string | null;
  mostrar_firma: boolean;
}

export type BatchDownloadType = 'carnets' | 'certificados' | null;

export interface BatchDownloadContextType {
  isDownloading: boolean;
  downloadType: BatchDownloadType;
  batchCurrent: number;
  batchTotal: number;
  currentItemName: string;
  isCanceling: boolean;
  cancelDownload: () => void;
  startBatchCarnets: () => Promise<void>;
  startBatchCertificados: (params: {
    curso: any;
    targetRows: any[];
    selectedOnly?: boolean;
  }) => Promise<void>;
}

const BatchDownloadContext = createContext<BatchDownloadContextType | null>(null);

export function BatchDownloadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadType, setDownloadType] = useState<BatchDownloadType>(null);
  const [batchCurrent, setBatchCurrent] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [currentItemName, setCurrentItemName] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);

  // Carnets Offscreen State
  const [currentMember, setCurrentMember] = useState<any>(null);
  const [currentMemberQrUrl, setCurrentMemberQrUrl] = useState('');
  const bulkCardRef = useRef<HTMLDivElement>(null);

  // Certificados Offscreen State
  const [renderingCertData, setRenderingCertData] = useState<any | null>(null);

  const cancelRef = useRef(false);

  // Cancelar descarga activa
  const cancelDownload = useCallback(() => {
    cancelRef.current = true;
    setIsCanceling(true);
  }, []);

  // Cancelar automáticamente si el usuario cierra sesión
  useEffect(() => {
    if (!user && isDownloading) {
      cancelDownload();
    }
  }, [user, isDownloading, cancelDownload]);

  // Alertar al usuario si intenta recargar la página o cerrarla mientras hay una descarga activa
  useEffect(() => {
    if (!isDownloading) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Hay una descarga masiva en curso. Si recargas o sales de la página, la descarga se cancelará.';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDownloading]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. DESCARGA MASIVA DE CARNETS
  // ─────────────────────────────────────────────────────────────────────────────
  const startBatchCarnets = useCallback(async () => {
    if (isDownloading) {
      toast.info('Ya hay una descarga en proceso.');
      return;
    }

    setIsDownloading(true);
    setDownloadType('carnets');
    setIsCanceling(false);
    setBatchTotal(0);
    setBatchCurrent(0);
    setCurrentItemName('');
    cancelRef.current = false;

    try {
      const res = await fetch(`${API_URL}/api/public/afiliados/buscar?con_foto=true&limit=1000`);
      if (!res.ok) {
        throw new Error(`Error en la solicitud (${res.status})`);
      }
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) {
        throw new Error('No se pudo obtener el listado de afiliados.');
      }

      const activeMembers = json.data;
      if (activeMembers.length === 0) {
        toast.error('No se encontraron afiliados activos con fotografía.');
        setIsDownloading(false);
        setDownloadType(null);
        return;
      }

      setBatchTotal(activeMembers.length);

      const zip = new JSZip();
      let generatedCount = 0;

      const preloadImg = (url?: string | null) => {
        if (!url) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        });
      };

      // Procesamiento de a 1 por 1
      for (let i = 0; i < activeMembers.length; i++) {
        if (cancelRef.current) {
          break;
        }

        const member = activeMembers[i];
        setBatchCurrent(i + 1);
        setCurrentMember(member);
        const memberName = member.nombres || member.nombre_completo || member.representante_nombre || `Afiliado ${i + 1}`;
        setCurrentItemName(memberName);

        const mCode = (member.codigo && String(member.codigo).trim() !== '') ? String(member.codigo).trim() : null;
        const pUrl = mCode ? `${window.location.origin}/miembros/${mCode}` : `${window.location.origin}/miembros/${member.id_afiliado}?by=id`;

        const rawRedes = member?.redes_sociales;
        const redes = rawRedes
          ? (typeof rawRedes === 'string' ? (() => { try { return JSON.parse(rawRedes); } catch { return {}; } })() : rawRedes)
          : {};
        const useJuntaPhoto = Boolean(redes?.use_junta_photo);
        const carnetPhotoUrl = useJuntaPhoto
          ? (redes?.foto_junta_carnet_url || member.foto_junta_url)
          : redes?.foto_carnet_url;
        const activePhoto = carnetPhotoUrl || ((useJuntaPhoto && member.foto_junta_url) ? member.foto_junta_url : member.foto_url);

        const [qrUrl] = await Promise.all([
          QRCode.toDataURL(pUrl, {
            margin: 1,
            width: 240,
            color: { dark: '#000000', light: '#00000000' },
            errorCorrectionLevel: 'H'
          }),
          preloadImg(activePhoto),
          preloadImg(member.empresa_logo_url)
        ]);

        setCurrentMemberQrUrl(qrUrl);

        // Breve espera para actualización de estado del DOM (60ms)
        await new Promise((resolve) => setTimeout(resolve, 60));

        if (bulkCardRef.current) {
          try {
            const dataUrl = await toPng(bulkCardRef.current, {
              quality: 0.98,
              pixelRatio: 2,
              backgroundColor: '#ffffff',
              style: {
                transform: 'none',
                borderRadius: '0px',
              }
            });

            const base64Data = dataUrl.split(',')[1];
            const filename = `carnet-${member.codigo || member.id_afiliado}.png`;
            zip.file(filename, base64Data, { base64: true });
            generatedCount++;
          } catch (cardErr) {
            console.error(`Error procesando carnet de ${member.codigo}:`, cardErr);
          }
        }
      }

      if (generatedCount > 0 && !cancelRef.current) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `carnets-ciebo-${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`${generatedCount} carnets descargados`);
      } else if (generatedCount > 0 && cancelRef.current) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `carnets-ciebo-${new Date().toISOString().slice(0, 10)}_parcial.zip`;
        link.click();
        URL.revokeObjectURL(url);
        showCancelToast(`Descarga parcial: ${generatedCount} carnets`);
      } else if (cancelRef.current) {
        showCancelToast('Descarga de carnets cancelada');
      } else if (generatedCount === 0 && !cancelRef.current) {
        toast.error('No se pudo generar ninguna credencial.');
      }
    } catch (err: any) {
      console.error('Error en descarga masiva de carnets:', err);
      toast.error(err.message || 'Ocurrió un error en la descarga masiva.');
    } finally {
      setIsDownloading(false);
      setDownloadType(null);
      setIsCanceling(false);
      setCurrentMember(null);
      setCurrentMemberQrUrl('');
      setCurrentItemName('');
      setBatchCurrent(0);
      setBatchTotal(0);
      cancelRef.current = false;
    }
  }, [isDownloading]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. DESCARGA MASIVA DE CERTIFICADOS
  // ─────────────────────────────────────────────────────────────────────────────
  const startBatchCertificados = useCallback(async ({
    curso,
    targetRows,
    selectedOnly = false,
  }: {
    curso: any;
    targetRows: any[];
    selectedOnly?: boolean;
  }) => {
    if (isDownloading) {
      toast.info('Ya hay una descarga en proceso.');
      return;
    }
    if (targetRows.length === 0) {
      toast.error(selectedOnly ? 'No hay participantes seleccionados.' : 'Este curso no tiene participantes inscritos para generar certificados.');
      return;
    }

    setIsDownloading(true);
    setDownloadType('certificados');
    setIsCanceling(false);
    setBatchTotal(targetRows.length);
    setBatchCurrent(0);
    setCurrentItemName('');
    cancelRef.current = false;

    try {
      const MAIN_PROGRAMS = new Set(['CIBIR', 'PREANI', 'PEGI', 'PADI']);
      const isMainProg = curso.programa_codigo
        ? MAIN_PROGRAMS.has(curso.programa_codigo.trim().toUpperCase())
        : false;

      let parsedFirmantes: FirmanteItem[] | undefined = undefined;
      if (curso.firmantes) {
        try {
          parsedFirmantes = typeof curso.firmantes === 'string' ? JSON.parse(curso.firmantes) : curso.firmantes;
        } catch {
          parsedFirmantes = undefined;
        }
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const zip = new JSZip();

      // Ensure browser fonts are ready
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const total = targetRows.length;
      let generatedCount = 0;
      for (let i = 0; i < total; i++) {
        if (cancelRef.current) {
          break;
        }

        const inscrito = targetRows[i];
        const nombreEstudiante = formatNombreCard(inscrito.estudiante_nombre) || inscrito.nombre || `Inscrito_${i + 1}`;
        const codigoVal = inscrito.codigo_validacion || `CIV-${String(inscrito.id_inscripcion || (i + 1)).padStart(5, '0')}-${String(curso.id_curso || '0').padStart(3, '0')}`;
        const urlVerif = `${origin}/comprobante/${encodeURIComponent(codigoVal)}`;

        setBatchCurrent(i + 1);
        setCurrentItemName(nombreEstudiante);

        // Render current participant
        setRenderingCertData({
          isMainProgram: isMainProg,
          codigo: codigoVal,
          fechaEmisionIso: inscrito.fecha_emision || (curso.fecha_fin ? `${curso.fecha_fin}T12:00:00` : new Date().toISOString()),
          titularNombre: nombreEstudiante,
          programaOCurso: curso.titulo || curso.nombre || 'CURSO',
          programaCodigo: curso.programa_codigo || 'CURSO',
          modalidad: curso.modalidad || null,
          categoria: curso.categoria || curso.nivel_academico || null,
          descripcion: curso.descripcion || null,
          instructorNombre: curso.instructor_nombre || null,
          instructorCargo: curso.instructor_cargo || null,
          urlVerificacion: urlVerif,
          vigente: Number(inscrito.completado) === 1 || inscrito.estatus === 'Inscrito' || true,
          cedula: inscrito.estudiante_cedula || inscrito.cedula || null,
          modulosLista: curso.modulos_lista || null,
          firmantes: parsedFirmantes
        });

        // Espera para actualización de estado del DOM y carga de fuentes/imágenes (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));

        const targetEl = document.querySelector('#zip-certificate-export-target #certificate-print-area') as HTMLElement;
        if (targetEl) {
          try {
            const pdfBuffer = await captureElementToPdfBuffer(targetEl);
            const rawCed = (inscrito.estudiante_cedula || inscrito.cedula || '').replace(/\D/g, '');
            const safeCed = rawCed ? `_${rawCed}` : '';
            const safeName = nombreEstudiante.replace(/[^a-zA-Z0-9_-]/g, '_');
            const filename = `Certificado_${String(i + 1).padStart(3, '0')}${safeCed}_${safeName}.pdf`;

            zip.file(filename, pdfBuffer);
            generatedCount++;
          } catch (itemErr) {
            console.error(`Error generando certificado para ${nombreEstudiante}:`, itemErr);
          }
        }
      }

      setRenderingCertData(null);

      if (generatedCount > 0 && !cancelRef.current) {
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });

        const safeCursoName = (curso.titulo || curso.nombre || 'Curso').replace(/[^a-zA-Z0-9_-]/g, '_');
        const zipFilename = `Certificados_${safeCursoName}.zip`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = zipFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        toast.success(`${generatedCount} certificados descargados`);
      } else if (generatedCount > 0 && cancelRef.current) {
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });

        const safeCursoName = (curso.titulo || curso.nombre || 'Curso').replace(/[^a-zA-Z0-9_-]/g, '_');
        const zipFilename = `Certificados_${safeCursoName}_parcial.zip`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = zipFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        showCancelToast(`Descarga parcial: ${generatedCount} certificados`);
      } else if (cancelRef.current) {
        showCancelToast('Descarga de certificados cancelada');
      } else if (generatedCount === 0 && !cancelRef.current) {
        toast.error('No se pudo generar ningún certificado');
      }
    } catch (err: any) {
      console.error('Error generando ZIP:', err);
      setRenderingCertData(null);
      toast.error(err.message || 'Ocurrió un error al compilar el archivo ZIP.');
    } finally {
      setIsDownloading(false);
      setDownloadType(null);
      setIsCanceling(false);
      setRenderingCertData(null);
      setBatchCurrent(0);
      setBatchTotal(0);
      setCurrentItemName('');
      cancelRef.current = false;
    }
  }, [isDownloading]);

  return (
    <BatchDownloadContext.Provider
      value={{
        isDownloading,
        downloadType,
        batchCurrent,
        batchTotal,
        currentItemName,
        isCanceling,
        cancelDownload,
        startBatchCarnets,
        startBatchCertificados,
      }}
    >
      {children}

      {/* ── Widget de Progreso Flotante Global (Persistente entre vistas) ── */}
      {isDownloading && (
        <div className="transition-transform fixed bottom-6 right-6 z-[130] bg-white border border-gray-200 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 min-w-[280px] slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              {downloadType === 'carnets' ? 'Descarga Masiva de Carnets' : 'Descarga Masiva de Certificados'}
            </span>
            <Loader2 className="animate-spin text-emerald-600" size={16} />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-800">
              {isCanceling ? 'Cancelando...' : `Procesando ${batchCurrent} de ${batchTotal}`}
            </div>
            {currentItemName && (
              <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider truncate max-w-[250px]">
                {currentItemName}
              </div>
            )}
          </div>
          {/* Progress Bar */}
          {batchTotal > 0 && (
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${(batchCurrent / batchTotal) * 100}%` }}
              />
            </div>
          )}
          <button
            type="button"
            disabled={isCanceling}
            onClick={cancelDownload}
            className="mt-1 text-center w-full py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Contenedor Oculto Global para Captura de Carnet en Lote ── */}
      {currentMember && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
          <CarnetCardPreview
            cardRef={bulkCardRef}
            afiliado={currentMember as any}
            useJuntaPhoto={(() => {
              const rawRedes = currentMember?.redes_sociales;
              const redes = rawRedes
                ? (typeof rawRedes === 'string' ? (() => { try { return JSON.parse(rawRedes); } catch { return {}; } })() : rawRedes)
                : {};
              return Boolean(redes?.use_junta_photo);
            })()}
            qrCodeUrl={currentMemberQrUrl}
            hideActionButtons={true}
          />
        </div>
      )}

      {/* ── Contenedor Offscreen Global para Renderizado de Certificados Oficiales ZIP ── */}
      <div
        id="zip-certificate-export-target"
        style={{
          position: 'fixed',
          left: '0px',
          top: '0px',
          width: '1000px',
          minWidth: '1000px',
          maxWidth: '1000px',
          height: '707px',
          minHeight: '707px',
          maxHeight: '707px',
          zIndex: -9999,
          opacity: 0.01,
          pointerEvents: 'none',
          backgroundColor: '#ffffff'
        }}
        aria-hidden="true"
      >
        {renderingCertData && (
          <div style={{ width: '1000px', height: '707px', backgroundColor: '#ffffff' }}>
            {renderingCertData.isMainProgram ? (
              <CertificadoProgramaView
                codigo={renderingCertData.codigo}
                fechaEmisionIso={renderingCertData.fechaEmisionIso}
                titularNombre={renderingCertData.titularNombre}
                programaOCurso={renderingCertData.programaOCurso}
                programaCodigo={renderingCertData.programaCodigo}
                urlVerificacion={renderingCertData.urlVerificacion}
                vigente={renderingCertData.vigente}
                cedula={renderingCertData.cedula}
                firmantes={renderingCertData.firmantes}
              />
            ) : (
              <CertificadoCursoView
                codigo={renderingCertData.codigo}
                fechaEmisionIso={renderingCertData.fechaEmisionIso}
                titularNombre={renderingCertData.titularNombre}
                programaOCurso={renderingCertData.programaOCurso}
                modalidad={renderingCertData.modalidad}
                categoria={renderingCertData.categoria}
                descripcion={renderingCertData.descripcion}
                instructorNombre={renderingCertData.instructorNombre}
                instructorCargo={renderingCertData.instructorCargo}
                urlVerificacion={renderingCertData.urlVerificacion}
                vigente={renderingCertData.vigente}
                cedula={renderingCertData.cedula}
                modulosLista={renderingCertData.modulosLista}
                firmantes={renderingCertData.firmantes}
              />
            )}
          </div>
        )}
      </div>
    </BatchDownloadContext.Provider>
  );
}

export function useBatchDownload() {
  const context = useContext(BatchDownloadContext);
  if (!context) {
    throw new Error('useBatchDownload debe ser utilizado dentro de un BatchDownloadProvider');
  }
  return context;
}
