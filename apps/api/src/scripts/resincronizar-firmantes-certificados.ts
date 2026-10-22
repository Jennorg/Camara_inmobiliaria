/**
 * Corrige los firmantes de los certificados YA emitidos de cursos: cada certificado guarda una copia
 * (firmantes_snapshot) de los firmantes del curso al emitirse y la verificación pública la usa antes
 * que los del curso, así que editar el curso no cambia lo emitido. Este script vuelve a copiarlos.
 *
 * Solo toca certificados de cursos con firmantes definidos. No toca los de programas (CIBIR, PREANI…),
 * cuyos firmantes salen de la junta directiva vigente en la emisión.
 *
 * Antes de escribir guarda un respaldo con las copias anteriores en scratch/ (sirve para revertir).
 * Uso (simula por defecto, --aplicar escribe en la BD):
 *   pnpm tsx src/scripts/resincronizar-firmantes-certificados.ts [--curso=ID] [--aplicar]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { db } from '../lib/db.js'

const flags = process.argv.slice(2)
const aplicar = flags.includes('--aplicar')
const idCurso = flags.find(f => f.startsWith('--curso='))?.split('=')[1]
if (idCurso !== undefined && !/^\d+$/.test(idCurso)) {
  console.error('Uso: resincronizar-firmantes-certificados.ts [--curso=ID] [--aplicar]')
  process.exit(1)
}

/** JSON canónico (sin espacios) o null si no es un arreglo válido. */
const canon = (raw: unknown): string | null => {
  try {
    const v = JSON.parse(String(raw ?? ''))
    return Array.isArray(v) ? JSON.stringify(v) : null
  } catch {
    return null
  }
}
const resumen = (canonico: string | null) =>
  canonico ? (JSON.parse(canonico) as { nombre?: string; cargo?: string }[]).map(f => `${f.nombre} (${f.cargo})`).join(' · ') || '(vacío)' : '(sin copia)'

async function main() {
  const r = await db.execute({
    sql: `SELECT c.id_certificado, c.codigo_validacion, c.firmantes_snapshot, cu.id_curso, cu.titulo, cu.firmantes
          FROM certificados c
          JOIN inscripciones_cursos ic ON ic.id_inscripcion = c.id_inscripcion
          JOIN cursos cu ON cu.id_curso = ic.id_curso
          WHERE c.eliminado_en IS NULL AND cu.firmantes IS NOT NULL AND TRIM(cu.firmantes) NOT IN ('', '[]')
            ${idCurso ? 'AND cu.id_curso = ?' : ''}
          ORDER BY cu.id_curso, c.id_certificado`,
    args: idCurso ? [Number(idCurso)] : [],
  })

  const cambios: { id_certificado: number; codigo: string; anterior: string | null; nuevo: string }[] = []
  const porCurso = new Map<number, { titulo: string; total: number; cambios: number; antes: Set<string>; despues: string }>()
  for (const row of r.rows as any[]) {
    const nuevo = canon(row.firmantes)
    if (nuevo === null || nuevo === '[]') {
      console.warn(`Aviso: el curso ${row.id_curso} "${row.titulo}" tiene firmantes que no son un JSON válido; se omite.`)
      continue
    }
    const anterior = canon(row.firmantes_snapshot)
    const c = porCurso.get(row.id_curso) ?? { titulo: row.titulo, total: 0, cambios: 0, antes: new Set<string>(), despues: resumen(nuevo) }
    c.total++
    if (anterior !== nuevo) {
      c.cambios++
      c.antes.add(resumen(anterior))
      cambios.push({ id_certificado: Number(row.id_certificado), codigo: row.codigo_validacion, anterior: row.firmantes_snapshot ?? null, nuevo })
    }
    porCurso.set(row.id_curso, c)
  }

  for (const [id, c] of porCurso) {
    console.log(`\nCurso ${id} "${c.titulo}": ${c.cambios} de ${c.total} certificados difieren.`)
    if (c.cambios) {
      for (const a of c.antes) console.log(`  antes:   ${a}`)
      console.log(`  después: ${c.despues}`)
    }
  }
  console.log(`\nTotal a corregir: ${cambios.length} certificados.`)
  if (!cambios.length) return
  if (!aplicar) {
    console.log('Simulación: no se escribió nada. Repite con --aplicar para corregirlos (se guarda un respaldo).')
    return
  }

  mkdirSync('scratch', { recursive: true })
  const respaldo = `scratch/firmantes-certificados-respaldo-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(respaldo, JSON.stringify(cambios.map(({ id_certificado, codigo, anterior }) => ({ id_certificado, codigo, firmantes_snapshot: anterior })), null, 2))
  console.log(`Respaldo guardado en ${respaldo}`)

  await db.batch(cambios.map(c => ({ sql: `UPDATE certificados SET firmantes_snapshot = ? WHERE id_certificado = ?`, args: [c.nuevo, c.id_certificado] })), 'write')
  console.log(`Listo: ${cambios.length} certificados actualizados.`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
