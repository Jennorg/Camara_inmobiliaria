import React, { useState, useEffect, useCallback } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import Swal from 'sweetalert2'
import { toast } from 'sonner'
import {
  X,
  Search,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  UserCheck,
  UserX,
  AlertCircle,
  Calendar,
  GraduationCap,
  Banknote,
  ChevronDown,
  Mail,
  Phone
} from 'lucide-react'
import { formatDateLatina } from '@/utils/formatters'
import ModalCobroTaquilla from '@/pages/admin/components/Finance/ModalCobroTaquilla'
import ReciboDigitalModal from '@/components/ReciboDigitalModal'
import type { PagoDTO } from '@/types/pagos'

interface Edicion {
  id_edicion: number
  nombre: string
  estado: string
  fecha_inicio: string
  fecha_fin: string | null
  cupo_maximo: number | null
}

interface InscritoEdicion {
  id: number
  id_edicion: number
  id_afiliado: number
  estatus: 'Preinscrito' | 'Aprobado' | 'Rechazado' | 'Cancelado'
  asignado_automatico: number
  aprobado_por: number | null
  nota_admin: string | null
  fecha_asignacion: string
  fecha_resolucion: string | null
  afiliado_codigo: string | null
  tipo_afiliado: string | null
  afiliado_estatus: string | null
  cedula: string | null
  nombre_completo: string
  email: string | null
  telefono: string | null
  empresa_nombre: string | null
}

interface Props {
  edicion: Edicion
  onClose: () => void
  onUpdated: () => void
}

export default function EdicionCibirDetailModal({ edicion, onClose, onUpdated }: Props) {
  const { token } = useAuth()
  const [inscritos, setInscritos] = useState<InscritoEdicion[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEstatus, setFilterEstatus] = useState<string>('Todos')
  const [search, setSearch] = useState('')
  const [searchField, setSearchField] = useState<'nombre' | 'cedula' | 'email'>('nombre')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [showCobroModal, setShowCobroModal] = useState(false)
  const [showReciboModal, setShowReciboModal] = useState(false)
  const [selectedCobroAfiliado, setSelectedCobroAfiliado] = useState<InscritoEdicion | null>(null)
  const [selectedPago, setSelectedPago] = useState<PagoDTO | null>(null)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  const fetchInscritos = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (filterEstatus !== 'Todos') q.set('estatus', filterEstatus)
      if (search.trim()) {
        q.set('search', search.trim())
        q.set('searchField', searchField)
      }

      const res = await fetch(`${API_URL}/api/admin/cibir/ediciones/${edicion.id_edicion}/inscritos?${q.toString()}`, {
        headers
      })
      const json = await res.json()
      if (json.success) {
        setInscritos(json.data)
      } else {
        toast.error(json.message || 'Error al cargar participantes')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error de conexión al cargar participantes')
    } finally {
      setLoading(false)
    }
  }, [edicion.id_edicion, filterEstatus, search, searchField, token])

  useEffect(() => {
    fetchInscritos()
  }, [fetchInscritos])

  const toggleSelect = (idAfiliado: number) => {
    setSelectedIds(prev =>
      prev.includes(idAfiliado) ? prev.filter(x => x !== idAfiliado) : [...prev, idAfiliado]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === inscritos.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(inscritos.map(i => i.id_afiliado))
    }
  }

  const handleCambiarEstatusIndividual = async (
    idAfiliado: number,
    nombre: string,
    nuevoEstatus: 'Aprobado' | 'Rechazado' | 'Cancelado'
  ) => {
    let notaAdmin = ''

    if (nuevoEstatus === 'Rechazado') {
      const { value, isConfirmed } = await Swal.fire({
        title: `Rechazar a ${nombre}`,
        text: 'Indica el motivo o nota administrativa para el participante:',
        input: 'textarea',
        inputPlaceholder: 'Escribe el motivo del rechazo...',
        showCancelButton: true,
        confirmButtonText: 'Confirmar Rechazo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#EF4444'
      })
      if (!isConfirmed) return
      notaAdmin = value || ''
    } else if (nuevoEstatus === 'Aprobado') {
      const result = await Swal.fire({
        title: `¿Aprobar CIBIR de ${nombre}?`,
        text: 'Al aprobar, el afiliado avanzará automáticamente a la etapa de Inscripción (6_INSCRIPCION).',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Aprobar CIBIR',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10B981'
      })
      if (!result.isConfirmed) return
    }

    try {
      setActionLoading(true)
      const res = await fetch(
        `${API_URL}/api/admin/cibir/ediciones/${edicion.id_edicion}/inscritos/${idAfiliado}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ estatus: nuevoEstatus, notaAdmin })
        }
      )
      const json = await res.json()
      if (json.success) {
        toast.success(json.message)
        fetchInscritos()
        onUpdated()
      } else {
        toast.error(json.message || 'Error al actualizar estatus')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error de conexión')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLoteAprobar = async () => {
    if (selectedIds.length === 0) return

    const result = await Swal.fire({
      title: `¿Aprobar ${selectedIds.length} participantes?`,
      text: 'Todos los seleccionados quedarán con CIBIR Aprobado y avanzarán a Inscripción.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Sí, Aprobar (${selectedIds.length})`,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10B981'
    })
    if (!result.isConfirmed) return

    try {
      setActionLoading(true)
      let okCount = 0
      for (const aId of selectedIds) {
        const res = await fetch(
          `${API_URL}/api/admin/cibir/ediciones/${edicion.id_edicion}/inscritos/${aId}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ estatus: 'Aprobado' })
          }
        )
        const j = await res.json()
        if (j.success) okCount++
      }
      toast.success(`Se aprobaron ${okCount} participantes`)
      setSelectedIds([])
      fetchInscritos()
      onUpdated()
    } catch (e) {
      toast.error('Error procesando lote')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="bg-white rounded-3xl w-full max-w-6xl xl:max-w-7xl h-[92vh] max-h-[95vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
              <GraduationCap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight">
                  {edicion.nombre}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                  {edicion.estado}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Inicio: {formatDateLatina(edicion.fecha_inicio)}
                {edicion.cupo_maximo ? ` · Cupo Máx: ${edicion.cupo_maximo}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          {/* Buscador libre con dropdown de criterio igual al estándar del proyecto */}
          <div className="relative flex items-center bg-slate-50 border border-slate-200/80 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 transition-colors h-9 flex-1 min-w-[260px] max-w-md z-20">
            {/* Dropdown de criterio */}
            <div className="relative shrink-0 border-r border-slate-200/80 h-full flex items-center z-10">
              <button
                type="button"
                onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                className="flex items-center gap-1 px-3 h-full text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <span>
                  {searchField === 'nombre' && 'Nombre'}
                  {searchField === 'cedula' && 'Cédula'}
                  {searchField === 'email' && 'Correo'}
                </span>
                <ChevronDown size={11} className={`text-slate-400 transition-transform ${showSearchDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showSearchDropdown && (
                <>
                  <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setShowSearchDropdown(false)} />
                  <div className="absolute left-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-50 min-w-[130px] animate-in fade-in slide-in-from-top-1 duration-100">
                    {([
                      { key: 'nombre', label: 'Nombre' },
                      { key: 'cedula', label: 'Cédula' },
                      { key: 'email', label: 'Correo' },
                    ] as const).map(option => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setSearchField(option.key)
                          setShowSearchDropdown(false)
                        }}
                        className={`w-full text-left px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                          searchField === option.key ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Input de texto */}
            <div className="relative flex-grow h-full flex items-center">
              <Search className="absolute left-2.5 text-slate-400" size={13} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Buscar por ${
                  searchField === 'nombre'
                    ? 'nombre o empresa...'
                    : searchField === 'cedula'
                    ? 'cédula de identidad...'
                    : 'correo electrónico...'
                }`}
                className="w-full h-full pl-7 pr-8 bg-transparent text-xs font-semibold placeholder:text-slate-400 outline-none text-slate-800"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded bg-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {['Todos', 'Preinscrito', 'Aprobado', 'Rechazado', 'Cancelado'].map(st => (
              <button
                key={st}
                onClick={() => setFilterEstatus(st)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                  filterEstatus === st
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Acciones en lote si hay seleccionados */}
        {selectedIds.length > 0 && (
          <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-100 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-emerald-800">
              {selectedIds.length} participante(s) seleccionado(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLoteAprobar}
                disabled={actionLoading}
                className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <UserCheck size={13} />
                Aprobar Seleccionados
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-emerald-700 hover:underline font-medium"
              >
                Deseleccionar
              </button>
            </div>
          </div>
        )}

        {/* Tabla / Lista de Inscritos */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">
              Cargando participantes...
            </div>
          ) : inscritos.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <AlertCircle size={28} className="mx-auto text-slate-300" />
              <p className="text-xs font-bold">No hay participantes registrados en esta edición</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-2.5 pl-4 pr-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === inscritos.length}
                      onChange={toggleSelectAll}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3">Participante</th>
                  <th className="py-2.5 px-3">Cédula / Rif</th>
                  <th className="py-2.5 px-3">Contacto</th>
                  <th className="py-2.5 px-3">Estado CIBIR</th>
                  <th className="py-2.5 px-3 text-right pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {inscritos.map(p => {
                  const isChecked = selectedIds.includes(p.id_afiliado)
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isChecked ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(p.id_afiliado)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 leading-tight">
                          {p.nombre_completo}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{p.tipo_afiliado || 'Natural'}</span>
                          {p.empresa_nombre && <span>· {p.empresa_nombre}</span>}
                          {p.asignado_automatico === 1 && (
                            <span className="text-emerald-700 font-semibold">(Auto)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">
                        {p.cedula || 'S/D'}
                      </td>
                      <td className="py-3 px-3">
                        {p.email && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate max-w-[220px]">
                            <Mail size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate">{p.email}</span>
                          </div>
                        )}
                        {p.telefono && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                            <Phone size={11} className="text-slate-400 shrink-0" />
                            <span>{p.telefono}</span>
                          </div>
                        )}
                        {!p.email && !p.telefono && <span className="text-[11px] text-slate-300">S/D</span>}
                      </td>
                      <td className="py-3 px-3">
                        {p.estatus === 'Aprobado' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 size={11} /> Aprobado
                          </span>
                        )}
                        {p.estatus === 'Rechazado' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <XCircle size={11} /> Rechazado
                          </span>
                        )}
                        {p.estatus === 'Preinscrito' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Clock size={11} /> Preinscrito
                          </span>
                        )}
                        {p.estatus === 'Cancelado' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <Ban size={11} /> Cancelado
                          </span>
                        )}
                        {p.nota_admin && (
                          <p className="text-[9px] text-slate-400 italic mt-0.5 truncate max-w-xs">
                            {p.nota_admin}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right pr-4 space-x-1">
                        <button
                          title="Registrar Cobro de CIBIR en Taquilla"
                          onClick={() => {
                            setSelectedCobroAfiliado(p)
                            setShowCobroModal(true)
                          }}
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Banknote size={15} />
                        </button>
                        {p.estatus !== 'Aprobado' && (
                          <button
                            title="Aprobar CIBIR"
                            onClick={() =>
                              handleCambiarEstatusIndividual(p.id_afiliado, p.nombre_completo, 'Aprobado')
                            }
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <UserCheck size={15} />
                          </button>
                        )}
                        {p.estatus !== 'Rechazado' && (
                          <button
                            title="Rechazar CIBIR"
                            onClick={() =>
                              handleCambiarEstatusIndividual(p.id_afiliado, p.nombre_completo, 'Rechazado')
                            }
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <UserX size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>Total inscritos: {inscritos.length}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-xl font-bold cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Modales de Cobro CIBIR y Recibo */}
      {selectedCobroAfiliado && (
        <ModalCobroTaquilla
          open={showCobroModal}
          onClose={() => {
            setShowCobroModal(false)
            setSelectedCobroAfiliado(null)
          }}
          onSuccess={(pago) => {
            fetchInscritos()
            onUpdated()
            setSelectedPago(pago)
            setShowReciboModal(true)
          }}
          afiliadoId={selectedCobroAfiliado.id_afiliado}
          afiliadoNombre={selectedCobroAfiliado.nombre_completo}
          afiliadoTipo={selectedCobroAfiliado.tipo_afiliado}
          conceptoDefault="curso_cibir"
          idEdicionCibir={edicion.id_edicion}
          authHeaders={headers}
        />
      )}

      <ReciboDigitalModal
        pago={selectedPago}
        onClose={() => {
          setShowReciboModal(false)
          setSelectedPago(null)
        }}
      />
    </div>
  )
}
