import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import logoUrl from '@/assets/Logo2.webp'
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

  // Excluir los que no tienen código asignado y ordenar por código de forma ascendente
  const sortedRows = rows
    .filter((row) => {
      const code = row.codigo?.trim()
      return code !== undefined && code !== null && code !== ''
    })
    .sort((a, b) => {
      const codeA = a.codigo?.trim() || ''
      const codeB = b.codigo?.trim() || ''
      
      const numA = Number(codeA)
      const numB = Number(codeB)
      
      const isNumA = !Number.isNaN(numA) && codeA !== ''
      const isNumB = !Number.isNaN(numB) && codeB !== ''
      
      if (isNumA && isNumB) {
        return numA - numB
      }
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' })
    })

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
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text('Reporte de Afiliados', margin + 38, y + 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text('Cámara Inmobiliaria de Bolívar', margin + 38, y + 18)
    
    y += 36
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text('Reporte de Afiliados', margin, y + 10)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text('Cámara Inmobiliaria de Bolívar', margin, y + 16)
    
    y += 22
  }

  const dateStr = generatedAt.toLocaleString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  doc.setFontSize(8)
  doc.text(`Generado: ${dateStr}`, pageWidth - margin, margin + 8, { align: 'right' })
  doc.text(`${sortedRows.length} registro${sortedRows.length === 1 ? '' : 's'}`, pageWidth - margin, margin + 14, {
    align: 'right',
  })

  // Resumen de filtros
  if (filterSummary && filterSummary.length > 0) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(51, 65, 85)
    doc.text('Filtros aplicados:', margin, y)
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    const filtersText = filterSummary.join(' | ')
    const lines = doc.splitTextToSize(filtersText, pageWidth - (margin * 2))
    doc.text(lines, margin, y + 4)
    y += (lines.length * 3) + 6
  } else {
    y += 4
  }

  const head = [columns.map((c) => c.label)]
  const body = sortedRows.map((row, index) =>
    columns.map((col) => {
      if (col.id === 'conteo') return String(index + 1)
      return col.getValue(row)
    })
  )

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
  })

  // Agregar el pie de página de forma diferida en todas las páginas generadas
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Página ${i} de ${totalPages} · Total: ${sortedRows.length} afiliados`,
      pageWidth / 2,
      pageH - 8,
      { align: 'center' }
    )
  }

  const filename = `reporte-afiliados-${generatedAt.toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}