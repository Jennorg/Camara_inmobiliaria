import React, { useState, useEffect, useCallback } from 'react'
import { 
  ShieldAlert, 
  FileText, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Gavel, 
  Calendar, 
  Lock, 
  UploadCloud, 
  ExternalLink, 
  Printer, 
  Copy, 
  Check, 
  Building2, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  ChevronDown
} from 'lucide-react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import Navbar from '@/pages/landing/components/navbar/Navbar'
import Footer from '@/pages/landing/components/Footer'
import SEO from '@/components/SEO'
import FileUpload from '@/components/common/FileUpload'
import { toast } from 'sonner'
import type { TipoFalta, TipoDenunciante } from '@/types/denuncias'

const TIPOS_FALTA = [
  { id: 'incumplimiento_contrato', label: 'Incumplimiento de Contrato / Oferta Inmobiliaria' },
  { id: 'comisiones_indebidas',     label: 'Cobro Indebido o Retención de Honorarios / Comisiones' },
  { id: 'publicidad_enganosa',      label: 'Publicidad Engañosa / Captación Irregular' },
  { id: 'falta_etica',              label: 'Infracción al Código de Ética de la Cámara (CIV/CIEB)' },
  { id: 'retencion_documentos',     label: 'Retención Indebida de Documentos, Llaves o Inmuebles' },
  { id: 'fraude_estafa',            label: 'Presunto Fraude, Estafa o Mala Praxis Profesional' },
  { id: 'otro',                     label: 'Otro Motivo / Disputa Inmobiliaria' },
]

export default function DenunciasPublicPage() {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<'formular' | 'consultar'>('formular')

  // ── Formulario de Denuncia ──
  const [tipoDenunciante, setTipoDenunciante] = useState<TipoDenunciante>('no_afiliado')
  const [nombreDenunciante, setNombreDenunciante] = useState('')
  const [cedulaRif, setCedulaRif] = useState('')
  const [emailDenunciante, setEmailDenunciante] = useState('')
  const [telefonoDenunciante, setTelefonoDenunciante] = useState('')
  const [direccionDenunciante, setDireccionDenunciante] = useState('')

  // Búsqueda de Afiliado Denunciado
  const [searchAfilQuery, setSearchAfilQuery] = useState('')
  const [afilResults, setAfilResults] = useState<any[]>([])
  const [searchingAfil, setSearchingAfil] = useState(false)
  const [selectedAfiliado, setSelectedAfiliado] = useState<any | null>(null)

  // Hechos
  const [tipoFalta, setTipoFalta] = useState<TipoFalta>('incumplimiento_contrato')
  const [titulo, setTitulo] = useState('')
  const [descripcionHechos, setDescripcionHechos] = useState('')
  const [inmuebleReferencia, setInmuebleReferencia] = useState('')
  const [montoInvolucrado, setMontoInvolucrado] = useState('')
  const [documentos, setDocumentos] = useState<{ nombre_archivo: string; url: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Resultado de radicación
  const [denunciaCreada, setDenunciaCreada] = useState<{
    codigo: string
    pin_seguimiento: string
    nombre_denunciado: string
  } | null>(null)

  // ── Formulario de Consulta ──
  const [consultarCodigo, setConsultarCodigo] = useState('')
  const [consultarPin, setConsultarPin] = useState('')
  const [consultando, setConsultando] = useState(false)
  const [casoConsultado, setCasoConsultado] = useState<any | null>(null)
  const [copiedPin, setCopiedPin] = useState(false)

  // Autocompletar si el usuario está logueado
  useEffect(() => {
    if (user) {
      if (user.role === 'afiliado') setTipoDenunciante('afiliado')
      if (user.email) setEmailDenunciante(user.email)
    }
  }, [user])

  // Buscar afiliados en el directorio público
  const handleSearchAfiliados = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setAfilResults([])
      return
    }
    try {
      setSearchingAfil(true)
      const res = await fetch(`${API_URL}/api/public/afiliados/buscar?q=${encodeURIComponent(q.trim())}`)
      if (res.ok) {
        const json = await res.json()
        setAfilResults(json.data || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSearchingAfil(false)
    }
  }, [])

  // Enviar denuncia
  const handleSubmitDenuncia = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedAfiliado) {
      toast.error('Debe buscar y seleccionar al afiliado denunciado en el registro.')
      return
    }
    if (!nombreDenunciante.trim() || !cedulaRif.trim() || !emailDenunciante.trim() || !telefonoDenunciante.trim()) {
      toast.error('Por favor complete todos sus datos de contacto.')
      return
    }
    if (!titulo.trim() || !descripcionHechos.trim()) {
      toast.error('Por favor detalle los hechos de la denuncia.')
      return
    }

    try {
      setSubmitting(true)

      const payload = {
        tipo_denunciante: tipoDenunciante,
        nombre_denunciante: nombreDenunciante.trim(),
        cedula_rif_denunciante: cedulaRif.trim().toUpperCase(),
        email_denunciante: emailDenunciante.trim().toLowerCase(),
        telefono_denunciante: telefonoDenunciante.trim(),
        direccion_denunciante: direccionDenunciante.trim() || null,
        id_afiliado_denunciado: selectedAfiliado.id_afiliado,
        tipo_falta: tipoFalta,
        titulo: titulo.trim(),
        descripcion_hechos: descripcionHechos.trim(),
        inmueble_referencia: inmuebleReferencia.trim() || null,
        monto_involucrado: parseFloat(montoInvolucrado) || 0,
        moneda_monto: 'USD',
        documentos
      }

      const res = await fetch(`${API_URL}/api/denuncias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al radicar denuncia')

      setDenunciaCreada({
        codigo: json.data.codigo,
        pin_seguimiento: json.data.pin_seguimiento,
        nombre_denunciado: json.data.nombre_denunciado
      })
      toast.success('¡Denuncia radicada formalmente ante el Tribunal de Ética!')
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar la denuncia')
    } finally {
      setSubmitting(false)
    }
  }

  // Consultar caso con Código + PIN
  const handleConsultar = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!consultarCodigo.trim() || !consultarPin.trim()) {
      toast.error('Ingrese el código de la denuncia y su PIN.')
      return
    }

    try {
      setConsultando(true)
      setCasoConsultado(null)

      const res = await fetch(`${API_URL}/api/denuncias/consultar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: consultarCodigo.trim().toUpperCase(),
          pin: consultarPin.trim().toUpperCase()
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se encontró la denuncia')

      setCasoConsultado(json.data)
      toast.success('Expediente localizado.')
    } catch (err: any) {
      toast.error(err.message || 'Error al consultar denuncia')
    } finally {
      setConsultando(false)
    }
  }

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin)
    setCopiedPin(true)
    setTimeout(() => setCopiedPin(false), 2000)
    toast.success('PIN copiado al portapapeles')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <SEO
        title="Tribunal de Ética y Denuncias | Cámara Inmobiliaria de Bolívar"
        description="Canal oficial para radicación, mediación y resolución de denuncias contra afiliados gremiales."
      />
      <Navbar />

      <main className="flex-1 py-10 px-4 sm:px-6 max-w-5xl mx-auto w-full space-y-8 mt-16 sm:mt-20">
        {/* Banner de Cabecera */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800">
            <Gavel size={14} />
            Tribunal de Ética & Disciplina Gremial
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Canal de Denuncias & Mediación Inmobiliaria
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            Garantizamos las buenas prácticas, la ética y la transparencia en las operaciones inmobiliarias. Presente su reclamo formal o consulte el avance de su expediente.
          </p>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex justify-center">
          <div className="bg-slate-200/80 p-1 rounded-2xl flex gap-1 shadow-inner">
            <button
              onClick={() => {
                setActiveTab('formular')
                setDenunciaCreada(null)
              }}
              className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'formular'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Formular Denuncia
            </button>
            <button
              onClick={() => setActiveTab('consultar')}
              className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'consultar'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Consultar Estado de Denuncia
            </button>
          </div>
        </div>

        {/* ── TAB 1: FORMULAR DENUNCIA ── */}
        {activeTab === 'formular' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            {denunciaCreada ? (
              /* Modal / Pantalla de Confirmación de Radicación */
              <div className="p-8 sm:p-12 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 size={36} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900">
                    ¡Denuncia Radicada Exitosamente!
                  </h2>
                  <p className="text-sm text-slate-600 max-w-lg mx-auto">
                    Su caso ha sido asignado al Tribunal de Ética y Disciplina de la Cámara Inmobiliaria del Estado Bolívar contra <strong>{denunciaCreada.nombre_denunciado}</strong>.
                  </p>
                </div>

                {/* Tarjeta de Código y PIN */}
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 max-w-md mx-auto space-y-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Código de Expediente</span>
                    <p className="text-2xl font-mono font-black text-slate-900">{denunciaCreada.codigo}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-left">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">PIN de Seguimiento</span>
                      <p className="text-xl font-mono font-black text-rose-600">{denunciaCreada.pin_seguimiento}</p>
                    </div>
                    <button
                      onClick={() => handleCopyPin(denunciaCreada.pin_seguimiento)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                    >
                      {copiedPin ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      <span>{copiedPin ? 'Copiado' : 'Copiar PIN'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl max-w-lg mx-auto text-left text-xs text-amber-900 space-y-1">
                  <strong className="block">Guarde este código y PIN:</strong>
                  <p>
                    Le permitirá consultar en línea el avance de su caso, las fechas de audiencia de mediación y el dictamen final emitido por el Tribunal de Ética.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                  <button
                    onClick={() => window.print()}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center gap-2"
                  >
                    <Printer size={16} /> Imprimir Comprobante
                  </button>
                  <button
                    onClick={() => {
                      setConsultarCodigo(denunciaCreada.codigo)
                      setConsultarPin(denunciaCreada.pin_seguimiento)
                      setActiveTab('consultar')
                    }}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-2 shadow-md"
                  >
                    Ir a Consultar Estado <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              /* Formulario de Registro */
              <form onSubmit={handleSubmitDenuncia} className="p-6 sm:p-10 space-y-8">
                {/* Paso 1: Datos del Denunciante */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">1</span>
                    <h3 className="font-bold text-base text-slate-800">Datos de la Persona o Entidad Denunciante</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipo de Denunciante</label>
                      <select
                        value={tipoDenunciante}
                        onChange={e => setTipoDenunciante(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white font-medium"
                      >
                        <option value="no_afiliado">Particular / Cliente / Comprador / Inquilino</option>
                        <option value="afiliado">Corredor o Empresa Afiliada a la Cámara</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre Completo / Razón Social *</label>
                      <input
                        type="text"
                        required
                        value={nombreDenunciante}
                        onChange={e => setNombreDenunciante(e.target.value)}
                        placeholder="Ej. Juan Pérez / Inversiones ABC"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Cédula de Identidad / RIF *</label>
                      <input
                        type="text"
                        required
                        value={cedulaRif}
                        onChange={e => setCedulaRif(e.target.value.toUpperCase())}
                        placeholder="Ej. V-12345678 o J-12345678-9"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none uppercase font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Correo Electrónico *</label>
                      <input
                        type="email"
                        required
                        value={emailDenunciante}
                        onChange={e => setEmailDenunciante(e.target.value)}
                        placeholder="correo@ejemplo.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Teléfono de Contacto / WhatsApp *</label>
                      <input
                        type="tel"
                        required
                        value={telefonoDenunciante}
                        onChange={e => setTelefonoDenunciante(e.target.value)}
                        placeholder="0414-1234567"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Paso 2: Selección del Afiliado Denunciado */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">2</span>
                    <h3 className="font-bold text-base text-slate-800">Afiliado Gremial Denunciado</h3>
                  </div>

                  <p className="text-xs text-slate-500">
                    Busque al profesional o empresa inmobiliaria afiliada a la Cámara contra quien formula la denuncia:
                  </p>

                  <div className="space-y-2 relative">
                    <div className="relative">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchAfilQuery}
                        onChange={e => {
                          setSearchAfilQuery(e.target.value)
                          handleSearchAfiliados(e.target.value)
                        }}
                        placeholder="Escriba el nombre, apellido, empresa o código de afiliado..."
                        className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none shadow-inner"
                      />
                    </div>

                    {/* Resultados del Buscador */}
                    {afilResults.length > 0 && !selectedAfiliado && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {afilResults.map((a: any) => {
                          const nombre = a.nombre_completo || a.empresa_razon_social || `${a.nombres || ''} ${a.apellidos || ''}`.trim() || 'Afiliado Gremial'
                          const infoSub = [
                            a.codigo ? `Código: ${a.codigo}` : 'Afiliado Gremial',
                            a.tipo_afiliado || 'Afiliado',
                            a.empresa_razon_social && a.empresa_razon_social !== a.nombre_completo ? a.empresa_razon_social : (a.cedula ? a.cedula : null)
                          ].filter(Boolean).join(' · ')

                          return (
                            <div
                              key={a.id_afiliado}
                              onClick={() => {
                                setSelectedAfiliado(a)
                                setSearchAfilQuery(nombre)
                                setAfilResults([])
                              }}
                              className="p-3 hover:bg-rose-50/60 cursor-pointer flex items-center justify-between transition-colors"
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-800">{nombre}</p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {infoSub}
                                </p>
                              </div>
                              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl">
                                Seleccionar
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Afiliado Seleccionado */}
                  {selectedAfiliado && (
                    <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {selectedAfiliado.nombre_completo || selectedAfiliado.empresa_razon_social || `${selectedAfiliado.nombres || ''} ${selectedAfiliado.apellidos || ''}`.trim() || 'Afiliado Seleccionado'}
                          </p>
                          <p className="text-xs text-rose-700 font-mono">
                            {selectedAfiliado.codigo ? `Código: ${selectedAfiliado.codigo}` : 'Afiliado Registrado'} {selectedAfiliado.tipo_afiliado ? `· ${selectedAfiliado.tipo_afiliado}` : ''}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAfiliado(null)
                          setSearchAfilQuery('')
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                      >
                        Cambiar
                      </button>
                    </div>
                  )}
                </div>

                {/* Paso 3: Motivo y Hechos */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">3</span>
                    <h3 className="font-bold text-base text-slate-800">Descripción del Conflicto y Hechos</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Motivo / Tipo de Falta *</label>
                      <select
                        value={tipoFalta}
                        onChange={e => setTipoFalta(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white font-medium"
                      >
                        {TIPOS_FALTA.map(t => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Título Resumido del Caso *</label>
                      <input
                        type="text"
                        required
                        value={titulo}
                        onChange={e => setTitulo(e.target.value)}
                        placeholder="Ej. Incumplimiento de entrega de llaves y solvencia municipal"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Relato Detallado y Cronológico de los Hechos *</label>
                    <textarea
                      required
                      rows={5}
                      value={descripcionHechos}
                      onChange={e => setDescripcionHechos(e.target.value)}
                      placeholder="Indique con claridad las fechas, acuerdos pactados, compromisos asumidos y los perjuicios causados..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Inmueble Referido (Opcional)</label>
                      <input
                        type="text"
                        value={inmuebleReferencia}
                        onChange={e => setInmuebleReferencia(e.target.value)}
                        placeholder="Ej. Casa en Urb. Los Olivos / Apto Res. Samanes"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Monto Económico Involucrado en USD (Opcional)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={montoInvolucrado}
                        onChange={e => setMontoInvolucrado(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Paso 4: Evidencias y Documentos */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">4</span>
                    <h3 className="font-bold text-base text-slate-800">Evidencias Probatorias (PDF o Imágenes)</h3>
                  </div>

                  <p className="text-xs text-slate-500">
                    Adjunte copia del contrato de corretaje/arrendamiento, recibos de transferencias, capturas de comunicaciones o documentos que sustenten los hechos:
                  </p>

                  <FileUpload
                    label="Adjuntar documento"
                    onUploadSuccess={(url, nombre = 'documento') => {
                      setDocumentos(prev => [...prev, { nombre_archivo: nombre, url }])
                      toast.success(`Archivo "${nombre}" adjuntado.`)
                    }}
                    // Los adjuntos ya quedaron en la lista; limpiar el input no los quita.
                    onClear={() => {}}
                    accept="application/pdf,image/*"
                    folder="denuncias"
                  />

                  {documentos.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[11px] font-bold text-slate-700">Archivos adjuntos ({documentos.length}):</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {documentos.map((doc, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                            <span className="truncate font-bold text-slate-700">{doc.nombre_archivo}</span>
                            <span className="text-[10px] text-emerald-600 font-bold">✓ Listo</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Botón de Envío */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-8 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? 'Radicando denuncia...' : 'Presentar Denuncia Formal'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── TAB 2: CONSULTAR ESTADO ── */}
        {activeTab === 'consultar' && (
          <div className="space-y-6">
            {/* Formulario de Búsqueda de Caso */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md">
              <form onSubmit={handleConsultar} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Código de Expediente *
                  </label>
                  <input
                    type="text"
                    required
                    value={consultarCodigo}
                    onChange={e => setConsultarCodigo(e.target.value.toUpperCase())}
                    placeholder="Ej. DEN-2026-0001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:ring-2 focus:ring-slate-900 uppercase outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    PIN de Seguimiento *
                  </label>
                  <input
                    type="text"
                    required
                    value={consultarPin}
                    onChange={e => setConsultarPin(e.target.value.toUpperCase())}
                    placeholder="Ej. 749215"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:ring-2 focus:ring-slate-900 uppercase outline-none"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={consultando}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-black transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {consultando ? <Clock size={16} className="animate-spin" /> : <Search size={16} />}
                    <span>Consultar Expediente</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Resultado de la Consulta */}
            {casoConsultado && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150">
                {/* Header del Caso */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <span className="font-mono font-black text-sm text-slate-400">{casoConsultado.codigo}</span>
                    <h2 className="text-xl font-black text-slate-900">{casoConsultado.titulo}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Presentada el {new Date(casoConsultado.fecha_presentacion).toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>

                  <div className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-slate-900 text-white shadow-xs">
                    Estado: {casoConsultado.estatus.replace('_', ' ')}
                  </div>
                </div>

                {/* Partes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Denunciante</span>
                    <p className="text-sm font-bold text-slate-800">{casoConsultado.nombre_denunciante}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 space-y-1">
                    <span className="text-[10px] font-bold text-rose-500 uppercase">Afiliado Denunciado</span>
                    <p className="text-sm font-bold text-slate-900">{casoConsultado.nombre_denunciado}</p>
                    <p className="text-[10px] text-rose-600 font-mono">Código CIV: {casoConsultado.codigo_afiliado_denunciado || 'Registrado'}</p>
                  </div>
                </div>

                {/* Audiencia de Mediación si existe */}
                {casoConsultado.fecha_audiencia_mediacion && (
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Calendar size={16} className="text-blue-600" />
                      Audiencia de Mediación y Conciliación Convocada
                    </div>
                    <p className="text-xs">
                      <strong>Fecha y Hora:</strong> {new Date(casoConsultado.fecha_audiencia_mediacion).toLocaleString('es-VE')}
                    </p>
                    <p className="text-xs">
                      <strong>Lugar / Modalidad:</strong> {casoConsultado.lugar_modalidad_audiencia}
                    </p>
                  </div>
                )}

                {/* Dictamen y Resolución Final si existe */}
                {casoConsultado.dictamen_resolucion && (
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                      <Gavel size={18} className="text-emerald-700" />
                      Dictamen Final y Fin al Conflicto
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-emerald-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {casoConsultado.dictamen_resolucion}
                    </div>

                    {casoConsultado.acta_resolucion_url && (
                      <div className="flex justify-end">
                        <a
                          href={casoConsultado.acta_resolucion_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-xs"
                        >
                          <FileText size={14} />
                          Descargar Acta Oficial de Resolución (PDF)
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Línea de Tiempo de Actuaciones */}
                <div className="space-y-3 pt-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                    Línea de Tiempo del Procedimiento
                  </h3>

                  <div className="space-y-3 relative pl-4 border-l-2 border-slate-200">
                    {casoConsultado.historial?.map((h: any) => (
                      <div key={h.id_historial} className="relative text-xs space-y-0.5">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-900 ring-4 ring-white" />
                        <p className="font-bold text-slate-800">{h.accion}</p>
                        {h.comentario && <p className="text-slate-600 text-[11px]">{h.comentario}</p>}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(h.fecha).toLocaleDateString('es-VE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
