import type jsPDF from 'jspdf'
import logoSvg from '@/assets/logo.svg'
import { svgToPngDataUrl } from '@/utils/svgToPng'

/**
 * Encabezado verde de los reportes en PDF de Finanzas: logo a la izquierda, nombre de la Cámara con el título del
 * reporte y, debajo, el RIF, el detalle (período, año…) y la fecha de emisión. Sin logo, el texto parte del margen.
 */
export async function dibujarEncabezadoPdf(doc: jsPDF, titulo: string, detalle: string): Promise<void> {
  doc.setFillColor(6, 78, 59)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 24, 'F')

  // Proporción 630×370 del SVG
  const altoLogo = 18
  const anchoLogo = altoLogo * (630 / 370)
  let xTexto = 14
  try {
    doc.addImage(await svgToPngDataUrl(logoSvg, 1260, 740), 'PNG', 6, 3, anchoLogo, altoLogo)
    xTexto = 6 + anchoLogo + 6
  } catch {
    // El PDF se genera igual sin el logo
  }

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`CÁMARA INMOBILIARIA DEL ESTADO BOLÍVAR — ${titulo}`, xTexto, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`RIF: J-30456789-0 · ${detalle} · Emitido: ${new Date().toLocaleDateString('es-VE')}`, xTexto, 18)
}
