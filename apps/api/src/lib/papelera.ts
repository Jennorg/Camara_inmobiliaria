/** Entidades con borrado lógico que se pueden ver y restaurar desde la papelera del súper administrador. */
export interface EntidadPapelera { tabla: string; pk: string; etiqueta: string; nombre: string; alRestaurar?: string }

export const PAPELERA: Record<string, EntidadPapelera> = {
  noticias: { tabla: 'cms_noticias', pk: 'id_noticia', etiqueta: 'Noticias', nombre: 'titulo' },
  cursos_web: { tabla: 'cms_cursos', pk: 'id_cms_curso', etiqueta: 'Cursos de la web', nombre: 'titulo' },
  convenios: { tabla: 'cms_convenios', pk: 'id_convenio', etiqueta: 'Convenios', nombre: 'nombre' },
  hitos: { tabla: 'cms_hitos', pk: 'id_hito', etiqueta: 'Hitos de la historia', nombre: 'titulo' },
  normativas: { tabla: 'cms_normativas', pk: 'id_normativa', etiqueta: 'Marco Legal', nombre: 'titulo' },
  cursos: { tabla: 'cursos', pk: 'id_curso', etiqueta: 'Cursos y programas', nombre: 'titulo' },
  // Una cuenta borrada queda desactivada: al restaurarla se reactiva
  usuarios: { tabla: 'users', pk: 'id', etiqueta: 'Usuarios', nombre: 'email', alRestaurar: ', activo = 1' },
}

/** Registros que se borran con todo lo que arrastran: se guarda una instantánea completa (ver instantaneas.ts). */
export const TIPOS_INSTANTANEA: Record<string, string> = { preinscripcion: 'Preinscripciones', afiliado: 'Afiliados' }
