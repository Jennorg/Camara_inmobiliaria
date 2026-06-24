import { Router } from 'express'
import {
  adminAsignarEstudianteACurso,
  adminAgendarEntrevista,
  adminFinalizarEntrevista,
  adminGetEstudiante,
  adminGetEstudianteDocumentos,
  adminListCursos,
  adminCreateCurso,
  adminUpdateCurso,
  adminDeleteCurso,
  adminListEstudiantes,
  adminListPreinscripciones,
  adminRechazarPreinscripcion,
  adminCompletarCursoEstudiante,
  adminAprobarModulo,
  academiaAdminGuards,
  adminRemitirACibir,
  adminCambiarEtapaInscripcion,
  adminBuscarReferenciaAfiliado,
  adminToggleCorredorStatus,
  adminDeleteInscripcion,
  adminGetModulosInscripcion,
  adminAprobarModuloInscripcion,
  adminRechazarModuloInscripcion,
  adminAprobarTodosModulosInscripcion,
  adminListProfesores,
  adminListPersonasDisponibles,
  adminCreateProfesor,
  adminDeleteProfesor,
} from '../controllers/academia.controller.js'

const router = Router()

// Todo lo de este router es para panel administrativo
router.use(...academiaAdminGuards)

// GET /api/academia/cursos?estatus=Abierto&programaCodigo=PADI
router.get('/cursos', adminListCursos)
// POST /api/academia/cursos
router.post('/cursos', adminCreateCurso)
// PUT /api/academia/cursos/:id
router.put('/cursos/:id', adminUpdateCurso)
// DELETE /api/academia/cursos/:id  (soft-delete → Cerrado)
router.delete('/cursos/:id', adminDeleteCurso)

// GET /api/academia/preinscripciones?programaCodigo=PADI&estatus=Preinscrito
router.get('/preinscripciones', adminListPreinscripciones)

// GET /api/academia/estudiantes?query=
router.get('/estudiantes', adminListEstudiantes)

// GET /api/academia/estudiantes/:id
router.get('/estudiantes/:id', adminGetEstudiante)

// GET /api/academia/estudiantes/:id/documentos
router.get('/estudiantes/:id/documentos', adminGetEstudianteDocumentos)

// POST /api/academia/cursos/:id_curso/asignar
router.post('/cursos/:id_curso/asignar', adminAsignarEstudianteACurso)

// PATCH /api/academia/inscripciones/:id/agendar-entrevista
router.patch('/inscripciones/:id/agendar-entrevista', adminAgendarEntrevista)

// PATCH /api/academia/inscripciones/:id/finalizar-entrevista
router.patch('/inscripciones/:id/finalizar-entrevista', adminFinalizarEntrevista)

// PATCH /api/academia/inscripciones/:id/aprobar-directo
router.patch('/inscripciones/:id/aprobar-directo', adminAprobarModulo)

// PATCH /api/academia/inscripciones/:id/remitir-cibir
router.patch('/inscripciones/:id/remitir-cibir', adminRemitirACibir)

// Mantenemos /aprobar por compatibilidad temporal si es necesario, pero redirigimos a agendar
router.patch('/inscripciones/:id/aprobar', adminAgendarEntrevista)

// PATCH /api/academia/inscripciones/:id/rechazar
router.patch('/inscripciones/:id/rechazar', adminRechazarPreinscripcion)

// DELETE /api/academia/inscripciones/:id
router.delete('/inscripciones/:id', adminDeleteInscripcion)

// PATCH /api/academia/inscripciones/:id/completar
router.patch('/inscripciones/:id/completar', adminCompletarCursoEstudiante)

// Módulos de inscripciones
router.get('/inscripciones/:id/modulos', adminGetModulosInscripcion)
router.patch('/inscripciones/:id/modulos/:nombre/aprobar', adminAprobarModuloInscripcion)
router.patch('/inscripciones/:id/modulos/:nombre/rechazar', adminRechazarModuloInscripcion)
router.patch('/inscripciones/:id/modulos/aprobar-todos', adminAprobarTodosModulosInscripcion)

// PATCH /api/academia/inscripciones/:id/cambiar-etapa
router.patch('/inscripciones/:id/cambiar-etapa', adminCambiarEtapaInscripcion)

// GET /api/academia/afiliados/referencia
router.get('/afiliados/referencia', adminBuscarReferenciaAfiliado)

// PATCH /api/academia/inscripciones/:id/toggle-corredor
router.patch('/inscripciones/:id/toggle-corredor', adminToggleCorredorStatus)

// Gestión de profesores
router.get('/profesores', adminListProfesores)
router.post('/profesores', adminCreateProfesor)
router.delete('/profesores/:id', adminDeleteProfesor)
router.get('/personas-disponibles', adminListPersonasDisponibles)

export { router as academiaRoutes }

