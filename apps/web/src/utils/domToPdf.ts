import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
 * Captures any HTML/SVG element (e.g. #certificate-print-area) into a pixel-perfect
 * high-resolution PDF matching the exact visual preview on screen.
 * Powered by html-to-image (native browser rendering). Falls back to html2canvas.
 */
export async function exportElementToPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Elemento con ID #${elementId} no encontrado.`);
  }

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const originalTransform = element.style.transform;
  const originalTransformOrigin = element.style.transformOrigin;
  element.style.transform = 'none';
  element.style.transformOrigin = 'top center';

  try {
    let dataUrl = '';
    try {
      dataUrl = await toPng(element, {
        quality: 0.98,
        pixelRatio: 2,
        cacheBust: false,
        backgroundColor: '#ffffff',
        skipFonts: false,
        style: { opacity: '1', transform: 'none' },
      });
    } catch {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc: Document) => patchOklchInClone(clonedDoc),
      });
      dataUrl = canvas.toDataURL('image/png', 0.98);
    }

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.addImage(dataUrl, 'PNG', 0, 0, 297, 210);
    pdf.save(filename);
  } finally {
    element.style.transform = originalTransform;
    element.style.transformOrigin = originalTransformOrigin;
  }
}

/**
 * Captures an HTML element into an in-memory PDF ArrayBuffer (used for ZIP generation).
 */
export async function captureElementToPdfBuffer(element: HTMLElement): Promise<ArrayBuffer> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const originalTransform = element.style.transform;
  const originalTransformOrigin = element.style.transformOrigin;
  element.style.transform = 'none';
  element.style.transformOrigin = 'top center';

  try {
    let dataUrl = '';
    try {
      dataUrl = await toPng(element, {
        quality: 0.98,
        pixelRatio: 2,
        cacheBust: false,
        backgroundColor: '#ffffff',
        skipFonts: false,
        // Override any inherited parent opacity (offscreen container is opacity 0.01)
        style: { opacity: '1', transform: 'none' },
        width: 1000,
        height: 707,
      });
    } catch (errToPng) {
      console.warn('[ZIP] toPng failed, trying html2canvas:', errToPng);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        // Fix Tailwind oklch() colors that html2canvas cannot parse
        onclone: (clonedDoc: Document) => patchOklchInClone(clonedDoc),
      });
      dataUrl = canvas.toDataURL('image/png', 0.98);
    }

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.addImage(dataUrl, 'PNG', 0, 0, 297, 210);
    return pdf.output('arraybuffer');
  } finally {
    element.style.transform = originalTransform;
    element.style.transformOrigin = originalTransformOrigin;
  }
}
