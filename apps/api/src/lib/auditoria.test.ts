import { describe, expect, it } from 'vitest'
import { accionDe, aJson, entidadDeRuta, sanitizar, tablaDeRuta } from './auditoria.js'

describe('auditoría: funciones de apoyo', () => {
  it('sanitizar quita secretos y archivos, y acota textos y listas', () => {
    const r: any = sanitizar({ nombre: 'Ana', password: '123', nuevaContrasena: 'x', token: 't', archivoBase64: 'AAAA', datos: { clave_secreta: 's', largo: 'x'.repeat(500), lista: Array.from({ length: 50 }, (_, i) => i) } })
    expect(r.nombre).toBe('Ana')
    expect([r.password, r.nuevaContrasena, r.token, r.archivoBase64, r.datos.clave_secreta]).toEqual(Array(5).fill('[omitido]'))
    expect(r.datos.largo.length).toBe(301)
    expect(r.datos.lista).toHaveLength(20)
    expect(sanitizar(Buffer.from('x'))).toBe('[archivo]')
  })
  it('aJson no guarda más de lo razonable', () => {
    expect(JSON.parse(aJson({ a: 'x'.repeat(100) })!)).toEqual({ a: 'x'.repeat(100) })
    const enorme = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`campo${i}`, 'x'.repeat(250)]))
    expect(JSON.parse(aJson(enorme)!)._truncado).toBe(true)
    expect(aJson(null)).toBeNull()
  })
  it.each([
    ['DELETE', '/api/cms/noticias/3', 'eliminar'],
    ['POST', '/api/cms/noticias', 'crear'],
    ['PUT', '/api/cms/noticias/3', 'editar'],
    ['PATCH', '/api/afiliados/9/aprobar', 'aprobar'],
    ['POST', '/api/academia/inscripciones/4/rechazar', 'rechazar'],
    ['PATCH', '/api/pagos/admin/5/verificar', 'verificar'],
    ['PUT', '/api/academia/inscripciones/4/etapa', 'cambiar_etapa'],
    ['POST', '/api/auditoria/papelera/cursos/2/restaurar', 'restaurar'],
  ])('%s %s → %s', (m, ruta, accion) => expect(accionDe(m, ruta)).toBe(accion))
  it('entidadDeRuta separa módulo, entidad e id', () => {
    expect(entidadDeRuta('/api/cms/noticias/12')).toEqual({ modulo: 'cms', entidad: 'noticias', id: '12' })
    expect(entidadDeRuta('/api/afiliados/7/aprobar')).toEqual({ modulo: 'afiliados', entidad: 'afiliados', id: '7' })
    expect(entidadDeRuta('/api/cms/noticias')).toEqual({ modulo: 'cms', entidad: 'noticias', id: null })
    expect(tablaDeRuta(entidadDeRuta('/api/cms/noticias/12'))).toEqual({ tabla: 'cms_noticias', pk: 'id_noticia' })
    expect(tablaDeRuta(entidadDeRuta('/api/afiliados/7'))).toEqual({ tabla: 'afiliados', pk: 'id_afiliado' })
    expect(tablaDeRuta(entidadDeRuta('/api/pagos/admin/7'))).toBeUndefined()
  })
})
