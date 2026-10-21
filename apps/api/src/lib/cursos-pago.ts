/**
 * Reglas de cobro de cursos: precio según afiliación y cuándo una inscripción ocupa cupo.
 */

export interface PreciosCurso {
  precio_afiliado_usd?: number | null
  precio_publico_usd?: number | null
}

/** Precio en USD que paga la persona (NULL o 0 = gratis). */
export function precioCurso(curso: PreciosCurso, esAfiliado: boolean): number {
  const precio = Number(esAfiliado ? curso.precio_afiliado_usd : curso.precio_publico_usd)
  return Number.isFinite(precio) && precio > 0 ? precio : 0
}

/** Fecha ISO sin milisegundos, comparable con strftime('%Y-%m-%dT%H:%M:%SZ') de SQLite. */
export const isoSegundos = (d: Date): string => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

/** Vencimiento de la reserva de cupo: `horas` después de `desde`. */
export function venceReserva(desde: Date, horas: number): string {
  return isoSegundos(new Date(desde.getTime() + horas * 3_600_000))
}

/**
 * Condición SQL: la inscripción `ic` ocupa cupo si está admitida, pagada o en entrevista, o si está
 * preinscrita y (no tiene reserva —curso gratis o con aprobación manual—, la reserva sigue vigente
 * o tiene un pago reportado por verificar). Así una reserva vencida libera el cupo sin esperar al cron.
 */
export const sqlOcupaCupo = (ic = 'ic'): string => `(
  ${ic}.estatus IN ('Inscrito', 'Pagado', 'Entrevista')
  OR (${ic}.estatus = 'Preinscrito' AND (
    ${ic}.reserva_vence_en IS NULL
    OR ${ic}.reserva_vence_en > strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    OR EXISTS (SELECT 1 FROM pagos pg WHERE pg.id_inscripcion_curso = ${ic}.id_inscripcion
               AND pg.estatus = 'Pendiente' AND pg.eliminado_en IS NULL)
  ))
)`

/** Cupos ilimitados se guardan como 999999 (o vacío). */
export const esCupoIlimitado = (cuposTotales: unknown): boolean => {
  const n = Number(cuposTotales) || 0
  return n <= 0 || n >= 999999
}
