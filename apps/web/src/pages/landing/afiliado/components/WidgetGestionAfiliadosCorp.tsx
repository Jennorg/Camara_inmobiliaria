import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Users,
  Link as LinkIcon,
  Copy,
  CheckCircle,
  ExternalLink,
  Loader2,
  AlertCircle,
  Building2,
  UserPlus,
  X,
  ChevronDown,
  GraduationCap,
  School,
  Award,
  Briefcase,
  Check,
  User,
  Mail,
  Search,
  UserCheck,
  Phone,
  ClipboardList
} from 'lucide-react';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatNombreCard, getInitials } from '@/utils/formatters';
import { apiFetch } from '@/lib/apiClient';

interface Invitacion {
  id_invitacion: number;
  token: string;
  nombre_empresa: string;
  activo: number;
  fecha_expiracion: string | null;
  creado_en: string;
  total_afiliados: number;
}

interface AfiliadoMiembro {
  id_afiliado: number | null;
  nombre_completo: string;
  nombres: string | null;
  apellidos: string | null;
  cedula: string;
  email: string;
  telefono: string;
  estatus: string;
  fecha_registro: string;
  fase: 'Solicitud' | 'Aprobado' | 'En Proceso' | 'Rechazado';
}

interface AfiliadoIndependiente {
  id_afiliado: number;
  nombre_completo: string;
  nombres: string | null;
  apellidos: string | null;
  cedula: string;
  email: string;
  telefono: string | null;
  codigo: string | null;
  foto_url: string | null;
}

const BOX_H = 'h-[58px]';

type ActiveTab = 'agentes' | 'links' | 'vincular' | 'solicitudes';

const NIVELES = [
  { value: 'Bachiller', label: 'Bachiller', icon: School },
  { value: 'TSU', label: 'Técnico Superior (TSU)', icon: Briefcase },
  { value: 'Nivel Profesional', label: 'Nivel Profesional', icon: GraduationCap },
  { value: 'Postgrado', label: 'Postgrado', icon: Award },
];

export default function WidgetGestionAfiliadosCorp() {
  const { user, token } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('agentes');
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [miembros, setMiembros] = useState<AfiliadoMiembro[]>([]);
  const [solicitudesCambio, setSolicitudesCambio] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Vincular independiente
  const [busquedaInd, setBusquedaInd] = useState('');
  const [searchField, setSearchField] = useState<'nombre' | 'cedula' | 'codigo'>('nombre');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [independientes, setIndependientes] = useState<AfiliadoIndependiente[]>([]);
  const [loadingInd, setLoadingInd] = useState(false);
  const [confirmVincular, setConfirmVincular] = useState<AfiliadoIndependiente | null>(null);
  const [vinculandoId, setVinculandoId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef({ q: '', field: 'nombre', initialized: false });
  const [showModal, setShowModal] = useState(false);
  const [showNivelDropdown, setShowNivelDropdown] = useState(false);
  const [modalForm, setModalForm] = useState({
    nombreCompleto: '',
    cedulaPrefix: 'V',
    cedulaNumber: '',
    email: '',
    phonePrefix: '+58',
    telefono: '',
    nivelProfesional: '',
    esCorredorInmobiliario: '',
  });

  const [empresaNombre, setEmpresaNombre] = useState('');

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    try {
      let companyId = user?.id_empresa;
      if (!companyId && user?.id_afiliado) {
        const resProfile = await fetch(`${API_URL}/api/afiliados/${user.id_afiliado}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal
        });
        if (!resProfile.ok) throw new Error(`HTTP error! status: ${resProfile.status}`);
        const dProfile = await resProfile.json();
        if (dProfile.success && dProfile.data.id_empresa) {
          companyId = dProfile.data.id_empresa;
        }
      }

      if (!companyId) {
        if (!signal?.aborted) setLoading(false);
        return;
      }

      const [resInv, resMbr, resSol] = await Promise.all([
        fetch(`${API_URL}/api/afiliados/${companyId}/invitaciones`, {
          headers: { Authorization: `Bearer ${token}` },
          signal
        }),
        fetch(`${API_URL}/api/afiliados/${companyId}/afiliados-corp`, {
          headers: { Authorization: `Bearer ${token}` },
          signal
        }),
        fetch(`${API_URL}/api/afiliados/empresa/solicitudes-cambio`, {
          headers: { Authorization: `Bearer ${token}` },
          signal
        })
      ]);

      if (!resInv.ok || !resMbr.ok || !resSol.ok) throw new Error('Response error');

      const dataInv = await resInv.json();
      const dataMbr = await resMbr.json();
      const dataSol = await resSol.json();

      if (signal?.aborted) return;
      if (dataInv.success) setInvitaciones(dataInv.data);
      if (dataMbr.success) setMiembros(dataMbr.data);
      if (dataSol.success) setSolicitudesCambio(dataSol.data);
    } catch (err: unknown) {
      if (signal?.aborted || (err as Error).name === 'AbortError') return;
      console.error(err);
      toastError('Error al cargar datos', 'Error al cargar datos de gestión corporativa.');
    } finally {
      setLoading(false);
    }
  }, [token, user?.id_empresa, user?.id_afiliado, toastError]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => { controller.abort(); };
  }, [fetchData]);

  const handleResolveSolicitudCambio = async (idSolicitud: number, aprobado: boolean) => {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/afiliados/empresa/solicitudes-cambio/${idSolicitud}/resolver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ aprobado, observaciones: aprobado ? 'Aprobado por representante' : 'Rechazado por representante' })
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        toastSuccess(aprobado ? 'Solicitud aprobada' : 'Solicitud rechazada', data.message);
        fetchData();
      } else {
        toastError('Error al procesar', data.message || 'No se pudo procesar la solicitud.');
      }
    } catch {
      toastError('Error de conexión', 'Verifica tu conexión a internet e intenta de nuevo.');
    } finally {
      setActionLoading(false);
    }
  };

  // Búsqueda con debounce de afiliados independientes disponibles
  const getCompanyId = useCallback(async (): Promise<number | null> => {
    let companyId = user?.id_empresa;
    if (!companyId && user?.id_afiliado && token) {
      const d = await apiFetch(`${API_URL}/api/afiliados/${user.id_afiliado}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (d.success && d.data.id_empresa) companyId = d.data.id_empresa;
    }
    return companyId ?? null;
  }, [user?.id_empresa, user?.id_afiliado, token]);

  useEffect(() => {
    if (activeTab !== 'vincular') return;
    
    const q = busquedaInd.trim();
    
    // Si la búsqueda es vacía, ya se inicializó y el campo de búsqueda cambia, no hacer petición
    if (q === '' && lastQueryRef.current.q === '' && lastQueryRef.current.initialized) {
      lastQueryRef.current.field = searchField;
      return;
    }
    
    // Si la búsqueda y el campo son iguales a la última petición (y ya se inicializó), no hacer nada
    if (q === lastQueryRef.current.q && searchField === lastQueryRef.current.field && lastQueryRef.current.initialized) {
      return;
    }
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const companyId = await getCompanyId();
      if (!companyId || !token) return;
      setLoadingInd(true);
      try {
        const url = `${API_URL}/api/afiliados/${companyId}/independientes-disponibles?q=${encodeURIComponent(q)}&field=${searchField}`;
        const data = await apiFetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (data.success) {
          setIndependientes(data.data);
          lastQueryRef.current = { q, field: searchField, initialized: true };
        }
      } catch { /* silencioso */ } finally {
        setLoadingInd(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [busquedaInd, searchField, activeTab, token, getCompanyId]);

  const handleVincular = async (afiliado: AfiliadoIndependiente) => {
    const companyId = await getCompanyId();
    if (!companyId || !token) return;
    setVinculandoId(afiliado.id_afiliado);
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${companyId}/afiliados-corp/vincular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id_afiliado: afiliado.id_afiliado })
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setConfirmVincular(null);
        const nombre = formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos);
        toastSuccess('Agente vinculado', `${nombre} fue establecido como Agente Corporativo.`);
        setIndependientes(prev => prev.filter(a => a.id_afiliado !== afiliado.id_afiliado));
        fetchData();
      } else {
        toastError('Error al vincular', data.message || 'No se pudo completar la vinculación.');
      }
    } catch {
      toastError('Error de conexión', 'Verifica tu conexión a internet e intenta nuevamente.');
    } finally {
      setVinculandoId(null);
    }
  };

  const handleGenerarLink = async () => {
    let companyId = user?.id_empresa;
    if (!companyId && user?.id_afiliado && token) {
      const resProfile = await fetch(`${API_URL}/api/afiliados/${user.id_afiliado}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resProfile.ok) throw new Error(`HTTP error! status: ${resProfile.status}`);
      const dataProfile = await resProfile.json();
      if (dataProfile.success && dataProfile.data.id_empresa) {
        companyId = dataProfile.data.id_empresa;
      }
    }
    
    if (!companyId || !token) return;

    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${companyId}/invitacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ diasExpiracion: 30 })
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        fetchData();
        toastSuccess('Link generado', 'El link de invitación está listo para compartir.');
      } else {
        toastError('Error al generar link', data.message || 'No se pudo generar el link.');
      }
    } catch {
      toastError('Error de conexión', 'Verifica tu conexión e intenta nuevamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyLink = (invToken: string) => {
    const url = `${window.location.origin}/afiliacion/invitacion/${invToken}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(invToken);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let companyId = user?.id_empresa;
    if (!companyId && user?.id_afiliado && token) {
      const resProfile = await fetch(`${API_URL}/api/afiliados/${user.id_afiliado}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resProfile.ok) throw new Error(`HTTP error! status: ${resProfile.status}`);
      const dataProfile = await resProfile.json();
      if (dataProfile.success && dataProfile.data.id_empresa) {
        companyId = dataProfile.data.id_empresa;
      }
    }

    if (!companyId || !token) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${companyId}/afiliados-corp/crear-solicitud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombreCompleto: modalForm.nombreCompleto.trim(),
          cedulaRif: `${modalForm.cedulaPrefix}-${modalForm.cedulaNumber}`,
          email: modalForm.email.trim().toLowerCase(),
          telefono: `${modalForm.phonePrefix}${modalForm.telefono}`,
          nivelProfesional: modalForm.nivelProfesional,
          esCorredorInmobiliario: modalForm.esCorredorInmobiliario === 'si'
        })
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setModalForm({ nombreCompleto: '', cedulaPrefix: 'V', cedulaNumber: '', email: '', phonePrefix: '+58', telefono: '', nivelProfesional: '', esCorredorInmobiliario: '' });
        fetchData();
        toastSuccess('Solicitud creada', 'La solicitud de agente corporativo fue registrada.');
      } else {
        toastError('Error al crear solicitud', data.message || 'No se pudo crear la solicitud.');
      }
    } catch {
      toastError('Error de conexión', 'Verifica tu conexión e intenta nuevamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAprobarSolicitud = async (idAfiliado: number) => {
    let companyId = user?.id_empresa;
    if (!companyId && user?.id_afiliado && token) {
      const resProfile = await fetch(`${API_URL}/api/afiliados/${user.id_afiliado}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resProfile.ok) throw new Error(`HTTP error! status: ${resProfile.status}`);
      const dataProfile = await resProfile.json();
      if (dataProfile.success && dataProfile.data.id_empresa) companyId = dataProfile.data.id_empresa;
    }
    if (!companyId || !token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${companyId}/afiliados-corp/${idAfiliado}/aprobar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        fetchData();
        toastSuccess('Solicitud aprobada', 'El agente ha sido aprobado exitosamente.');
      } else {
        toastError('Error al aprobar', data.message || 'No se pudo aprobar la solicitud.');
      }
    } catch {
      toastError('Error de conexión', 'Verifica tu conexión e intenta nuevamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRechazarSolicitud = async (idAfiliado: number) => {
    let companyId = user?.id_empresa;
    if (!companyId && user?.id_afiliado && token) {
      const resProfile = await fetch(`${API_URL}/api/afiliados/${user.id_afiliado}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resProfile.ok) throw new Error(`HTTP error! status: ${resProfile.status}`);
      const dataProfile = await resProfile.json();
      if (dataProfile.success && dataProfile.data.id_empresa) companyId = dataProfile.data.id_empresa;
    }
    if (!companyId || !token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${companyId}/afiliados-corp/${idAfiliado}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        fetchData();
        toastSuccess('Solicitud rechazada', 'La solicitud fue rechazada.');
      } else {
        toastError('Error al rechazar', data.message || 'No se pudo rechazar la solicitud.');
      }
    } catch {
      toastError('Error de conexión', 'Verifica tu conexión e intenta nuevamente.');
    } finally {
      setActionLoading(false);
    }
  };


  const selectedNivel = NIVELES.find(n => n.value === modalForm.nivelProfesional);

  const solicitudesPendientes = miembros.filter(m => m.fase === 'Solicitud');
  const miembrosVinculados = miembros.filter(m => m.fase !== 'Solicitud');

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-12 flex flex-col items-center justify-center gap-4 text-gray-400">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
        <p className="text-xs font-black uppercase tracking-widest">Cargando gestión corporativa...</p>
      </div>
    );
  }

  return (
    <div className="h-full space-y-6 p-4 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
            <Building2 className="text-emerald-600" size={24} />
            Gestión de Agentes Corporativos
          </h2>
          <p className="text-xs font-medium text-gray-500 mt-1">
            Administra los miembros vinculados a tu empresa.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className={`flex items-center gap-2 px-5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-black uppercase tracking-widest text-[10px] hover:bg-gray-50 transition-colors transition-transform active:scale-95 ${BOX_H}`}
          >
            <UserPlus size={14} className="text-emerald-500" />
            Crear Solicitud
          </button>
          <button
            onClick={handleGenerarLink}
            disabled={actionLoading}
            className={`flex items-center gap-2 px-5 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 transition-transform active:scale-95 disabled:opacity-50 ${BOX_H}`}
          >
            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <LinkIcon size={14} />}
            Generar Link
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-gray-100/70 rounded-2xl w-full sm:w-fit">
        {([
          { key: 'agentes', label: 'Mis Agentes', icon: Users, count: miembrosVinculados.length },
          { key: 'links', label: 'Links', icon: LinkIcon, count: invitaciones.filter(i => i.activo).length },
          { key: 'vincular', label: 'Vincular Afiliado', icon: UserCheck },
          { key: 'solicitudes', label: 'Solicitudes de Ingreso', icon: ClipboardList, count: solicitudesCambio.length },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
            {'count' in tab && tab.count! > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                activeTab === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>



      {/* ── Solicitudes Pendientes (siempre visible si hay alguna) ─────── */}
      {solicitudesPendientes.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-emerald-50/10">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#022c22] flex items-center gap-2">
              <Users size={14} className="text-emerald-600" />
              Solicitudes Pendientes de Aprobación
            </h3>
            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
              {solicitudesPendientes.length} por Revisar
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {solicitudesPendientes.map((m) => (
              <div key={m.id_afiliado || m.email} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs">
                    {getInitials(m.nombres || m.nombre_completo, m.apellidos)}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-gray-900 uppercase tracking-tight">
                      {formatNombreCard(m.nombres || m.nombre_completo, m.apellidos)}
                    </p>
                    <p className="text-[10px] font-medium text-gray-500">{m.email} • {m.telefono}</p>
                    <p className="text-[10px] text-gray-400 font-bold">
                      C.I. / RIF: {m.cedula || '—'} • Envío: {new Date(m.fecha_registro).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {m.id_afiliado !== null ? (
                    <>
                      <button
                        onClick={() => handleAprobarSolicitud(m.id_afiliado!)}
                        disabled={actionLoading}
                        className="h-9 px-4 rounded-xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[9px] hover:bg-emerald-700 transition-colors transition-transform flex items-center gap-1.5 shadow-lg shadow-emerald-600/10 active:scale-95 disabled:opacity-50"
                      >
                        <Check size={12} strokeWidth={3} />
                        Aprobar
                      </button>
                      <button
                        onClick={() => handleRechazarSolicitud(m.id_afiliado!)}
                        disabled={actionLoading}
                        className="h-9 px-4 rounded-xl bg-red-600 text-white font-black uppercase tracking-widest text-[9px] hover:bg-red-700 transition-colors transition-transform flex items-center gap-1.5 shadow-lg shadow-red-600/10 active:scale-95 disabled:opacity-50"
                      >
                        <X size={12} strokeWidth={3} />
                        Rechazar
                      </button>
                    </>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest border border-amber-200">
                      Pendiente por cargar expediente
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: Mis Agentes ─────────────────────────────────────────────── */}
      {activeTab === 'agentes' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
              <Users size={14} className="text-emerald-500" />
              Afiliados Vinculados a la Empresa
            </h3>
            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
              {miembrosVinculados.length} Miembros
            </span>
            </div>

          <div className="divide-y divide-gray-50">
            {miembrosVinculados.length === 0 ? (
              <div className="p-12 text-center text-gray-400 space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest">Sin miembros vinculados</p>
                <p className="text-[10px] font-medium leading-relaxed">Los afiliados que se registren con tu link o sean vinculados aparecerán aquí.</p>
              </div>
            ) : (
              miembrosVinculados.map((m) => (
                <div key={m.id_afiliado} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 font-black text-xs">
                      {getInitials(m.nombres || m.nombre_completo, m.apellidos)}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-gray-900 uppercase tracking-tight">{formatNombreCard(m.nombres || m.nombre_completo, m.apellidos)}</p>
                      <p className="text-[10px] font-medium text-gray-500">{m.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                          m.fase === 'Aprobado' ? 'bg-emerald-50 text-emerald-600' : 
                          m.fase === 'Rechazado' ? 'bg-red-50 text-red-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {m.fase === 'Aprobado' ? 'Activo' : 
                           m.fase === 'En Proceso' ? 'Esperando Admin' : 
                           m.fase}
                        </span>
                        <span className="text-[9px] text-gray-400 font-medium">Registrado: {new Date(m.fecha_registro).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Links ──────────────────────────────────────────────────── */}
      {activeTab === 'links' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
              <LinkIcon size={14} className="text-emerald-500" />
              Links de Invitación Activos
            </h3>
            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
              {invitaciones.filter(i => i.activo).length} Links
            </span>
          </div>

          <div className="divide-y divide-gray-50 flex-1 overflow-y-auto max-h-[400px]">
            {invitaciones.length === 0 ? (
              <div className="p-12 text-center text-gray-400 space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest">No hay links generados</p>
                <p className="text-[10px] font-medium leading-relaxed">Genera un link para que tus colaboradores puedan registrarse fácilmente.</p>
              </div>
            ) : (
              invitaciones.map((inv) => (
                <div key={inv.id_invitacion} className={`p-5 flex items-center justify-between group transition-colors ${!inv.activo ? 'bg-gray-50/50 grayscale opacity-60' : 'hover:bg-gray-50/50'}`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        ...{inv.token.slice(-8)}
                      </code>
                      {inv.fecha_expiracion && (
                        <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">
                          Exp: {new Date(inv.fecha_expiracion).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-black text-gray-800 uppercase tracking-tight">
                      Link Reutilizable
                    </p>
                    <p className="text-[9px] font-medium text-gray-400">
                      Creado el {new Date(inv.creado_en).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(inv.token)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${copiedToken === inv.token ? 'bg-emerald-500 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
                      title="Copiar Link"
                    >
                      {copiedToken === inv.token ? <CheckCircle size={16} /> : <Copy size={16} />}
                    </button>
                    <a
                      href={`/afiliacion/invitacion/${inv.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                      title="Ver Página de Registro"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Vincular Afiliado Independiente ─────────────────────────── */}
      {activeTab === 'vincular' && (
        <div className="space-y-4">
          {/* Descripción */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/20">
              <UserCheck size={22} />
            </div>
            <div>
              <h3 className="font-black text-emerald-900 text-sm uppercase tracking-tight">Vincular afiliado independiente ya registrado</h3>
              <p className="text-xs font-medium text-emerald-700 mt-1 leading-relaxed">
                Busca y selecciona un afiliado Natural ya activo en el sistema para establecerlo directamente como Agente Corporativo de tu empresa. La vinculación es inmediata y se notifica al afiliado por correo.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="p-5 border-b border-gray-50">
              <div className="relative flex items-center bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-400/10 transition-colors h-12 z-20">
                {/* Dropdown de criterio */}
                <div className="relative shrink-0 border-r border-gray-200/80 h-full flex items-center z-10">
                  <button
                    type="button"
                    onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                    className="flex items-center gap-1 px-4 h-full text-xs font-black uppercase tracking-wider text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <span>
                      {searchField === 'nombre' && 'Nombre'}
                      {searchField === 'cedula' && 'Cédula'}
                      {searchField === 'codigo' && 'Código'}
                    </span>
                    <ChevronDown size={12} className={`text-gray-400 transition-transform ${showSearchDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showSearchDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSearchDropdown(false)} />
                      <div className="transition-opacity transition-transform absolute left-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50 min-w-[120px] fade-in slide-in-from-top-1 duration-200">
                        {([
                          { key: 'nombre', label: 'Nombre' },
                          { key: 'cedula', label: 'Cédula' },
                          { key: 'codigo', label: 'Código' },
                        ] as const).map(option => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => {
                              setSearchField(option.key);
                              setShowSearchDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${
                              searchField === option.key ? 'bg-emerald-50 text-emerald-600' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="relative flex-grow h-full">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={busquedaInd}
                    onChange={e => setBusquedaInd(e.target.value)}
                    placeholder={`Buscar por ${
                      searchField === 'nombre' ? 'nombre completo' :
                      searchField === 'cedula' ? 'cédula de identidad' : 'código de afiliado'
                    }...`}
                    className="w-full h-full pl-11 pr-10 bg-transparent text-sm text-gray-800 placeholder-gray-400 font-medium outline-none"
                  />
                  {busquedaInd && (
                    <button
                      onClick={() => setBusquedaInd('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-gray-200/80 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
              {loadingInd ? (
                <div className="p-12 flex flex-col items-center gap-3 text-gray-400">
                  <Loader2 className="animate-spin text-emerald-500" size={28} />
                  <p className="text-xs font-black uppercase tracking-widest">Buscando afiliados...</p>
                </div>
              ) : independientes.length === 0 ? (
                <div className="p-12 text-center text-gray-400 space-y-2">
                  <UserCheck size={32} className="mx-auto opacity-30" />
                  <p className="text-xs font-bold uppercase tracking-widest">
                    {busquedaInd ? 'Sin resultados para tu búsqueda' : 'Escribe para buscar afiliados disponibles'}
                  </p>
                  <p className="text-[10px] font-medium leading-relaxed">
                    Solo aparecen afiliados Naturales activos sin empresa asignada.
                  </p>
                </div>
              ) : (
                independientes.map(a => (
                  <div key={a.id_afiliado} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">
                        {getInitials(a.nombres || a.nombre_completo, a.apellidos)}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-gray-900 uppercase tracking-tight">
                          {formatNombreCard(a.nombres || a.nombre_completo, a.apellidos)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 text-[10px] text-gray-500">
                            <Mail size={10} /> {a.email}
                          </span>
                          {a.telefono && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                              <Phone size={10} /> {a.telefono}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-gray-400 font-mono">{a.cedula}</span>
                          {a.codigo && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest">{a.codigo}</span>
                          )}
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest">Afiliado Activo</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmVincular(a)}
                      disabled={vinculandoId === a.id_afiliado}
                      className="flex items-center gap-2 px-4 h-10 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[9px] shadow-lg shadow-emerald-600/15 hover:-translate-y-0.5 transition-transform active:scale-95 disabled:opacity-60 shrink-0"
                    >
                      {vinculandoId === a.id_afiliado ? <Loader2 className="animate-spin" size={12} /> : <UserCheck size={12} />}
                      Vincular
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Solicitudes de Ingreso ─────────────────────────────────────────── */}
      {activeTab === 'solicitudes' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
              <UserPlus size={14} className="text-emerald-500" />
              Solicitudes de Vinculación de Agentes
            </h3>
            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
              {solicitudesCambio.length} Pendientes
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {solicitudesCambio.length === 0 ? (
              <div className="p-12 text-center text-gray-400 space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest">No hay solicitudes pendientes</p>
                <p className="text-[10px] font-medium leading-relaxed">Las solicitudes de afiliados que quieren unirse como agentes aparecerán aquí.</p>
              </div>
            ) : (
              solicitudesCambio.map((sol) => (
                <div key={sol.id_solicitud} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs shrink-0">
                      {getInitials(sol.afiliado_nombre || '', '')}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-gray-900 uppercase tracking-tight">
                        {sol.afiliado_nombre}
                      </p>
                      <p className="text-[10px] font-medium text-gray-500">{sol.afiliado_email} • {sol.afiliado_telefono || 'sin teléfono'}</p>
                      <p className="text-[10px] text-gray-400 font-bold">
                        C.I. / RIF: {sol.afiliado_cedula || '—'} • Envío: {new Date(sol.creado_en).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleResolveSolicitudCambio(sol.id_solicitud, true)}
                      disabled={actionLoading}
                      className="h-9 px-4 rounded-xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[9px] hover:bg-emerald-700 transition-colors transition-transform flex items-center gap-1.5 shadow-lg shadow-emerald-600/10 active:scale-95 disabled:opacity-50"
                    >
                      <Check size={12} strokeWidth={3} />
                      Aprobar
                    </button>
                    <button
                      onClick={() => handleResolveSolicitudCambio(sol.id_solicitud, false)}
                      disabled={actionLoading}
                      className="h-9 px-4 rounded-xl bg-red-600 text-white font-black uppercase tracking-widest text-[9px] hover:bg-red-700 transition-colors transition-transform flex items-center gap-1.5 shadow-lg shadow-red-600/10 active:scale-95 disabled:opacity-50"
                    >
                      <X size={12} strokeWidth={3} />
                      Rechazar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN VINCULAR INDEPENDIENTE */}
      {confirmVincular && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setConfirmVincular(null)} />
          <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-8">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-6">
                <UserCheck size={30} />
              </div>
              <h3 className="text-xl font-black text-gray-900 text-center uppercase tracking-tight">¿Vincular este agente?</h3>
              <p className="text-sm text-gray-500 text-center mt-2 font-medium">
                Este afiliado será establecido como <strong>Agente Corporativo</strong> de tu empresa de forma inmediata.
              </p>

              <div className="mt-6 rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-4 p-4 bg-gray-50 border-b border-gray-100">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm shrink-0">
                    {getInitials(confirmVincular.nombres || confirmVincular.nombre_completo, confirmVincular.apellidos)}
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-sm uppercase tracking-tight">
                      {formatNombreCard(confirmVincular.nombres || confirmVincular.nombre_completo, confirmVincular.apellidos)}
                    </p>
                    {confirmVincular.codigo && (
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest">{confirmVincular.codigo}</span>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  <div className="flex items-center px-4 py-2.5 gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 w-20 shrink-0">Cédula</span>
                    <span className="text-xs font-mono text-gray-700">{confirmVincular.cedula}</span>
                  </div>
                  <div className="flex items-center px-4 py-2.5 gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 w-20 shrink-0">Email</span>
                    <span className="text-xs text-gray-700 font-medium truncate">{confirmVincular.email}</span>
                  </div>
                  {confirmVincular.telefono && (
                    <div className="flex items-center px-4 py-2.5 gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 w-20 shrink-0">Teléfono</span>
                      <span className="text-xs text-gray-700 font-medium">{confirmVincular.telefono}</span>
                    </div>
                  )}
                  <div className="flex items-center px-4 py-2.5 gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 w-20 shrink-0">Tipo</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest">Afiliado Natural Activo</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 pb-8 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmVincular(null)}
                className="flex-1 h-12 rounded-2xl border border-gray-200 text-gray-600 font-black uppercase tracking-widest text-[10px] hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={vinculandoId === confirmVincular.id_afiliado}
                onClick={() => handleVincular(confirmVincular)}
                className="flex-[2] h-12 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {vinculandoId === confirmVincular.id_afiliado
                  ? <><Loader2 className="animate-spin" size={14} /> Vinculando...</>
                  : <><UserCheck size={14} /> Confirmar Vinculación</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REGISTRO DIRECTO */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#022c22]/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                  <UserPlus className="text-emerald-600" size={24} />
                  Crear Solicitud de Agente
                </h3>
                <p className="text-xs font-medium text-gray-500 mt-1">Ingresa los datos para crear una solicitud de agente corporativo.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:shadow-md transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-8">
              <form id="direct-reg-form" onSubmit={handleModalSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Nombre */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-500">Nombre Completo</label>
                    <div className="relative">
                      <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input required type="text" value={modalForm.nombreCompleto} onChange={e => setModalForm(p => ({ ...p, nombreCompleto: e.target.value }))}
                        placeholder="Ej. Ana García" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl border border-slate-200 outline-none focus:border-emerald-500 text-slate-800 text-sm font-medium shadow-sm`} />
                    </div>
                  </div>

                  {/* Cédula */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-500">Cédula</label>
                    <div className={`flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 shadow-sm ${BOX_H}`}>
                      <select value={modalForm.cedulaPrefix} onChange={e => setModalForm(p => ({ ...p, cedulaPrefix: e.target.value }))}
                        className="bg-slate-50 border-r border-slate-200 px-4 h-full text-sm font-black text-slate-700 outline-none">
                        {['V', 'E', 'P'].map(p => <option key={p}>{p}</option>)}
                      </select>
                      <input required type="text" value={modalForm.cedulaNumber} onChange={e => setModalForm(p => ({ ...p, cedulaNumber: e.target.value }))}
                        placeholder="00000000" className="flex-1 px-5 h-full bg-white outline-none text-sm font-medium text-slate-800" />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-500">Email</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input required type="email" value={modalForm.email} onChange={e => setModalForm(p => ({ ...p, email: e.target.value }))}
                        placeholder="usuario@ejemplo.com" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl border border-slate-200 outline-none focus:border-emerald-500 text-slate-800 text-sm font-medium shadow-sm`} />
                    </div>
                  </div>

                  {/* Teléfono */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-500">Teléfono</label>
                    <div className={`flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 shadow-sm ${BOX_H}`}>
                      <span className="bg-slate-50 border-r border-slate-200 px-4 h-full flex items-center text-sm font-black text-slate-700">🇻🇪 +58</span>
                      <input type="tel" value={modalForm.telefono} onChange={e => setModalForm(p => ({ ...p, telefono: e.target.value }))}
                        placeholder="4XX 0000000" className="flex-1 px-5 h-full bg-white outline-none text-sm font-medium text-slate-800" />
                    </div>
                  </div>

                  {/* Nivel Profesional */}
                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-500">Nivel Profesional</label>
                    <button type="button" onClick={() => setShowNivelDropdown(!showNivelDropdown)}
                      className={`w-full px-4 ${BOX_H} bg-white rounded-xl border transition-colors flex items-center justify-between group shadow-sm ${showNivelDropdown ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200 hover:border-emerald-400'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${selectedNivel ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                          {selectedNivel ? <selectedNivel.icon size={18} /> : <Briefcase size={18} />}
                        </div>
                        <span className={`text-sm font-bold ${selectedNivel ? 'text-slate-800' : 'text-slate-300'}`}>
                          {selectedNivel ? selectedNivel.label : 'Selecciona'}
                        </span>
                      </div>
                      <ChevronDown size={18} className={`text-slate-400 transition-transform ${showNivelDropdown ? 'rotate-180 text-emerald-500' : ''}`} />
                    </button>
                    {showNivelDropdown && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[110] overflow-hidden">
                        <div className="p-1.5 space-y-1">
                          {NIVELES.map(n => (
                            <button key={n.value} type="button"
                              onClick={() => { setModalForm(p => ({ ...p, nivelProfesional: n.value })); setShowNivelDropdown(false) }}
                              className={`w-full flex items-center justify-between px-4 h-[50px] rounded-xl transition-colors ${modalForm.nivelProfesional === n.value ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}>
                              <div className="flex items-center gap-3">
                                <n.icon size={18} className={modalForm.nivelProfesional === n.value ? 'text-white' : 'text-slate-400'} />
                                <span className="text-[10px] font-black uppercase tracking-tight">{n.label}</span>
                              </div>
                              {modalForm.nivelProfesional === n.value && <Check size={16} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Corredor */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-500">¿Es corredor?</label>
                    <div className={`grid grid-cols-2 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden ${BOX_H}`}>
                      {['si', 'no'].map(opt => (
                        <button key={opt} type="button"
                          onClick={() => setModalForm(p => ({ ...p, esCorredorInmobiliario: opt }))}
                          className={`h-full text-[10px] font-black uppercase tracking-widest transition-colors ${modalForm.esCorredorInmobiliario === opt ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white hover:text-slate-700'}`}>
                          {opt === 'si' ? 'Sí' : 'No'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-black uppercase tracking-widest text-[10px] hover:bg-white transition-colors">
                Cancelar
              </button>
              <button type="submit" form="direct-reg-form" disabled={actionLoading} className="flex-[2] h-12 rounded-xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 transition-transform flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <><CheckCircle size={14} /> Crear Solicitud</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
