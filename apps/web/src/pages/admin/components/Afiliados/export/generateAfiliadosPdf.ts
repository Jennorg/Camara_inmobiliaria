import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import logoUrl from '@/assets/Logo2.png'
import { AfiliadoDTO } from '@/types/afiliados'
import {
  AFILIADOS_EXPORT_COLUMNS,
  ExportColumnId,
} from './afiliadosExportColumns'

const HEADER_COLOR: [number, number, number] = [4, 120, 87]
const ALT_ROW: [number, number, number] = [248, 250, 252]

function loadLogoDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2d no disponible'))
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error(`No se pudo cargar imagen: ${src.slice(0, 60)}`))
    img.src = src
  })
}

export interface GenerateAfiliadosPdfOptions {
  rows: AfiliadoDTO[]
  columnIds: ExportColumnId[]
  filterSummary: string[]
  generatedAt?: Date
}

export async function generateAfiliadosPdf({
  rows,
  columnIds,
  filterSummary,
  generatedAt = new Date(),
}: GenerateAfiliadosPdfOptions): Promise<void> {
  const columns = AFILIADOS_EXPORT_COLUMNS.filter((c) => columnIds.includes(c.id))
  if (columns.length === 0) return

  const landscape = columns.length > 4
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14

  let logoBase64: string | null = null
  try {
    logoBase64 = await loadLogoDataUrl(String(logoUrl))
  } catch {
    logoBase64 = null
  }

  let y = margin

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, y, 32, 32)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text('Reporte de Afiliados', logoBase64 ? margin + 38 : margin, y + 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text('Cámara Inmobiliaria de Bolívar', logoBase64 ? margin + 38 : margin, y + 16)

  const dateStr = generatedAt.toLocaleString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  doc.setFontSize(8)
  doc.text(`Generado: ${dateStr}`, pageWidth - margin, y + 8, { align: 'right' })
  doc.text(`${rows.length} registro${rows.length === 1 ? '' : 's'}`, pageWidth - margin, y + 14, {
    align: 'right',
  })

  y += 32

  const head = [columns.map((c) => c.label)]
  const body = rows.map((row) => columns.map((col) => col.getValue(row)))

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: margin, right: margin },
    styles: {
      font: 'helvetica',
      fontSize: landscape ? 7.5 : 8,
      cellPadding: 2.5,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: ALT_ROW,
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages()
      const pageH = doc.internal.pageSize.getHeight()
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.text(
        `Página ${data.pageNumber} de ${pageCount} · Total: ${rows.length} afiliados`,
        pageWidth / 2,
        pageH - 8,
        { align: 'center' }
      )
    },
  })

  const filename = `reporte-afiliados-${generatedAt.toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}