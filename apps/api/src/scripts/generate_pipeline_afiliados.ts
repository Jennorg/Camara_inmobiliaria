/**
 * generate_pipeline_afiliados.ts
 * Genera 5 nuevas solicitudes para el PIPELINE de 9 pasos (tabla agremiados).
 * 
 * Uso:
 *   pnpm tsx src/scripts/generate_pipeline_afiliados.ts
 */

import { db } from '../lib/db.js'

const PIPELINE_DATA = [
  { nombre: 'Chino Miranda', cedula: 'V-21.222.333', email: 'chino.m@test.com', tlf: '+58 414 8880011' },
  { nombre: 'Nacho Mendoza', cedula: 'V-22.444.555', email: 'nacho.m@test.com',  tlf: '+58 424 8880022' },
  { nombre: 'Sheryl Rubio',  cedula: 'V-23.666.777', email: 'sheryl.r@test.com', tlf: '+58 412 8880033' },
  { nombre: 'Víctor Drija',  cedula: 'V-24.888.999', email: 'victor.d@test.com', tlf: '+58 416 8880044' },
  { nombre: 'Rosmeri Marval', cedula: 'V-25.000.111', email: 'rosmeri.m@test.com',tlf: '+58 426 8880055' },
]

async function run() {
  console.log('🚀 Generando 5 nuevas solicitudes para el PIPELINE de Afiliación (9 pasos)...\n')

  let creados = 0

  for (const a of PIPELINE_DATA) {
    try {
      const cleanedCedula = a.cedula.replace(/\D/g, '');
      await db.execute({
        sql: `INSERT INTO agremiados (nombre_completo, cedula_rif, email, telefono, estatus)
              VALUES (?, ?, ?, ?, '1_SOLICITUD')`,
        args: [a.nombre, cleanedCedula, a.email, a.tlf],
      })
      console.log(`  ✓ Solicitud creada: ${a.nombre} [1_SOLICITUD]`)
      creados++
    } catch (e: any) {
      console.error(`  ✗ Error con ${a.nombre}:`, e.message)
    }
  }

  console.log(`\n✅ Proceso finalizado. Creados: ${creados}`)
}

run().catch(console.error)
