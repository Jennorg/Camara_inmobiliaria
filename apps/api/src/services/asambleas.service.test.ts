import { createClient } from '@libsql/client'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))

const svc = await import('./asambleas.service.js')

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE personas (id INTEGER PRIMARY KEY, nombres TEXT, apellidos TEXT, cedula TEXT, cedula_tipo TEXT)`,
    `CREATE TABLE empresas (id_empresa INTEGER PRIMARY KEY, razon_social TEXT, rif_numero TEXT)`,
    `CREATE TABLE afiliados (id_afiliado INTEGER PRIMARY KEY, id_persona INTEGER, id_empresa INTEGER, codigo TEXT, estatus TEXT, eliminado_en TEXT)`,
    `INSERT INTO personas VALUES (1,'Ana','Pérez','111','V'),(2,'Luis','Gómez','222','V'),(3,'Eva','Soto','333','V'),(4,'Ramón','Díaz','444','V')`,
    `INSERT INTO afiliados VALUES (1,1,NULL,'A1','Afiliado',NULL),(2,2,NULL,'A2','Afiliado',NULL),(3,3,NULL,'A3','Afiliado',NULL),(4,4,NULL,'A4','Moroso',NULL)`,
  ], 'write')
})

describe('asambleas: quórum y asistencia', () => {
  it('toma como total de miembros a los afiliados activos y calcula el quórum con presentes y representados', async () => {
    const id = await svc.crearAsamblea({ tipo: 'Extraordinaria', titulo: 'Reforma de estatutos', fecha: '2026-11-01', quorum_pct: 50 }, 1)
    expect((await svc.obtenerAsamblea(id)).total_miembros).toBe(3) // el moroso no cuenta
    await svc.registrarAsistencia(id, { id_afiliado: 1 })
    expect((await svc.obtenerAsamblea(id)).quorum_alcanzado).toBe(false) // 1 de 2 requeridos
    await svc.registrarAsistencia(id, { id_afiliado: 2, condicion: 'Representado', representante: 'Ana Pérez' })
    const a = await svc.obtenerAsamblea(id)
    expect([a.asistentes, a.quorum_requeridos, a.quorum_alcanzado]).toEqual([2, 2, true])
  })

  it('valida los datos y rechaza representados sin representante', async () => {
    await expect(svc.crearAsamblea({ tipo: 'Otra', titulo: 'x', fecha: '2026-01-01' }, 1)).rejects.toMatchObject({ status: 400 })
    await expect(svc.crearAsamblea({ tipo: 'Ordinaria', titulo: 'x', fecha: '01/01/2026' }, 1)).rejects.toMatchObject({ status: 400 })
    const id = await svc.crearAsamblea({ tipo: 'Ordinaria', titulo: 'Anual', fecha: '2026-03-01' }, 1)
    await expect(svc.registrarAsistencia(id, { id_afiliado: 1, condicion: 'Representado' })).rejects.toMatchObject({ status: 400 })
  })

  it('solo publica en el sitio las actas marcadas como publicadas y con PDF', async () => {
    const a = await svc.crearAsamblea({ tipo: 'Ordinaria', titulo: 'Publicada', fecha: '2026-04-01', url_acta: 'https://x.test/a.pdf', publicada: true, numero_acta: '7' }, 1)
    await svc.crearAsamblea({ tipo: 'Ordinaria', titulo: 'Borrador', fecha: '2026-04-02', url_acta: 'https://x.test/b.pdf' }, 1)
    const pub = await svc.actasPublicadas()
    expect(pub.map(p => p.id_normativa)).toEqual([`asamblea-${a}`])
    expect(pub[0].titulo).toContain('Acta N° 7')
  })

  it('busca afiliados por nombre, cédula o código y deja fuera a los no activos', async () => {
    expect((await svc.buscarAfiliados('ana')).map((x: any) => x.codigo)).toEqual(['A1'])
    expect((await svc.buscarAfiliados('V-222')).map((x: any) => x.codigo)).toEqual(['A2'])
    expect(await svc.buscarAfiliados('ramón')).toEqual([])
  })
})
