import { db } from '../lib/db.js';

async function main() {
  try {
    console.log('Listing all tables in active DB...');
    const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tables:', tables.rows.map(r => r.name));

    for (const table of tables.rows) {
      const name = table.name as string;
      if (name.startsWith('sqlite_') || name.startsWith('_')) continue;
      const countRes = await db.execute(`SELECT COUNT(*) as count FROM "${name}"`);
      console.log(`Table "${name}": ${countRes.rows[0].count} rows`);
    }
  } catch (error) {
    console.error('Error listing tables:', error);
  }
}

main();
