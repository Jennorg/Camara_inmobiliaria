import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  User,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCheck,
  XCircle,
  ArrowRight,
  Search,
  X,
  ChevronDown
} from 'lucide-react';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import CompanySearchSelector from '@/components/CompanySearchSelector';
import { apiFetch } from '@/lib/apiClient';
import FileUpload from '@/components/common/FileUpload';
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard';

interface EmpresaItem {
  id_empresa: number;
  razon_social: string;
  rif_tipo: string;
  rif_numero: string;
  representante_legal?: string;
  codigo?: string;
}

interface SolicitudCambio {
  id_solicitud: number;
  tipo_actual: 'Natural' | 'Corporativo' | 'Agente Corporativo';
  tipo_solicitado: 'Natural' | 'Corporativo' | 'Agente Corporativo';
  id_empresa_solicitada: number | null;
  empresa_nombre: string | null;
  datos_empresa: string; // JSON string
  documentos_empresa: string; // JSON string
  estatus: 'Pendiente_Empresa' | 'Pendiente_Admin' | 'Aprobado' | 'Rechazado_Empresa' | 'Rechazado_Admin';
  observaciones_empresa: string | null;
  observaciones_admin: string | null;
  creado_en: string;
}

const formatDisplayTipo = (tipo?: string | null) => {
  if (!tipo) return 'Agente Independiente';
  const clean = tipo.trim();
  if (['Natural', 'Independiente', 'Agente Independiente', 'Agente'].includes(clean)) return 'Agente Independiente';
  if (['Agente Corporativo'].includes(clean)) return 'Agente Corporativo';
  if (['Corporativo', 'Juridico', 'Empresa', 'Miembro Corporativo'].includes(clean)) return 'Corporativo';
  return clean;
};

export default function WidgetSolicitudCambioEstado() {
  const { user, token } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [solicitud, setSolicitud] = useState<SolicitudCambio | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Form state
  const [tipoDestino, setTipoDestino] = useState<'Natural' | 'Corporativo' | 'Agente Corporativo' | ''>('');
  const [idEmpresaSelect, setIdEmpresaSelect] = useState<string>('');

  // Company details
  const [razonSocial, setRazonSocial] = useState('');
  const [rifTipo, setRifTipo] = useState('J');
  const [rifNumero, setRifNumero] = useState('');
  const [emailEmpresa, setEmailEmpresa] = useState('');
  const [telefonoEmpresa, setTelefonoEmpresa] = useState('');
  const [direccionEmpresa, setDireccionEmpresa] = useState('');
  const [websiteEmpresa, setWebsiteEmpresa] = useState('');

  // Uploaded docs
  const [urlRegistro, setUrlRegistro] = useState('');
  const [urlRif, setUrlRif] = useState('');
  const [nombreRegistro, setNombreRegistro] = useState('');
  const [nombreRif, setNombreRif] = useState('');

  const fetchSolicitud = async () => {
    if (!token) return;
    try {
      const data = await apiFetch(`${API_URL}/api/afiliados/me/solicitud-cambio`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setSolicitud(data.data);
      }
    } catch (err) {
      console.error('Error fetching status change request:', err);
    }
  };

  const fetchEmpresas = async () => {
    try {
      const data = await apiFetch(`${API_URL}/api/public/empresas`);
      if (data.success) {
        setEmpresas(data.data);
      }
    } catch (err) {
      console.error('Error fetching companies list:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await fetchSolicitud();
    } finally {
      setLoading(false);
    }
    // Cargar empresas en segundo plano para no bloquear el renderizado inicial del widget
    fetchEmpresas();
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const json = await apiFetch(`${API_URL}/api/afiliados/mi-solicitud-cambio`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!active) return;
        if (json.success) {
          setSolicitud(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !tipoDestino) return;

    setSubmitting(true);
    try {
      let body: any = {
        tipo_solicitado: tipoDestino
      };

      if (tipoDestino === 'Agente Corporativo') {
        body.id_empresa_solicitada = Number(idEmpresaSelect);
      } else if (tipoDestino === 'Corporativo') {
        body.datos_empresa = {
          razon_social: razonSocial.trim(),
          rif_tipo: rifTipo,
          rif_numero: rifNumero.replace(/\D/g, ''),
          email: emailEmpresa.trim().toLowerCase(),
          telefono: telefonoEmpresa.trim(),
          direccion: direccionEmpresa.trim(),
          website: websiteEmpresa.trim()
        };
        body.documentos_empresa = [
          { tipo_doc: 'registro_mercantil', url: urlRegistro, nombre_archivo: nombreRegistro },
          { tipo_doc: 'rif_empresa', url: urlRif, nombre_archivo: nombreRif }
        ];
      }

      const res = await fetch(`${API_URL}/api/afiliados/me/solicitud-cambio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        toastSuccess('Solicitud enviada', 'Tu solicitud de cambio de membresía ha sido registrada.');
        // Reset forms
        setTipoDestino('');
        setIdEmpresaSelect('');
        setRazonSocial('');
        setRifNumero('');
        setEmailEmpresa('');
        setTelefonoEmpresa('');
        setDireccionEmpresa('');
        setWebsiteEmpresa('');
        setUrlRegistro('');
        setUrlRif('');
        // Reload
        await fetchSolicitud();
      } else {
        toastError('Error al solicitar', data.message || 'No se pudo crear la solicitud.');
      }
    } catch (err) {
      toastError('Error de conexión', 'Ocurrió un problema de red al enviar tu solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSolicitud = async (idSolicitud: number) => {
    if (!token) return;
    setCanceling(true);
    try {
      const res = await fetch(`${API_URL}/api/afiliados/me/solicitud-cambio/${idSolicitud}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        toastSuccess('Solicitud cancelada', 'Tu solicitud de cambio de estatus ha sido cancelada.');
        setShowCancelConfirm(false);
        await fetchSolicitud();
      } else {
        toastError('Error al cancelar', data.message || 'No se pudo cancelar la solicitud.');
      }
    } catch (err) {
      toastError('Error de conexión', 'Ocurrió un problema de red al intentar cancelar la solicitud.');
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-8 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="animate-spin text-emerald-500" size={24} />
        <p className="text-[10px] font-black uppercase tracking-widest">Cargando panel de solicitudes...</p>
      </div>
    );
  }

  const hasPending = Boolean(solicitud && ['Pendiente_Empresa', 'Pendiente_Admin'].includes(solicitud.estatus));
  const normCurrent = formatDisplayTipo(solicitud?.tipo_actual || user?.tipo_afiliado);

  return (
    <DashboardCard
      title="Estatus de afiliado"
      icon={Building2}
      description="Solicita el cambio de tu tipo de afiliado (Agente Independiente, Agente Corporativo o Corporativo)"
    >
      <div className="space-y-6">
        {hasPending && solicitud ? (
          <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                  <Clock className="animate-pulse" size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Solicitud de Cambio en Trámite
                    </span>
                    <span className="px-2.5 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Por Aprobar
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-1.5">
                    Cambio Solicitado: <span className="text-emerald-600 font-extrabold uppercase">{formatDisplayTipo(solicitud.tipo_solicitado)}</span>
                  </p>
                </div>
              </div>

              {!showCancelConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-600 text-xs font-black uppercase tracking-wider transition-colors"
                >
                  <XCircle size={15} />
                  Cancelar Solicitud
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-slate-50 border border-rose-200 rounded-xl p-2">
                  <span className="text-[10px] font-extrabold uppercase text-rose-700 px-1">¿Cancelar solicitud?</span>
                  <button
                    type="button"
                    disabled={canceling}
                    onClick={() => handleCancelSolicitud(solicitud.id_solicitud)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-wider transition-colors transition-opacity disabled:opacity-50"
                  >
                    {canceling ? <Loader2 size={12} className="animate-spin" /> : 'Sí, cancelar'}
                  </button>
                  <button
                    type="button"
                    disabled={canceling}
                    onClick={() => setShowCancelConfirm(false)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-[10px] font-bold uppercase tracking-wider transition-colors"
                  >
                    No
                  </button>
                </div>
              )}
            </div>

            <div className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold pb-2.5 border-b border-slate-200/60">
                <span>Estatus Actual ({normCurrent})</span>
                <ArrowRight size={14} className="text-emerald-500 shrink-0" />
                <span className="text-emerald-700 font-extrabold uppercase">Solicitado: {formatDisplayTipo(solicitud.tipo_solicitado)}</span>
              </div>

              {solicitud.tipo_solicitado === 'Agente Corporativo' && solicitud.empresa_nombre && (
                <p className="text-xs text-slate-600">
                  <strong className="text-slate-800">Empresa Destino Seleccionada:</strong> {solicitud.empresa_nombre}
                </p>
              )}

              <div className="pt-1 flex items-center gap-2.5">
                {solicitud.estatus === 'Pendiente_Empresa' ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <AlertCircle size={14} />
                    </div>
                    <span className="font-extrabold text-xs text-amber-800">
                      Paso 1 de 2: Esperando la aprobación del Representante Legal de la Empresa.
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={14} />
                    </div>
                    <span className="font-extrabold text-xs text-emerald-800">
                      Esperando revisión y aprobación final de la Cámara Inmobiliaria.
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {solicitud && ['Rechazado_Empresa', 'Rechazado_Admin'].includes(solicitud.estatus) && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3 text-rose-800">
                <AlertCircle className="shrink-0 text-rose-500" size={18} />
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-wider">Tu solicitud anterior fue rechazada</p>
                  <p className="text-xs font-medium">
                    Motivo: {solicitud.estatus === 'Rechazado_Empresa' ? solicitud.observaciones_empresa : solicitud.observaciones_admin || 'No se indicaron comentarios.'}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Selecciona el Tipo de Membresía Destino
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {([
                  { key: 'Natural', label: 'Agente Independiente', desc: 'Trabaja por tu cuenta sin vinculación empresarial.', icon: User },
                  { key: 'Agente Corporativo', label: 'Agente Corporativo', desc: 'Asóciate a una empresa registrada en la Cámara.', icon: Building2 },
                  { key: 'Corporativo', label: 'Corporativo', desc: 'Registra tu propia empresa inmobiliaria.', icon: Building2 },
                ] as const).map(opt => {
                  const isCurrent = opt.label === normCurrent;
                  const isSelected = tipoDestino === opt.key;

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => !isCurrent && setTipoDestino(opt.key)}
                      className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-colors relative ${isCurrent
                        ? 'border-emerald-300 bg-emerald-50/40 cursor-default shadow-xs'
                        : isSelected
                          ? 'border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-500/5'
                          : 'border-gray-200 bg-white hover:border-emerald-300'
                        }`}
                    >
                      <div className="flex items-center justify-between w-full mb-3">
                        <opt.icon className={isCurrent || isSelected ? 'text-emerald-600' : 'text-slate-400'} size={20} />
                        {isCurrent ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                            Estatus Actual
                          </span>
                        ) : (
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                            }`}>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        )}
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight">{opt.label}</h5>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 leading-snug">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {tipoDestino === 'Natural' && (
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200/60">
                  <CheckCircle2 size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <h6 className="text-[11px] font-black uppercase tracking-wider text-emerald-900">Confirmación de cambio a Agente Independiente</h6>
                  <p className="text-[11px] text-emerald-800/90 font-semibold leading-relaxed mt-0.5">
                    Al cambiar a Agente Independiente, se desvinculará tu perfil de cualquier empresa a la que pertenezcas actualmente en el sistema.
                  </p>
                </div>
              </div>
            )}

            {tipoDestino === 'Agente Corporativo' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Selecciona la Empresa a la que perteneces <span className="text-rose-500">*</span>
                  </label>
                  <CompanySearchSelector
                    empresas={empresas}
                    selectedId={idEmpresaSelect}
                    onSelect={setIdEmpresaSelect}
                  />
                </div>
                <div className="p-4 bg-amber-50/60 border border-amber-200/70 rounded-2xl flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200/80">
                    <AlertCircle size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h6 className="text-[11px] font-black uppercase tracking-wider text-amber-900">Nota importante</h6>
                    <p className="text-[11px] text-amber-800/90 font-semibold leading-relaxed mt-0.5">
                      Al enviar esta solicitud, el representante legal de la empresa seleccionada deberá aprobar tu vinculación en su panel antes de que sea enviada a la Cámara para su aprobación definitiva.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {tipoDestino === 'Corporativo' && (
              <div className="space-y-4">
                <div className="bg-emerald-50/10 border border-emerald-500/10 rounded-2xl p-5 space-y-4">
                  <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                    <Building2 className="text-emerald-500" size={16} />
                    Información de la Empresa a Registrar
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="col-span-full flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Razón Social *</label>
                      <input
                        type="text"
                        required
                        value={razonSocial}
                        onChange={e => setRazonSocial(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50/50 focus:bg-white transition-colors"
                        placeholder="Nombre comercial de la inmobiliaria"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tipo RIF *</label>
                      <select
                        value={rifTipo}
                        onChange={e => setRifTipo(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50/50 focus:bg-white transition-colors"
                      >
                        <option value="J">J (Jurídico)</option>
                        <option value="G">G (Gubernamental)</option>
                        <option value="P">P (Persona Firma Personal)</option>
                        <option value="V">V (Venezolano)</option>
                        <option value="E">E (Extranjero)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Número de RIF (Solo números) *</label>
                      <input
                        type="text"
                        required
                        value={rifNumero}
                        onChange={e => setRifNumero(e.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50/50 focus:bg-white transition-colors"
                        placeholder="123456789"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Correo Electrónico de la Empresa *</label>
                      <input
                        type="email"
                        required
                        value={emailEmpresa}
                        onChange={e => setEmailEmpresa(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50/50 focus:bg-white transition-colors"
                        placeholder="contacto@empresa.com"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Teléfono *</label>
                      <input
                        type="text"
                        required
                        value={telefonoEmpresa}
                        onChange={e => setTelefonoEmpresa(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50/50 focus:bg-white transition-colors"
                        placeholder="+58 212 555-5555"
                      />
                    </div>

                    <div className="col-span-full flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Dirección Física (Opcional)</label>
                      <textarea
                        rows={2}
                        value={direccionEmpresa}
                        onChange={e => setDireccionEmpresa(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50/50 focus:bg-white transition-colors resize-none"
                        placeholder="Dirección exacta de la oficina..."
                      />
                    </div>

                    <div className="col-span-full flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sitio Web (Opcional)</label>
                      <input
                        type="text"
                        value={websiteEmpresa}
                        onChange={e => setWebsiteEmpresa(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50/50 focus:bg-white transition-colors"
                        placeholder="www.tuempresa.com"
                      />
                    </div>
                  </div>
                </div>

                {/* File Uploads for Docs */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                  <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                    <FileCheck className="text-emerald-500" size={16} />
                    Documentación de la Empresa
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FileUpload
                      label="Registro Mercantil de la Empresa"
                      required
                      accept=".pdf,image/*"
                      folder="documentos_empresa"
                      maxSizeMB={10}
                      onUploadSuccess={(url: string, name?: string) => {
                        setUrlRegistro(url);
                        setNombreRegistro(name || 'Registro_Mercantil.pdf');
                      }}
                      onClear={() => {
                        setUrlRegistro('');
                        setNombreRegistro('');
                      }}
                    />

                    <FileUpload
                      label="RIF de la Empresa"
                      required
                      accept=".pdf,image/*"
                      folder="documentos_empresa"
                      onUploadSuccess={(url: string, name?: string) => {
                        setUrlRif(url);
                        setNombreRif(name || 'RIF_Empresa.pdf');
                      }}
                      onClear={() => {
                        setUrlRif('');
                        setNombreRif('');
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            {tipoDestino && (
              <div className="flex justify-end pt-4 border-t border-slate-50">
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (tipoDestino === 'Agente Corporativo' && !idEmpresaSelect) ||
                    (tipoDestino === 'Corporativo' && (!razonSocial || !rifNumero || !emailEmpresa || !telefonoEmpresa || !urlRegistro || !urlRif))
                  }
                  className={`flex items-center gap-2 px-6 h-12 rounded-2xl font-black uppercase tracking-widest text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/10 transition-colors transition-transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Enviar Solicitud
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </DashboardCard>
  );
}
