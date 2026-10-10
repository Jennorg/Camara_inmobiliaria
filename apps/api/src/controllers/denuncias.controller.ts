import { Request, Response } from 'express';
import { denunciasService, CrearDenunciaInput, FiltrosDenunciasAdmin } from '../services/denuncias.service.js';

export async function publicCrearDenuncia(req: Request, res: Response) {
  try {
    const body = req.body;

    if (!body.nombre_denunciante || !body.cedula_rif_denunciante || !body.email_denunciante || !body.telefono_denunciante) {
      return res.status(400).json({ error: 'Faltan datos de contacto obligatorios del denunciante.' });
    }
    if (!body.id_afiliado_denunciado) {
      return res.status(400).json({ error: 'Debe seleccionar al afiliado denunciado.' });
    }
    if (!body.tipo_falta || !body.titulo || !body.descripcion_hechos) {
      return res.status(400).json({ error: 'Faltan campos obligatorios sobre los hechos denunciados.' });
    }

    const input: CrearDenunciaInput = {
      tipo_denunciante: body.tipo_denunciante || 'no_afiliado',
      id_afiliado_denunciante: body.id_afiliado_denunciante ? Number(body.id_afiliado_denunciante) : null,
      id_user_denunciante: (req as any).user?.id || null,
      nombre_denunciante: String(body.nombre_denunciante),
      cedula_rif_denunciante: String(body.cedula_rif_denunciante),
      email_denunciante: String(body.email_denunciante),
      telefono_denunciante: String(body.telefono_denunciante),
      direccion_denunciante: body.direccion_denunciante ? String(body.direccion_denunciante) : null,
      id_afiliado_denunciado: Number(body.id_afiliado_denunciado),
      tipo_falta: body.tipo_falta,
      titulo: String(body.titulo),
      descripcion_hechos: String(body.descripcion_hechos),
      inmueble_referencia: body.inmueble_referencia ? String(body.inmueble_referencia) : null,
      monto_involucrado: body.monto_involucrado ? Number(body.monto_involucrado) : 0,
      moneda_monto: body.moneda_monto || 'USD',
      prioridad: body.prioridad || 'media',
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
    return res.status(500).json({ error: error.message || 'Error al actualizar estatus' });
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

export async function adminRegistrarDescargos(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { descargoTexto, documentos } = req.body;
    if (!descargoTexto) return res.status(400).json({ error: 'El texto de descargos es obligatorio' });

    const userId = (req as any).user?.id;
    const data = await denunciasService.registrarDescargos(id, { descargoTexto, documentos }, userId);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error al registrar descargos' });
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
