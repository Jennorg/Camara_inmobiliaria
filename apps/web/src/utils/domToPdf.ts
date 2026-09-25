import { toJpeg, toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getCertificateFontEmbedCSS } from '@/utils/certificateFonts';

/**
 * Uses a 1×1 canvas to resolve any CSS color (including oklch) to an rgb() string.
 * html2canvas has its own CSS parser that does NOT support oklch; this pre-converts them.
 */
function resolveColorViaCanvas(colorStr: string): string {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = colorStr;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a < 255
      ? `rgba(${r},${g},${b},${+(a / 255).toFixed(3)})`
      : `rgb(${r},${g},${b})`;
  } catch {
    return '#000000';
  }
}

/**
 * Patches every oklch() token in <style> tags of a cloned document so html2canvas
 * can parse them. Safe to call inside html2canvas's `onclone` callback.
 */
function patchOklchInClone(doc: Document): void {
  const styleEls = Array.from(doc.querySelectorAll<HTMLStyleElement>('style'));
  for (const el of styleEls) {
    const css = el.textContent || '';
    if (!css.includes('oklch')) continue;
    el.textContent = css.replace(/oklch\([^)]+\)/g, resolveColorViaCanvas);
  }
}

/**
 * Ensures all <img> tags inside an element are fully loaded and decoded in memory
 * before triggering capture.
 */
export async function waitForImagesToLoad(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) {
        return;
      }
      try {
        if ('decode' in img) {
          await img.decode();
        } else {
          await new Promise((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
          });
        }
      } catch {
        // Ignorar si decode falla
      }
    })
  );
}

/**
 * Prepares the live DOM element by un-scaling it and removing parent clipping
 * while capturing, returning a restore function.
 */
function prepareElementForCapture(element: HTMLElement): () => void {
  const originalTransform = element.style.transform;
  const originalTransformOrigin = element.style.transformOrigin;
  const originalBoxShadow = element.style.boxShadow;
  const originalBorderRadius = element.style.borderRadius;

  const parent = element.parentElement;
  const originalParentHeight = parent ? parent.style.height : '';
  const originalParentOverflow = parent ? parent.style.overflow : '';
  const originalParentWidth = parent ? parent.style.width : '';

  if (parent) {
    parent.style.height = '707px';
    parent.style.overflow = 'visible';
    parent.style.width = '1000px';
  }

  element.style.transform = 'none';
  element.style.transformOrigin = 'top left';
  element.style.boxShadow = 'none';
  element.style.borderRadius = '0px';

  return () => {
    element.style.transform = originalTransform;
    element.style.transformOrigin = originalTransformOrigin;
    element.style.boxShadow = originalBoxShadow;
    element.style.borderRadius = originalBorderRadius;
    if (parent) {
      parent.style.height = originalParentHeight;
      parent.style.overflow = originalParentOverflow;
      parent.style.width = originalParentWidth;
    }
  };
}

/**
 * Captures any certificate element into a pixel-perfect, High-Definition (3000 × 2121 px at 300 DPI)
 * PDF matching the exact distribution on screen.
 */
export async function exportElementToPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Elemento con ID #${elementId} no encontrado.`);
  }

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  await waitForImagesToLoad(element);
  const restore = prepareElementForCapture(element);

  try {
    const fontEmbedCSS = await getCertificateFontEmbedCSS();
    let dataUrl = '';
    try {
      dataUrl = await toJpeg(element, {
        quality: 0.98,
        pixelRatio: 3.0,
        width: 1000,
        height: 707,
        cacheBust: false,
        backgroundColor: '#ffffff',
        fontEmbedCSS,
        style: { opacity: '1', transform: 'none', borderRadius: '0px', margin: '0px', width: '1000px', height: '707px' },
      });
    } catch (errToJpeg) {
      console.warn('toJpeg failed, falling back to html2canvas:', errToJpeg);
      const canvas = await html2canvas(element, {
        scale: 3.0,
        width: 1000,
        height: 707,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc: Document) => patchOklchInClone(clonedDoc),
      });
      dataUrl = canvas.toDataURL('image/jpeg', 0.98);
    }

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
    pdf.save(filename);
  } finally {
    restore();
  }
}

/**
 * Captures any certificate element into a lossless, Ultra-HD (3000 × 2121 px at 300 DPI) PNG
 * with 100% fidelity to the visual layout.
 */
export async function exportElementToPng(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Elemento con ID #${elementId} no encontrado.`);
  }

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  await waitForImagesToLoad(element);
  const restore = prepareElementForCapture(element);

  try {
    const fontEmbedCSS = await getCertificateFontEmbedCSS();
    let dataUrl = '';
    try {
      dataUrl = await toPng(element, {
        pixelRatio: 3.0,
        width: 1000,
        height: 707,
        cacheBust: false,
        backgroundColor: '#ffffff',
        fontEmbedCSS,
        style: { opacity: '1', transform: 'none', borderRadius: '0px', margin: '0px', width: '1000px', height: '707px' },
      });
    } catch (errToPng) {
      console.warn('toPng failed, falling back to html2canvas:', errToPng);
      const canvas = await html2canvas(element, {
        scale: 3.0,
        width: 1000,
        height: 707,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc: Document) => patchOklchInClone(clonedDoc),
      });
      dataUrl = canvas.toDataURL('image/png');
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }

    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new Error('No se pudo generar la imagen PNG del certificado.');
    }

    const downloadName = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    restore();
  }
}

/**
 * Captures an HTML element into a high-quality JPEG DataURL string in High Definition.
 */
export async function captureElementToJpegDataUrl(element: HTMLElement): Promise<string> {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  await waitForImagesToLoad(element);
  const restore = prepareElementForCapture(element);

  try {
    const fontEmbedCSS = await getCertificateFontEmbedCSS();
    let dataUrl = '';
    try {
      dataUrl = await toJpeg(element, {
        quality: 0.98,
        pixelRatio: 3.0,
        width: 1000,
        height: 707,
        cacheBust: false,
        backgroundColor: '#ffffff',
        fontEmbedCSS,
        style: { opacity: '1', transform: 'none', borderRadius: '0px', margin: '0px', width: '1000px', height: '707px' },
      });
    } catch (errToJpeg) {
      console.warn('[DataURL] toJpeg failed, falling back to html2canvas:', errToJpeg);
      const canvas = await html2canvas(element, {
        scale: 3.0,
        width: 1000,
        height: 707,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc: Document) => patchOklchInClone(clonedDoc),
      });
      dataUrl = canvas.toDataURL('image/jpeg', 0.98);
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }

    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new Error('No se pudo generar la imagen del certificado.');
    }

    return dataUrl;
  } finally {
    restore();
  }
}

/**
 * Captures an HTML element into an in-memory PDF ArrayBuffer (used for ZIP generation).
 */
export async function captureElementToPdfBuffer(element: HTMLElement): Promise<ArrayBuffer> {
  const dataUrl = await captureElementToJpegDataUrl(element);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.addImage(dataUrl, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
  return pdf.output('arraybuffer');
}

/**
 * Captures an HTML element into an in-memory PNG ArrayBuffer (used for ZIP generation).
 */
export async function captureElementToPngBuffer(element: HTMLElement): Promise<ArrayBuffer> {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  await waitForImagesToLoad(element);
  const restore = prepareElementForCapture(element);

  try {
    const fontEmbedCSS = await getCertificateFontEmbedCSS();
    let dataUrl = '';
    try {
      dataUrl = await toPng(element, {
        pixelRatio: 3.0,
        width: 1000,
        height: 707,
        cacheBust: false,
        backgroundColor: '#ffffff',
        fontEmbedCSS,
        style: { opacity: '1', transform: 'none', borderRadius: '0px', margin: '0px', width: '1000px', height: '707px' },
      });
    } catch (errToPng) {
      console.warn('[ZIP] toPng failed, falling back to html2canvas:', errToPng);
      const canvas = await html2canvas(element, {
        scale: 3.0,
        width: 1000,
        height: 707,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc: Document) => patchOklchInClone(clonedDoc),
      });
      dataUrl = canvas.toDataURL('image/png');
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }

    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new Error('No se pudo generar la imagen PNG del certificado.');
    }

    const base64Data = dataUrl.split(',')[1];
    const binaryStr = atob(base64Data);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    dataUrl = '';
    return bytes.buffer;
  } finally {
    restore();
  }
}
