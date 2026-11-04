import { Request, Response } from 'express';
import { db } from '../lib/db.js';
import { enrichUserPayload } from '../middlewares/auth.middleware.js';
import { denunciasService, PRIORIDADES, CrearDenunciaInput, FiltrosDenunciasAdmin } from '../services/denuncias.service.js';

/** Datos del afiliado que inició sesión (persona o empresa); null si la cuenta no es de un afiliado */
async function identidadAfiliado(user: NonNullable<Request['user']>) {
  const { id_afiliado } = await enrichUserPayload({ ...user });
  if (!id_afiliado) return null;
  const r = await db.execute({
    sql: `SELECT a.id_afiliado, a.codigo, a.tipo_afiliado,
                 p.nombres, p.apellidos, p.cedula, p.email AS persona_email, p.telefono AS persona_telefono,
                 e.razon_social, e.rif_tipo, e.rif_numero, e.email AS empresa_email, e.telefono AS empresa_telefono
          FROM afiliados a
          LEFT JOIN personas p ON a.id_persona = p.id
          LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
          WHERE a.id_afiliado = ? AND a.eliminado_en IS NULL`,
    args: [id_afiliado]
  });
  const f: any = r.rows[0];
  if (!f) return null;
  const persona = [f.nombres, f.apellidos].filter(Boolean).join(' ').trim();
  return {
    id_afiliado: Number(f.id_afiliado),
    codigo: (f.codigo as string) || null,
    tipo_afiliado: (f.tipo_afiliado as string) || null,
    nombre: persona || String(f.razon_social || ''),
    cedula_rif: persona ? String(f.cedula || '') : `${f.rif_tipo || 'J'}-${f.rif_numero || ''}`,
    email: String(f.persona_email || f.empresa_email || user.email || ''),
    telefono: String(f.persona_telefono || f.empresa_telefono || ''),
  };
}

/** GET /api/denuncias/mi-identidad — para precargar el formulario del afiliado con sesión */
export async function miIdentidadDenunciante(req: Request, res: Response) {
  try {
    const identidad = await identidadAfiliado(req.user!);
    return res.json({ success: true, data: identidad });
  } catch (error: any) {
    console.error('Error al obtener identidad del denunciante:', error);
    return res.status(500).json({ error: 'No se pudo obtener tu identidad de afiliado.' });
  }
}

export async function publicCrearDenuncia(req: Request, res: Response) {
  try {
    const body = req.body;

    // Con sesión de afiliado, la identidad sale de la base de datos: nada de lo que diga el cuerpo sobre quién denuncia se acepta
    const afiliado = req.user ? await identidadAfiliado(req.user) : null;
    const email = String(body.email_denunciante || afiliado?.email || '').trim();
    const telefono = String(body.telefono_denunciante || afiliado?.telefono || '').trim();

    if (afiliado) {
      if (!email || !telefono) {
        return res.status(400).json({ error: 'Indica un correo y un teléfono de contacto vigentes.' });
      }
      if (Number(body.id_afiliado_denunciado) === afiliado.id_afiliado) {
        return res.status(400).json({ error: 'No puedes presentar una denuncia contra ti mismo.' });
      }
    } else if (!body.nombre_denunciante || !body.cedula_rif_denunciante || !email || !telefono) {
      return res.status(400).json({ error: 'Faltan datos de contacto obligatorios del denunciante.' });
    }
    if (!body.id_afiliado_denunciado) {
      return res.status(400).json({ error: 'Debe seleccionar al afiliado denunciado.' });
    }
    if (!body.tipo_falta || !body.titulo || !body.descripcion_hechos) {
      return res.status(400).json({ error: 'Faltan campos obligatorios sobre los hechos denunciados.' });
    }

    const input: CrearDenunciaInput = {
      tipo_denunciante: afiliado ? 'afiliado' : body.tipo_denunciante === 'afiliado' ? 'afiliado' : 'no_afiliado',
      id_afiliado_denunciante: afiliado?.id_afiliado ?? null,
      id_user_denunciante: req.user?.id || null,
      nombre_denunciante: afiliado ? afiliado.nombre : String(body.nombre_denunciante),
      cedula_rif_denunciante: afiliado ? afiliado.cedula_rif : String(body.cedula_rif_denunciante),
      email_denunciante: email,
      telefono_denunciante: telefono,
      direccion_denunciante: body.direccion_denunciante ? String(body.direccion_denunciante) : null,
      id_afiliado_denunciado: Number(body.id_afiliado_denunciado),
      tipo_falta: body.tipo_falta,
      titulo: String(body.titulo),
      descripcion_hechos: String(body.descripcion_hechos),
      inmueble_referencia: body.inmueble_referencia ? String(body.inmueble_referencia) : null,
      monto_involucrado: body.monto_involucrado ? Number(body.monto_involucrado) : 0,
      moneda_monto: body.moneda_monto || 'USD',
      documentos: Array.isArray(body.documentos) ? body.documentos : []
    };

    const resultado = await denunciasService.crearDenuncia(input);
    return res.status(201).json({ success: true, data: resultado });
  } catch (error: any) {
    console.error('Error al radicar denuncia:', error);
    return res.status(500).json({ error: error.message || 'Error al radicar la denuncia' });
  }
}

export async function publicConsultarDenuncia(req: Request, res: Response) {
  try {
    const { codigo, pin } = req.body;
    if (!codigo || !pin) {
      return res.status(400).json({ error: 'Debe ingresar el código de la denuncia y su PIN de seguimiento.' });
    }

    const data = await denunciasService.consultarDenunciaPublica(String(codigo), String(pin));
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(404).json({ error: error.message || 'Denuncia no encontrada' });
  }
}

export async function adminListarDenuncias(req: Request, res: Response) {
  try {
    const { estatus, tipo_falta, prioridad, search, id_afiliado_denunciado } = req.query;

    const filtros: FiltrosDenunciasAdmin = {
      estatus: estatus ? String(estatus) : undefined,
      tipo_falta: tipo_falta ? String(tipo_falta) : undefined,
      prioridad: prioridad ? String(prioridad) : undefined,
      search: search ? String(search) : undefined,
      id_afiliado_denunciado: id_afiliado_denunciado ? Number(id_afiliado_denunciado) : undefined
    };

    const data = await denunciasService.listarDenunciasAdmin(filtros);
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error al listar denuncias admin:', error);
    return res.status(500).json({ error: error.message || 'Error al listar denuncias' });
  }
}

export async function adminGetDetalleDenuncia(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const data = await denunciasService.getDetalleDenunciaAdmin(id);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(404).json({ error: error.message || 'Denuncia no encontrada' });
  }
}

export async function adminCambiarEstatus(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { estatus, comentario } = req.body;
    if (!estatus) return res.status(400).json({ error: 'Estatus requerido' });

    const userId = (req as any).user?.id;
    const data = await denunciasService.cambiarEstatus(id, estatus, comentario, userId);
    return res.json({ success: true, data });
  } catch (error: any) {
    if (String(error.message).startsWith('No se puede pasar')) return res.status(400).json({ error: error.message });
    return res.status(500).json({ error: error.message || 'Error al actualizar estatus' });
  }
}

export async function adminCambiarPrioridad(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { prioridad, motivo } = req.body;
    if (!PRIORIDADES.includes(prioridad)) return res.status(400).json({ error: 'Prioridad inválida' });

    const data = await denunciasService.cambiarPrioridad(id, prioridad, motivo ? String(motivo) : undefined, (req as any).user?.id);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error al cambiar la prioridad' });
  }
}

export async function adminConvocarMediacion(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { fechaAudiencia, lugarModalidad, notas } = req.body;
    if (!fechaAudiencia || !lugarModalidad) {
      return res.status(400).json({ error: 'Fecha y lugar/modalidad de la audiencia son obligatorios.' });
    }

    const userId = (req as any).user?.id;
    const data = await denunciasService.convocarMediacion(id, { fechaAudiencia, lugarModalidad, notas }, userId);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error al convocar mediación' });
  }
}

export async function adminRegistrarDefensa(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { defensaTexto, documentos } = req.body;
    if (!defensaTexto) return res.status(400).json({ error: 'El texto de la defensa es obligatorio' });

    const userId = (req as any).user?.id;
    const data = await denunciasService.registrarDefensa(id, { defensaTexto, documentos }, userId);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error al registrar la defensa' });
  }
}

export async function adminResolverDenuncia(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { tipoResolucion, dictamen, actaUrl } = req.body;
    if (!tipoResolucion || !dictamen) {
      return res.status(400).json({ error: 'Debe especificar el tipo de resolución y el dictamen oficial.' });
    }

    const userId = (req as any).user?.id;
    const data = await denunciasService.resolverDenuncia(id, { tipoResolucion, dictamen, actaUrl }, userId);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error al emitir resolución' });
  }
}

export async function adminGuardarNotas(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { notas } = req.body;
    const data = await denunciasService.guardarNotasInternas(id, String(notas || ''));
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error al guardar notas' });
  }
}
