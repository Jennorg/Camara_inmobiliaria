import { Router } from 'express'
import { requireAuth, requirePermiso } from '../middlewares/auth.middleware.js'
import {
  adminAsignarEstudianteACurso,
  adminAgendarEntrevista,
  adminFinalizarEntrevista,
  adminGetEstudiante,
  adminGetEstudianteDocumentos,
  adminAgregarEstudianteDocumento,
  adminCrearInscripcionManual,
  adminQuitarEstudianteDocumento,
  adminListCursos,
  adminCreateCurso,
  adminUpdateCurso,
  adminDeleteCurso,
  adminListEstudiantes,
  adminListPreinscripciones,
  adminRechazarPreinscripcion,
  adminCompletarCursoEstudiante,
  adminAprobarModulo,
  adminReenviarConfirmacionCurso,
  adminEstadoCorreo,
  adminRemitirACibir,
  adminCambiarEtapaInscripcion,
  adminBuscarReferenciaAfiliado,
  adminToggleCorredorStatus,
  adminDeleteInscripcion,
  adminUpdateInscripcionDatos,
  adminGetModulosInscripcion,
  adminAprobarModuloInscripcion,
  adminRechazarModuloInscripcion,
  adminAprobarTodosModulosInscripcion,
  adminListProfesores,
  adminListPersonasDisponibles,
  adminCreateProfesor,
  adminDeleteProfesor,
  adminReenviarEnlaceExpediente,
} from '../controllers/academia.controller.js'

import { adminEnviarEnlaceAgenda, adminGuardarDisponibilidad, adminLeerDisponibilidad } from '../controllers/agenda.controller.js'
import { adminAsignarCohorte, adminCambiarEstadoCohorte, adminCrearCohorte, adminExportarCohorte, adminListCohortes } from '../controllers/cohortes.controller.js'

const router = Router()

// Todo lo de este router es para panel administrativo. Mapa de secciones: cursos, inscripciones, módulos, profesores y
// cohortes → formacion; lista y flujo de preinscripciones (aprobar, rechazar, remitir, agenda, etapa) → preinscripciones;
// fichas y documentos de estudiantes → estudiantes. POST que reenvían correos (no crean) llevan «editar».
router.use(requireAuth)
const F = (accion?: 'ver' | 'crear' | 'editar' | 'eliminar') => requirePermiso('formacion', accion)
const P = (accion?: 'ver' | 'crear' | 'editar' | 'eliminar') => requirePermiso('preinscripciones', accion)
const E = (accion?: 'ver' | 'crear' | 'editar' | 'eliminar') => requirePermiso('estudiantes', accion)

// GET /api/academia/cursos?estatus=Abierto&programaCodigo=PADI
router.get('/cursos', F(), adminListCursos)
// POST /api/academia/cursos
router.post('/cursos', F(), adminCreateCurso)
// PUT /api/academia/cursos/:id
router.put('/cursos/:id', F(), adminUpdateCurso)
// DELETE /api/academia/cursos/:id  (soft-delete → Cerrado)
router.delete('/cursos/:id', F(), adminDeleteCurso)

// GET /api/academia/preinscripciones?programaCodigo=PADI&estatus=Preinscrito
router.get('/preinscripciones', P(), adminListPreinscripciones)

// GET /api/academia/estudiantes?query=
router.get('/estudiantes', E(), adminListEstudiantes)

// GET /api/academia/estudiantes/:id
router.get('/estudiantes/:id', E(), adminGetEstudiante)

// GET /api/academia/estudiantes/:id/documentos
router.get('/estudiantes/:id/documentos', E(), adminGetEstudianteDocumentos)
router.post('/estudiantes/:id/documentos', E(), adminAgregarEstudianteDocumento)
router.delete('/estudiantes/:id/documentos/:idDocumento', E(), adminQuitarEstudianteDocumento)

// POST /api/academia/cursos/:id_curso/asignar
router.post('/cursos/:id_curso/asignar', F(), adminAsignarEstudianteACurso)

// PATCH /api/academia/inscripciones/:id/agendar-entrevista
router.patch('/inscripciones/:id/agendar-entrevista', P(), adminAgendarEntrevista)

// Agenda de entrevistas: disponibilidad y enlace de reserva (el aspirante reserva por /api/public/agenda)
router.get('/agenda/disponibilidad', P(), adminLeerDisponibilidad)
router.put('/agenda/disponibilidad', P(), adminGuardarDisponibilidad)
router.post('/inscripciones/:id/enlace-agenda', P('editar'), adminEnviarEnlaceAgenda)

// PATCH /api/academia/inscripciones/:id/finalizar-entrevista
router.patch('/inscripciones/:id/finalizar-entrevista', P(), adminFinalizarEntrevista)

// POST /api/academia/inscripciones/:id/reenviar-confirmacion
router.post('/inscripciones/:id/reenviar-confirmacion', F('editar'), adminReenviarConfirmacionCurso)

// GET /api/academia/correos/:emailId/estado
router.get('/correos/:emailId/estado', F(), adminEstadoCorreo)

// PATCH /api/academia/inscripciones/:id/aprobar-directo
router.patch('/inscripciones/:id/aprobar-directo', P(), adminAprobarModulo)

// PATCH /api/academia/inscripciones/:id/remitir-cibir
router.patch('/inscripciones/:id/remitir-cibir', P(), adminRemitirACibir)

// Mantenemos /aprobar por compatibilidad temporal si es necesario, pero redirigimos a agendar
router.patch('/inscripciones/:id/aprobar', P(), adminAgendarEntrevista)

// PATCH /api/academia/inscripciones/:id/rechazar
router.patch('/inscripciones/:id/rechazar', P(), adminRechazarPreinscripcion)

// DELETE /api/academia/inscripciones/:id
router.delete('/inscripciones/:id', F(), adminDeleteInscripcion)

// PUT /api/academia/inscripciones/:id/datos
router.put('/inscripciones/:id/datos', F(), adminUpdateInscripcionDatos)

// PATCH /api/academia/inscripciones/:id/completar
router.patch('/inscripciones/:id/completar', F(), adminCompletarCursoEstudiante)

// Módulos de inscripciones
router.get('/inscripciones/:id/modulos', F(), adminGetModulosInscripcion)
router.patch('/inscripciones/:id/modulos/:nombre/aprobar', F(), adminAprobarModuloInscripcion)
router.patch('/inscripciones/:id/modulos/:nombre/rechazar', F(), adminRechazarModuloInscripcion)
router.patch('/inscripciones/:id/modulos/aprobar-todos', F(), adminAprobarTodosModulosInscripcion)

// PATCH /api/academia/inscripciones/:id/cambiar-etapa
router.patch('/inscripciones/:id/cambiar-etapa', P(), adminCambiarEtapaInscripcion)

// GET /api/academia/afiliados/referencia
router.get('/afiliados/referencia', P(), adminBuscarReferenciaAfiliado)

// PATCH /api/academia/inscripciones/:id/toggle-corredor
router.patch('/inscripciones/:id/toggle-corredor', F(), adminToggleCorredorStatus)

// Gestión de profesores
router.get('/profesores', F(), adminListProfesores)
router.post('/profesores', F(), adminCreateProfesor)
router.delete('/profesores/:id', F(), adminDeleteProfesor)
router.get('/personas-disponibles', F(), adminListPersonasDisponibles)
// POST /api/academia/inscripciones/:id/reenviar-enlace
router.post('/inscripciones/:id/reenviar-enlace', P('editar'), adminReenviarEnlaceExpediente)

// Cohortes de los programas CIBIR, PREANI, PEGI y PADI
router.get('/cohortes', F(), adminListCohortes)
router.post('/cohortes', F(), adminCrearCohorte)
router.patch('/cohortes/:id/estado', F(), adminCambiarEstadoCohorte)
router.get('/cohortes/:id/inscritos.xlsx', F(), adminExportarCohorte)
router.patch('/inscripciones/:id/cohorte', F(), adminAsignarCohorte)

// POST /api/academia/inscripciones/manual — agrega a una persona a CIBIR/PREANI/PEGI/PADI
router.post('/inscripciones/manual', F(), adminCrearInscripcionManual)

export { router as academiaRoutes }

