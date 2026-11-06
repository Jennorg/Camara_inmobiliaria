import { createClient } from '@libsql/client'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))

const { puedePermiso, invalidarCachePermisos } = await import('../services/permisos.service.js')
const { getAfiliadoById, updateAfiliado, cambiarAccesoEmail, convertirAgenteANatural, listarAfiliadosCorporativos } = await import('./afiliados.controller.js')
const { puedeAccederAfiliado } = await import('../middlewares/auth.middleware.js')

const res = () => {
  const r: any = { statusCode: 200 }
  r.status = (c: number) => { r.statusCode = c; return r }
  r.json = (b: any) => { r.body = b; return r }
  return r
}
const user = (roles: string[]) => ({ id: 9, email: 'u@x', roles, rol: roles[0], id_afiliado: 1 }) as any
const llamar = async (fn: any, roles: string[], extra: any = {}) => {
  const r = res()
  await fn({ user: user(roles), params: { id: '77' }, body: {}, ...extra }, r)
  return r
}

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE roles (id INTEGER PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, es_sistema INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT)`,
    `CREATE TABLE rol_permisos (id_rol INTEGER NOT NULL, seccion TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 0, crear INTEGER NOT NULL DEFAULT 0, editar INTEGER NOT NULL DEFAULT 0, eliminar INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id_rol, seccion))`,
    `INSERT INTO roles (clave, nombre) VALUES ('solo_ver', 'v'), ('con_editar', 'e'), ('sin_nada', 'n'), ('afi_ver', 'av'), ('afi_editar', 'ae')`,
    `INSERT INTO rol_permisos SELECT id, 'afiliados', 1, 0, 0, 0 FROM roles WHERE clave='solo_ver'`,
    `INSERT INTO rol_permisos SELECT id, 'afiliados', 1, 0, 1, 0 FROM roles WHERE clave='con_editar'`,
    `INSERT INTO rol_permisos SELECT id, 'afiliaciones', 1, 0, 0, 0 FROM roles WHERE clave='afi_ver'`,
    `INSERT INTO rol_permisos SELECT id, 'afiliaciones', 1, 0, 1, 0 FROM roles WHERE clave='afi_editar'`,
  ], 'write')
})

describe('puedePermiso', () => {
  it('super_admin siempre; rol personalizado según casilla; desconocido y vacío no', async () => {
    expect(await puedePermiso(user(['super_admin']), 'afiliados', 'eliminar')).toBe(true)
    expect(await puedePermiso(user(['solo_ver']), 'afiliados', 'ver')).toBe(true)
    expect(await puedePermiso(user(['solo_ver']), 'afiliados', 'editar')).toBe(false)
    expect(await puedePermiso(user(['con_editar']), 'afiliados', 'editar')).toBe(true)
    expect(await puedePermiso(user(['con_editar']), 'finanzas', 'ver')).toBe(false)
    expect(await puedePermiso(user(['rol_fantasma']), 'afiliados', 'ver')).toBe(false)
    expect(await puedePermiso({ roles: [] }, 'afiliados', 'ver')).toBe(false)
  })
  it('error de BD → false', async () => {
    invalidarCachePermisos()
    const spy = vi.spyOn(mem, 'execute').mockRejectedValueOnce(new Error('boom'))
    expect(await puedePermiso(user(['con_editar']), 'afiliados', 'editar')).toBe(false)
    spy.mockRestore()
    invalidarCachePermisos()
  })
})

// Sin permiso (y sin ser el dueño del registro) → 403 antes de tocar tablas de afiliados.
describe('controladores de afiliados aceptan permisos por sección', () => {
  it('getAfiliadoById: sin ver → 403', async () => {
    expect((await llamar(getAfiliadoById, ['sin_nada'])).statusCode).toBe(403)
  })
  it('getAfiliadoById: con ver pasa el control (falla después, sin tablas)', async () => {
    expect((await llamar(getAfiliadoById, ['solo_ver'])).statusCode).not.toBe(403)
  })
  it('updateAfiliado: solo ver → 403; con editar pasa el control', async () => {
    expect((await llamar(updateAfiliado, ['solo_ver'])).statusCode).toBe(403)
    expect((await llamar(updateAfiliado, ['con_editar'])).statusCode).not.toBe(403)
  })
  it('cambiarAccesoEmail y convertirAgenteANatural: solo ver → 403; con editar pasa', async () => {
    for (const fn of [cambiarAccesoEmail, convertirAgenteANatural]) {
      expect((await llamar(fn, ['solo_ver'], { body: { tipo: 'personal' } })).statusCode).toBe(403)
      expect((await llamar(fn, ['con_editar'], { body: { tipo: 'personal' } })).statusCode).not.toBe(403)
    }
  })
  it('el dueño del registro sigue pasando sin permisos', async () => {
    expect((await llamar(updateAfiliado, ['afiliado'], { params: { id: '1' } })).statusCode).not.toBe(403)
  })
})

// La sección «afiliaciones» (proceso de afiliación) abre los mismos controles que «afiliados» con la misma acción.
describe('controladores de afiliados aceptan también la sección afiliaciones', () => {
  it('getAfiliadoById: afiliaciones/ver pasa el control', async () => {
    expect((await llamar(getAfiliadoById, ['afi_ver'])).statusCode).not.toBe(403)
  })
  it('updateAfiliado, cambiarAccesoEmail, convertirAgenteANatural: afiliaciones solo ver → 403; con editar pasa', async () => {
    for (const fn of [updateAfiliado, cambiarAccesoEmail, convertirAgenteANatural]) {
      expect((await llamar(fn, ['afi_ver'], { body: { tipo: 'personal' } })).statusCode).toBe(403)
      expect((await llamar(fn, ['afi_editar'], { body: { tipo: 'personal' } })).statusCode).not.toBe(403)
    }
  })
  it('canManageEmpresa (listarAfiliadosCorporativos): afiliaciones/editar pasa; sin permiso → 403', async () => {
    expect((await llamar(listarAfiliadosCorporativos, ['afi_editar'])).statusCode).not.toBe(403)
    expect((await llamar(listarAfiliadosCorporativos, ['con_editar'])).statusCode).not.toBe(403)
    expect((await llamar(listarAfiliadosCorporativos, ['sin_nada'])).statusCode).toBe(403)
  })
  it('puedeAccederAfiliado: afiliaciones/ver o afiliados/ver acceden a cualquier afiliado', async () => {
    expect(await puedeAccederAfiliado(user(['afi_ver']), 77)).toBe(true)
    expect(await puedeAccederAfiliado(user(['solo_ver']), 77)).toBe(true)
  })
})
