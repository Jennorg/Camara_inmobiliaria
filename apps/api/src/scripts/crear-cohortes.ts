/**
 * Crea las cohortes de los programas y reparte las inscripciones actuales.
 *
 * CIBIR (los CIBIR previos al sistema no guardan a qué grupo pertenecía cada quien, así que se separan por origen):
 *   Cohorte 1 (cerrada): cargados a mano antes del 1-sep-2026 que cursaron (tienen certificado).
 *   Cohorte 2 (cerrada): inscripciones CIBIR creadas por el sistema desde el 1-sep-2026 (ya completadas).
 *   Cohorte 3 (abierta): afiliados que están ahora en la etapa 5_CIBIR (su inscripción es la de AFILIACION).
 *   Sin cohorte: cargados a mano solo acreditados, sin certificado (no cursaron ningún CIBIR).
 * PREANI / PEGI / PADI: una sola Cohorte 1 (abierta) con todas sus inscripciones actuales.
 *
 * Solo asigna inscripciones que aún no tienen cohorte, así que se puede repetir sin efecto. Para revertir:
 *   UPDATE inscripciones_cursos SET id_cohorte = NULL;  DELETE FROM cohortes;
 * HAZ UN RESPALDO ANTES. Todo se escribe en una transacción que verifica los conteos esperados antes de confirmar.
 *
 * Uso (simula por defecto, --aplicar escribe en la BD; --forzar ignora los conteos esperados):
 *   pnpm tsx src/scripts/crear-cohortes.ts [--aplicar] [--forzar]
 */
import { db } from '../lib/db.js'
import { asegurarEsquemaCohortes } from '../lib/cohortes.js'

const flags = process.argv.slice(2)
const aplicar = flags.includes('--aplicar')
const forzar = flags.includes('--forzar')

const TIENE_CERTIFICADO = `EXISTS (SELECT 1 FROM certificados c WHERE c.id_inscripcion = ic.id_inscripcion AND c.eliminado_en IS NULL)`
const EN_ETAPA_CIBIR = `EXISTS (SELECT 1 FROM estudiantes e JOIN afiliados a
    ON (e.id_persona IS NOT NULL AND a.id_persona = e.id_persona) OR (e.id_empresa IS NOT NULL AND a.id_empresa = e.id_empresa)
    WHERE e.id_estudiante = ic.id_estudiante AND a.estatus = '5_CIBIR' AND a.eliminado_en IS NULL)`
const PROGRAMA = (p: string) => `ic.programa_codigo = '${p}' AND ic.id_curso IS NULL`

interface Grupo { programa: string; numero: number | null; etiqueta: string; condicion: string; esperado: number }
const GRUPOS: Grupo[] = [
  { programa: 'CIBIR', numero: 1, etiqueta: 'CIBIR Cohorte 1 (cargados a mano con certificado)', condicion: `${PROGRAMA('CIBIR')} AND ic.creado_en < '2026-09-01' AND ${TIENE_CERTIFICADO}`, esperado: 64 },
  { programa: 'CIBIR', numero: 2, etiqueta: 'CIBIR Cohorte 2 (inscritos por el sistema, completados)', condicion: `${PROGRAMA('CIBIR')} AND ic.creado_en >= '2026-09-01'`, esperado: 66 },
  { programa: 'CIBIR', numero: 3, etiqueta: 'CIBIR Cohorte 3 (actuales en 5_CIBIR)', condicion: `${PROGRAMA('AFILIACION')} AND ${EN_ETAPA_CIBIR}`, esperado: 40 },
  { programa: 'CIBIR', numero: null, etiqueta: 'CIBIR sin cohorte (solo acreditados, sin certificado)', condicion: `${PROGRAMA('CIBIR')} AND ic.creado_en < '2026-09-01' AND NOT ${TIENE_CERTIFICADO}`, esperado: 156 },
  { programa: 'PREANI', numero: 1, etiqueta: 'PREANI Cohorte 1', condicion: PROGRAMA('PREANI'), esperado: 2 },
  { programa: 'PEGI', numero: 1, etiqueta: 'PEGI Cohorte 1', condicion: PROGRAMA('PEGI'), esperado: 1 },
  { programa: 'PADI', numero: 1, etiqueta: 'PADI Cohorte 1', condicion: PROGRAMA('PADI'), esperado: 1 },
]

const COHORTES = [
  ['CIBIR', 1, 'Cerrada', 'Primer CIBIR. Afiliados cargados a mano el 31-ago-2026 que ya habían cursado (con certificado).'],
  ['CIBIR', 2, 'Cerrada', 'Segundo CIBIR. Inscritos por el sistema entre septiembre y octubre de 2026 (completados).'],
  ['CIBIR', 3, 'Abierta', 'Inscritos actuales (etapa 5_CIBIR) y los que se sumen.'],
  ['PREANI', 1, 'Abierta', 'Cohorte inicial: preinscritos al crear las cohortes.'],
  ['PEGI', 1, 'Abierta', 'Cohorte inicial: preinscritos al crear las cohortes.'],
  ['PADI', 1, 'Abierta', 'Cohorte inicial: preinscritos al crear las cohortes.'],
] as const

type Ejecutor = Pick<typeof db, 'execute'>
const contar = async (ex: Ejecutor, condicion: string, soloSinCohorte: boolean) =>
  Number((await ex.execute(`SELECT COUNT(*) AS n FROM inscripciones_cursos ic WHERE ${condicion}${soloSinCohorte ? ' AND ic.id_cohorte IS NULL' : ''}`)).rows[0].n)

async function main() {
  const cols = await db.execute(`SELECT name FROM pragma_table_info('inscripciones_cursos')`)
  const yaMigrada = cols.rows.some(r => r.name === 'id_cohorte')

  console.log(`Cohortes ya creadas en la base: ${yaMigrada ? 'sí (se asignan solo inscripciones sin cohorte)' : 'no'}\n`)
  const conteos: number[] = []
  for (const g of GRUPOS) {
    const n = await contar(db, g.condicion, yaMigrada)
    conteos.push(n)
    console.log(`${String(n).padStart(4)}  ${g.etiqueta}${n === g.esperado ? '' : `   ← esperado ${g.esperado}`}`)
  }
  const distinto = GRUPOS.some((g, i) => conteos[i] !== g.esperado && !(yaMigrada && conteos[i] === 0))
  if (!aplicar) {
    console.log(`\nSimulación: no se escribió nada.${distinto ? ' Hay conteos distintos a los confirmados: revísalos antes de aplicar.' : ''} Repite con --aplicar después del respaldo.`)
    return
  }
  if (distinto && !forzar) throw new Error('Los conteos no coinciden con los confirmados (ver "esperado"). Revisa los datos o usa --forzar.')

  await asegurarEsquemaCohortes(db)
  const tx = await db.transaction('write')
  try {
    for (const [programa, numero, estado, descripcion] of COHORTES) {
      await tx.execute({
        sql: `INSERT OR IGNORE INTO cohortes (programa_codigo, numero, nombre, descripcion, estado) VALUES (?, ?, ?, ?, ?)`,
        args: [programa, numero, `Cohorte ${numero}`, descripcion, estado],
      })
    }
    for (const g of GRUPOS.filter(g => g.numero !== null)) {
      await tx.execute({
        sql: `UPDATE inscripciones_cursos SET id_cohorte = (SELECT id_cohorte FROM cohortes WHERE programa_codigo = ? AND numero = ?)
              WHERE id_cohorte IS NULL AND id_inscripcion IN (SELECT ic.id_inscripcion FROM inscripciones_cursos ic WHERE ${g.condicion})`,
        args: [g.programa, g.numero],
      })
    }
    // Verificación dentro de la transacción: cada cohorte debe tener exactamente lo esperado
    const r = await tx.execute(`SELECT c.programa_codigo, c.numero, c.estado, COUNT(ic.id_inscripcion) AS n
                                FROM cohortes c LEFT JOIN inscripciones_cursos ic ON ic.id_cohorte = c.id_cohorte
                                GROUP BY c.id_cohorte ORDER BY c.programa_codigo, c.numero`)
    console.log('\nResultado:')
    for (const f of r.rows as any[]) {
      const esperado = GRUPOS.find(g => g.programa === f.programa_codigo && g.numero === f.numero)?.esperado
      console.log(`${String(f.n).padStart(4)}  ${f.programa_codigo} Cohorte ${f.numero} (${f.estado})`)
      if (!forzar && esperado !== undefined && Number(f.n) !== esperado) throw new Error(`${f.programa_codigo} Cohorte ${f.numero} quedó con ${f.n}, se esperaban ${esperado}`)
    }
    await tx.commit()
    console.log('\nListo: cohortes creadas y asignadas.')
  } catch (e) {
    await tx.rollback()
    console.error('\nSe revirtió todo; no se escribió nada.')
    throw e
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
