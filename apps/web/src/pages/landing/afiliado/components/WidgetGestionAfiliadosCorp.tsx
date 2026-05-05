import React, { useEffect, useState } from 'react';
import {
  Users,
  Link as LinkIcon,
  Plus,
  Trash2,
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
  ArrowRight
} from 'lucide-react';
import { API_URL } from '@/config/env';
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard';
import { useAuth } from '@/context/AuthContext';
import { formatNombreCard, getInitials } from '@/utils/formatters';

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
  id_afiliado: number;
  nombre_completo: string;
  nombres: string | null;
  apellidos: string | null;
  cedula: string;
  email: string;
  telefono: string;
  estatus: string;
  fecha_registro: string;
}

const BOX_H = 'h-[58px]';

const NIVELES = [
  { value: 'Bachiller', label: 'Bachiller', icon: School },
  { value: 'TSU', label: 'Técnico Superior (TSU)', icon: Briefcase },
  { value: 'Universitario', label: 'Universitario', icon: GraduationCap },
  { value: 'Postgrado', label: 'Postgrado', icon: Award },
];

export default function WidgetGestionAfiliadosCorp() {
  const { user, token } = useAuth();
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [miembros, setMiembros] = useState<AfiliadoMiembro[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Modal State
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

  const fetchData = async () => {
    if (!user?.id_empresa || !token) return;
    setLoading(true);
    try {
      const [resInv, resMbr] = await Promise.all([
        fetch(`${API_URL}/api/afiliados/${user.id_empresa}/invitaciones`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/afiliados/${user.id_empresa}/afiliados-corp`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const dataInv = await resInv.json();
      const dataMbr = await resMbr.json();

      if (dataInv.success) setInvitaciones(dataInv.data);
      if (dataMbr.success) setMiembros(dataMbr.data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar datos de gestión corporativa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id_empresa, token]);

  const handleGenerarLink = async () => {
    if (!user?.id_empresa || !token) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${user.id_empresa}/invitacion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ diasExpiracion: 30 })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        setError(data.message || 'Error al generar link.');
      }
    } catch (err) {
      setError('Error de conexión.');
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
    if (!user?.id_empresa || !token) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${user.id_empresa}/registrar-miembro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombreCompleto: modalForm.nombreCompleto.trim(),
          cedulaRif: `${modalForm.cedulaPrefix}-${modalForm.cedulaNumber}`,
          email: modalForm.email.trim().toLowerCase(),
          telefono: `${modalForm.phonePrefix}${modalForm.telefono}`,
          nivelProfesional: modalForm.nivelProfesional,
          esCorredorInmobiliario: modalForm.esCorredorInmobiliario === 'si'
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setModalForm({
          nombreCompleto: '',
          cedulaPrefix: 'V',
          cedulaNumber: '',
          email: '',
          phonePrefix: '+58',
          telefono: '',
          nivelProfesional: '',
          esCorredorInmobiliario: '',
        });
        fetchData();
      } else {
        setError(data.message || 'Error al registrar miembro.');
      }
    } catch (err) {
      setError('Error de conexión.');
    } finally {
      setActionLoading(false);
    }
  };

  const selectedNivel = NIVELES.find(n => n.value === modalForm.nivelProfesional);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-12 flex flex-col items-center justify-center gap-4 text-gray-400">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
        <p className="text-xs font-black uppercase tracking-widest">Cargando gestión corporativa...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
            <Building2 className="text-emerald-600" size={24} />
            Gestión de Afiliados Corporativos
          </h2>
          <p className="text-xs font-medium text-gray-500 mt-1">
            Administra los miembros vinculados a tu empresa y genera links de invitación.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className={`flex items-center gap-2 px-6 rounded-2xl bg-white border border-gray-200 text-gray-700 font-black uppercase tracking-widest text-[10px] hover:bg-gray-50 transition-all active:scale-95 ${BOX_H}`}
          >
            <UserPlus size={14} className="text-emerald-500" />
            Registrar Manualmente
          </button>
          <button
            onClick={handleGenerarLink}
            disabled={actionLoading}
            className={`flex items-center gap-2 px-6 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 ${BOX_H}`}
          >
            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <LinkIcon size={14} />}
            Generar Link de Invitación
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sección de Links */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
              <LinkIcon size={14} className="text-emerald-500" />
              Links Activos
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
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${copiedToken === inv.token ? 'bg-emerald-500 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
                      title="Copiar Link"
                    >
                      {copiedToken === inv.token ? <CheckCircle size={16} /> : <Copy size={16} />}
                    </button>
                    <a
                      href={`/afiliacion/invitacion/${inv.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all"
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

        {/* Sección de Miembros */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
              <Users size={14} className="text-emerald-500" />
              Afiliados Vinculados
            </h3>
            <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest">
              {miembros.length} Miembros
            </span>
          </div>

          <div className="divide-y divide-gray-50 flex-1 overflow-y-auto max-h-[400px]">
            {miembros.length === 0 ? (
              <div className="p-12 text-center text-gray-400 space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest">Sin miembros vinculados</p>
                <p className="text-[10px] font-medium leading-relaxed">Los afiliados que se registren con tu link aparecerán aquí.</p>
              </div>
            ) : (
              miembros.map((m) => (
                <div key={m.id_afiliado} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 font-black text-xs">
                      {getInitials(m.nombres || m.nombre_completo, m.apellidos)}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-gray-900 uppercase tracking-tight">{formatNombreCard(m.nombres || m.nombre_completo, m.apellidos)}</p>
                      <p className="text-[10px] font-medium text-gray-500">{m.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${m.estatus === 'Afiliado' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                          {m.estatus === 'Afiliado' ? 'Activo' : m.estatus.replace(/_/g, ' ')}
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
      </div>

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
                  Registrar Nuevo Miembro
                </h3>
                <p className="text-xs font-medium text-gray-500 mt-1">Ingresa los datos para registrar un afiliado directamente.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:shadow-md transition-all">
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
                      className={`w-full px-4 ${BOX_H} bg-white rounded-xl border transition-all flex items-center justify-between group shadow-sm ${showNivelDropdown ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200 hover:border-emerald-400'}`}>
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
                              className={`w-full flex items-center justify-between px-4 h-[50px] rounded-xl transition-all ${modalForm.nivelProfesional === n.value ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}>
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
                          className={`h-full text-[10px] font-black uppercase tracking-widest transition-all ${modalForm.esCorredorInmobiliario === opt ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white hover:text-slate-700'}`}>
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
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-black uppercase tracking-widest text-[10px] hover:bg-white transition-all">
                Cancelar
              </button>
              <button type="submit" form="direct-reg-form" disabled={actionLoading} className="flex-[2] h-12 rounded-xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <><CheckCircle size={14} /> Confirmar Registro</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
