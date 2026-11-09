import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { crearZip, esZip, leerZip } from './zip.js'
import { empaquetar, leerRespaldo, VERSION_RESPALDO } from './respaldo.js'

// ZIP creado con Python (zipfile, deflate): prueba que se lee lo que genera otra herramienta, p. ej. si alguien lo vuelve a comprimir
const ZIP_EXTERNO = 'UEsDBBQAAAAIAMSSaF0wcc/1GAAAABYAAAAQAAAAb3Ryby1ub21icmUuanNvbqtWysjPSVSyUlA6vDExL+XwLoXDC5VqAVBLAQIUAxQAAAAIAMSSaF0wcc/1GAAAABYAAAAQAAAAAAAAAAAAAACAAQAAAABvdHJvLW5vbWJyZS5qc29uUEsFBgAAAAABAAEAPgAAAEYAAAAAAA=='

describe('zip', () => {
  it('ida y vuelta, con tildes y un tamaño que no cabe en un bloque', () => {
    const datos = Buffer.from('ñandú á '.repeat(50_000))
    const zip = crearZip('x.json', datos)
    expect(esZip(zip)).toBe(true)
    expect(leerZip(zip).equals(datos)).toBe(true)
    expect(zip.length).toBeLessThan(datos.length)
  })
  it('lee un ZIP creado por otra herramienta', () => {
    expect(JSON.parse(leerZip(Buffer.from(ZIP_EXTERNO, 'base64')).toString())).toEqual({ hola: 'ñandú á' })
  })
  it('rechaza un ZIP truncado', () => {
    expect(() => leerZip(crearZip('x.json', Buffer.from('abc')).subarray(0, 40))).toThrow()
  })
})

describe('formatos de respaldo aceptados', () => {
  const r = { version: VERSION_RESPALDO, generado_en: '2026-11-08T12:00:00.000Z', tablas: { t: { columnas: ['a'], filas: [[1]] } }, checksum: '' }
  r.checksum = createHash('sha256').update(JSON.stringify(r.tablas)).digest('hex')
  it('.zip (actual), .json.gz (anterior) y JSON plano', () => {
    expect(leerRespaldo(empaquetar(r)).tablas.t.filas).toEqual([[1]])
    expect(leerRespaldo(gzipSync(Buffer.from(JSON.stringify(r)))).tablas.t.filas).toEqual([[1]])
    expect(leerRespaldo(Buffer.from(JSON.stringify(r))).tablas.t.filas).toEqual([[1]])
  })
})
