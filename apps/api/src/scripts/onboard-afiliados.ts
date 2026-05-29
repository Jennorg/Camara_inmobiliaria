import { db } from '../lib/db.js'
import { randomBytes, createHash } from 'crypto'
import { enviarCorreoOnboardingMasivo } from '../lib/email.js'

/** Hashea un token en crudo con SHA-256 (para almacenar en reset_token_hash). */
const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex')

async function main() {
  const isTest = process.argv.includes('--test')
  const testEmail = 'jenfermz44@gmail.com'

  console.log('🚀 Iniciando proceso de onboarding masivo...')
  if (isTest) {
    console.log(`🧪 MODO TEST ACTIVADO: Se enviará solo a ${testEmail}`)
  }

  // 1. Obtener todos los afiliados
  // Incluimos los que tienen estatus de Afiliado, o si es modo test, el email específico
  const query = `
    SELECT 
      a.id_afiliado,
      a.id_user,
      a.estatus,
      p.nombres,
      p.apellidos,
      p.email
    FROM afiliados a
    JOIN personas p ON a.id_persona = p.id
    WHERE p.eliminado_en IS NULL
  `
  const result = await db.execute(query)
  const allAfiliados = result.rows as any[]

  // Filtrar según lógica: Afiliados aprobados, o el de test
  const afiliados = allAfiliados.filter(a => {
    if (isTest) return a.email.toLowerCase() === testEmail.toLowerCase()
    return a.estatus === 'Afiliado'
  })

  console.log(`📊 Se seleccionaron ${afiliados.length} afiliados para procesar.`)

  let procesados = 0
  let errores = 0

  for (const afiliado of afiliados) {
    try {
      const { id_afiliado, nombres, email } = afiliado
      let { id_user } = afiliado

      // Si estamos en modo test, saltar si no es el email de prueba
      if (isTest && email.toLowerCase() !== testEmail.toLowerCase()) {
        continue
      }

      console.log(`\n--- Procesando: ${nombres} (${email}) ---`)

      // 2. Verificar o crear el usuario
      if (!id_user) {
        console.log('   - No tiene usuario vinculado. Creando...')
        // Verificamos si ya existe un usuario con ese email (por si acaso)
        const userExists = await db.execute({
          sql: 'SELECT id FROM users WHERE email = ?',
          args: [email]
        })

        if (userExists.rows.length > 0) {
          id_user = userExists.rows[0].id
          console.log(`   - Usuario ya existía con ID ${id_user}. Vinculando...`)
        } else {
          // Crear usuario con password dummy (se cambiará con el token)
          const dummyPass = randomBytes(16).toString('hex')
          const insertUser = await db.execute({
            sql: `INSERT INTO users (email, password_hash, roles, activo) 
                  VALUES (?, ?, '["afiliado"]', 0) RETURNING id`,
            args: [email, dummyPass]
          })
          id_user = insertUser.rows[0].id
          console.log(`   - Usuario creado con ID ${id_user}`)
        }

        // Vincular el nuevo usuario al afiliado
        await db.execute({
          sql: 'UPDATE afiliados SET id_user = ? WHERE id_afiliado = ?',
          args: [id_user, id_afiliado]
        })
      }

      // 3. Generar token de activación
      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = sha256(rawToken)
      const expira = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 horas

      await db.execute({
        sql: `UPDATE users 
              SET reset_token_hash = ?, reset_token_expira = ?, actualizado_en = ? 
              WHERE id = ?`,
        args: [tokenHash, expira, new Date().toISOString(), id_user]
      })

      // 4. Enviar correo
      console.log('   - Enviando correo de bienvenida...')
      await enviarCorreoOnboardingMasivo(nombres, email, rawToken)
      
      const appUrl = process.env.APP_URL || 'http://localhost:5173'
      console.log(`   🔗 Enlace de activación: ${appUrl}/establecer-contrasena?token=${rawToken}`)
      
      procesados++
      console.log('   ✅ Procesado correctamente')

    } catch (err) {
      console.error(`   ❌ Error procesando a ${afiliado.email}:`, err)
      errores++
    }
  }

  console.log('\n=========================================')
  console.log(`✨ Proceso finalizado.`)
  console.log(`✅ Exitosos: ${procesados}`)
  console.log(`❌ Errores: ${errores}`)
  console.log('=========================================\n')
}

main().catch((err) => {
  console.error('💥 Error fatal en el script:', err)
  process.exit(1)
})
