
import { db } from '../lib/db.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateFullSeed() {
  try {
    // List of tables to export
    const tables = [
      'users',
      'agremiados',
      'noticias',
      'junta_directiva',
      'normativas',
      'convenios',
      'cursos',
      'preinscripciones_programas',
      'agremiados_datos_empresa',
      'invitaciones_corporativas'
    ];

    let seedContent = "import { Client } from '@libsql/client';\n\n";
    seedContent += "export async function seedFull(db: Client) {\n";
    seedContent += "  console.log('Iniciando restauración completa de la base de datos...');\n\n";

    // Disable foreign key checks for the restoration
    seedContent += "  await db.execute('PRAGMA foreign_keys = OFF;');\n\n";

    for (const table of tables) {
      console.log(`Exportando tabla: ${table}...`);
      const result = await db.execute(`SELECT * FROM ${table}`);

      if (result.rows.length === 0) {
        console.log(`  - Tabla ${table} vacía, omitiendo.`);
        continue;
      }

      seedContent += `  // --- ${table.toUpperCase()} ---\n`;
      seedContent += `  await db.execute('DELETE FROM ${table}');\n`;

      for (const row of result.rows) {
        const columns = Object.keys(row);
        const values = Object.values(row).map(v => {
          if (v === null) return 'NULL';
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          return v;
        });

        seedContent += `  await db.execute('INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')})');\n`;
      }
      seedContent += "\n";
    }

    // Re-enable foreign key checks
    seedContent += "  await db.execute('PRAGMA foreign_keys = ON;');\n";
    seedContent += "  console.log('Base de datos restaurada con éxito.');\n";
    seedContent += "}\n";

    const outputPath = path.join(__dirname, 'seed-full.ts');
    fs.writeFileSync(outputPath, seedContent);
    console.log(`\n✅ Seed completo generado con éxito en: ${outputPath}`);

  } catch (error) {
    console.error('Error generando el seed:', error);
  }
}

generateFullSeed();
