import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { Loader2, OctagonXIcon } from 'lucide-react';
import { API_URL } from '@/config/env';
import { formatNombreCard } from '@/utils/formatters';
import { captureElementToPdfBuffer, captureElementToPngBuffer, captureElementToJpegDataUrl, waitForImagesToLoad } from '@/utils/domToPdf';
import logoImg from '@/assets/Logo2.webp';
import logoImg4 from '@/assets/Logo4.webp';
import logoCieboGreen from '@/assets/logo_ciebo_green.svg';
import cibirBg from '@/assets/Cibir.webp';
import firmaFranciscoImg from '@/assets/firma-francisco.webp';
import firmaGracielaImg from '@/assets/firma-graciela-ledezma.webp';
import { CarnetCardPreview } from '@/components/CarnetCardPreview';
import { drawCarnetCanvas } from '@/utils/carnetCanvasRenderer';
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
export type BatchCertFormat = 'pdf' | 'pdf_zip' | 'pdf_single' | 'png' | 'png_zip';

export interface BatchDownloadContextType {
  isDownloading: boolean;
  downloadType: BatchDownloadType;
  batchCurrent: number;
  batchTotal: number;
  currentItemName: string;
  isCanceling: boolean;
  cancelDownload: () => void;
  startBatchCarnets: (customMembers?: any[]) => Promise<void>;
  startBatchCertificados: (params: {
    curso: any;
    targetRows: any[];
    selectedOnly?: boolean;
    format?: BatchCertFormat;
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
  const [currentCertData, setCurrentCertData] = useState<any | null>(null);
  const [batchCertFormat, setBatchCertFormat] = useState<'pdf' | 'png'>('pdf');
  const bulkCertRef = useRef<HTMLDivElement>(null);

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
  const startBatchCarnets = useCallback(async (customMembers?: any[]) => {
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
      const hasCarnetPhoto = (m: any): boolean => {
        if (!m?.codigo || String(m.codigo).trim() === '') return false;
        const rawRedes = m?.redes_sociales;
        const redes = rawRedes
          ? (typeof rawRedes === 'string' ? (() => { try { return JSON.parse(rawRedes); } catch { return {}; } })() : rawRedes)
          : {};
        const useJuntaPhoto = Boolean(redes?.use_junta_photo);
        const carnetPhotoUrl = useJuntaPhoto
          ? (redes?.foto_junta_carnet_url || m?.foto_junta_url)
          : redes?.foto_carnet_url;
        const activePhoto = carnetPhotoUrl || (useJuntaPhoto && m?.foto_junta_url ? m?.foto_junta_url : m?.foto_url);
        return Boolean(activePhoto && typeof activePhoto === 'string' && activePhoto.trim() !== '');
      };

      let activeMembers: any[] = [];
      if (Array.isArray(customMembers) && customMembers.length > 0) {
        activeMembers = customMembers.filter(hasCarnetPhoto);
      } else {
        const res = await fetch(`${API_URL}/api/public/afiliados/buscar?con_foto=true&limit=1000`);
        if (!res.ok) {
          throw new Error(`Error en la solicitud (${res.status})`);
        }
        const json = await res.json();
        if (!json.success || !Array.isArray(json.data)) {
          throw new Error('No se pudo obtener el listado de afiliados.');
        }
        activeMembers = json.data.filter(hasCarnetPhoto);
      }

      if (activeMembers.length === 0) {
        toast.error('No se encontraron afiliados activos con fotografía y código.');
        setIsDownloading(false);
        setDownloadType(null);
        return;
      }

      setBatchTotal(activeMembers.length);

      const zip = new JSZip();
      let generatedCount = 0;

      // Procesamiento ultra-rápido mediante Canvas 2D
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

        try {
          const qrUrl = await QRCode.toDataURL(pUrl, {
            margin: 1,
            width: 240,
            color: { dark: '#000000', light: '#00000000' },
            errorCorrectionLevel: 'H'
          });

          setCurrentMemberQrUrl(qrUrl);

          const blob = await drawCarnetCanvas(member, qrUrl);
          const arrayBuffer = await blob.arrayBuffer();
          const filename = `carnet-${member.codigo || member.id_afiliado}.jpg`;
          zip.file(filename, arrayBuffer);
          generatedCount++;
        } catch (cardErr) {
          console.error(`Error procesando carnet de ${member.codigo}:`, cardErr);
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
        toast.success(`${generatedCount} carnets descargados con éxito.`);
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
    format = 'pdf_zip',
  }: {
    curso: any;
    targetRows: any[];
    selectedOnly?: boolean;
    format?: BatchCertFormat;
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
    setBatchCertFormat(format);
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
      const isSinglePdf = format === 'pdf_single';
      const isPng = format === 'png' || format === 'png_zip';
      const zip = !isSinglePdf ? new JSZip() : null;
      const singlePdfDoc = isSinglePdf
        ? new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
        : null;

      // Ensure browser fonts are ready
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

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

      // Preload static and custom signature images
      const promises: Promise<void>[] = [
        preloadImg(logoCieboGreen),
        preloadImg(logoImg),
        preloadImg(logoImg4),
        preloadImg(cibirBg),
        preloadImg(firmaFranciscoImg),
        preloadImg(firmaGracielaImg),
      ];
      if (parsedFirmantes && parsedFirmantes.length > 0) {
        parsedFirmantes.forEach((f) => {
          if (f.firma_url) promises.push(preloadImg(f.firma_url));
        });
      }
      await Promise.all(promises);

      // Extraer lista de módulos del curso
      let extractedModulos: string[] | string | null = null;
      if (Array.isArray(curso.modulos) && curso.modulos.length > 0) {
        extractedModulos = curso.modulos
          .map((m: any) => (typeof m === 'string' ? m : m?.nombre_modulo || m?.nombre || ''))
          .filter(Boolean);
      } else if (curso.modulos_lista) {
        extractedModulos = curso.modulos_lista;
      }

      const total = targetRows.length;
      let generatedCount = 0;
      for (let i = 0; i < total; i++) {
        if (cancelRef.current) {
          break;
        }

        const inscrito = targetRows[i];
        const rawNombre = (inscrito.estudiante_nombre || inscrito.nombre || `Inscrito_${i + 1}`).trim();
        const rawNombres = inscrito.estudiante_nombres || inscrito.nombres || null;
        const rawApellidos = inscrito.estudiante_apellidos || inscrito.apellidos || null;
        const nombreEstudiante = rawNombre;
        const codigoVal = inscrito.codigo_validacion || `CIV-${String(inscrito.id_inscripcion || (i + 1)).padStart(5, '0')}-${String(curso.id_curso || '0').padStart(3, '0')}`;
        const urlVerif = `${origin}/comprobante/${encodeURIComponent(codigoVal)}`;

        setBatchCurrent(i + 1);
        setCurrentItemName(formatNombreCard(rawNombres || rawNombre, rawApellidos) || nombreEstudiante);

        // Pre-generate QR code data URL
        let qrDataUrl = '';
        try {
          qrDataUrl = await QRCode.toDataURL(urlVerif, {
            margin: 1,
            width: 250,
            color: { dark: '#000000', light: '#ffffff' }
          });
        } catch {}

        // Update current certificate data
        setCurrentCertData({
          isMainProgram: isMainProg,
          codigo: codigoVal,
          fechaEmisionIso: inscrito.fecha_emision || (curso.fecha_fin ? `${curso.fecha_fin}T12:00:00` : new Date().toISOString()),
          titularNombre: nombreEstudiante,
          titularNombres: rawNombres,
          titularApellidos: rawApellidos,
          programaOCurso: curso.titulo || curso.nombre || 'CURSO',
          programaCodigo: curso.programa_codigo || 'CURSO',
          modalidad: curso.modalidad || null,
          categoria: curso.categoria || curso.nivel_academico || null,
          descripcion: curso.descripcion || null,
          instructorNombre: curso.instructor_nombre || null,
          instructorCargo: curso.instructor_cargo || null,
          urlVerificacion: urlVerif,
          qrDataUrl,
          vigente: Number(inscrito.completado) === 1 || inscrito.estatus === 'Inscrito' || true,
          cedula: inscrito.estudiante_cedula || inscrito.cedula || null,
          modulosLista: extractedModulos,
          firmantes: parsedFirmantes
        });

        // Espera para que React pinte el nodo y decodifique imágenes (más tiempo en el primer certificado)
        await new Promise((resolve) => setTimeout(resolve, i === 0 ? 250 : 100));

        if (bulkCertRef.current) {
          try {
            const targetEl = (bulkCertRef.current.querySelector('#certificate-print-area') || bulkCertRef.current) as HTMLElement;
            await waitForImagesToLoad(targetEl);

            const rawCed = (inscrito.estudiante_cedula || inscrito.cedula || '').replace(/\D/g, '');
            const safeCed = rawCed ? `_${rawCed}` : '';
            const safeName = nombreEstudiante.replace(/[^a-zA-Z0-9_-]/g, '_');

            if (isPng) {
              const pngBuffer = await captureElementToPngBuffer(targetEl);
              const filename = `Certificado_${String(i + 1).padStart(3, '0')}${safeCed}_${safeName}.png`;
              zip?.file(filename, pngBuffer, { binary: true });
            } else if (isSinglePdf && singlePdfDoc) {
              const dataUrl = await captureElementToJpegDataUrl(targetEl);
              if (generatedCount > 0) {
                singlePdfDoc.addPage('a4', 'landscape');
              }
              singlePdfDoc.addImage(dataUrl, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
            } else {
              const pdfBuffer = await captureElementToPdfBuffer(targetEl);
              const filename = `Certificado_${String(i + 1).padStart(3, '0')}${safeCed}_${safeName}.pdf`;
              zip?.file(filename, pdfBuffer, { binary: true });
            }
            generatedCount++;
          } catch (itemErr) {
            console.error(`Error generando certificado para ${nombreEstudiante}:`, itemErr);
          }
        }

        // Breve pausa para no bloquear la UI y permitir que la barra de progreso se refresque suavemente
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      if (generatedCount > 0 && !cancelRef.current) {
        const safeCursoName = (curso.titulo || curso.nombre || 'Curso').replace(/[^a-zA-Z0-9_-]/g, '_');

        if (isSinglePdf && singlePdfDoc) {
          const pdfFilename = `Certificados_Unificados_${safeCursoName}.pdf`;
          singlePdfDoc.save(pdfFilename);
          toast.success(`${generatedCount} certificados descargados exitosamente en un único documento PDF`);
        } else if (zip) {
          const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 4 }
          });

          const formatSuffix = isPng ? '_PNG' : '_PDF';
          const zipFilename = `Certificados_${safeCursoName}${formatSuffix}.zip`;

          const link = document.createElement('a');
          link.href = URL.createObjectURL(zipBlob);
          link.download = zipFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);

          const formatLabel = isPng ? 'en PNG (Alta Calidad)' : 'en PDFs individuales';
          toast.success(`${generatedCount} certificados descargados exitosamente ${formatLabel}`);
        }
      } else if (generatedCount > 0 && cancelRef.current) {
        const safeCursoName = (curso.titulo || curso.nombre || 'Curso').replace(/[^a-zA-Z0-9_-]/g, '_');

        if (isSinglePdf && singlePdfDoc) {
          const pdfFilename = `Certificados_Unificados_${safeCursoName}_parcial.pdf`;
          singlePdfDoc.save(pdfFilename);
          showCancelToast(`Descarga parcial: ${generatedCount} certificados en un único PDF`);
        } else if (zip) {
          const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 4 }
          });

          const formatSuffix = isPng ? '_PNG' : '_PDF';
          const zipFilename = `Certificados_${safeCursoName}${formatSuffix}_parcial.zip`;

          const link = document.createElement('a');
          link.href = URL.createObjectURL(zipBlob);
          link.download = zipFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);

          showCancelToast(`Descarga parcial: ${generatedCount} certificados`);
        }
      } else if (cancelRef.current) {
        showCancelToast('Descarga de certificados cancelada');
      } else if (generatedCount === 0 && !cancelRef.current) {
        toast.error('No se pudo generar ningún certificado');
      }
    } catch (err: any) {
      console.error('Error generando certificados:', err);
      toast.error(err.message || 'Ocurrió un error al compilar los certificados.');
    } finally {
      setIsDownloading(false);
      setDownloadType(null);
      setIsCanceling(false);
      setCurrentCertData(null);
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
              {downloadType === 'carnets'
                ? 'Descarga Masiva de Carnets'
                : batchCertFormat === 'pdf_single'
                ? 'Generando PDF Unificado (1 Documento)'
                : batchCertFormat === 'png' || batchCertFormat === 'png_zip'
                ? 'Certificados PNG (Impresión 300 DPI)'
                : 'Descarga de Certificados (PDFs en ZIP)'}
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

      {/* ── Contenedor Oculto Global para Captura de Certificados en Lote ── */}
      {currentCertData && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
          <div
            ref={bulkCertRef}
            style={{
              width: '1000px',
              height: '707px',
              minWidth: '1000px',
              minHeight: '707px',
              maxWidth: '1000px',
              maxHeight: '707px',
              backgroundColor: '#ffffff',
              overflow: 'hidden',
            }}
          >
            {currentCertData.isMainProgram ? (
              <CertificadoProgramaView
                codigo={currentCertData.codigo}
                fechaEmisionIso={currentCertData.fechaEmisionIso}
                titularNombre={currentCertData.titularNombre}
                titularNombres={currentCertData.titularNombres}
                titularApellidos={currentCertData.titularApellidos}
                programaOCurso={currentCertData.programaOCurso}
                programaCodigo={currentCertData.programaCodigo}
                urlVerificacion={currentCertData.urlVerificacion}
                qrDataUrl={currentCertData.qrDataUrl}
                vigente={currentCertData.vigente}
                cedula={currentCertData.cedula}
                firmantes={currentCertData.firmantes}
              />
            ) : (
              <CertificadoCursoView
                codigo={currentCertData.codigo}
                fechaEmisionIso={currentCertData.fechaEmisionIso}
                titularNombre={currentCertData.titularNombre}
                titularNombres={currentCertData.titularNombres}
                titularApellidos={currentCertData.titularApellidos}
                programaOCurso={currentCertData.programaOCurso}
                modalidad={currentCertData.modalidad}
                categoria={currentCertData.categoria}
                descripcion={currentCertData.descripcion}
                instructorNombre={currentCertData.instructorNombre}
                instructorCargo={currentCertData.instructorCargo}
                urlVerificacion={currentCertData.urlVerificacion}
                qrDataUrl={currentCertData.qrDataUrl}
                vigente={currentCertData.vigente}
                cedula={currentCertData.cedula}
                modulosLista={currentCertData.modulosLista}
                firmantes={currentCertData.firmantes}
              />
            )}
          </div>
        </div>
      )}
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
