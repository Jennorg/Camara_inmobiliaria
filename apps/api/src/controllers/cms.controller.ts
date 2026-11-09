import { Request, Response } from 'express';
import { actasPublicadas } from '../services/asambleas.service.js';
import { db } from '../lib/db.js';
import { borrarLogico, marcarBorrado, modoDeBorrado } from '../lib/borrado.js';
import { CATEGORIA_OTROS, slugify } from '../config/secciones-normativa.js';

// ─────────────────────────────────────────────────────────────────────────────
// NOTICIAS  — Schema: id_noticia, titulo, contenido, imagen_url, publicado, creado_en
// ─────────────────────────────────────────────────────────────────────────────

export const getNoticias = async (req: Request, res: Response) => {
  try {
    const { publicado } = req.query;
    let sql = 'SELECT * FROM cms_noticias WHERE eliminado_en IS NULL';
    const args: any[] = [];
    if (publicado !== undefined) {
      const isPub = publicado === '1' || publicado === 'true';
      sql += ' AND (publicado = ? OR publicado = ? OR publicado IS NULL)';
      args.push(isPub ? 1 : 0, isPub ? '1' : '0');
    }
    sql += ' ORDER BY CASE WHEN orden IS NULL OR orden = 0 THEN 999999 ELSE orden END ASC, fecha_publicacion DESC';
    const result = await db.execute({ sql, args });
    let noticias: any[] = [...result.rows];

    // Incluir automáticamente los cursos marcados como solo_informativo
    if (publicado === undefined || publicado === '1' || publicado === 'true') {
      try {
        const cursosRes = await db.execute({
          sql: `SELECT id_curso, titulo, descripcion as contenido, imagen_url, estatus, solo_informativo, fecha_inicio as fecha_evento, creado_en as fecha_publicacion, COALESCE(orden, 0) as orden
                FROM cursos 
                WHERE (solo_informativo = ? OR estatus = ?)
                  AND LOWER(TRIM(COALESCE(estatus, ''))) NOT IN ('cerrado', 'borrador', 'finalizado', 'concluido', 'inactivo')
                  AND eliminado_en IS NULL
                  AND imagen_url IS NOT NULL AND LENGTH(TRIM(imagen_url)) > 0
                ORDER BY CASE WHEN orden IS NULL OR orden = 0 THEN 999999 ELSE orden END ASC, creado_en DESC`,
          args: [1, 'Solo Informativo']
        });
        
        const cursosAsNoticias = cursosRes.rows.map((c: any) => ({
          id_noticia: `curso_${c.id_curso}`,
          titulo: c.titulo,
          contenido: c.contenido || '',
          resumen: '[SOLO_IMAGEN]',
          imagen_url: c.imagen_url,
          categoria: 'Formación',
          tag: 'solo_imagen',
          fecha_publicacion: c.fecha_publicacion,
          publicado: 1,
          fecha_evento: c.fecha_evento,
          hora_evento: null,
          lugar_evento: null,
          orden: c.orden
        }));

        noticias = [...cursosAsNoticias, ...noticias].sort((a: any, b: any) => {
          const ordA = a.orden !== undefined && a.orden !== null && Number(a.orden) > 0 ? Number(a.orden) : 999999;
          const ordB = b.orden !== undefined && b.orden !== null && Number(b.orden) > 0 ? Number(b.orden) : 999999;
          if (ordA !== ordB) return ordA - ordB;
          const dateA = new Date(a.fecha_publicacion || 0).getTime();
          const dateB = new Date(b.fecha_publicacion || 0).getTime();
          return dateB - dateA;
        });
      } catch (err) {
        console.error('Error al incluir cursos solo_informativo en getNoticias:', err);
      }
    }

    return res.json({ success: true, data: noticias });
  } catch (error) {
    console.error('getNoticias:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener noticias' });
  }
};

const generateSlug = (str: string) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') + '-' + Date.now();
}

const normalizeCargo = (cargo: string) => {
  if (!cargo) return '';
  let key = cargo.trim().toLowerCase();
  
  // Replace accents
  key = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Normalize gendered prefixes
  if (key.startsWith('directora')) {
    key = 'director' + key.substring(9);
  } else if (key.startsWith('vicepresidenta')) {
    key = 'vicepresidente' + key.substring(14);
  } else if (key.startsWith('presidenta')) {
    key = 'presidente' + key.substring(10);
  } else if (key.startsWith('secretaria')) {
    key = 'secretario' + key.substring(10);
  } else if (key.startsWith('tesorera')) {
    key = 'tesorero' + key.substring(8);
  }
  
  // Replace spaces/special characters with underscores
  return key.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export const createNoticia = async (req: Request, res: Response) => {
  try {
    const { titulo, contenido, resumen, imagen_url, categoria, tag, publicado, fecha_evento, hora_evento, lugar_evento, posicion_imagen } = req.body;
    const finalContenido = contenido || resumen;
    if (!titulo || !finalContenido) {
      return res.status(400).json({ success: false, message: 'El título y el contenido son requeridos' });
    }
    const slug = generateSlug(titulo);
    const result = await db.execute({
      sql: `INSERT INTO cms_noticias (titulo, slug, contenido, resumen, imagen_url, categoria, tag, publicado, fecha_evento, hora_evento, lugar_evento, posicion_imagen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [
        titulo,
        slug,
        finalContenido,
        resumen ?? null,
        imagen_url ?? null,
        categoria ?? 'Noticias',
        tag ?? null,
        publicado !== undefined ? (publicado ? 1 : 0) : 1,
        fecha_evento ?? null,
        hora_evento ?? null,
        lugar_evento ?? null,
        posicion_imagen ?? 'center center'
      ]
    });
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('createNoticia:', error);
    return res.status(500).json({ success: false, message: 'Error al crear noticia' });
  }
};

export const updateNoticia = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { titulo, contenido, resumen, imagen_url, categoria, tag, publicado, fecha_evento, hora_evento, lugar_evento, posicion_imagen } = req.body;
    const finalContenido = contenido || resumen;
    const result = await db.execute({
      sql: `UPDATE cms_noticias 
            SET titulo=?, contenido=?, resumen=?, imagen_url=?, categoria=?, tag=?, publicado=?, fecha_evento=?, hora_evento=?, lugar_evento=?, posicion_imagen=?
            WHERE id_noticia=? RETURNING *`,
      args: [
        titulo,
        finalContenido,
        resumen ?? null,
        imagen_url ?? null,
        categoria ?? 'Noticias',
        tag ?? null,
        publicado ? 1 : 0,
        fecha_evento ?? null,
        hora_evento ?? null,
        lugar_evento ?? null,
        posicion_imagen ?? 'center center',
        id
      ]
    });
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Noticia no encontrada' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('updateNoticia:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar noticia' });
  }
};

export const deleteNoticia = async (req: Request, res: Response) => {
  try {
    const modo = modoDeBorrado(req, res);
    if (!modo) return;
    if (modo === 'definitivo') await db.execute({ sql: 'DELETE FROM cms_noticias WHERE id_noticia=?', args: [String(req.params.id)] });
    else await borrarLogico(db, 'cms_noticias', 'id_noticia', [String(req.params.id)], req.user?.id);
    marcarBorrado(res, modo);
    return res.json({ success: true, message: 'Noticia eliminada' });
  } catch (error) {
    console.error('deleteNoticia:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar noticia' });
  }
};

export const reorderNoticias = async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items debe ser un arreglo' });
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const idStr = String(item.id);
      if (idStr.startsWith('curso_')) {
        const idCurso = Number(idStr.replace('curso_', ''));
        await db.execute({
          sql: 'UPDATE cursos SET orden = ? WHERE id_curso = ?',
          args: [i + 1, idCurso]
        });
      } else {
        await db.execute({
          sql: 'UPDATE cms_noticias SET orden = ? WHERE id_noticia = ?',
          args: [i + 1, item.id]
        });
      }
    }
    return res.json({ success: true, message: 'Orden actualizado' });
  } catch (error) {
    console.error('reorderNoticias:', error);
    return res.status(500).json({ success: false, message: 'Error al reordenar noticias' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CURSOS CMS — Schema: id_cms_curso, id_curso (FK), slug, destacado
// ─────────────────────────────────────────────────────────────────────────────

export const getCursos = async (_req: Request, res: Response) => {
  try {
    const result = await db.execute('SELECT * FROM cms_cursos WHERE eliminado_en IS NULL ORDER BY id_cms_curso ASC');
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getCursos:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener cursos' });
  }
};

export const createCurso = async (req: Request, res: Response) => {
  try {
    const { id_curso, slug, destacado } = req.body;
    if (!slug) return res.status(400).json({ success: false, message: 'slug es requerido' });
    const result = await db.execute({
      sql: `INSERT INTO cms_cursos (id_curso, slug, destacado) VALUES (?, ?, ?) RETURNING *`,
      args: [id_curso ?? null, slug, destacado !== undefined ? (destacado ? 1 : 0) : 0]
    });
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('createCurso:', error);
    return res.status(500).json({ success: false, message: 'Error al crear curso CMS' });
  }
};

export const updateCurso = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { id_curso, slug, destacado } = req.body;
    const result = await db.execute({
      sql: `UPDATE cms_cursos SET id_curso=?, slug=?, destacado=? WHERE id_cms_curso=? RETURNING *`,
      args: [id_curso ?? null, slug, destacado ? 1 : 0, id]
    });
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('updateCurso:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar curso' });
  }
};

export const deleteCurso = async (req: Request, res: Response) => {
  try {
    const modo = modoDeBorrado(req, res);
    if (!modo) return;
    if (modo === 'definitivo') await db.execute({ sql: 'DELETE FROM cms_cursos WHERE id_cms_curso=?', args: [String(req.params.id)] });
    else await borrarLogico(db, 'cms_cursos', 'id_cms_curso', [String(req.params.id)], req.user?.id);
    marcarBorrado(res, modo);
    return res.json({ success: true, message: 'Curso eliminado' });
  } catch (error) {
    console.error('deleteCurso:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar curso' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIOS — Schema: id_convenio, nombre_aliado, descripcion, logo_url, link_web
// ─────────────────────────────────────────────────────────────────────────────

export const getConvenios = async (_req: Request, res: Response) => {
  try {
    const result = await db.execute('SELECT * FROM cms_convenios WHERE eliminado_en IS NULL ORDER BY id_convenio ASC');
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getConvenios:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener convenios' });
  }
};

export const createConvenio = async (req: Request, res: Response) => {
  try {
    const { nombre, descripcion, logo_url, link_web } = req.body;
    if (!nombre) {
      return res.status(400).json({ success: false, message: 'nombre es requerido' });
    }
    const result = await db.execute({
      sql: `INSERT INTO cms_convenios (nombre, descripcion, logo_url, link_web) VALUES (?, ?, ?, ?) RETURNING *`,
      args: [nombre, descripcion ?? null, logo_url ?? null, link_web ?? null]
    });
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('createConvenio:', error);
    return res.status(500).json({ success: false, message: 'Error al crear convenio' });
  }
};

export const updateConvenio = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, logo_url, link_web } = req.body;
    if (!nombre) {
      return res.status(400).json({ success: false, message: 'nombre es requerido' });
    }
    const result = await db.execute({
      sql: `UPDATE cms_convenios SET nombre=?, descripcion=?, logo_url=?, link_web=? WHERE id_convenio=? RETURNING *`,
      args: [nombre, descripcion ?? null, logo_url ?? null, link_web ?? null, id]
    });
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Convenio no encontrado' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('updateConvenio:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar convenio' });
  }
};

export const deleteConvenio = async (req: Request, res: Response) => {
  try {
    const modo = modoDeBorrado(req, res);
    if (!modo) return;
    if (modo === 'definitivo') await db.execute({ sql: 'DELETE FROM cms_convenios WHERE id_convenio=?', args: [String(req.params.id)] });
    else await borrarLogico(db, 'cms_convenios', 'id_convenio', [String(req.params.id)], req.user?.id);
    marcarBorrado(res, modo);
    return res.json({ success: true, message: 'Convenio eliminado' });
  } catch (error) {
    console.error('deleteConvenio:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar convenio' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTIVA — Schema: id_miembro, nombre, cargo, foto_url, orden
// ─────────────────────────────────────────────────────────────────────────────

export const getDirectiva = async (req: Request, res: Response) => {
  try {
    const result = await db.execute(`
      SELECT dc.*, 
             a.codigo,
             p.nombres,
             p.apellidos,
             p.nombres || ' ' || p.apellidos as nombre,
             p.foto_url as foto_url_miembro,
             COALESCE(NULLIF(TRIM(dc.foto_junta_url), ''), NULLIF(TRIM(p.foto_url), '')) as foto_url,
             NULLIF(TRIM(dc.foto_junta_url), '') as foto_junta_url,
             NULLIF(TRIM(dc.firma_url), '') as firma_url
      FROM directiva_cargos dc
      JOIN afiliados a ON dc.id_afiliado = a.id_afiliado
      JOIN personas p ON a.id_persona = p.id
      ORDER BY dc.orden ASC, dc.id ASC
    `);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getDirectiva:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener directiva' });
  }
};

export const createMiembroDirectiva = async (req: Request, res: Response) => {
  try {
    const { id_afiliado, cargo, cargo_canonical, periodo, orden, activo, foto_junta_url, firma_url } = req.body;
    if (!id_afiliado || !cargo) return res.status(400).json({ success: false, message: 'id_afiliado y cargo son requeridos' });

    // Validar duplicado de afiliado en el mismo período
    const checkAfi = await db.execute({
      sql: `SELECT 1 FROM directiva_cargos WHERE id_afiliado = ? AND periodo = ? LIMIT 1`,
      args: [Number(id_afiliado), periodo ?? null]
    });
    if (checkAfi.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'El afiliado ya forma parte de esta junta directiva' });
    }

    // Validar duplicado de cargo en el mismo período usando cargo_canonical (insensible a género/mayúsculas)
    const canonical = normalizeCargo(cargo_canonical || cargo);
    const checkCargo = await db.execute({
      sql: `SELECT 1 FROM directiva_cargos WHERE cargo_canonical = ? AND periodo = ? LIMIT 1`,
      args: [canonical, periodo ?? null]
    });
    if (checkCargo.rows.length > 0) {
      return res.status(400).json({ success: false, message: `El cargo "${cargo}" ya está asignado en esta junta directiva` });
    }

    const cleanFotoJunta = foto_junta_url && String(foto_junta_url).trim() ? String(foto_junta_url).trim() : null;
    const cleanFirma = firma_url && String(firma_url).trim() ? String(firma_url).trim() : null;

    const result = await db.execute({
      sql: `INSERT INTO directiva_cargos (id_afiliado, cargo, cargo_canonical, periodo, orden, activo, foto_junta_url, firma_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [Number(id_afiliado), cargo, canonical, periodo ?? null, orden ?? 0, activo === false ? 0 : 1, cleanFotoJunta, cleanFirma]
    });
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('createMiembroDirectiva:', error);
    return res.status(500).json({ success: false, message: 'Error al crear miembro' });
  }
};

export const updateMiembroDirectiva = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { id_afiliado, cargo, cargo_canonical, periodo, orden, activo, foto_junta_url, firma_url } = req.body;

    // Validar duplicado de afiliado en el mismo período (excluyendo el actual)
    const checkAfi = await db.execute({
      sql: `SELECT 1 FROM directiva_cargos WHERE id_afiliado = ? AND periodo = ? AND id <> ? LIMIT 1`,
      args: [Number(id_afiliado), periodo ?? null, id]
    });
    if (checkAfi.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'El afiliado ya forma parte de esta junta directiva' });
    }

    // Validar duplicado de cargo en el mismo período usando cargo_canonical (excluyendo el actual)
    const canonical = normalizeCargo(cargo_canonical || cargo);
    const checkCargo = await db.execute({
      sql: `SELECT 1 FROM directiva_cargos WHERE cargo_canonical = ? AND periodo = ? AND id <> ? LIMIT 1`,
      args: [canonical, periodo ?? null, id]
    });
    if (checkCargo.rows.length > 0) {
      return res.status(400).json({ success: false, message: `El cargo "${cargo}" ya está asignado en esta junta directiva` });
    }

    const cleanFotoJunta = foto_junta_url && String(foto_junta_url).trim() ? String(foto_junta_url).trim() : null;
    const cleanFirma = firma_url && String(firma_url).trim() ? String(firma_url).trim() : null;

    const result = await db.execute({
      sql: `UPDATE directiva_cargos SET id_afiliado=?, cargo=?, cargo_canonical=?, periodo=?, orden=?, activo=?, foto_junta_url=?, firma_url=? WHERE id=? RETURNING *`,
      args: [Number(id_afiliado), cargo, canonical, periodo ?? null, orden ?? 0, activo ? 1 : 0, cleanFotoJunta, cleanFirma, id]
    });
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Miembro no encontrado' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('updateMiembroDirectiva:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar miembro' });
  }
};

export const deleteMiembroDirectiva = async (req: Request, res: Response) => {
  try {
    await db.execute({ sql: 'DELETE FROM directiva_cargos WHERE id=?', args: [String(req.params.id)] });
    return res.json({ success: true, message: 'Miembro eliminado' });
  } catch (error) {
    console.error('deleteMiembroDirectiva:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar miembro' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HITOS — Schema: id_hito, anio, titulo, descripcion   (sin orden)
// ─────────────────────────────────────────────────────────────────────────────

export const getHitos = async (_req: Request, res: Response) => {
  try {
    const result = await db.execute('SELECT * FROM cms_hitos WHERE eliminado_en IS NULL ORDER BY año ASC, id_hito ASC');
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getHitos:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener hitos' });
  }
};

export const createHito = async (req: Request, res: Response) => {
  try {
    const { anio, titulo, descripcion } = req.body;
    if (!anio || !titulo) return res.status(400).json({ success: false, message: 'anio y titulo son requeridos' });
    const result = await db.execute({
      sql: `INSERT INTO cms_hitos (año, titulo, descripcion) VALUES (?, ?, ?) RETURNING *`,
      args: [anio, titulo, descripcion ?? null]
    });
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('createHito:', error);
    return res.status(500).json({ success: false, message: 'Error al crear hito' });
  }
};

export const updateHito = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { anio, titulo, descripcion } = req.body;
    const result = await db.execute({
      sql: `UPDATE cms_hitos SET año=?, titulo=?, descripcion=? WHERE id_hito=? RETURNING *`,
      args: [anio, titulo, descripcion ?? null, id]
    });
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Hito no encontrado' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('updateHito:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar hito' });
  }
};

export const deleteHito = async (req: Request, res: Response) => {
  try {
    const modo = modoDeBorrado(req, res);
    if (!modo) return;
    if (modo === 'definitivo') await db.execute({ sql: 'DELETE FROM cms_hitos WHERE id_hito=?', args: [String(req.params.id)] });
    else await borrarLogico(db, 'cms_hitos', 'id_hito', [String(req.params.id)], req.user?.id);
    marcarBorrado(res, modo);
    return res.json({ success: true, message: 'Hito eliminado' });
  } catch (error) {
    console.error('deleteHito:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar hito' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACION — Schema: clave (PK), valor, descripcion
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CMS_CONFIG: Record<string, string> = {
  redes_instagram: 'https://www.instagram.com/ciebolivar',
  redes_facebook: 'https://www.facebook.com/CIEBOLIVAR',
  redes_linkedin: 'https://linkedin.com/company/ciebolivar',
  redes_twitter: 'https://x.com/ciebolivar',
  redes_whatsapp: '+58 412-1234567',
  contacto_email: 'contacto@ciebo.org.ve',
  contacto_telefono: '+58 286-9611234',
  rif: 'J-30752538-0',
  hero_titulo: 'Cámara Inmobiliaria <br/> del Estado Bolívar',
  hero_subtitulo: 'Tu gremio de inmobiliarias y corredores certificados en Bolívar, Venezuela.',
  hero_img: '',
  convenios_marquee_titulo: 'Convenios y Beneficios',
  convenios_link: 'Conoce nuestros programas de formación inmobiliaria'
};

export const getConfig = async (_req: Request, res: Response) => {
  try {
    const result = await db.execute('SELECT * FROM cms_configuracion ORDER BY clave ASC');
    const config: Record<string, string> = { ...DEFAULT_CMS_CONFIG };
    for (const row of result.rows) {
      config[row.clave as string] = row.valor as string;
    }
    return res.json({ success: true, data: result.rows, config });
  } catch (error) {
    console.error('getConfig:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener configuración' });
  }
};

export const upsertConfig = async (req: Request, res: Response) => {
  try {
    const { clave, valor } = req.body;
    if (!clave || valor === undefined) return res.status(400).json({ success: false, message: 'clave y valor son requeridos' });
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO cms_configuracion (clave, valor, actualizado_en) VALUES (?, ?, ?)
            ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor, actualizado_en=excluded.actualizado_en`,
      args: [clave, String(valor), now]
    });
    return res.json({ success: true, message: 'Configuración guardada', data: { clave, valor } });
  } catch (error) {
    console.error('upsertConfig:', error);
    return res.status(500).json({ success: false, message: 'Error al guardar configuración' });
  }
};

export const upsertConfigBatch = async (req: Request, res: Response) => {
  try {
    const entries: { clave: string; valor: string }[] = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: 'Se espera un array de objetos {clave, valor}' });
    }
    const now = new Date().toISOString();
    for (const entry of entries) {
      await db.execute({
        sql: `INSERT INTO cms_configuracion (clave, valor, actualizado_en) VALUES (?, ?, ?)
              ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor, actualizado_en=excluded.actualizado_en`,
        args: [entry.clave, String(entry.valor ?? ''), now]
      });
    }
    return res.json({ success: true, message: `${entries.length} valores de configuración guardados` });
  } catch (error) {
    console.error('upsertConfigBatch:', error);
    return res.status(500).json({ success: false, message: 'Error al guardar configuración en batch' });
  }
};

export const deleteConfig = async (req: Request, res: Response) => {
  try {
    await db.execute({ sql: 'DELETE FROM cms_configuracion WHERE clave=?', args: [String(req.params.clave)] });
    return res.json({ success: true, message: 'Clave eliminada' });
  } catch (error) {
    console.error('deleteConfig:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar clave de configuración' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINAS DINÁMICAS — Schema: slug (PK), contenido, actualizado_en
// ─────────────────────────────────────────────────────────────────────────────

export const getPaginasList = async (_req: Request, res: Response) => {
  return res.json({ success: true, data: [] });
};

export const getPaginaBySlug = async (_req: Request, res: Response) => {
  return res.status(404).json({ success: false, message: 'Página no encontrada' });
};

export const upsertPagina = async (_req: Request, res: Response) => {
  return res.status(400).json({ success: false, message: 'La gestión de páginas dinámicas ha sido deshabilitada en esta versión del esquema.' });
};

export const deletePagina = async (_req: Request, res: Response) => {
  return res.json({ success: true, message: 'Página eliminada o no existente' });
};

// ─────────────────────────────────────────────────────────────────────────────
// NORMATIVAS — Schema: id_normativa, titulo, url_archivo, tipo, creado_en
// ─────────────────────────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

// Una categoría es válida si es una sección existente (nombre exacto), vacía o «Otros» (solo admin; lo exige la ruta).
const categoriaValida = async (categoria: unknown): Promise<boolean> => {
  if (!categoria || categoria === CATEGORIA_OTROS) return true;
  if (typeof categoria !== 'string') return false;
  const r = await db.execute({ sql: 'SELECT 1 FROM cms_normativa_secciones WHERE nombre = ?', args: [categoria] });
  return r.rows.length > 0;
};
const CATEGORIA_INVALIDA = 'La categoría no existe: elige una sección del Marco Legal';

// Las actas publicadas desde la gestión de asambleas van a la sección de slug «actas-de-asamblea» (el slug no cambia al
// renombrar) y solo si es pública; se rotulan con su nombre actual.
const ACTAS_SLUG = 'actas-de-asamblea';
const actasDeSeccion = async (nombre: string) => (await actasPublicadas()).map(a => ({ ...a, categoria: nombre }));

const SQL_NORMATIVAS_PUBLICAS = `SELECT n.id_normativa, n.titulo, n.descripcion, n.url_archivo, n.categoria, n.orden, n.creado_en
  FROM cms_normativas n JOIN cms_normativa_secciones s ON s.nombre = n.categoria AND s.publica = 1
  WHERE n.activo = 1 AND n.eliminado_en IS NULL`;

// Privacidad: solo documentos de secciones públicas (el JOIN excluye privadas, «Otros», nulas y desconocidas).
export const publicListNormativas = async (req: Request, res: Response) => {
  try {
    const categoria = typeof req.query.categoria === 'string' ? req.query.categoria : '';
    const args: any[] = [];
    let sql = SQL_NORMATIVAS_PUBLICAS;
    if (categoria) {
      sql += ` AND n.categoria = ?`;
      args.push(categoria);
    }
    sql += ` ORDER BY n.orden ASC, n.creado_en DESC`;
    const [result, seccionActas] = await Promise.all([
      db.execute({ sql, args }),
      db.execute({ sql: 'SELECT nombre FROM cms_normativa_secciones WHERE slug = ? AND publica = 1', args: [ACTAS_SLUG] }),
    ]);
    const nombreActas = seccionActas.rows[0]?.nombre as string | undefined;
    const actas = nombreActas && (!categoria || categoria === nombreActas) ? await actasDeSeccion(nombreActas) : [];
    return res.json({ success: true, data: [...actas, ...result.rows] });
  } catch (error) {
    console.error('publicListNormativas:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener normativas' });
  }
};

// GET /api/public/normativas/secciones — secciones públicas con al menos un documento publicado.
export const publicListSeccionesNormativa = async (_req: Request, res: Response) => {
  try {
    const r = await db.execute(`SELECT s.nombre, s.slug, COUNT(n.id_normativa) AS total
      FROM cms_normativa_secciones s JOIN cms_normativas n ON n.categoria = s.nombre AND n.activo = 1 AND n.eliminado_en IS NULL
      WHERE s.publica = 1 GROUP BY s.id ORDER BY s.orden ASC, s.nombre ASC`);
    return res.json({ success: true, data: r.rows.map(x => ({ nombre: x.nombre, slug: x.slug, total: Number(x.total) })) });
  } catch (error) {
    console.error('publicListSeccionesNormativa:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener las secciones del Marco Legal' });
  }
};

export const getNormativas = async (req: Request, res: Response) => {
  try {
    const { categoria } = req.query;
    let sql = `SELECT * FROM cms_normativas WHERE eliminado_en IS NULL`;
    const args: any[] = [];
    if (categoria) { 
      sql += ` AND categoria = ?`; 
      args.push(categoria); 
    }
    sql += ` ORDER BY orden ASC, creado_en DESC`;
    const result = await db.execute({ sql, args });
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getNormativas:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener normativas' });
  }
};

// ── Secciones del Marco Legal (admin) ──────────────────────────────────────────
const leerSeccion = async (id: string) =>
  (await db.execute({ sql: 'SELECT * FROM cms_normativa_secciones WHERE id = ?', args: [id] })).rows[0] as any;

// Valida el nombre y que no choque (sin mayúsculas ni acentos) con el slug guardado ni con el nombre de otra sección.
const validarNombreSeccion = async (nombre: unknown, excluirId?: string): Promise<{ error?: [number, string]; nombre?: string; slug?: string }> => {
  const limpio = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
  if (!limpio || limpio.length > 80) return { error: [400, 'El nombre de la sección es obligatorio (máximo 80 caracteres)'] };
  const slug = slugify(limpio);
  if (!slug) return { error: [400, 'El nombre de la sección debe contener letras o números'] };
  if (slug === slugify(CATEGORIA_OTROS)) return { error: [400, '«Otros» es una categoría reservada: usa otro nombre'] };
  const otras = await db.execute({ sql: 'SELECT id, nombre, slug FROM cms_normativa_secciones WHERE id <> ?', args: [excluirId ?? -1] });
  if (otras.rows.some(x => x.slug === slug || slugify(String(x.nombre)) === slug)) {
    return { error: [409, `Ya existe una sección llamada «${limpio}» (o una muy parecida)`] };
  }
  return { nombre: limpio, slug };
};

export const listSeccionesNormativa = async (_req: Request, res: Response) => {
  try {
    const r = await db.execute(`SELECT s.id, s.nombre, s.slug, s.orden, s.publica, s.creado_en,
      (SELECT COUNT(*) FROM cms_normativas n WHERE n.categoria = s.nombre AND n.eliminado_en IS NULL) AS total
      FROM cms_normativa_secciones s ORDER BY s.orden ASC, s.nombre ASC`);
    return res.json({ success: true, data: r.rows.map(x => ({ ...x, total: Number(x.total) })) });
  } catch (error) {
    console.error('listSeccionesNormativa:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener las secciones' });
  }
};

export const createSeccionNormativa = async (req: Request, res: Response) => {
  try {
    const { nombre, publica } = req.body ?? {};
    if (publica !== undefined && typeof publica !== 'boolean') return res.status(400).json({ success: false, message: 'publica debe ser verdadero o falso' });
    const v = await validarNombreSeccion(nombre);
    if (v.error) return res.status(v.error[0]).json({ success: false, message: v.error[1] });
    const r = await db.execute({
      sql: `INSERT INTO cms_normativa_secciones (nombre, slug, orden, publica)
            VALUES (?, ?, (SELECT COALESCE(MAX(orden), -1) + 1 FROM cms_normativa_secciones), ?) RETURNING *`,
      args: [v.nombre!, v.slug!, publica === false ? 0 : 1],
    });
    return res.status(201).json({ success: true, data: { ...r.rows[0], total: 0 } });
  } catch (error) {
    console.error('createSeccionNormativa:', error);
    return res.status(500).json({ success: false, message: 'Error al crear la sección' });
  }
};

// Renombrar mueve sus documentos al nuevo nombre en el mismo lote; el slug (URL pública) no cambia.
export const updateSeccionNormativa = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const actual = await leerSeccion(id);
    if (!actual) return res.status(404).json({ success: false, message: 'Sección no encontrada' });
    const { nombre, publica, orden } = req.body ?? {};
    if (publica !== undefined && typeof publica !== 'boolean') return res.status(400).json({ success: false, message: 'publica debe ser verdadero o falso' });
    if (orden !== undefined && !Number.isInteger(orden)) return res.status(400).json({ success: false, message: 'orden debe ser un número entero' });
    let nuevoNombre = String(actual.nombre);
    if (nombre !== undefined) {
      const v = await validarNombreSeccion(nombre, id);
      if (v.error) return res.status(v.error[0]).json({ success: false, message: v.error[1] });
      nuevoNombre = v.nombre!;
    }
    await db.batch([
      {
        sql: 'UPDATE cms_normativa_secciones SET nombre = ?, publica = ?, orden = ? WHERE id = ?',
        args: [nuevoNombre, publica === undefined ? actual.publica : publica ? 1 : 0, orden ?? actual.orden, id],
      },
      { sql: 'UPDATE cms_normativas SET categoria = ? WHERE categoria = ?', args: [nuevoNombre, actual.nombre] },
    ], 'write');
    return res.json({ success: true, data: await leerSeccion(id) });
  } catch (error) {
    console.error('updateSeccionNormativa:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar la sección' });
  }
};

export const deleteSeccionNormativa = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const actual = await leerSeccion(id);
    if (!actual) return res.status(404).json({ success: false, message: 'Sección no encontrada' });
    // Comprueba y borra en una sola sentencia: no se borra si entre medias le añadieron un documento.
    const r = await db.execute({
      sql: `DELETE FROM cms_normativa_secciones WHERE id = ?
            AND NOT EXISTS (SELECT 1 FROM cms_normativas WHERE categoria = ? AND eliminado_en IS NULL)`,
      args: [id, actual.nombre],
    });
    if (r.rowsAffected === 0) {
      return res.status(409).json({ success: false, message: `La sección «${actual.nombre}» todavía tiene documentos: muévelos a otra sección o elimínalos antes de borrarla` });
    }
    return res.json({ success: true, message: 'Sección eliminada' });
  } catch (error) {
    console.error('deleteSeccionNormativa:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar la sección' });
  }
};

export const createNormativa = async (req: Request, res: Response) => {
  try {
    const { titulo, descripcion, url_archivo, categoria, orden, activo } = req.body as Record<string, unknown>;
    const t = typeof titulo === 'string' ? titulo.trim().toUpperCase() : '';
    const u = typeof url_archivo === 'string' ? url_archivo.trim() : '';
    
    if (!t || !u) {
      return res.status(400).json({ success: false, message: 'titulo y url_archivo son requeridos' });
    }
    if (!isValidUrl(u)) {
      return res.status(400).json({ success: false, message: 'url_archivo debe ser una URL http(s) válida' });
    }
    if (!(await categoriaValida(categoria))) {
      return res.status(400).json({ success: false, message: CATEGORIA_INVALIDA });
    }

    const result = await db.execute({
      sql: `INSERT INTO cms_normativas (titulo, descripcion, url_archivo, categoria, orden, activo) 
            VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [
        t, 
        (descripcion as string | null) || null, 
        u, 
        (categoria as string | null) || null, 
        Number(orden || 0), 
        activo === false ? 0 : 1
      ],
    });
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('createNormativa:', error);
    return res.status(500).json({ success: false, message: 'Error al crear normativa' });
  }
};

export const updateNormativa = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? '').trim();
    const { titulo, descripcion, url_archivo, categoria, orden, activo } = req.body as Record<string, unknown>;
    const t = typeof titulo === 'string' ? titulo.trim().toUpperCase() : '';
    const u = typeof url_archivo === 'string' ? url_archivo.trim() : '';
    
    if (!t || !u) {
      return res.status(400).json({ success: false, message: 'titulo y url_archivo son requeridos' });
    }
    if (!isValidUrl(u)) {
      return res.status(400).json({ success: false, message: 'url_archivo debe ser una URL http(s) válida' });
    }
    if (!(await categoriaValida(categoria))) {
      return res.status(400).json({ success: false, message: CATEGORIA_INVALIDA });
    }

    const result = await db.execute({
      sql: `UPDATE cms_normativas 
            SET titulo=?, descripcion=?, url_archivo=?, categoria=?, orden=?, activo=? 
            WHERE id_normativa=? RETURNING *`,
      args: [
        t, 
        (descripcion as string | null) || null, 
        u, 
        (categoria as string | null) || null, 
        Number(orden || 0), 
        activo === false ? 0 : 1,
        id
      ],
    });
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Normativa no encontrada' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('updateNormativa:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar normativa' });
  }
};

export const deleteNormativa = async (req: Request, res: Response) => {
  try {
    const modo = modoDeBorrado(req, res);
    if (!modo) return;
    if (modo === 'definitivo') await db.execute({ sql: 'DELETE FROM cms_normativas WHERE id_normativa=?', args: [String(req.params.id)] });
    else await borrarLogico(db, 'cms_normativas', 'id_normativa', [String(req.params.id)], req.user?.id);
    marcarBorrado(res, modo);
    return res.json({ success: true, message: 'Normativa eliminada' });
  } catch (error) {
    console.error('deleteNormativa:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar normativa' });
  }
};

export const deleteBatchNormativas = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Debe proporcionar un arreglo de IDs a eliminar' });
    }

    const modo = modoDeBorrado(req, res);
    if (!modo) return;
    const placeholders = ids.map(() => '?').join(',');
    const antes = (await db.execute({ sql: `SELECT * FROM cms_normativas WHERE id_normativa IN (${placeholders})`, args: ids.map(id => String(id)) })).rows;
    if (modo === 'definitivo') await db.execute({ sql: `DELETE FROM cms_normativas WHERE id_normativa IN (${placeholders})`, args: ids.map(id => String(id)) });
    else await borrarLogico(db, 'cms_normativas', 'id_normativa', ids.map(id => String(id)), req.user?.id);
    marcarBorrado(res, modo, { antes, resumen: `${modo === 'definitivo' ? 'eliminar definitivamente' : 'eliminar'} ${ids.length} documentos de Marco Legal` });

    return res.json({ success: true, message: `${ids.length} documentos eliminados correctamente` });
  } catch (error) {
    console.error('deleteBatchNormativas:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar documentos en lote' });
  }
};

export const reorderNormativas = async (req: Request, res: Response) => {
  try {
    const { items } = req.body as { items: Array<{ id: string | number; orden: number }> };
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Debe proporcionar un arreglo de items con id y orden' });
    }

    for (const item of items) {
      await db.execute({
        sql: `UPDATE cms_normativas SET orden = ? WHERE id_normativa = ?`,
        args: [Number(item.orden), String(item.id)],
      });
    }

    return res.json({ success: true, message: 'Orden de normativas actualizado' });
  } catch (error) {
    console.error('reorderNormativas:', error);
    return res.status(500).json({ success: false, message: 'Error al reordenar normativas' });
  }
};
