import { db } from '../lib/db.js'
import { randomBytes, createHash } from 'crypto'
import { enviarCorreoOnboardingMasivo } from '../lib/email.js'

/** Hashea un token en crudo con SHA-256 (para almacenar en reset_token_hash). */
const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex')

async function main() {
  const isTest = process.argv.includes('--test')
  const onlyCorporativos = process.argv.includes('--corporativos')
  const onlyCorporativosPersonales = process.argv.includes('--corporativos-personales')
  
  // Intentar obtener el email de los argumentos (ej: --test mi@correo.com)
  let testEmail = 'jenfermz44@gmail.com'
  const testIdx = process.argv.indexOf('--test')
  if (isTest && process.argv[testIdx + 1] && process.argv[testIdx + 1].includes('@')) {
    testEmail = process.argv[testIdx + 1]
  }

  console.log('🚀 Iniciando proceso de onboarding masivo...')
  if (isTest) {
    console.log(`🧪 MODO TEST ACTIVADO: Se procesará solo a ${testEmail}`)
  }
  if (onlyCorporativosPersonales) {
    console.log(`🏢 MODO CORPORATIVOS (SOLO PERSONALES): Se procesarán solo afiliados Corporativos cuyo correo de empresa sea inválido/pendiente.`)
  } else if (onlyCorporativos) {
    console.log(`🏢 MODO CORPORATIVOS: Se procesarán solo afiliados de tipo Corporativo o Agente Corporativo.`)
  }

  // 1. Obtener todos los afiliados
  // Incluimos los que tienen estatus de Afiliado, o si es modo test, el email específico
  // Hacemos JOIN con empresas para tener el email corporativo como respaldo
  const query = `
    SELECT 
      a.id_afiliado,
      a.id_user,
      a.tipo_afiliado,
      a.estatus,
      p.id as id_persona,
      p.nombres,
      p.apellidos,
      p.email as persona_email,
      e.email as empresa_email
    FROM afiliados a
    JOIN personas p ON a.id_persona = p.id
    LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
    WHERE p.eliminado_en IS NULL AND p.email <> 'admin@ciebo.com'
  `
  const result = await db.execute(query)
  const allAfiliados = result.rows as any[]

  // Filtrar según lógica: Afiliados aprobados, o el de test (ignorando estatus en test)
  const afiliados = allAfiliados.filter(a => {
    // Si estamos en test, validamos si alguno de los dos emails coincide
    if (isTest) {
      return (a.persona_email?.toLowerCase() === testEmail.toLowerCase()) || 
             (a.empresa_email?.toLowerCase() === testEmail.toLowerCase())
    }

    const isCorporate = a.tipo_afiliado === 'Corporativo' || a.tipo_afiliado === 'Agente Corporativo';

    // Si el modo "solo corporativos personales" está activo
    if (onlyCorporativosPersonales) {
      if (!isCorporate) return false;
      const isEmpresaValid = a.empresa_email && 
                             !a.empresa_email.includes('@placeholder.com') && 
                             !a.empresa_email.includes('temp-') && 
                             !a.empresa_email.toLowerCase().includes('pendiente');
      // Solo dejamos pasar a los que NO tienen un correo de empresa válido (van a usar el personal)
      if (isEmpresaValid) return false;
    } 
    // Si el modo corporativo genérico está activo, filtramos a los demás
    else if (onlyCorporativos && !isCorporate) {
      return false
    }

    return a.estatus === 'Afiliado'
  })

  if (afiliados.length === 0) {
    console.log(isTest 
      ? `⚠️ No se encontró ningún afiliado con el correo: ${testEmail}` 
      : '⚠️ No hay afiliados con estatus "Afiliado" para procesar.'
    )
    return
  }

  console.log(`📊 Se seleccionaron ${afiliados.length} afiliados para procesar.`)

  let procesados = 0
  let errores = 0

  for (const afiliado of afiliados) {
    try {
      const { id_afiliado, id_persona, tipo_afiliado, nombres, persona_email, empresa_email } = afiliado
      let { id_user } = afiliado

      // --- LÓGICA DE PREFERENCIA DE EMAIL ---
      let targetEmail = persona_email
      let sourceInfo = 'Personal'

      if (tipo_afiliado === 'Corporativo' || tipo_afiliado === 'Agente Corporativo') {
        const isEmpresaValid = empresa_email && 
                               !empresa_email.includes('@placeholder.com') && 
                               !empresa_email.includes('temp-') && 
                               !empresa_email.toLowerCase().includes('pendiente')
        
        if (isEmpresaValid) {
          targetEmail = empresa_email
          sourceInfo = 'Empresa'
          
          // Sincronizar el correo en la tabla personas para que el login y el perfil coincidan
          if (persona_email !== empresa_email) {
            try {
              await db.execute({
                sql: 'UPDATE personas SET email = ? WHERE id = ?',
                args: [targetEmail, id_persona]
              })
              console.log(`   🔄 Email personal sincronizado para coincidir con el de la empresa: ${targetEmail}`)
            } catch (err) {
              console.log(`   ⚠️ No se pudo sincronizar el email en personas (posible duplicado), pero se usará: ${targetEmail}`)
            }
          }
        } else {
          // Fallback al personal si el de la empresa no sirve o está pendiente
          console.log(`   ⚠️ Correo de empresa inválido, vacío o marcado como pendiente (${empresa_email}). Usando correo personal como respaldo: ${persona_email}`)
        }
      }

      // Validar que el email resultante sea útil
      if (!targetEmail || targetEmail.includes('@placeholder.com') || !targetEmail.includes('@')) {
        console.log(`   ⏭️ Saltando a ${nombres}: No tiene un correo válido (${targetEmail})`)
        continue
      }

      // Si estamos en modo test, saltar si el email final no es el de prueba
      if (isTest && targetEmail.toLowerCase() !== testEmail.toLowerCase()) {
        continue
      }

      console.log(`\n--- Procesando: ${nombres} (${targetEmail}) [Origen: ${sourceInfo}] ---`)

      // 2. Verificar o crear el usuario
      if (!id_user) {
        console.log('   - No tiene usuario vinculado. Creando...')
        // Verificamos si ya existe un usuario con ese email (por si acaso)
        const userExists = await db.execute({
          sql: 'SELECT id FROM users WHERE email = ?',
          args: [targetEmail]
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
            args: [targetEmail, dummyPass]
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
      await enviarCorreoOnboardingMasivo(nombres, targetEmail, rawToken)
      
      const appUrl = process.env.APP_URL || 'http://localhost:5173'
      console.log(`   🔗 Enlace de activación: ${appUrl}/establecer-contrasena?token=${rawToken}`)
      
      procesados++
      console.log('   ✅ Procesado correctamente')

    } catch (err) {
      console.error(`   ❌ Error procesando a ${targetEmail || persona_email}:`, err)
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
