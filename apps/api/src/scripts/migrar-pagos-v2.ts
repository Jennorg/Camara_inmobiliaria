/**
 * Reconstruye la tabla `pagos` para el cobro de cursos (fase 2 del módulo financiero):
 *   - id_afiliado pasa a ser opcional y se añade id_estudiante (público general que paga en taquilla)
 *   - CHECK: todo pago tiene afiliado o estudiante
 *   - FK a afiliados pasa de ON DELETE CASCADE a RESTRICT (borrar un afiliado no borra ventas)
 *   - tipo_concepto admite 'programa' y se añade codigo_arancel (rellenado para los pagos existentes)
 *
 * SQLite no permite quitar un NOT NULL ni cambiar una FK con ALTER, por eso se copia a una tabla nueva.
 * Todo corre en un único `db.migrate()` (FK desactivadas, transacción): o se aplica completo o nada.
 * HAZ UN RESPALDO ANTES: turso db shell <db> .dump > respaldo.sql
 *
 * Uso (simula por defecto, --aplicar escribe en la BD):
 *   pnpm tsx src/scripts/migrar-pagos-v2.ts [--aplicar]
 */
import { db } from '../lib/db.js'

const aplicar = process.argv.includes('--aplicar')

const COLUMNAS_COPIADAS = [
  'id_pago', 'numero_recibo', 'id_afiliado', 'id_inscripcion_curso', 'id_edicion_cibir',
  'tipo_concepto', 'descripcion_concepto', 'metodo_pago', 'moneda', 'monto', 'monto_usd_equivalente',
  'tasa_bcv', 'banco_origen', 'banco_destino', 'referencia', 'titular_origen', 'telefono_origen',
  'comprobante_url', 'estatus', 'origen_registro', 'registrado_por', 'verificado_por', 'fecha_pago',
  'fecha_verificacion', 'motivo_rechazo', 'notas', 'creado_en', 'actualizado_en', 'eliminado_en',
  'periodo', 'meses_cubiertos',
]

const CREATE_PAGOS_V2 = `CREATE TABLE pagos_v2 (
  id_pago               INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_recibo         TEXT UNIQUE NOT NULL,
  id_afiliado           INTEGER REFERENCES afiliados(id_afiliado) ON DELETE RESTRICT,
  id_estudiante         INTEGER REFERENCES estudiantes(id_estudiante) ON DELETE RESTRICT,
  id_inscripcion_curso  INTEGER REFERENCES inscripciones_cursos(id_inscripcion) ON DELETE SET NULL,
  id_edicion_cibir      INTEGER REFERENCES ediciones_cibir(id_edicion) ON DELETE SET NULL,
  tipo_concepto         TEXT NOT NULL CHECK (tipo_concepto IN ('formalizacion_afiliacion', 'curso_cibir', 'mensualidad', 'curso', 'programa', 'otro')),
  codigo_arancel        TEXT,
  descripcion_concepto  TEXT NOT NULL,
  metodo_pago           TEXT NOT NULL CHECK (metodo_pago IN (
                          'efectivo_usd', 'efectivo_bs', 'pago_movil',
                          'transferencia_bs', 'zelle', 'pos_debito', 'binance_usdt', 'otro'
                        )),
  moneda                TEXT NOT NULL CHECK (moneda IN ('USD', 'VES')),
  monto                 REAL NOT NULL,
  monto_usd_equivalente REAL NOT NULL,
  tasa_bcv              REAL,
  banco_origen          TEXT,
  banco_destino         TEXT,
  referencia            TEXT,
  titular_origen        TEXT,
  telefono_origen       TEXT,
  comprobante_url       TEXT,
  estatus               TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estatus IN ('Pendiente', 'Verificado', 'Rechazado', 'Anulado')),
  origen_registro       TEXT NOT NULL DEFAULT 'admin' CHECK (origen_registro IN ('afiliado', 'admin')),
  registrado_por        INTEGER REFERENCES users(id),
  verificado_por        INTEGER REFERENCES users(id),
  fecha_pago            TEXT NOT NULL,
  fecha_verificacion    TEXT,
  motivo_rechazo        TEXT,
  notas                 TEXT,
  creado_en             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  actualizado_en        TEXT,
  eliminado_en          TEXT,
  periodo               TEXT,
  meses_cubiertos       INTEGER NOT NULL DEFAULT 1,
  CHECK (id_afiliado IS NOT NULL OR id_estudiante IS NOT NULL)
)`

// Concepto de los pagos ya existentes (todos tienen afiliado); la formalización usa el arancel de inscripción por tipo
const CODIGO_ARANCEL_EXISTENTE = `CASE p.tipo_concepto
  WHEN 'mensualidad' THEN 'mensualidad_base'
  WHEN 'curso_cibir' THEN 'curso_cibir'
  WHEN 'formalizacion_afiliacion' THEN CASE a.tipo_afiliado
    WHEN 'Corporativo' THEN 'inscripcion_corporativo'
    WHEN 'Agente Corporativo' THEN 'inscripcion_agente'
    ELSE 'inscripcion_natural' END
  ELSE NULL END`

async function main() {
  const info = await db.execute('PRAGMA table_info(pagos)')
  const columnas = info.rows.map(r => String(r.name))
  if (columnas.includes('id_estudiante')) {
    console.log('pagos ya está migrada (tiene id_estudiante). Nada que hacer.')
    return
  }
  const faltan = COLUMNAS_COPIADAS.filter(c => !columnas.includes(c))
  if (faltan.length) throw new Error(`pagos no tiene las columnas esperadas: ${faltan.join(', ')}. Corre primero initdb.`)

  const antes = Number((await db.execute('SELECT COUNT(*) AS n FROM pagos')).rows[0].n)
  console.log(`pagos: ${antes} filas a copiar.`)
  if (!aplicar) {
    console.log('Simulación: no se escribió nada. Repite con --aplicar después del respaldo.')
    return
  }

  const cols = COLUMNAS_COPIADAS.join(', ')
  await db.migrate([
    CREATE_PAGOS_V2,
    `INSERT INTO pagos_v2 (${cols}, codigo_arancel)
       SELECT ${COLUMNAS_COPIADAS.map(c => `p.${c}`).join(', ')}, ${CODIGO_ARANCEL_EXISTENTE}
       FROM pagos p LEFT JOIN afiliados a ON a.id_afiliado = p.id_afiliado`,
    'DROP TABLE pagos',
    'ALTER TABLE pagos_v2 RENAME TO pagos',
    'CREATE INDEX IF NOT EXISTS idx_pagos_afiliado ON pagos(id_afiliado)',
    'CREATE INDEX IF NOT EXISTS idx_pagos_estudiante ON pagos(id_estudiante)',
    'CREATE INDEX IF NOT EXISTS idx_pagos_estatus ON pagos(estatus)',
    'CREATE INDEX IF NOT EXISTS idx_pagos_recibo ON pagos(numero_recibo)',
    'CREATE INDEX IF NOT EXISTS idx_pagos_edicion_cibir ON pagos(id_edicion_cibir)',
    'CREATE INDEX IF NOT EXISTS idx_pagos_inscripcion ON pagos(id_inscripcion_curso)',
  ])

  const despues = Number((await db.execute('SELECT COUNT(*) AS n FROM pagos')).rows[0].n)
  const huerfanos = await db.execute('PRAGMA foreign_key_check(pagos)')
  console.log(`pagos: ${despues} filas después (antes ${antes}).`)
  if (despues !== antes) throw new Error('¡El número de filas no coincide! Restaura el respaldo.')
  if (huerfanos.rows.length) console.warn(`Aviso: ${huerfanos.rows.length} referencias rotas en pagos (ya existían antes).`)
  console.log('Migración aplicada.')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
