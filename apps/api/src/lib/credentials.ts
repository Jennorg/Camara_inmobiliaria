import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { db } from './db.js'
import { enviarCorreoOnboardingMasivo, enviarCorreoAccesoCibirAprobado } from './email.js'

/**
 * Invitación de acceso: guarda (hasheado) un token reset_password de 30 días, reemplazando
 * los anteriores del email, y envía el correo de onboarding con el token en claro.
 */
export async function enviarInvitacion(user: { email: string; nombre: string }): Promise<void> {
  const token = randomBytes(32).toString('hex')
  const expStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const tokenHash = createHash('sha256').update(token).digest('hex')

  await db.execute({
    sql: `DELETE FROM tokens_accion WHERE email = ? AND tipo = 'reset_password'`,
    args: [user.email],
  })
  await db.execute({
    sql: `INSERT INTO tokens_accion (token, tipo, email, usado, fecha_expiracion)
          VALUES (?, 'reset_password', ?, 0, ?)`,
    args: [tokenHash, user.email, expStr],
  })
  await enviarCorreoOnboardingMasivo(user.nombre, user.email, token)
}

const CORPORATIVO_TIPOS = new Set(['Corporativo', 'Agente Corporativo'])

/**
 * Genera credenciales de acceso para un afiliado recién aprobado.
 * Crea una fila en `users` con rol='afiliado' y devuelve la contraseña
 * en texto plano.
 *
 * @param idAfiliado - ID del afiliado al que se le asignan las credenciales
 * @param email       - Email del afiliado (será su usuario de acceso)
 * @returns           - Contraseña generada en texto plano (uso temporal)
 */
export async function generarCredenciales(
  idAfiliado: number,
  email: string
): Promise<string> {
  // Contraseña genérica: CIEBO- + 6 últimos dígitos del timestamp
  const rawPassword = `CIEBO-${Date.now().toString().slice(-6)}`
  const passwordHash = await bcrypt.hash(rawPassword, 10)

  await db.execute({
    sql: `INSERT OR IGNORE INTO users (email, password_hash, roles)
          VALUES (?, ?, '["afiliado"]')`,
    args: [email, passwordHash],
  })

  return rawPassword
}

/**
 * Regenera las credenciales de un usuario existente (reset de contraseña).
 * Devuelve la nueva contraseña en texto plano.
 */
export async function resetCredenciales(userId: number): Promise<string> {
  const rawPassword = `CIEBO-${Date.now().toString().slice(-6)}`
  const passwordHash = await bcrypt.hash(rawPassword, 10)

  await db.execute({
    sql: `UPDATE users SET password_hash = ? WHERE id = ?`,
    args: [passwordHash, userId],
  })

  return rawPassword
}

export type AccesoPanelResult = {
  userId: number
  email: string
  created: boolean
}

/**
 * Crea o actualiza la cuenta de acceso de un afiliado con la contraseña indicada.
 * Vincula id_user en afiliados y activa la cuenta (limpia tokens de reset).
 */
export async function establecerAccesoPanelAfiliado(
  idAfiliado: number,
  password: string,
  emailOverride?: string
): Promise<AccesoPanelResult> {
  const af = await db.execute({
    sql: `SELECT a.id_afiliado, a.id_user, a.id_persona, a.id_empresa, a.tipo_afiliado,
                 p.email AS persona_email,
                 e.email AS empresa_email
          FROM afiliados a
          LEFT JOIN personas p ON a.id_persona = p.id
          LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
          WHERE a.id_afiliado = ?`,
    args: [idAfiliado],
  })

  if (af.rows.length === 0) {
    throw new Error('AFILIADO_NO_ENCONTRADO')
  }

  const row = af.rows[0] as unknown as {
    id_user: number | null
    id_persona: number | null
    id_empresa: number | null
    persona_email: string | null
    empresa_email: string | null
    tipo_afiliado: string
  }

  const email = (emailOverride?.trim() || row.persona_email || row.empresa_email || '').trim().toLowerCase()
  if (!email) {
    throw new Error('EMAIL_REQUERIDO')
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const now = new Date().toISOString()
  let userId = row.id_user
  let created = false

  const syncAfiliadoEmails = async () => {
    if (row.id_persona) {
      await db.execute({
        sql: `UPDATE personas SET email = ?, actualizado_en = ? WHERE id = ?`,
        args: [email, now, row.id_persona],
      })
    }
    if (row.id_empresa && CORPORATIVO_TIPOS.has(row.tipo_afiliado)) {
      await db.execute({
        sql: `UPDATE empresas SET email = ?, actualizado_en = ? WHERE id_empresa = ?`,
        args: [email, now, row.id_empresa],
      })
    }
  }

  const assertEmailAvailable = async (excludeUserId?: number) => {
    const dup = await db.execute({
      sql: `SELECT id FROM users WHERE LOWER(TRIM(email)) = ?${excludeUserId ? ' AND id != ?' : ''}`,
      args: excludeUserId ? [email, excludeUserId] : [email],
    })
    if (dup.rows.length > 0) throw new Error('EMAIL_EN_USO')
  }

  if (userId) {
    await assertEmailAvailable(userId)
    await db.execute({
      sql: `UPDATE users
            SET email = ?, password_hash = ?, activo = 1,
                actualizado_en = ?
            WHERE id = ?`,
      args: [email, passwordHash, now, userId],
    })
    await syncAfiliadoEmails()
  } else {
    const existing = await db.execute({
      sql: `SELECT id FROM users WHERE LOWER(TRIM(email)) = ?`,
      args: [email],
    })

    if (existing.rows.length > 0) {
      userId = existing.rows[0].id as number
      await db.execute({
        sql: `UPDATE users
              SET email = ?, password_hash = ?, roles = '["afiliado"]', activo = 1,
                  actualizado_en = ?
              WHERE id = ?`,
        args: [email, passwordHash, now, userId],
      })
      await syncAfiliadoEmails()
    } else {
      const inserted = await db.execute({
        sql: `INSERT INTO users (email, password_hash, roles, activo)
              VALUES (?, ?, '["afiliado"]', 1)
              RETURNING id`,
        args: [email, passwordHash],
      })
      userId = inserted.rows[0].id as number
      created = true
    }

    await db.execute({
      sql: `UPDATE afiliados SET id_user = ?, actualizado_en = ? WHERE id_afiliado = ?`,
      args: [userId, now, idAfiliado],
    })
    await syncAfiliadoEmails()
  }

  return { userId: userId!, email, created }
}

/**
 * Acceso al sistema de un aspirante: solo cuando la Junta Directiva aprueba su CIBIR.
 * Crea el usuario (contraseña inservible hasta que la establezca) y envía el enlace por correo.
 * Si ya tiene usuario, solo reenvía cuando aún no ha establecido su contraseña (token vigente sin usar).
 */
export async function concederAccesoAlAprobarCibir(idAfiliado: number): Promise<void> {
  const r = await db.execute({
    sql: `SELECT COALESCE(NULLIF(TRIM(p.email), ''), e.email) AS email,
                 COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), e.razon_social) AS nombre
          FROM afiliados a
          LEFT JOIN personas p ON a.id_persona = p.id
          LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
          WHERE a.id_afiliado = ?`,
    args: [idAfiliado],
  })
  const a = r.rows[0] as { email?: string; nombre?: string } | undefined
  if (!a?.email) return
  const email = a.email.trim().toLowerCase()

  const existente = await db.execute({ sql: `SELECT id FROM users WHERE email = ?`, args: [email] })
  if (existente.rows.length) {
    const pendiente = await db.execute({
      sql: `SELECT 1 FROM tokens_accion WHERE email = ? AND tipo = 'reset_password' AND usado = 0 AND fecha_expiracion > ? LIMIT 1`,
      args: [email, new Date().toISOString()],
    })
    if (!pendiente.rows.length) return // ya estableció su contraseña
  } else {
    const ins = await db.execute({
      sql: `INSERT INTO users (email, password_hash, roles) VALUES (?, ?, '["estudiante", "afiliado"]') RETURNING id`,
      args: [email, await bcrypt.hash(randomBytes(16).toString('hex'), 10)],
    })
    await db.execute({ sql: `UPDATE afiliados SET id_user = ? WHERE id_afiliado = ? AND id_user IS NULL`, args: [ins.rows[0].id, idAfiliado] })
  }

  const token = randomBytes(32).toString('hex')
  await db.execute({ sql: `DELETE FROM tokens_accion WHERE email = ? AND tipo = 'reset_password'`, args: [email] })
  await db.execute({
    sql: `INSERT INTO tokens_accion (token, tipo, email, usado, fecha_expiracion) VALUES (?, 'reset_password', ?, 0, ?)`,
    args: [createHash('sha256').update(token).digest('hex'), email, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()],
  })
  await enviarCorreoAccesoCibirAprobado(String(a.nombre ?? ''), email, token)
}
