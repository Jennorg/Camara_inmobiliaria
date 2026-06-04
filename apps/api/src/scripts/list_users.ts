import { db } from '../lib/db.js'

async function run() {
  const res = await db.execute('SELECT email, roles FROM users LIMIT 20')
  console.log('--- USUARIOS EN BD ---')
  res.rows.forEach(r => {
    console.log(`Email: ${r.email} | Roles: ${r.roles}`)
  })
}

run().catch(console.error)
