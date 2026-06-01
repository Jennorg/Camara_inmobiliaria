import { db } from '../lib/db.js';
import { writeFileSync } from 'fs';

async function main() {
  try {
    const res = await db.execute(`
      SELECT 
        a.codigo,
        p.nombres,
        p.apellidos,
        p.email as persona_email,
        e.email as empresa_email,
        a.tipo_afiliado
      FROM afiliados a 
      JOIN personas p ON a.id_persona = p.id 
      LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
      WHERE (p.email LIKE '%pendiente%')
    `);
    
    // Filtrar según la lógica:
    // "si la empresa tiene email y por supuesto el afiliado es corporativo se considera que si tiene email, no lo quiero en la lista"
    const filtered = res.rows.filter((row: any) => {
      const isCorporate = row.tipo_afiliado.includes('Corporativo');
      const companyHasValidEmail = row.empresa_email && !row.empresa_email.includes('pendiente');
      
      if (isCorporate && companyHasValidEmail) {
        return false; // Se considera que sí tiene email, excluir
      }
      
      return true;
    });

    // Crear CSV
    const header = 'codigo,nombres,apellidos\n';
    const csvContent = filtered.map((row: any) => {
      return `"${row.codigo || ''}","${row.nombres || ''}","${row.apellidos || ''}"`;
    }).join('\n');

    const finalCsv = header + csvContent;
    writeFileSync('afiliados_sin_email.csv', finalCsv);
    
    console.log(`CSV generado exitosamente: afiliados_sin_email.csv`);
    console.log(`Total en el CSV: ${filtered.length}`);
    
  } catch (error) {
    console.error('Error al generar el CSV:', error);
  }
}

main();
