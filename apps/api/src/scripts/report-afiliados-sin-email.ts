import { createClient } from '@libsql/client';
import { env } from '../config/env.js';

const db = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN
});

async function main() {
  try {
    const pendingStatuses = [
      '1_PREINSCRIPCION',
      '2_EXPEDIENTE',
      '3_ENTREVISTA',
      '4_VERIFICACION',
      '5_CIBIR',
      '6_INSCRIPCION'
    ];

    const sql = `
      SELECT 
        a.id_afiliado,
        p.nombres,
        p.apellidos,
        COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') as nombre_persona,
        e.razon_social as nombre_empresa,
        a.tipo_afiliado,
        a.estatus,
        p.email as persona_email,
        e.email as empresa_email
      FROM afiliados a
      JOIN personas p ON a.id_persona = p.id
      LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
      WHERE a.estatus IN (${pendingStatuses.map(() => '?').join(',')})
        AND (COALESCE(p.email, '') = '')
        AND (
          a.tipo_afiliado NOT IN ('Corporativo', 'Agente Corporativo') 
          OR (a.id_empresa IS NULL OR COALESCE(e.email, '') = '')
        )
      ORDER BY a.fecha_registro DESC
    `;

    const result = await db.execute({
      sql,
      args: [...pendingStatuses]
    });

    console.log(`\n=== Afiliados PENDIENTES sin Email ===`);
    console.log(`Total encontrados: ${result.rows.length}\n`);

    if (result.rows.length === 0) {
      console.log('No se encontraron afiliados que cumplan los criterios.');
    } else {
      result.rows.forEach((row: any) => {
        const nombre = row.tipo_afiliado.includes('Corporativo') 
          ? `${row.nombre_persona} (${row.nombre_empresa || 'Empresa no vinculada'})`
          : row.nombre_persona;
        
        console.log(`- [${row.id_afiliado}] ${nombre}`);
        console.log(`  Tipo: ${row.tipo_afiliado} | Estatus: ${row.estatus}`);
        console.log(`  P.Email: ${row.persona_email || 'VACIO'} | E.Email: ${row.empresa_email || 'VACIO'}`);
        console.log('-----------------------------------');
      });
    }

  } catch (error) {
    console.error('Error al ejecutar el reporte:', error);
  } finally {
    // Cerrar conexión no es estrictamente necesario con libsql client en script corto pero buena práctica
  }
}

main();
