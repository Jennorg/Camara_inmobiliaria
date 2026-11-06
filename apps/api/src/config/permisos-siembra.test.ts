import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'
import { sembrarRoles, SECCIONES } from './secciones.js'

const DDL = [
  `CREATE TABLE roles (id INTEGER PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, es_sistema INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT)`,
  `CREATE TABLE rol_permisos (id_rol INTEGER NOT NULL, seccion TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 0, crear INTEGER NOT NULL DEFAULT 0, editar INTEGER NOT NULL DEFAULT 0, eliminar INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id_rol, seccion))`,
]

async function permisos(db: ReturnType<typeof createClient>) {
  const r = await db.execute(`SELECT r.clave, p.seccion, p.ver, p.crear, p.editar, p.eliminar FROM rol_permisos p JOIN roles r ON r.id = p.id_rol`)
  const out: Record<string, Record<string, string>> = {}
  for (const x of r.rows as any[]) {
    const acc = (['ver', 'crear', 'editar', 'eliminar'] as const).filter(a => x[a] === 1).join(',')
    ;(out[x.clave] ??= {})[x.seccion] = acc
  }
  return out
}

describe('permisos: siembra', () => {
  it('sembrar_roles_reproduce_acceso_actual', async () => {
    const db = createClient({ url: ':memory:' })
    await db.batch(DDL, 'write')
    await sembrarRoles(db)
    const n1 = (await db.execute(`SELECT COUNT(*) c FROM rol_permisos`)).rows[0].c
    await sembrarRoles(db)
    expect((await db.execute(`SELECT COUNT(*) c FROM rol_permisos`)).rows[0].c).toBe(n1)
    expect((await db.execute(`SELECT COUNT(*) c FROM roles`)).rows[0].c).toBe(8)

    const p = await permisos(db)
    const ALL = 'ver,crear,editar,eliminar'
    for (const s of SECCIONES) {
      expect(p.admin[s.id]).toBe(['roles', 'admin_users'].includes(s.id) ? undefined : ALL)
    }
    const AF = 'ver,crear,editar'
    const SC = 'ver,editar'
    expect(p.asistente).toEqual({ afiliados: AF, solicitudes_cambio: SC, users: AF, finanzas: ALL, asambleas: ALL, denuncias: ALL, formacion: AF, preinscripciones: AF, estudiantes: ALL })
    expect(p.administrativo).toEqual({ afiliados: AF, solicitudes_cambio: SC, users: AF, finanzas: ALL, asambleas: ALL, denuncias: ALL, formacion: AF, preinscripciones: AF, estudiantes: ALL })
    expect(p.personal_admin).toEqual({ afiliados: AF, solicitudes_cambio: SC, users: AF, finanzas: ALL, asambleas: ALL, denuncias: ALL, formacion: AF, preinscripciones: AF, estudiantes: ALL })
    expect(p.secretario).toEqual({ afiliados: AF, solicitudes_cambio: SC, users: AF, finanzas: ALL, asambleas: ALL, denuncias: ALL, formacion: AF, preinscripciones: AF, estudiantes: ALL })
    expect(p.secretaria).toEqual({ afiliados: AF, solicitudes_cambio: SC, users: AF, finanzas: ALL, asambleas: ALL, denuncias: ALL, formacion: AF, preinscripciones: AF, estudiantes: ALL })
    expect(p.personal).toEqual({ afiliados: AF, solicitudes_cambio: SC, users: AF, finanzas: ALL, asambleas: ALL, denuncias: ALL, formacion: AF, preinscripciones: AF, estudiantes: ALL })
    expect(p.personal_administrativo).toEqual({ afiliados: AF, solicitudes_cambio: SC, users: AF, finanzas: ALL, asambleas: ALL, denuncias: ALL, formacion: AF, preinscripciones: AF, estudiantes: ALL })
    expect(p.super_admin).toBeUndefined()
  })

  it('no pisa permisos editados al volver a sembrar', async () => {
    const db = createClient({ url: ':memory:' })
    await db.batch(DDL, 'write')
    await sembrarRoles(db)
    await db.execute(`UPDATE rol_permisos SET eliminar = 0 WHERE seccion = 'finanzas' AND id_rol = (SELECT id FROM roles WHERE clave='asistente')`)
    await sembrarRoles(db)
    expect((await permisos(db)).asistente.finanzas).toBe('ver,crear,editar')
  })
})
