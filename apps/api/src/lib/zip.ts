import { deflateRawSync, inflateRawSync } from 'node:zlib'

// ZIP mínimo de un solo archivo (el respaldo), para que cualquier Windows lo abra sin instalar nada.

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = TABLA_CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }

const fechaDos = (d: Date) => ({
  hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
  dia: (Math.max(1980, d.getFullYear()) - 1980) << 9 | ((d.getMonth() + 1) << 5) | d.getDate(),
})

export function crearZip(nombre: string, datos: Buffer, fecha = new Date()): Buffer {
  const comprimido = deflateRawSync(datos)
  const nom = Buffer.from(nombre, 'utf8')
  const { hora, dia } = fechaDos(fecha)
  const crc = crc32(datos)
  // Cabecera local
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6) // 0x0800 = nombre en UTF-8
  local.writeUInt16LE(8, 8); local.writeUInt16LE(hora, 10); local.writeUInt16LE(dia, 12)
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(comprimido.length, 18); local.writeUInt32LE(datos.length, 22); local.writeUInt16LE(nom.length, 26)
  // Directorio central
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8)
  central.writeUInt16LE(8, 10); central.writeUInt16LE(hora, 12); central.writeUInt16LE(dia, 14)
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(comprimido.length, 20); central.writeUInt32LE(datos.length, 24); central.writeUInt16LE(nom.length, 28)
  const inicioCentral = local.length + nom.length + comprimido.length
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(1, 8); fin.writeUInt16LE(1, 10)
  fin.writeUInt32LE(central.length + nom.length, 12); fin.writeUInt32LE(inicioCentral, 16)
  return Buffer.concat([local, nom, comprimido, central, nom, fin])
}

/** Extrae el primer archivo de un ZIP (almacenado o comprimido). Lanza Error si el ZIP no es válido. */
export function leerZip(zip: Buffer, maxBytes = 300 * 1024 * 1024): Buffer {
  let eocd = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65535); i--) if (zip.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('zip inválido')
  const central = zip.readUInt32LE(eocd + 16)
  if (zip.readUInt32LE(central) !== 0x02014b50) throw new Error('zip inválido')
  const metodo = zip.readUInt16LE(central + 10)
  const tamComprimido = zip.readUInt32LE(central + 20)
  const posLocal = zip.readUInt32LE(central + 42)
  if (zip.readUInt32LE(posLocal) !== 0x04034b50) throw new Error('zip inválido')
  const inicio = posLocal + 30 + zip.readUInt16LE(posLocal + 26) + zip.readUInt16LE(posLocal + 28)
  const datos = zip.subarray(inicio, inicio + tamComprimido)
  if (metodo === 0) return Buffer.from(datos)
  if (metodo === 8) return inflateRawSync(datos, { maxOutputLength: maxBytes })
  throw new Error('método de compresión no soportado')
}

export const esZip = (b: Buffer) => b.length > 4 && b.readUInt32LE(0) === 0x04034b50
