import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { AfiliadoDTO } from '@/types/afiliados'
import { formatNombreCard, getInitials } from '@/utils/formatters'
import {
  Users,
  Search,
  Building2,
  RefreshCw,
  Check,
  X,
  Loader2,
  AlertCircle,
  ExternalLink,
  Mail,
  Phone,
  ChevronLeft
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

async function requestCompanies(authHeaders: Record<string, string>, signal?: AbortSignal) {
  const json = await apiFetch(`${API_URL}/api/afiliados?tipo_afiliado=Corporativo`, { headers: authHeaders, signal })
  if (!json.success) throw new Error(json.message || 'No se pudo cargar empresas')
  return json.data as AfiliadoDTO[]
}

export default function AdminMisAgentesPanel() {
  const { token } = useAuth()
  const [companies, setCompanies] = useState<AfiliadoDTO[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [agents, setAgents] = useState<AfiliadoDTO[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [searchCompany, setSearchCompany] = useState('')
  const [searchAgent, setSearchAgent] = useState('')
  const [error, setError] = useState('')

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token])

  const fetchCompanies = useCallback(async () => {
    setError('')
    setLoadingCompanies(true)
    try {
      const data = await requestCompanies(authHeaders)
      setCompanies(data)
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Error al cargar empresas')
    } finally {
      setLoadingCompanies(false)
    }
  }, [authHeaders])

  const loadAgentsForCompany = useCallback(async (companyId: number, signal?: AbortSignal) => {
    setLoadingAgents(true)
    setError('')
    try {
      const json = await apiFetch(`${API_URL}/api/afiliados?tipo_afiliado=Agente%20Corporativo&id_empresa=${companyId}`, { headers: authHeaders, signal })
      if (signal?.aborted) return
      if (!json.success) throw new Error(json.message || 'No se pudo cargar agentes')
      setAgents(json.data as AfiliadoDTO[])
    } catch (err: unknown) {
      if (signal?.aborted) return
      const e = err as Error
      setError(e.message || 'Error al cargar agentes corporativos')
    } finally {
      setLoadingAgents(false)
    }
  }, [authHeaders])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setError('')
    setLoadingCompanies(true)

    requestCompanies(authHeaders, controller.signal)
      .then((data) => {
        if (active && !controller.signal.aborted) {
          setCompanies(data)
        }
      })
      .catch((err: unknown) => {
        if (active && !controller.signal.aborted) {
          const e = err as Error
          setError(e.message || 'Error al cargar listado de empresas')
        }
      })
      .finally(() => {
        if (active) {
          setLoadingCompanies(false)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [authHeaders])

  useEffect(() => {
    if (!selectedCompanyId) {
      setAgents([])
      return
    }
    const controller = new AbortController()
    loadAgentsForCompany(selectedCompanyId, controller.signal)
    return () => {
      controller.abort()
    }
  }, [selectedCompanyId, loadAgentsForCompany])

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id_empresa === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  )

  const filteredCompanies = useMemo(() => {
    const query = searchCompany.trim().toLowerCase()
    if (!query) return companies
    return companies.filter((company) => {
      const name = (company.empresa_razon_social || '').toLowerCase()
      const persona = `${company.nombres || ''} ${company.apellidos || ''}`.trim().toLowerCase()
      const fullName = (company.nombre_completo || '').toLowerCase()
      const email = (company.empresa_email || company.email || '').toLowerCase()
      const rif = (company.empresa_rif_numero || '').toLowerCase()
      return name.includes(query) || persona.includes(query) || fullName.includes(query) || email.includes(query) || rif.includes(query)
    })
  }, [companies, searchCompany])

  const filteredAgents = useMemo(() => {
    const query = searchAgent.trim().toLowerCase()
    if (!query) return agents

    return agents.filter((agent) => {
      const nombre = (agent.nombre_completo || '').toLowerCase()
      const email = (agent.email || '').toLowerCase()
      const telefono = (agent.telefono || '').toLowerCase()
      const cedula = (agent.cedula || '').toLowerCase()
      return nombre.includes(query) || email.includes(query) || telefono.includes(query) || cedula.includes(query)
    })
  }, [agents, searchAgent])

  const pendingRequests = useMemo(
    () => filteredAgents.filter((agent) => agent.estatus === '1_PREINSCRIPCION'),
    [filteredAgents]
  )
  const activeAgents = useMemo(
    () => filteredAgents.filter((agent) => agent.estatus !== '1_PREINSCRIPCION'),
    [filteredAgents]
  )

  const updateCompanyAgents = async (idAfiliado: number, action: 'aprobar' | 'rechazar') => {
    if (!selectedCompany) return
    const companyId = selectedCompany.id_empresa
    if (companyId == null) return
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${companyId}/afiliados-corp/${idAfiliado}/${action}`, {
        method: 'POST',
        headers: authHeaders
      })
      if (!res.ok) throw new Error('No se pudo procesar la acción')
      const json = await res.json()
      if (!json.success) throw new Error(json.message || 'No se pudo procesar la acción')
      await loadAgentsForCompany(companyId)
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Error al procesar la acción')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="h-full space-y-8 p-4 lg:p-8 overflow-y-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Users className="text-emerald-600" size={24} />
            Solicitudes de Agentes
          </h2>
        </div>
        <button
          type="button"
          onClick={fetchCompanies}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={14} />
          Refrescar Empresas
        </button>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <div className={`bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm ${selectedCompanyId ? 'hidden xl:block' : 'block'}`}>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Empresas Corporativas</h3>
            </div>
            <span className="rounded-full bg-emerald-50 text-emerald-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider">
              {companies.length} Empresas
            </span>
          </div>
          <div className="p-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchCompany}
                onChange={(e) => setSearchCompany(e.target.value)}
                placeholder="Buscar empresa..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-100">
            {loadingCompanies ? (
              <div className="p-10 text-center text-slate-400">
                <Loader2 className="animate-spin mx-auto mb-3" size={24} />
                Cargando empresas...
              </div>
            ) : (
              filteredCompanies.map((company) => {
                const companyId = company.id_empresa
                return companyId !== null ? (
                  <button
                    key={companyId}
                    type="button"
                    onClick={() => setSelectedCompanyId(companyId)}
                    className={`w-full text-left p-4 transition-colors border-b border-slate-100 ${selectedCompanyId === companyId ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Building2 size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{company.empresa_razon_social || company.nombre_completo}</p>
                        <p className="text-[11px] text-slate-500 truncate">{company.empresa_email || company.email || 'Sin email'}</p>
                      </div>
                    </div>
                    {company.empresa_rif_numero && (
                      <p className="text-[11px] text-slate-400 font-medium mt-1.5 pl-12 truncate">
                        RIF: {company.empresa_rif_numero}
                      </p>
                    )}
                  </button>
                ) : null
              })
            )}
          </div>
        </div>

        <div className={`space-y-6 ${!selectedCompanyId ? 'hidden xl:block' : 'block'}`}>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {selectedCompanyId && (
                  <button 
                    onClick={() => setSelectedCompanyId(null)}
                    className="xl:hidden p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Agentes Corporativos</h3>
                </div>
              </div>
              <span className="rounded-full bg-slate-50 text-slate-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider">
                {selectedCompany ? `${agents.length} agentes` : 'Selecciona una empresa'}
              </span>
            </div>
            <div className="p-4 space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  disabled={!selectedCompany}
                  value={searchAgent}
                  onChange={(e) => setSearchAgent(e.target.value)}
                  placeholder={selectedCompany ? 'Buscar agente...' : 'Selecciona una empresa primero'}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed"
                />
              </div>
              {!selectedCompany ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                  Selecciona una empresa en la columna izquierda para revisar sus agentes.
                </div>
              ) : loadingAgents ? (
                <div className="p-10 text-center text-slate-400">
                  <Loader2 className="animate-spin mx-auto mb-3" size={24} />
                  Cargando agentes...
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No se encontraron agentes para esta empresa.</div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.length > 0 && (
                    <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-amber-800">
                      <p className="font-black text-[11px] uppercase tracking-[0.2em] mb-2">Solicitudes Pendientes</p>
                      <p className="text-[12px] leading-relaxed">Estas solicitudes todavía no han sido confirmadas. El admin puede aprobar o rechazar cada agente.</p>
                    </div>
                  )}

                  {filteredAgents.map((agent) => (
                    <div key={agent.id_afiliado} className="rounded-3xl border border-slate-100 p-4 hover:border-slate-200 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-black">
                            {getInitials(agent.nombre_completo || '', agent.nombre_completo ? '' : '')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{agent.nombre_completo}</p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-2">
                              <Mail size={12} /> {agent.email || 'Sin email'}
                            </p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                              <Phone size={12} /> {agent.telefono || 'Sin teléfono'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${agent.estatus === '1_PREINSCRIPCION' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {agent.estatus === '1_PREINSCRIPCION' ? 'Solicitud' : agent.estatus.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400">Registrado {new Date(agent.fecha_registro).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {agent.estatus === '1_PREINSCRIPCION' && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => updateCompanyAgents(agent.id_afiliado, 'aprobar')}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors transition-opacity disabled:opacity-50"
                          >
                            <Check size={14} /> Aprobar
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => updateCompanyAgents(agent.id_afiliado, 'rechazar')}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-colors transition-opacity disabled:opacity-50"
                          >
                            <X size={14} /> Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
