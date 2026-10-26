import type { Client } from '@libsql/client'

export type DatosEntrevista = { fecha: string; hora: string; lugar: string; meetUrl?: string | null; googleEventId?: string | null }
export type EstudianteEntrevista = { nombre_completo: string; email: string | null }

/**
 * Agenda (o reprograma) la entrevista de una inscripción: la pasa a Entrevista, guarda la fila de `entrevistas` y
 * mueve al afiliado a la etapa 3_ENTREVISTA. El correo lo envía quien llama con el `estudiante` devuelto.
 */
export async function agendarEntrevista(client: Pick<Client, 'execute'>, idInscripcion: number, datos: DatosEntrevista) {
  const now = new Date().toISOString()
  const result = await client.execute({
    sql: `UPDATE inscripciones_cursos
          SET estatus='Entrevista', actualizado_en=?
          WHERE id_inscripcion=? AND estatus IN ('Preinscrito', 'Entrevista')
          RETURNING *`,
    args: [now, idInscripcion],
  })
  if (result.rows.length === 0) {
    throw Object.assign(new Error('Preinscripción no encontrada o ya procesada'), { status: 404 })
  }
  const row = result.rows[0] as any

  const meetUrl = datos.meetUrl ?? null
  const googleEventId = datos.googleEventId ?? null
  const existente = await client.execute({
    sql: `SELECT id_entrevista, google_event_id FROM entrevistas WHERE id_inscripcion = ? AND eliminado_en IS NULL LIMIT 1`,
    args: [idInscripcion],
  })
  // El evento de Google de la cita anterior queda huérfano al reprogramar: quien llama lo borra
  const previo = existente.rows[0]?.google_event_id ? String(existente.rows[0].google_event_id) : null
  const eventoPrevio = previo && previo !== googleEventId ? previo : null
  if (existente.rows.length > 0) {
    await client.execute({
      sql: `UPDATE entrevistas SET fecha = ?, hora = ?, lugar = ?, meet_url = ?, google_event_id = ?, estatus = 'Pendiente', actualizado_en = ? WHERE id_entrevista = ?`,
      args: [datos.fecha, datos.hora, datos.lugar, meetUrl, googleEventId, now, existente.rows[0].id_entrevista],
    })
  } else {
    await client.execute({
      sql: `INSERT INTO entrevistas (id_inscripcion, fecha, hora, lugar, meet_url, google_event_id, estatus, creado_en) VALUES (?, ?, ?, ?, ?, ?, 'Pendiente', ?)`,
      args: [idInscripcion, datos.fecha, datos.hora, datos.lugar, meetUrl, googleEventId, now],
    })
  }

  if (row.programa_codigo === 'AFILIACION' || row.programa_codigo === 'CIBIR') {
    try {
      await client.execute({
        sql: `UPDATE afiliados
              SET estatus = '3_ENTREVISTA', fecha_ultimo_cambio_estatus = ?, actualizado_en = ?
              WHERE id_afiliado IN (
                SELECT af.id_afiliado
                FROM afiliados af
                JOIN estudiantes e ON (e.id_persona = af.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = af.id_empresa))
                WHERE e.id_estudiante = ?
              )`,
        args: [now, now, row.id_estudiante],
      })
    } catch (afErr) {
      console.error('Error actualizando estatus a 3_ENTREVISTA en afiliados:', afErr)
    }
  }

  const estRes = await client.execute({
    sql: `SELECT COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), emp.razon_social) as nombre_completo,
                 COALESCE(p.email, emp.email) as email
          FROM estudiantes e
          LEFT JOIN personas p ON e.id_persona = p.id
          LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
          WHERE e.id_estudiante = ?`,
    args: [row.id_estudiante],
  })
  const e = estRes.rows[0] as any
  const estudiante: EstudianteEntrevista | null = e ? { nombre_completo: e.nombre_completo, email: e.email ?? null } : null
  return { row, estudiante, eventoPrevio }
}
