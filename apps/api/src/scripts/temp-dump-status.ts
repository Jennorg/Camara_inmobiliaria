import { db } from '../lib/db.js';

async function main() {
  try {
    const res = await db.execute(`
      SELECT 
        a.id_afiliado, 
        p.nombres, 
        p.apellidos, 
        p.email as persona_email, 
        e.email as empresa_email, 
        a.tipo_afiliado, 
        a.estatus
      FROM afiliados a 
      JOIN personas p ON a.id_persona = p.id 
      LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
      WHERE (p.email LIKE '%pendiente%' OR (e.email IS NOT NULL AND e.email LIKE '%pendiente%'))
    `);
    
    console.log(`Afiliados con email que contiene 'pendiente': ${res.rows.length}`);
    if (res.rows.length > 0) {
      console.table(res.rows);
    } else {
      console.log('No se encontraron registros con esa palabra en el email.');
    }
  } catch (error) {
    console.error('Error al ejecutar la búsqueda:', error);
  }
}

main();
