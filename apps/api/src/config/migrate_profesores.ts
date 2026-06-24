import { db } from '../lib/db.js';

async function migrate() {
  console.log('--- Database Schema Migration: Profesores & Modulos ---');
  
  // 1. Create profesores table
  console.log('Creating table "profesores"...');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS profesores (
      id_profesor       INTEGER     PRIMARY KEY AUTOINCREMENT,
      id_persona        INTEGER     UNIQUE NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
      id_afiliado       INTEGER     UNIQUE REFERENCES afiliados(id_afiliado) ON DELETE SET NULL,
      creado_en         TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      actualizado_en    TEXT
    )
  `);
  console.log('OK: Table "profesores" created/exists.');

  // 2. Query existing data from modulos_curso to preserve them
  let oldModules: any[] = [];
  try {
    const tableInfo = await db.execute(`PRAGMA table_info(modulos_curso)`);
    const columns = tableInfo.rows.map((r: any) => r.name);
    
    if (columns.length > 0) {
      console.log('Found existing "modulos_curso" table. Fetching existing modules...');
      const result = await db.execute(`SELECT * FROM modulos_curso`);
      oldModules = result.rows;
      console.log(`Fetched ${oldModules.length} existing modules.`);
    }
  } catch (err: any) {
    console.log('Note: "modulos_curso" does not exist yet or error reading it:', err.message);
  }

  // 3. Drop old table
  console.log('Dropping old "modulos_curso" table...');
  await db.execute(`DROP TABLE IF EXISTS modulos_curso`);

  // 4. Recreate modulos_curso with the new schema (no obligatorio column, id_profesor instead of profesor text)
  console.log('Creating new "modulos_curso" table...');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS modulos_curso (
      id_curso      INTEGER NOT NULL REFERENCES cursos(id_curso) ON DELETE CASCADE,
      nombre_modulo TEXT NOT NULL,
      orden         INTEGER DEFAULT 0,
      id_profesor   INTEGER REFERENCES profesores(id_profesor) ON DELETE SET NULL,
      PRIMARY KEY (id_curso, nombre_modulo)
    )
  `);
  console.log('OK: Table "modulos_curso" recreated.');

  // 5. Re-insert preserved modules
  if (oldModules.length > 0) {
    console.log('Re-inserting course modules...');
    for (const m of oldModules) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO modulos_curso (id_curso, nombre_modulo, orden, id_profesor) VALUES (?, ?, ?, NULL)`,
        args: [m.id_curso, m.nombre_modulo || m.num_modulo || 'General', m.orden || 0]
      });
    }
    console.log('OK: Existing course modules restored.');
  }

  console.log('--- Migration Complete ---');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
