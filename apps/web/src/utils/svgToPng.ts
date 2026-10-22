/**
 * Rasteriza un SVG a PNG (data URL) con el tamaño indicado, para incrustarlo en un PDF generado con jsPDF,
 * que no dibuja SVG. Se pide más resolución de la necesaria para que no se vea pixelado al imprimir.
 */
export async function svgToPngDataUrl(url: string, ancho: number, alto: number): Promise<string> {
  const img = new Image()
  img.src = url
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  canvas.getContext('2d')!.drawImage(img, 0, 0, ancho, alto)
  return canvas.toDataURL('image/png')
}
