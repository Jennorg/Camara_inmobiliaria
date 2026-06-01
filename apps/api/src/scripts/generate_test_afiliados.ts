import { db } from '../lib/db.js';
import { randomUUID } from 'crypto';

async function run() {
  console.log('--- GENERANDO 5 SOLICITUDES DE TEST ---');
  let creados = 0;

  const tests = [
    { nombre: 'Test Juan', apellido: 'Perez', email: 'test_juan@example.com', programa: 'AFILIACION', tipo: 'Natural' },
    { nombre: 'Test Maria', apellido: 'Gomez', email: 'test_maria@example.com', programa: 'AFILIACION', tipo: 'Natural' },
    { nombre: 'Empresa Test A', apellido: 'Rep', email: 'test_empresa_a@example.com', programa: 'AFILIACION', tipo: 'Corporativo', razon: 'Test Corp A' },
    { nombre: 'Test Roberto', apellido: 'Sanz', email: 'test_roberto@example.com', programa: 'AFILIACION', tipo: 'Natural' },
    { nombre: 'Empresa Test B', apellido: 'Rep', email: 'test_empresa_b@example.com', programa: 'AFILIACION', tipo: 'Corporativo', razon: 'Test Corp B' },
  ];

  for (const t of tests) {
    try {
      const token = randomUUID();
      const expiracion = new Date();
      expiracion.setHours(expiracion.getHours() + 24);

      await db.execute({
        sql: `INSERT INTO verificaciones_preinscripciones (
                token_verificacion, email, nombres, apellidos, programa_interes, 
                tipo_afiliado, razon_social, fecha_expiracion
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          token, t.email, t.nombre, t.apellido, t.programa, 
          t.tipo, t.razon || null, expiracion.toISOString()
        ]
      });

      console.log(`✅ Creada preinscripción para: ${t.nombre} (Token: ${token})`);
      creados++;
    } catch (e: any) {
      console.error(`❌ Error con ${t.nombre}:`, e.message);
    }
  }

  console.log(`\nProceso finalizado. ${creados} registros de prueba insertados.`);
  console.log('Puedes usar estos tokens en la URL /cursos/verificar?token=... para simular el envío del expediente.');
}

run().catch(console.error);
