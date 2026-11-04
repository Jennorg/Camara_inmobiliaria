/**
 * Guarda en un archivo JSON la solvencia importada de cada afiliado (tabla solvencia_historial) y la
 * configuración de cobranza, para cargarla después en otra base (p. ej. producción).
 * Los afiliados se identifican por `codigo` (los id_afiliado cambian entre bases) y se guarda el nombre para verificar.
 *
 * Uso: pnpm tsx src/scripts/exportar-solvencia.ts [archivo.json]   (por defecto data/solvencia-AAAA-MM-DD.json)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { db } from '../lib/db.js'
import { env } from '../config/env.js'

const hoy = new Date().toISOString().slice(0, 10)
const destino = process.argv[2] ?? `data/solvencia-${hoy}.json`

const filas = (await db.execute(`
  SELECT a.codigo, a.id_afiliado,
         TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') || ' ' || COALESCE(e.razon_social, '')) AS nombre,
         s.periodo, s.estado, s.fuente, s.importado_en
  FROM solvencia_historial s
  JOIN afiliados a ON a.id_afiliado = s.id_afiliado
  LEFT JOIN personas p ON a.id_persona = p.id
  LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
  ORDER BY a.codigo, s.periodo`)).rows as any[]

const porAfiliado = new Map<string, { codigo: string | null; nombre: string; meses: { periodo: string; estado: string; fuente: string | null; importado_en: string }[] }>()
for (const f of filas) {
  const clave = f.codigo ? String(f.codigo) : `sin-codigo-${f.id_afiliado}`
  const a = porAfiliado.get(clave) ?? { codigo: f.codigo ? String(f.codigo) : null, nombre: String(f.nombre), meses: [] }
  a.meses.push({ periodo: String(f.periodo), estado: String(f.estado), fuente: f.fuente as string | null, importado_en: String(f.importado_en) })
  porAfiliado.set(clave, a)
}

const config = (await db.execute(`SELECT clave, valor FROM cms_configuracion WHERE clave = 'solvencia_inicio' OR clave LIKE 'cobranza_%' ORDER BY clave`)).rows
  .map(r => ({ clave: String(r.clave), valor: String(r.valor) }))

const afiliados = [...porAfiliado.values()]
const salida = {
  generado_en: new Date().toISOString(),
  origen: new URL(env.TURSO_DATABASE_URL.replace('libsql://', 'https://')).hostname,
  clave_de_afiliado: 'codigo (afiliados.codigo); verificar también el nombre al cargar',
  resumen: {
    afiliados: afiliados.length,
    meses: filas.length,
    sin_codigo: afiliados.filter(a => !a.codigo).length,
    por_fuente: Object.fromEntries([...new Set(filas.map(f => String(f.fuente)))].map(fu => [fu, filas.filter(f => String(f.fuente) === fu).length])),
  },
  configuracion: config,
  afiliados,
}
mkdirSync(dirname(destino), { recursive: true })
writeFileSync(destino, JSON.stringify(salida, null, 1) + '\n')
console.log(`Guardado en ${destino}`)
console.log(JSON.stringify(salida.resumen), '\nconfiguración:', config)
process.exit(0)
