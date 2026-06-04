import { db } from '../lib/db.js'
import bcrypt from 'bcryptjs'

async function run() {
  console.log('🚀 Iniciando sembrado de usuarios de prueba (Corporativo y Agente)...')

  const hashedPass = await bcrypt.hash('Ciebo2026!', 10)
  const now = new Date().toISOString()

  try {
    // 1. AFILIADO CORPORATIVO (DUEÑO DE EMPRESA)
    const corpEmail = 'corporativo@test.com'
    console.log(`  · Creando Afiliado Corporativo: ${corpEmail}`)
    
    // Crear Usuario
    const userRes = await db.execute({
      sql: `INSERT INTO users (email, password_hash, roles, activo) VALUES (?, ?, '["afiliado"]', 1) 
            ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash RETURNING id`,
      args: [corpEmail, hashedPass]
    })
    const userIdCorp = Number(userRes.rows[0].id)

    // Crear Persona (Socio/Dueño)
    const persRes = await db.execute({
      sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email) VALUES (?, ?, ?, ?, ?) 
            ON CONFLICT(email) DO UPDATE SET nombres=excluded.nombres RETURNING id`,
      args: ['Carlos', 'Empresario', 'V', '22222222', corpEmail]
    })
    const personaIdCorp = Number(persRes.rows[0].id)

    // Crear Empresa
    const empRes = await db.execute({
      sql: `INSERT INTO empresas (razon_social, rif_tipo, rif_numero, email, id_user) VALUES (?, ?, ?, ?, ?) 
            ON CONFLICT(rif_numero) DO UPDATE SET razon_social=excluded.razon_social RETURNING id_empresa`,
      args: ['Inmobiliaria Test C.A.', 'J', '123456789', 'contacto@testcorp.com', userIdCorp]
    })
    const empresaId = Number(empRes.rows[0].id_empresa)

    // Crear Afiliado tipo Corporativo
    const afilRes = await db.execute({
      sql: `INSERT INTO afiliados (id_user, id_persona, id_empresa, tipo_afiliado, estatus, codigo, fecha_afiliacion) 
            VALUES (?, ?, ?, 'Corporativo', 'Afiliado', ?, ?) 
            ON CONFLICT(id_persona) DO UPDATE SET tipo_afiliado='Corporativo', estatus='Afiliado', codigo=excluded.codigo RETURNING id_afiliado`,
      args: [userIdCorp, personaIdCorp, empresaId, `CORP-${Date.now()}`, now]
    })
    const idAfiliadoOwner = Number(afilRes.rows[0].id_afiliado)

    // Actualizar representante legal de la empresa
    await db.execute({
      sql: `UPDATE empresas SET id_representante_legal = ? WHERE id_empresa = ?`,
      args: [idAfiliadoOwner, empresaId]
    })

    console.log('    ✓ Afiliado Corporativo y Empresa creados.')

    // 2. AGENTE CORPORATIVO (VINCULADO A LA MISMA EMPRESA)
    const agenteEmail = 'agente@test.com'
    console.log(`  · Creando Agente Corporativo: ${agenteEmail}`)

    // Crear Usuario Agente
    const userAgenteRes = await db.execute({
      sql: `INSERT INTO users (email, password_hash, roles, activo) VALUES (?, ?, '["afiliado"]', 1) 
            ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash RETURNING id`,
      args: [agenteEmail, hashedPass]
    })
    const userIdAgente = Number(userAgenteRes.rows[0].id)

    // Crear Persona Agente
    const persAgenteRes = await db.execute({
      sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email) VALUES (?, ?, ?, ?, ?) 
            ON CONFLICT(email) DO UPDATE SET nombres=excluded.nombres RETURNING id`,
      args: ['Pedro', 'Agente', 'V', '44444444', agenteEmail]
    })
    const personaIdAgente = Number(persAgenteRes.rows[0].id)

    // Crear Afiliado tipo Agente Corporativo (vinculado a empresaId)
    await db.execute({
      sql: `INSERT INTO afiliados (id_user, id_persona, id_empresa, tipo_afiliado, estatus, codigo, fecha_afiliacion) 
            VALUES (?, ?, ?, 'Agente Corporativo', 'Afiliado', ?, ?) 
            ON CONFLICT(id_persona) DO UPDATE SET tipo_afiliado='Agente Corporativo', estatus='Afiliado', codigo=excluded.codigo`,
      args: [userIdAgente, personaIdAgente, empresaId, `AGE-${Date.now()}`, now]
    })

    console.log('    ✓ Agente Corporativo creado y vinculado a la empresa.')

    console.log('\n✅ Sembrado finalizado con éxito.')
    console.log('\nCredenciales para pruebas:')
    console.log('---------------------------')
    console.log('CORPORATIVO:')
    console.log(`  Email: ${corpEmail}`)
    console.log('  Pass:  Ciebo2026!')
    console.log('\nAGENTE:')
    console.log(`  Email: ${agenteEmail}`)
    console.log('  Pass:  Ciebo2026!')
    console.log('---------------------------')

  } catch (error: any) {
    console.error('\n❌ Error durante el sembrado:', error.message)
  }
}

run().catch(console.error)
