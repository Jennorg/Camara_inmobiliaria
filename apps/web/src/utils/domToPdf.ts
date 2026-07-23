import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

/**
 * Captures any HTML/SVG element (e.g. #certificate-print-area) into a 100% pixel-perfect
 * high-resolution PDF matching the exact visual preview on screen.
 * Powered by html-to-image (uses native browser rendering engine).
 */
export async function exportElementToPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Elemento con ID #${elementId} no encontrado.`);
  }

  // Ensure fonts are loaded before capture
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Temporarily reset CSS scale transforms for 1:1 capture
  const originalTransform = element.style.transform;
  const originalTransformOrigin = element.style.transformOrigin;

  element.style.transform = 'none';
  element.style.transformOrigin = 'top center';

  try {
    const dataUrl = await toPng(element, {
      quality: 0.98,
      pixelRatio: 2, // 2x DPI for ultra crisp quality
      cacheBust: true,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, 297, 210);
    pdf.save(filename);
  } finally {
    element.style.transform = originalTransform;
    element.style.transformOrigin = originalTransformOrigin;
  }
}
