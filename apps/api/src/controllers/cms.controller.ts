import { Request, Response } from 'express';
import { db } from '../lib/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// NOTICIAS  — Schema: id_noticia, titulo, contenido, imagen_url, publicado, creado_en
// ─────────────────────────────────────────────────────────────────────────────

export const getNoticias = async (req: Request, res: Response) => {
  try {
    const { publicado } = req.query;
    let sql = 'SELECT * FROM cms_noticias';
    const args: any[] = [];
    if (publicado !== undefined) {
      sql += ' WHERE publicado = ?';
      args.push(publicado === '1' || publicado === 'true' ? 1 : 0);
    }
    sql += ' ORDER BY fecha_publicacion DESC';
    const result = await db.execute({ sql, args });
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getNoticias:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener noticias' });
  }
};

export const createNoticia = async (req: Request, res: Response) => {
  try {
    const { titulo, contenido, imagen_url, publicado } = req.body;
    if (!titulo || !contenido) {
      return res.status(400).json({ success: false, message: 'titulo y contenido son requeridos' });
    }
    const result = await db.execute({
      sql: `INSERT INTO cms_noticias (titulo, contenido, imagen_url, publicado)
            VALUES (?, ?, ?, ?) RETURNING *`,
      args: [titulo, contenido, imagen_url ?? null, publicado !== undefined ? (publicado ? 1 : 0) : 1]
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
    const { titulo, contenido, imagen_url, publicado } = req.body;
    const result = await db.execute({
      sql: `UPDATE cms_noticias SET titulo=?, contenido=?, imagen_url=?, publicado=?
            WHERE id_noticia=? RETURNING *`,
      args: [titulo, contenido, imagen_url ?? null, publicado ? 1 : 0, id]
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
    await db.execute({ sql: 'DELETE FROM cms_noticias WHERE id_noticia=?', args: [String(req.params.id)] });
    return res.json({ success: true, message: 'Noticia eliminada' });
  } catch (error) {
    console.error('deleteNoticia:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar noticia' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CURSOS CMS — Schema: id_cms_curso, id_curso (FK), slug, destacado
// ─────────────────────────────────────────────────────────────────────────────

export const getCursos = async (_req: Request, res: Response) => {
  try {
    const result = await db.execute('SELECT * FROM cms_cursos ORDER BY id_cms_curso ASC');
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
    await db.execute({ sql: 'DELETE FROM cms_cursos WHERE id_cms_curso=?', args: [String(req.params.id)] });
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
    const result = await db.execute('SELECT * FROM cms_convenios ORDER BY id_convenio ASC');
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
    await db.execute({ sql: 'DELETE FROM cms_convenios WHERE id_convenio=?', args: [String(req.params.id)] });
    return res.json({ success: true, message: 'Convenio eliminado' });
  } catch (error) {
    console.error('deleteConvenio:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar convenio' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTIVA — Schema: id_miembro, nombre, cargo, foto_url, orden
// ─────────────────────────────────────────────────────────────────────────────

export const getDirectiva = async (_req: Request, res: Response) => {
  try {
    const result = await db.execute('SELECT * FROM cms_directiva ORDER BY orden ASC, id_miembro ASC');
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getDirectiva:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener directiva' });
  }
};

export const createMiembroDirectiva = async (req: Request, res: Response) => {
  try {
    const { nombre, cargo, foto_url, orden } = req.body;
    if (!nombre || !cargo) return res.status(400).json({ success: false, message: 'nombre y cargo son requeridos' });
    const result = await db.execute({
      sql: `INSERT INTO cms_directiva (nombre, cargo, foto_url, orden) VALUES (?, ?, ?, ?) RETURNING *`,
      args: [nombre, cargo, foto_url ?? null, orden ?? 0]
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
    const { nombre, cargo, foto_url, orden } = req.body;
    const result = await db.execute({
      sql: `UPDATE cms_directiva SET nombre=?, cargo=?, foto_url=?, orden=? WHERE id_miembro=? RETURNING *`,
      args: [nombre, cargo, foto_url ?? null, orden ?? 0, id]
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
    await db.execute({ sql: 'DELETE FROM cms_directiva WHERE id_miembro=?', args: [String(req.params.id)] });
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
    const result = await db.execute('SELECT * FROM cms_hitos ORDER BY año ASC, id_hito ASC');
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
    await db.execute({ sql: 'DELETE FROM cms_hitos WHERE id_hito=?', args: [String(req.params.id)] });
    return res.json({ success: true, message: 'Hito eliminado' });
  } catch (error) {
    console.error('deleteHito:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar hito' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACION — Schema: clave (PK), valor, descripcion
// ─────────────────────────────────────────────────────────────────────────────

export const getConfig = async (_req: Request, res: Response) => {
  try {
    const result = await db.execute('SELECT * FROM cms_configuracion ORDER BY clave ASC');
    const config: Record<string, string> = {};
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
    const { clave, valor, descripcion } = req.body;
    if (!clave || valor === undefined) return res.status(400).json({ success: false, message: 'clave y valor son requeridos' });
    await db.execute({
      sql: `INSERT INTO cms_configuracion (clave, valor, descripcion) VALUES (?, ?, ?)
            ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor, descripcion=excluded.descripcion`,
      args: [clave, String(valor), descripcion ?? null]
    });
    return res.json({ success: true, message: 'Configuración guardada', data: { clave, valor } });
  } catch (error) {
    console.error('upsertConfig:', error);
    return res.status(500).json({ success: false, message: 'Error al guardar configuración' });
  }
};

export const upsertConfigBatch = async (req: Request, res: Response) => {
  try {
    const entries: { clave: string; valor: string; descripcion?: string }[] = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: 'Se espera un array de objetos {clave, valor}' });
    }
    for (const entry of entries) {
      await db.execute({
        sql: `INSERT INTO cms_configuracion (clave, valor, descripcion) VALUES (?, ?, ?)
              ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor, descripcion=excluded.descripcion`,
        args: [entry.clave, String(entry.valor), entry.descripcion ?? null]
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
  try {
    const result = await db.execute({
      sql: `SELECT slug, actualizado_en, length(contenido) AS contenido_len FROM cms_paginas ORDER BY slug ASC`,
      args: [],
    });
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getPaginasList:', error);
    return res.status(500).json({ success: false, message: 'Error al listar páginas CMS' });
  }
};

export const getPaginaBySlug = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ success: false, message: 'slug requerido' });
    const result = await db.execute({
      sql: `SELECT slug, contenido, actualizado_en FROM cms_paginas WHERE slug = ? LIMIT 1`,
      args: [slug],
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Página no encontrada' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('getPaginaBySlug:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener página CMS' });
  }
};

export const upsertPagina = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const { contenido } = req.body as { contenido?: string };
    if (!slug) return res.status(400).json({ success: false, message: 'slug requerido' });
    if (typeof contenido !== 'string' || contenido.length === 0) {
      return res.status(400).json({ success: false, message: 'contenido (JSON) es requerido' });
    }
    JSON.parse(contenido);
    const now = new Date().toISOString();
    const result = await db.execute({
      sql: `INSERT INTO cms_paginas (slug, contenido, actualizado_en)
            VALUES (?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
              contenido = excluded.contenido,
              actualizado_en = excluded.actualizado_en
            RETURNING slug, actualizado_en`,
      args: [slug, contenido, now],
    });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ success: false, message: 'contenido no es JSON válido' });
    }
    console.error('upsertPagina:', error);
    return res.status(500).json({ success: false, message: 'Error al guardar página CMS' });
  }
};

export const deletePagina = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || '').trim();
    await db.execute({ sql: `DELETE FROM cms_paginas WHERE slug = ?`, args: [slug] });
    return res.json({ success: true, message: 'Página eliminada' });
  } catch (error) {
    console.error('deletePagina:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar página CMS' });
  }
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

const CATEGORIAS_NORMATIVA = ['Leyes y Decretos', 'Reglamentos y Estatutos', 'Normas y Procedimientos', 'Actas de Asamblea', 'Otros'];

export const publicListNormativas = async (req: Request, res: Response) => {
  try {
    const { categoria } = req.query;
    let sql = `SELECT id_normativa, titulo, descripcion, url_archivo, categoria, orden, creado_en 
               FROM cms_normativas WHERE activo = 1`;
    const args: any[] = [];
    if (categoria) {
      sql += ` AND categoria = ?`;
      args.push(categoria);
    }
    sql += ` ORDER BY orden ASC, creado_en DESC`;
    const result = await db.execute({ sql, args });
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('publicListNormativas:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener normativas' });
  }
};

export const getNormativas = async (req: Request, res: Response) => {
  try {
    const { categoria } = req.query;
    let sql = `SELECT * FROM cms_normativas`;
    const args: any[] = [];
    if (categoria) { 
      sql += ` WHERE categoria = ?`; 
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

export const createNormativa = async (req: Request, res: Response) => {
  try {
    const { titulo, descripcion, url_archivo, categoria, orden, activo } = req.body as Record<string, unknown>;
    const t = typeof titulo === 'string' ? titulo.trim() : '';
    const u = typeof url_archivo === 'string' ? url_archivo.trim() : '';
    
    if (!t || !u) {
      return res.status(400).json({ success: false, message: 'titulo y url_archivo son requeridos' });
    }
    if (!isValidUrl(u)) {
      return res.status(400).json({ success: false, message: 'url_archivo debe ser una URL http(s) válida' });
    }
    if (categoria && !CATEGORIAS_NORMATIVA.includes(categoria as string)) {
      return res.status(400).json({ success: false, message: `categoria debe ser una de: ${CATEGORIAS_NORMATIVA.join(', ')}` });
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
    const t = typeof titulo === 'string' ? titulo.trim() : '';
    const u = typeof url_archivo === 'string' ? url_archivo.trim() : '';
    
    if (!t || !u) {
      return res.status(400).json({ success: false, message: 'titulo y url_archivo son requeridos' });
    }
    if (!isValidUrl(u)) {
      return res.status(400).json({ success: false, message: 'url_archivo debe ser una URL http(s) válida' });
    }
    if (categoria && !CATEGORIAS_NORMATIVA.includes(categoria as string)) {
      return res.status(400).json({ success: false, message: `categoria debe ser una de: ${CATEGORIAS_NORMATIVA.join(', ')}` });
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
    await db.execute({ sql: 'DELETE FROM cms_normativas WHERE id_normativa=?', args: [String(req.params.id)] });
    return res.json({ success: true, message: 'Normativa eliminada' });
  } catch (error) {
    console.error('deleteNormativa:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar normativa' });
  }
};
