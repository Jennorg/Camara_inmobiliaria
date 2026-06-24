import { db } from '../lib/db.js';

async function main() {
  const sql = `
      SELECT a.*, (strftime('%Y', 'now') - a.ano_inicio_servicio) as anos_servicio,
             p.nombres, p.apellidos, 
             (p.cedula_tipo || '-' || p.cedula) as cedula, p.email, p.telefono, p.direccion, p.fecha_nacimiento, p.nivel_academico, p.foto_url,
             e.razon_social as empresa_razon_social, 
             e.rif_tipo as empresa_rif_tipo,
             e.rif_numero as empresa_rif_numero,
             e.logo_url as empresa_logo_url,
             e.website as empresa_website,
             e.email as empresa_email,
             e.telefono as empresa_telefono,
             COALESCE(e_redes.instagram, CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.instagram') ELSE NULL END) as instagram,
             COALESCE(e_redes.facebook, CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.facebook') ELSE NULL END) as facebook,
             COALESCE(e_redes.linkedin, CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.linkedin') ELSE NULL END) as linkedin,
             COALESCE(e_redes.twitter, CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.twitter') ELSE NULL END) as twitter,
             CASE 
                WHEN a.tipo_afiliado = 'Corporativo' THEN COALESCE(NULLIF(TRIM(e.razon_social), ''), NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''))
                ELSE NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), '')
             END as nombre_completo
      FROM afiliados a
      JOIN personas p ON a.id_persona = p.id
      LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
      LEFT JOIN (
        SELECT id_empresa, 
               CASE WHEN json_valid(redes_sociales) = 1 THEN json_extract(redes_sociales, '$.instagram') ELSE NULL END as instagram,
               CASE WHEN json_valid(redes_sociales) = 1 THEN json_extract(redes_sociales, '$.facebook') ELSE NULL END as facebook,
               CASE WHEN json_valid(redes_sociales) = 1 THEN json_extract(redes_sociales, '$.linkedin') ELSE NULL END as linkedin,
               CASE WHEN json_valid(redes_sociales) = 1 THEN json_extract(redes_sociales, '$.twitter') ELSE NULL END as twitter
        FROM empresas
      ) e_redes ON a.id_empresa = e_redes.id_empresa
      WHERE a.eliminado_en IS NULL
        AND p.eliminado_en IS NULL
        AND e.eliminado_en IS NULL
  `;
  const result = await db.execute(sql);
  console.log('Result rows count:', result.rows.length);
}

main().catch(console.error);
