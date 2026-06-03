/**
 * Genera 5 nuevas solicitudes de afiliación para el panel de FORMACIÓN.
 * Inserta en 'estudiantes' e 'inscripciones_cursos' con programa 'AFILIACION'.
 * 
 * Uso:
 *   pnpm tsx src/scripts/generate_afiliados.ts
 */

import { db } from '../lib/db.js'

const TEST_DATA = [
  { nombre: 'Ricardo Montaner', cedula: 'V-11.222.333', email: 'ricardo.m@test.com', tlf: '+58 414 7770011' },
  { nombre: 'Gaby Espino', cedula: 'V-19.444.555', email: 'gaby.e@test.com', tlf: '+58 424 7770022' },
  { nombre: 'Edgar Ramírez', cedula: 'V-16.666.777', email: 'edgar.r@test.com', tlf: '+58 412 7770033' },
  { nombre: 'Maite Delgado', cedula: 'V-14.888.999', email: 'maite.d@test.com', tlf: '+58 416 7770044' },
  { nombre: 'Oscar D Leon', cedula: 'V-10.000.111', email: 'oscar.d@test.com', tlf: '+58 426 7770055' },
  { nombre: 'Juan Perez', cedula: 'V-12345678', email: 'juan.perez@test.com', tlf: '+58 414 0000001' },
  { nombre: 'Maria Garcia', cedula: 'V-87654321', email: 'maria.garcia@test.com', tlf: '+58 414 0000002' },
  { nombre: 'Luis Rodriguez', cedula: 'V-11122233', email: 'luis.rod@test.com', tlf: '+58 414 0000003' },
  { nombre: 'Ana Martinez', cedula: 'V-44455566', email: 'ana.martinez@test.com', tlf: '+58 414 0000004' },
  { nombre: 'Pedro Lopez', cedula: 'V-77788899', email: 'pedro.lopez@test.com', tlf: '+58 414 0000005' },
]

async function run() {
  console.log('🚀 Generando 5 nuevas solicitudes de AFILIACIÓN para el panel de Formación...\n')

  let creados = 0
  const now = new Date().toISOString()

  for (const a of TEST_DATA) {
    try {
      // 1. Crear Persona
      const [nombres, ...apellidosArr] = (a.nombre as string).split(' ');
      const apellidos = apellidosArr.join(' ');
      const cleanedCedula = a.cedula.replace(/\D/g, '');
      const resP = await db.execute({
        sql: `INSERT INTO personas (nombres, apellidos, cedula, email, telefono)
              VALUES (?, ?, ?, ?, ?) 
              ON CONFLICT(email) DO UPDATE SET nombres=excluded.nombres
              RETURNING id`,
        args: [nombres || a.nombre, apellidos || '', cleanedCedula, a.email, a.tlf]
      })
      const idPersona = resP.rows[0].id

      // 2. Crear Estudiante
      const insEst = await db.execute({
        sql: `INSERT INTO estudiantes (id_persona, tipo) 
              VALUES (?, 'Regular') 
              ON CONFLICT(id_persona) DO UPDATE SET tipo=excluded.tipo
              RETURNING id_estudiante`,
        args: [idPersona]
      })
      const idEst = insEst.rows[0].id_estudiante

      // 3. Crear Inscripción (Solicitud)
      await db.execute({
        sql: `INSERT INTO inscripciones_cursos 
              (id_estudiante, programa_codigo, tipo_inscripcion, estatus, creado_en)
              VALUES (?, 'AFILIACION', 'programa', 'Preinscrito', ?)`,
        args: [idEst, now],
      })

      console.log(`  ✓ Solicitud creada: ${a.nombre} (id_estudiante: ${idEst})`)
      creados++
    } catch (e: any) {
      console.error(`  ✗ Error con ${a.nombre}:`, e.message)
    }
  }

  console.log(`\n✅ Proceso finalizado. Creados: ${creados}`)
}

run().catch(console.error)
