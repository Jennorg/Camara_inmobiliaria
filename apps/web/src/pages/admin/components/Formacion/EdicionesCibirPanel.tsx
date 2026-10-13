import React, { useState, useEffect, useCallback } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import Swal from 'sweetalert2'
import { toast } from 'sonner'
import {
  GraduationCap,
  Calendar,
  Users,
  Plus,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  UserPlus,
  Edit2,
  Trash2,
  RefreshCw,
  Search
} from 'lucide-react'
import { formatDateLatina, numeroAOrdinalEdicion } from '@/utils/formatters'
import EdicionCibirDetailModal from './EdicionCibirDetailModal'

export interface EdicionCibir {
  id_edicion: number
  nombre: string
  descripcion: string | null
  fecha_inicio: string
  fecha_fin: string | null
  estado: 'Planificada' | 'Abierta' | 'Cerrada' | 'Finalizada'
  cupo_maximo: number | null
  total_preinscrito: number
  total_aprobado: number
  total_rechazado: number
  total_cancelado: number
  total_activos: number
  creado_en: string
}

export default function EdicionesCibirPanel() {
  const { token } = useAuth()
  const [ediciones, setEdiciones] = useState<EdicionCibir[]>([])
  const [pendientes, setPendientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEdicion, setSelectedEdicion] = useState<EdicionCibir | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingEdicion, setEditingEdicion] = useState<EdicionCibir | null>(null)

  // Formulario de creación/edición
  const [formNombre, setFormNombre] = useState('')
  const [formDescripcion, setFormDescripcion] = useState('')
  const [formFechaInicio, setFormFechaInicio] = useState('')
  const [formFechaFin, setFormFechaFin] = useState('')
  const [formCupo, setFormCupo] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [resEd, resPend] = await Promise.all([
        fetch(`${API_URL}/api/admin/cibir/ediciones`, { headers }),
        fetch(`${API_URL}/api/admin/cibir/pendientes`, { headers })
      ])

      const jEd = await resEd.json()
      const jPend = await resPend.json()

      if (jEd.success) setEdiciones(jEd.data)
      if (jPend.success) setPendientes(jPend.data)
    } catch (e) {
      console.error(e)
      toast.error('Error al cargar datos de ediciones CIBIR')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const edicionActiva = ediciones.find(e => e.estado === 'Abierta' || e.estado === 'Planificada')

  const proximoNumero = (ediciones && ediciones.length > 0 
    ? Math.max(...ediciones.map(e => e.id_edicion || 0)) 
    : 0) + 1
  const proximoNombre = numeroAOrdinalEdicion(proximoNumero)

  const handleOpenCreate = () => {
    if (edicionActiva) {
      Swal.fire({
        title: 'Edición Activa Existente',
        text: `Ya existe la edición "${edicionActiva.nombre}" en estado ${edicionActiva.estado}. Debe cerrarla o finalizarla antes de crear una nueva.`,
        icon: 'warning',
        confirmButtonColor: '#10B981'
      })
      return
    }
    setEditingEdicion(null)
    setFormNombre('')
    setFormDescripcion('')
    setFormFechaInicio(new Date().toISOString().split('T')[0])
    setFormFechaFin('')
    setFormCupo('')
    setShowCreateModal(true)
  }

  const handleOpenEdit = (ed: EdicionCibir) => {
    setEditingEdicion(ed)
    setFormNombre(ed.nombre)
    setFormDescripcion(ed.descripcion || '')
    setFormFechaInicio(ed.fecha_inicio ? ed.fecha_inicio.split('T')[0] : '')
    setFormFechaFin(ed.fecha_fin ? ed.fecha_fin.split('T')[0] : '')
    setFormCupo(ed.cupo_maximo ?? '')
    setShowCreateModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formFechaInicio) {
      toast.error('La fecha de inicio es requerida')
      return
    }

    try {
      setSubmitting(true)
      const payload: any = {
        nombre: editingEdicion ? (formNombre.trim() || editingEdicion.nombre) : proximoNombre,
        descripcion: formDescripcion.trim() || null,
        fecha_inicio: formFechaInicio,
        fecha_fin: formFechaFin || null,
        cupo_maximo: formCupo !== '' ? Number(formCupo) : null
      }

      let res
      if (editingEdicion) {
        res = await fetch(`${API_URL}/api/admin/cibir/ediciones/${editingEdicion.id_edicion}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload)
        })
      } else {
        payload.estado = 'Abierta'
        res = await fetch(`${API_URL}/api/admin/cibir/ediciones`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        })
      }

      const json = await res.json()
      if (json.success) {
        toast.success(json.message)
        setShowCreateModal(false)
        fetchData()
      } else {
        Swal.fire('Error', json.message || 'Error al guardar edición', 'error')
      }
    } catch (err) {
      toast.error('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCambiarEstado = async (
    ed: EdicionCibir,
    nuevoEstado: 'Abierta' | 'Cerrada' | 'Finalizada'
  ) => {
    const confirmText =
      nuevoEstado === 'Abierta'
        ? `¿Abrir la edición "${ed.nombre}"? Todos los afiliados que esperan en 5_CIBIR se asignarán automáticamente.`
        : nuevoEstado === 'Cerrada'
        ? `¿Cerrar la edición "${ed.nombre}"? No se auto-asignarán nuevos participantes hasta que se vuelva a abrir.`
        : `¿Finalizar la edición "${ed.nombre}"? Quedará archivada en el historial.`

    const result = await Swal.fire({
      title: 'Cambiar Estado',
      text: confirmText,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10B981'
    })
    if (!result.isConfirmed) return

    try {
      const res = await fetch(`${API_URL}/api/admin/cibir/ediciones/${ed.id_edicion}/estado`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ estado: nuevoEstado })
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message)
        fetchData()
      } else {
        Swal.fire('Error', json.message || 'No se pudo cambiar el estado', 'error')
      }
    } catch (e) {
      toast.error('Error de conexión')
    }
  }

  const handleAsignarPendientes = async (idEdicion: number) => {
    if (pendientes.length === 0) return

    const result = await Swal.fire({
      title: `¿Asignar ${pendientes.length} aspirantes?`,
      text: 'Se asignarán a esta edición CIBIR en estado Preinscrito.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, asignar todos',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10B981'
    })
    if (!result.isConfirmed) return

    try {
      const res = await fetch(`${API_URL}/api/admin/cibir/ediciones/${idEdicion}/asignar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ afiliadosIds: pendientes.map(p => p.id_afiliado) })
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message)
        fetchData()
      } else {
        toast.error(json.message)
      }
    } catch (e) {
      toast.error('Error asignando pendientes')
    }
  }

  return (
    <div className="w-full flex-1 min-w-0 p-4 sm:p-5 space-y-5 max-w-[1600px] mx-auto overflow-y-auto">
      {/* Cabecera del Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <GraduationCap size={22} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight leading-tight uppercase">
              Ediciones CIBIR
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Control de cohortes del Curso de Inducción de Bienes Raíces
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            className="p-2.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-2xl border border-slate-200/80 transition-colors cursor-pointer"
            title="Refrescar"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-[#00D084] hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-2xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Nueva Edición
          </button>
        </div>
      </div>

      {/* Alerta de Pendientes en Espera (si hay) */}
      {pendientes.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">
                {pendientes.length} aspirante(s) en espera de edición CIBIR
              </p>
              <p className="text-[11px] text-amber-700">
                Llegaron a la etapa 5_CIBIR y aún no tienen una edición activa asignada.
              </p>
            </div>
          </div>
          {edicionActiva && edicionActiva.estado === 'Abierta' && (
            <button
              onClick={() => handleAsignarPendientes(edicionActiva.id_edicion)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              Asignar a {edicionActiva.nombre}
            </button>
          )}
        </div>
      )}

      {/* Edición Activa (Destacada) */}
      {edicionActiva ? (
        <div className="bg-gradient-to-br from-emerald-500/10 via-white to-white border-2 border-emerald-500/30 rounded-3xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-600 text-white uppercase tracking-wider">
                  Edición Activa
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    edicionActiva.estado === 'Abierta'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {edicionActiva.estado}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                {edicionActiva.nombre}
              </h3>
              {edicionActiva.descripcion && (
                <p className="text-xs text-slate-600 max-w-xl">{edicionActiva.descripcion}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-emerald-700" />
                  Inicio: <strong>{formatDateLatina(edicionActiva.fecha_inicio)}</strong>
                </span>
                {edicionActiva.fecha_fin && (
                  <span>
                    Fin: <strong>{formatDateLatina(edicionActiva.fecha_fin)}</strong>
                  </span>
                )}
                {edicionActiva.cupo_maximo && (
                  <span>
                    Cupo: <strong>{edicionActiva.cupo_maximo}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Métricas y Acciones de la edición activa */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-center min-w-[240px]">
                <div>
                  <div className="text-lg font-black text-slate-800">
                    {edicionActiva.total_preinscrito || 0}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Preins.
                  </div>
                </div>
                <div>
                  <div className="text-lg font-black text-emerald-600">
                    {edicionActiva.total_aprobado || 0}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Aprobados
                  </div>
                </div>
                <div>
                  <div className="text-lg font-black text-rose-500">
                    {edicionActiva.total_rechazado || 0}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Rechazados
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setSelectedEdicion(edicionActiva)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Users size={14} />
                  Ver Participantes
                </button>
                <div className="flex items-center gap-1.5">
                  {edicionActiva.estado === 'Planificada' ? (
                    <button
                      onClick={() => handleCambiarEstado(edicionActiva, 'Abierta')}
                      className="flex-1 px-3 py-1.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold text-[10px] uppercase rounded-xl transition-colors cursor-pointer"
                    >
                      Abrir Cohorte
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCambiarEstado(edicionActiva, 'Cerrada')}
                      className="flex-1 px-3 py-1.5 bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold text-[10px] uppercase rounded-xl transition-colors cursor-pointer"
                    >
                      Cerrar Inscripción
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenEdit(edicionActiva)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-8 text-center text-slate-400 space-y-2">
          <GraduationCap size={32} className="mx-auto text-slate-300" />
          <p className="text-xs font-bold text-slate-600">No hay ninguna edición CIBIR activa</p>
          <p className="text-[11px] text-slate-400">
            Crea una nueva edición para que las preinscripciones que lleguen a CIBIR se asignen automáticamente.
          </p>
        </div>
      )}

      {/* Historial de Ediciones */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Historial de Ediciones
          </h4>
          <span className="text-xs text-slate-400 font-medium">
            Total: {ediciones.length} edición(es)
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">
            Cargando historial...
          </div>
        ) : ediciones.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-6">No hay ediciones registradas</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {ediciones.map(ed => (
              <div
                key={ed.id_edicion}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 px-3 rounded-2xl transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                      {ed.nombre}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        ed.estado === 'Abierta'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : ed.estado === 'Planificada'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : ed.estado === 'Cerrada'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {ed.estado}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Inicio: {formatDateLatina(ed.fecha_inicio)}
                    {ed.fecha_fin ? ` · Fin: ${formatDateLatina(ed.fecha_fin)}` : ''} · Inscritos:{' '}
                    <strong>{ed.total_activos || 0}</strong> (
                    {ed.total_aprobado || 0} aprobados)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedEdicion(ed)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Ver Inscritos
                  </button>
                  {ed.estado === 'Cerrada' && (
                    <button
                      onClick={() => handleCambiarEstado(ed, 'Finalizada')}
                      className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 text-[11px] font-medium"
                    >
                      Finalizar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Detalle de Participantes */}
      {selectedEdicion && (
        <EdicionCibirDetailModal
          edicion={selectedEdicion}
          onClose={() => setSelectedEdicion(null)}
          onUpdated={fetchData}
        />
      )}

      {/* Modal de Crear / Editar Edición */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
              {editingEdicion ? 'Editar Edición CIBIR' : 'Nueva Edición CIBIR'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {editingEdicion ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Nombre de la Edición *
                  </label>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={e => setFormNombre(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              ) : (
                <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Nombre de la Edición (Autonumérico)
                    </span>
                    <span className="text-base font-black text-slate-900 uppercase tracking-tight block">
                      {proximoNombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-800 shadow-xs">
                    <GraduationCap size={15} />
                    <span className="text-xs font-black">#{proximoNumero}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={formDescripcion}
                  onChange={e => setFormDescripcion(e.target.value)}
                  placeholder="Detalles de la cohorte..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="date"
                    value={formFechaInicio}
                    onChange={e => setFormFechaInicio(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Fecha de Fin
                  </label>
                  <input
                    type="date"
                    value={formFechaFin}
                    onChange={e => setFormFechaFin(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Cupo Máximo
                </label>
                <input
                  type="number"
                  min="1"
                  value={formCupo}
                  onChange={e => setFormCupo(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Sin límite"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-slate-500 font-bold hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs bg-[#00D084] hover:bg-emerald-600 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : editingEdicion ? 'Actualizar' : 'Crear Edición'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
