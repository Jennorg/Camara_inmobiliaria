import React, { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
type EstadoDenuncia = 'pendiente' | 'en_revision' | 'resuelta' | 'desestimada'

interface Denuncia {
  id: string
  codigo: string
  tipo: string
  descripcion: string
  denunciante: string
  cedula: string
  email: string
  telefono: string
  denunciado: string
  fecha: string
  estado: EstadoDenuncia
  prioridad: 'alta' | 'media' | 'baja'
  archivos: number
  notas: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_DENUNCIAS: Denuncia[] = [
  {
    id: '1',
    codigo: 'DEN-2026-001',
    tipo: 'Incumplimiento de Contrato',
    descripcion: 'El arrendador no ha realizado las reparaciones acordadas en el contrato de arrendamiento desde hace 3 meses, afectando las instalaciones eléctricas y sanitarias del inmueble.',
    denunciante: 'Carlos Rodríguez Pérez',
    cedula: 'V-12.345.678',
    email: 'carlos.rodriguez@email.com',
    telefono: '0414-1234567',
    denunciado: 'Inmobiliaria Horizonte C.A.',
    fecha: '2026-07-28',
    estado: 'en_revision',
    prioridad: 'alta',
    archivos: 4,
    notas: 'Caso asignado al mediador. Se esperan documentos adicionales del denunciante.',
  },
  {
    id: '2',
    codigo: 'DEN-2026-002',
    tipo: 'Publicidad Engañosa',
    descripcion: 'Anuncio de venta de inmueble con características que no corresponden a la realidad. Las fotos publicadas no pertenecen al inmueble ofertado.',
    denunciante: 'María González Vargas',
    cedula: 'V-9.876.543',
    email: 'mariag@correo.com',
    telefono: '0424-7654321',
    denunciado: 'José Martínez (Corredor Independiente)',
    fecha: '2026-08-01',
    estado: 'pendiente',
    prioridad: 'media',
    archivos: 2,
    notas: '',
  },
  {
    id: '3',
    codigo: 'DEN-2026-003',
    tipo: 'Cobro Indebido de Comisiones',
    descripcion: 'Corredor cobró honorarios superiores al porcentaje máximo permitido por la normativa vigente de la Cámara para operaciones de compraventa.',
    denunciante: 'Andreina Torres',
    cedula: 'V-15.432.109',
    email: 'andreina.t@gmail.com',
    telefono: '0412-9988776',
    denunciado: 'Luis Álvarez (Corredor Afiliado #0341)',
    fecha: '2026-07-15',
    estado: 'resuelta',
    prioridad: 'baja',
    archivos: 6,
    notas: 'Mediación exitosa. El corredor devolvió el excedente cobrado. Caso cerrado.',
  },
  {
    id: '4',
    codigo: 'DEN-2026-004',
    tipo: 'Usurpación de Inmueble',
    descripcion: 'Terceros ocuparon ilegalmente una propiedad vacante mientras se tramitaba documentación de compraventa.',
    denunciante: 'Roberto Fuentes Salinas',
    cedula: 'V-8.123.456',
    email: 'r.fuentes@empresa.com',
    telefono: '0416-5551234',
    denunciado: 'Desconocidos',
    fecha: '2026-08-03',
    estado: 'pendiente',
    prioridad: 'alta',
    archivos: 1,
    notas: '',
  },
  {
    id: '5',
    codigo: 'DEN-2026-005',
    tipo: 'Discriminación en Arrendamiento',
    descripcion: 'Propietario rechazó solicitud de arrendamiento argumentando criterios discriminatorios no justificados legalmente.',
    denunciante: 'Sofía Blanco',
    cedula: 'V-21.098.765',
    email: 'sofia.blanco@live.com',
    telefono: '0426-3210987',
    denunciado: 'Pedro Ramírez (Propietario)',
    fecha: '2026-07-20',
    estado: 'desestimada',
    prioridad: 'baja',
    archivos: 0,
    notas: 'Caso desestimado por falta de evidencias suficientes.',
  },
]

// ─── Constants ────────────────────────────────────────────────────────────────
const TIPOS_DENUNCIA = [
  'Incumplimiento de Contrato',
  'Publicidad Engañosa',
  'Cobro Indebido de Comisiones',
  'Usurpación de Inmueble',
  'Discriminación en Arrendamiento',
  'Fraude Inmobiliario',
  'Negligencia Profesional',
  'Otro',
]

const ESTADO_CONFIG: Record<EstadoDenuncia, { label: string; classes: string; dot: string }> = {
  pendiente: {
    label: 'Pendiente',
    classes: 'text-amber-700 bg-amber-50 border-amber-200',
    dot: 'bg-amber-500',
  },
  en_revision: {
    label: 'En Revisión',
    classes: 'text-blue-700 bg-blue-50 border-blue-200',
    dot: 'bg-blue-500',
  },
  resuelta: {
    label: 'Resuelta',
    classes: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  desestimada: {
    label: 'Desestimada',
    classes: 'text-slate-600 bg-slate-100 border-slate-200',
    dot: 'bg-slate-400',
  },
}

const PRIORIDAD_CONFIG = {
  alta: { label: 'Alta', classes: 'text-rose-700 bg-rose-50 border-rose-200' },
  media: { label: 'Media', classes: 'text-amber-700 bg-amber-50 border-amber-200' },
  baja: { label: 'Baja', classes: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
const DenunciaDetail = ({
  denuncia,
  onBack,
  onEstadoChange,
}: {
  denuncia: Denuncia
  onBack: () => void
  onEstadoChange: (id: string, estado: EstadoDenuncia) => void
}) => {
  const [nota, setNota] = useState(denuncia.notas)
  const [isHiding, setIsHiding] = useState(false)

  useEffect(() => {
    setNota(denuncia.notas)
  }, [denuncia.id, denuncia.notas])

  const handleBack = () => {
    setIsHiding(true)
    setTimeout(onBack, 180)
  }

  const estadoCfg = ESTADO_CONFIG[denuncia.estado]
  const prioridadCfg = PRIORIDAD_CONFIG[denuncia.prioridad]

  return (
    <div className={`flex flex-col gap-0 h-full overflow-hidden transition-colors duration-200 ${
      isHiding ? 'opacity-0 scale-95 translate-x-4 pointer-events-none' : 'opacity-100 scale-100'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 bg-white shrink-0">
        <button
          onClick={handleBack}
          className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors transition-transform hover:scale-105 active:scale-95 shrink-0"
          title="Volver a la lista"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{denuncia.codigo}</span>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${estadoCfg.classes}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${estadoCfg.dot}`} />
              {estadoCfg.label}
            </span>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${prioridadCfg.classes}`}>
              {prioridadCfg.label} prioridad
            </span>
          </div>
          <h2 className="text-base font-black text-slate-800 mt-0.5 truncate">{denuncia.tipo}</h2>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {/* Partes involucradas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Denunciante</p>
            <p className="text-sm font-bold text-slate-800">{denuncia.denunciante}</p>
            <p className="text-xs text-slate-500 mt-1">{denuncia.cedula}</p>
            <p className="text-xs text-slate-500">{denuncia.email}</p>
            <p className="text-xs text-slate-500">{denuncia.telefono}</p>
          </div>
          <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-2">Denunciado</p>
            <p className="text-sm font-bold text-slate-800">{denuncia.denunciado}</p>
            <p className="text-xs text-slate-500 mt-1">Fecha de Denuncia: {new Date(denuncia.fecha).toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="text-xs text-slate-500">{denuncia.archivos} archivo(s) adjunto(s)</p>
          </div>
        </div>

        {/* Descripción */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Descripción del Caso</p>
          <p className="text-sm text-slate-700 leading-relaxed">{denuncia.descripcion}</p>
        </div>

        {/* Cambio de Estado */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cambiar Estado del Caso</p>
          <div className="flex items-center gap-2 flex-wrap">
            {(Object.keys(ESTADO_CONFIG) as EstadoDenuncia[]).map((estado) => {
              const cfg = ESTADO_CONFIG[estado]
              const isActive = denuncia.estado === estado
              return (
                <button
                  key={estado}
                  onClick={() => onEstadoChange(denuncia.id, estado)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                    isActive
                      ? cfg.classes + ' shadow-sm scale-105'
                      : 'text-slate-400 bg-white border-slate-200 hover:border-slate-300 hover:text-slate-600'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isActive ? cfg.dot : 'bg-slate-300'}`} />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Notas internas */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Notas Internas del Expediente</p>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={4}
            placeholder="Escribe notas internas del caso (solo visible para administradores)..."
            className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 p-3 resize-none transition-colors"
          />
          <button className="text-xs font-black uppercase tracking-wider text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors border border-blue-100 cursor-pointer">
            Guardar Nota
          </button>
        </div>

        {/* Archivos adjuntos mock */}
        {denuncia.archivos > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Archivos Adjuntos</p>
            <div className="flex flex-col gap-2">
              {Array.from({ length: denuncia.archivos }).map((_, fileIdx) => (
                <div key={`archivo-${fileIdx + 1}`} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:border-slate-200 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-slate-700 flex-1">evidencia_0{fileIdx + 1}.pdf</span>
                  <span className="text-[10px] text-slate-400 font-bold">Ver archivo →</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex gap-3">
        <button className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-colors transition-transform active:scale-95 cursor-pointer shadow-md">
          Notificar al Denunciante
        </button>
        <button className="px-6 py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-black uppercase tracking-wider border border-rose-200 transition-colors cursor-pointer">
          Archivar Caso
        </button>
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
const DenunciasPanel = () => {
  const [items, setItems] = useState<Denuncia[]>(MOCK_DENUNCIAS)
  const [selected, setSelected] = useState<Denuncia | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoDenuncia | 'todos'>('todos')
  const [filtroPrioridad, setFiltroPrioridad] = useState<'alta' | 'media' | 'baja' | 'todos'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newForm, setNewForm] = useState({
    tipo: '', denunciante: '', cedula: '', email: '', telefono: '', denunciado: '', descripcion: '', prioridad: 'media' as 'alta' | 'media' | 'baja',
  })

  const filtered = items.filter((d) => {
    const matchEstado = filtroEstado === 'todos' || d.estado === filtroEstado
    const matchPrioridad = filtroPrioridad === 'todos' || d.prioridad === filtroPrioridad
    const matchBusqueda = busqueda === '' ||
      d.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      d.denunciante.toLowerCase().includes(busqueda.toLowerCase()) ||
      d.denunciado.toLowerCase().includes(busqueda.toLowerCase()) ||
      d.tipo.toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchPrioridad && matchBusqueda
  })

  const stats = {
    total: items.length,
    pendientes: items.filter(d => d.estado === 'pendiente').length,
    en_revision: items.filter(d => d.estado === 'en_revision').length,
    resueltas: items.filter(d => d.estado === 'resuelta').length,
  }

  const handleEstadoChange = (id: string, estado: EstadoDenuncia) => {
    setItems(prev => prev.map(d => d.id === id ? { ...d, estado } : d))
    setSelected(prev => prev && prev.id === id ? { ...prev, estado } : prev)
  }

  const handleNuevaDenuncia = () => {
    const nuevaId = String(items.length + 1)
    const nuevaDenuncia: Denuncia = {
      id: nuevaId,
      codigo: `DEN-2026-00${items.length + 1}`,
      tipo: newForm.tipo || 'Otro',
      descripcion: newForm.descripcion,
      denunciante: newForm.denunciante,
      cedula: newForm.cedula,
      email: newForm.email,
      telefono: newForm.telefono,
      denunciado: newForm.denunciado,
      fecha: new Date().toISOString().split('T')[0],
      estado: 'pendiente',
      prioridad: newForm.prioridad,
      archivos: 0,
      notas: '',
    }
    setItems(prev => [nuevaDenuncia, ...prev])
    setNewForm({ tipo: '', denunciante: '', cedula: '', email: '', telefono: '', denunciado: '', descripcion: '', prioridad: 'media' })
    setShowForm(false)
    setSelected(nuevaDenuncia)
  }

  if (selected) {
    return (
      <DenunciaDetail
        denuncia={selected}
        onBack={() => setSelected(null)}
        onEstadoChange={handleEstadoChange}
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
      {/* Stats bar */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-slate-100 shrink-0 overflow-x-auto no-scrollbar">
        {[
          { label: 'Total Denuncias', value: stats.total, color: 'text-slate-800', bg: 'bg-slate-100' },
          { label: 'Pendientes', value: stats.pendientes, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'En Revisión', value: stats.en_revision, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Resueltas', value: stats.resueltas, color: 'text-emerald-700', bg: 'bg-emerald-50' },
        ].map((stat) => (
          <div key={stat.label} className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl ${stat.bg} border border-transparent shrink-0`}>
            <span className={`text-xl font-black ${stat.color}`}>{stat.value}</span>
            <span className="text-xs font-bold text-slate-500 leading-tight">{stat.label}</span>
          </div>
        ))}
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto shrink-0 flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-colors transition-transform active:scale-95 shadow-md shadow-rose-600/20 cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva Denuncia
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-slate-100 shrink-0 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por código, nombre, tipo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-medium"
          />
        </div>

        {/* Filtro Estado */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {(['todos', 'pendiente', 'en_revision', 'resuelta', 'desestimada'] as const).map((e) => {
            const label = e === 'todos' ? 'Todos' : ESTADO_CONFIG[e]?.label ?? e
            return (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                  filtroEstado === e ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Filtro Prioridad */}
        <select
          value={filtroPrioridad}
          onChange={(e) => setFiltroPrioridad(e.target.value as any)}
          className="text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 focus:outline-none cursor-pointer"
        >
          <option value="todos">Toda prioridad</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
      </div>

      {/* New Denuncia Form (slide-in) */}
      {showForm && (
        <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="transition-opacity transition-transform bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg max-h-[90vh] overflow-y-auto fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 p-6 border-b border-slate-100">
              <button
                onClick={() => setShowForm(false)}
                className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div>
                <h3 className="text-lg font-black text-slate-800">Registrar Nueva Denuncia</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Módulo de Denuncias</p>
              </div>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[
                { label: 'Denunciante (Nombre Completo)', key: 'denunciante', placeholder: 'Nombre y Apellido' },
                { label: 'Cédula de Identidad', key: 'cedula', placeholder: 'V-12.345.678' },
                { label: 'Correo Electrónico', key: 'email', placeholder: 'correo@ejemplo.com' },
                { label: 'Teléfono de Contacto', key: 'telefono', placeholder: '0414-1234567' },
                { label: 'Persona o Empresa Denunciada', key: 'denunciado', placeholder: 'Nombre / Razón Social' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={newForm[key as keyof typeof newForm] as string}
                    onChange={(e) => setNewForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 px-3 py-2.5 font-medium"
                  />
                </div>
              ))}

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Tipo de Denuncia</label>
                <select
                  value={newForm.tipo}
                  onChange={(e) => setNewForm(p => ({ ...p, tipo: e.target.value }))}
                  className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none px-3 py-2.5 font-semibold"
                >
                  <option value="">Selecciona un tipo</option>
                  {TIPOS_DENUNCIA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Prioridad</label>
                <div className="flex gap-2">
                  {(['alta', 'media', 'baja'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewForm(prev => ({ ...prev, prioridad: p }))}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                        newForm.prioridad === p
                          ? PRIORIDAD_CONFIG[p].classes + ' shadow-sm scale-[1.02]'
                          : 'text-slate-400 bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {PRIORIDAD_CONFIG[p].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Descripción del Hecho</label>
                <textarea
                  placeholder="Describe detalladamente los hechos que motivan la denuncia..."
                  value={newForm.descripcion}
                  onChange={(e) => setNewForm(p => ({ ...p, descripcion: e.target.value }))}
                  rows={4}
                  className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 px-3 py-2.5 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleNuevaDenuncia}
                  className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-colors transition-transform active:scale-95 cursor-pointer"
                >
                  Registrar Denuncia
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 py-24">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <p className="text-sm font-bold">No se encontraron denuncias</p>
            <p className="text-xs text-slate-300">Prueba con otros filtros o términos de búsqueda</p>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3">
            {filtered.map((d) => {
              const estadoCfg = ESTADO_CONFIG[d.estado]
              const prioridadCfg = PRIORIDAD_CONFIG[d.prioridad]
              return (
                <div
                  key={d.id}
                  onClick={() => setSelected(d)}
                  className="bg-white rounded-2xl border border-slate-100 p-4 cursor-pointer hover:border-slate-200 hover:shadow-md transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{d.codigo}</span>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${estadoCfg.classes}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${estadoCfg.dot}`} />
                          {estadoCfg.label}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${prioridadCfg.classes}`}>
                          {prioridadCfg.label}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-800 truncate">{d.tipo}</h4>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{d.descripcion}</p>
                    </div>
                    <div className="shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors mt-1">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-black">
                        {d.denunciante.charAt(0)}
                      </div>
                      <span className="text-xs font-bold text-slate-600">{d.denunciante}</span>
                      <span className="text-slate-300">→</span>
                      <span className="text-xs text-slate-400 font-medium truncate max-w-[120px]">{d.denunciado}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      {new Date(d.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default DenunciasPanel
