import { db } from '../lib/db.js'

async function run() {
  console.log('Running benchmark...')
  const startTotal = Date.now()

  // 1. Stats query
  const startStats = Date.now()
  const statsResult = await db.execute({
    sql: `
      SELECT a.tipo_afiliado, COUNT(*) as qty
      FROM afiliados a
      JOIN personas p ON a.id_persona = p.id
      WHERE a.estatus = 'Afiliado'
        AND a.activo = 1
        AND a.eliminado_en IS NULL
        AND p.eliminado_en IS NULL
        AND p.foto_url IS NOT NULL
        AND p.foto_url <> ''
      GROUP BY a.tipo_afiliado
    `,
    args: []
  })
  console.log('Stats query time:', Date.now() - startStats, 'ms')
  console.log('Stats result:', statsResult.rows)

  // 2. Count query for general public search
  const startCount = Date.now()
  const countSql = `
    SELECT COUNT(*) as total 
    FROM afiliados a 
    JOIN personas p ON a.id_persona = p.id 
    WHERE a.estatus = 'Afiliado'
      AND a.activo = 1
      AND a.eliminado_en IS NULL
      AND p.eliminado_en IS NULL
      AND p.foto_url IS NOT NULL
      AND p.foto_url <> ''
  `
  const countResult = await db.execute({ sql: countSql, args: [] })
  console.log('Count query time:', Date.now() - startCount, 'ms')
  console.log('Count result:', countResult.rows[0])

  // 3. Select page query with ORDER BY CAST
  const startSelectCast = Date.now()
  const selectCastSql = `
    SELECT a.id_afiliado, a.id_empresa,
           CASE
             WHEN a.tipo_afiliado = 'Corporativo' THEN COALESCE(NULLIF(TRIM(e.razon_social), ''), NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''))
             ELSE NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), '')
           END as nombre_completo,
           p.nombres, p.apellidos, a.codigo, p.foto_url,
           (strftime('%Y', 'now') - a.ano_inicio_servicio) as anos_servicio, a.fecha_afiliacion,
           (p.cedula_tipo || '-' || p.cedula) as cedula,
           a.tipo_afiliado
    FROM afiliados a
    JOIN personas p ON a.id_persona = p.id
    LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
    WHERE a.estatus = 'Afiliado'
      AND a.activo = 1
      AND a.eliminado_en IS NULL
      AND p.eliminado_en IS NULL
      AND p.foto_url IS NOT NULL
      AND p.foto_url <> ''
    ORDER BY CAST(a.codigo AS INTEGER) ASC
    LIMIT 20 OFFSET 0
  `
  const selectCastResult = await db.execute({ sql: selectCastSql, args: [] })
  console.log('Select with CAST query time:', Date.now() - startSelectCast, 'ms')

  // 4. Select page query WITHOUT CAST (e.g. order by id_afiliado or order by codigo)
  const startSelectNoCast = Date.now()
  const selectNoCastSql = `
    SELECT a.id_afiliado, a.id_empresa,
           CASE
             WHEN a.tipo_afiliado = 'Corporativo' THEN COALESCE(NULLIF(TRIM(e.razon_social), ''), NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''))
             ELSE NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), '')
           END as nombre_completo,
           p.nombres, p.apellidos, a.codigo, p.foto_url,
           (strftime('%Y', 'now') - a.ano_inicio_servicio) as anos_servicio, a.fecha_afiliacion,
           (p.cedula_tipo || '-' || p.cedula) as cedula,
           a.tipo_afiliado
    FROM afiliados a
    JOIN personas p ON a.id_persona = p.id
    LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
    WHERE a.estatus = 'Afiliado'
      AND a.activo = 1
      AND a.eliminado_en IS NULL
      AND p.eliminado_en IS NULL
      AND p.foto_url IS NOT NULL
      AND p.foto_url <> ''
    ORDER BY a.codigo ASC
    LIMIT 20 OFFSET 0
  `
  const selectNoCastResult = await db.execute({ sql: selectNoCastSql, args: [] })
  console.log('Select with normal ORDER BY query time:', Date.now() - startSelectNoCast, 'ms')

  console.log('Total benchmark time:', Date.now() - startTotal, 'ms')
}

run().catch(console.error)
