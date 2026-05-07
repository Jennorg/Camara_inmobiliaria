import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/env';
import { 
  User, Mail, Shield, Building, ArrowRightLeft, 
  CheckCircle2, AlertCircle, Globe, Phone, MapPin, 
  Briefcase, GraduationCap, Instagram, Facebook, 
  Linkedin, Twitter, Save, Loader2, ChevronRight
} from 'lucide-react';
import Swal from 'sweetalert2';

type SettingsTab = 'personal' | 'profesional' | 'social' | 'empresa' | 'membresia';

interface ProfileFormData {
  nombres?: string;
  apellidos?: string;
  cedula?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  nivel_academico?: string;
  profesion?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  twitter?: string;
  empresa_razon_social?: string;
  empresa_rif_tipo?: string;
  empresa_rif_numero?: string;
  empresa_email?: string;
  empresa_telefono?: string;
  empresa_website?: string;
  empresa_instagram?: string;
  empresa_facebook?: string;
  empresa_linkedin?: string;
  empresa_twitter?: string;
}

const SettingsPanel = () => {
  const { user, token, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('personal');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState<ProfileFormData>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const isAgente = user?.tipo_afiliado === 'Agente Corporativo' || user?.tipo_afiliado === 'Agente';
  const isCorp = user?.tipo_afiliado === 'Corporativo';

  useEffect(() => {
    if (!user?.id_afiliado) {
      setFetching(false);
      return;
    }
    loadProfileData();
  }, [user?.id_afiliado]);

  const loadProfileData = async () => {
    if (!user?.id_afiliado) return;
    setFetching(true);
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${user.id_afiliado}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const af = data.data;
        setFormData({
          nombres: af.nombres || '',
          apellidos: af.apellidos || '',
          cedula: af.cedula || '',
          email: af.email || '',
          telefono: af.telefono || '',
          direccion: af.direccion || '',
          fecha_nacimiento: af.fecha_nacimiento || '',
          nivel_academico: af.nivel_academico || '',
          profesion: af.profesion || '',
          instagram: af.instagram || '',
          facebook: af.facebook || '',
          linkedin: af.linkedin || '',
          twitter: af.twitter || '',
          // Empresa fields
          empresa_razon_social: af.empresa_razon_social || '',
          empresa_rif_tipo: af.empresa_rif_tipo || '',
          empresa_rif_numero: af.empresa_rif_numero || '',
          empresa_email: af.empresa_email || '',
          empresa_telefono: af.empresa_telefono || '',
          empresa_website: af.empresa_website || '',
          empresa_instagram: af.empresa_instagram || '',
          empresa_facebook: af.empresa_facebook || '',
          empresa_linkedin: af.empresa_linkedin || '',
          empresa_twitter: af.empresa_twitter || '',
        });
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${user?.id_afiliado}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: '¡Cambios guardados!',
          text: 'Tu información ha sido actualizada correctamente.',
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
          toast: true
        });
        refreshUser(); // Refresh context
      } else {
        throw new Error(data.message || 'Error al guardar');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleConverttoNatural = async () => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Abandonarás tu empresa actual y pasarás a ser un Afiliado Natural independiente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, independizarme',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${user?.id_afiliado}/convertir-natural`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success) {
        await Swal.fire('¡Éxito!', 'Ahora eres Afiliado Natural. El sistema se actualizará ahora.', 'success');
        window.location.reload();
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="col-span-3 flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
        <p className="font-bold text-sm uppercase tracking-widest">Cargando configuración...</p>
      </div>
    );
  }

  const tabs: { id: SettingsTab, label: string, icon: any, hide?: boolean }[] = [
    { id: 'personal', label: 'Información Personal', icon: User },
    { id: 'profesional', label: 'Perfil Profesional', icon: Briefcase },
    { id: 'social', label: 'Redes Sociales', icon: Globe },
    { id: 'empresa', label: 'Mi Corporativo', icon: Building, hide: !isCorp && !isAgente },
    { id: 'membresia', label: 'Cuenta y Membresía', icon: Shield },
  ];

  return (
    <div className="col-span-3 grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sidebar de Ajustes */}
      <aside className="lg:col-span-1 space-y-2">
        <div className="mb-6 px-4">
          <h2 className="text-xl font-black tracking-tight text-gray-900">Ajustes</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Gestiona tu presencia en la Cámara</p>
        </div>
        {tabs.filter(t => !t.hide).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-left group ${
              activeTab === tab.id 
                ? 'bg-white shadow-sm border border-gray-100 text-emerald-600 font-bold' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <tab.icon size={18} className={activeTab === tab.id ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-900'} />
            <span className="text-sm">{tab.label}</span>
            {activeTab === tab.id && <ChevronRight size={14} className="ml-auto opacity-40" />}
          </button>
        ))}
      </aside>

      {/* Area de Formulario */}
      <div className="lg:col-span-3 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <form onSubmit={handleSave} className="p-6 lg:p-8 flex-grow">
          
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <HeaderSection title="Información Personal" subtitle="Datos básicos que te identifican como miembro." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Nombres" name="nombres" value={formData.nombres} onChange={handleInputChange} icon={User} />
                <Input label="Apellidos" name="apellidos" value={formData.apellidos} onChange={handleInputChange} icon={User} />
                <Input label="Cédula / RIF" name="cedula" value={formData.cedula} onChange={handleInputChange} icon={Shield} disabled />
                <Input label="Email de Contacto" name="email" value={formData.email} onChange={handleInputChange} icon={Mail} />
                <Input label="Teléfono" name="telefono" value={formData.telefono} onChange={handleInputChange} icon={Phone} />
                <Input label="Fecha de Nacimiento" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleInputChange} type="date" />
                <div className="md:col-span-2">
                  <Input label="Dirección de Habitación" name="direccion" value={formData.direccion} onChange={handleInputChange} icon={MapPin} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profesional' && (
            <div className="space-y-6">
              <HeaderSection title="Perfil Profesional" subtitle="Comparte tu trayectoria y nivel académico." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">Nivel Académico</label>
                  <select
                    name="nivel_academico"
                    value={formData.nivel_academico}
                    onChange={handleInputChange}
                    className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="TSU">TSU</option>
                    <option value="Universitario">Universitario</option>
                    <option value="Postgrado">Postgrado</option>
                    <option value="Doctorado">Doctorado</option>
                  </select>
                </div>
                <Input label="Profesión" name="profesion" value={formData.profesion} onChange={handleInputChange} icon={Briefcase} />
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="space-y-6">
              <HeaderSection title="Redes Sociales" subtitle="Enlaces a tus perfiles para el directorio público." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Instagram" name="instagram" value={formData.instagram} onChange={handleInputChange} icon={Instagram} placeholder="@usuario" />
                <Input label="Facebook" name="facebook" value={formData.facebook} onChange={handleInputChange} icon={Facebook} placeholder="URL perfil" />
                <Input label="LinkedIn" name="linkedin" value={formData.linkedin} onChange={handleInputChange} icon={Linkedin} placeholder="URL perfil" />
                <Input label="Twitter" name="twitter" value={formData.twitter} onChange={handleInputChange} icon={Twitter} placeholder="@usuario" />
              </div>
            </div>
          )}

          {activeTab === 'empresa' && (
            <div className="space-y-6">
              <HeaderSection title="Información de Corporativo" subtitle="Datos corporativos visibles en tu membresía." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Input label="Razón Social" name="empresa_razon_social" value={formData.empresa_razon_social} onChange={handleInputChange} icon={Building} disabled={isAgente} />
                </div>
                <div className="flex gap-2">
                  <div className="w-24">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">Tipo RIF</label>
                    <select
                      name="empresa_rif_tipo"
                      value={formData.empresa_rif_tipo}
                      onChange={handleInputChange}
                      disabled={isAgente}
                      className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-4 text-sm font-bold disabled:opacity-50"
                    >
                      <option value="J">J</option>
                      <option value="G">G</option>
                      <option value="V">V</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <Input label="Número RIF" name="empresa_rif_numero" value={formData.empresa_rif_numero} onChange={handleInputChange} disabled={isAgente} />
                  </div>
                </div>
                <Input label="Email Corporativo" name="empresa_email" value={formData.empresa_email} onChange={handleInputChange} icon={Mail} disabled={isAgente} />
                <Input label="Website" name="empresa_website" value={formData.empresa_website} onChange={handleInputChange} icon={Globe} placeholder="www.tuempresa.com" disabled={isAgente} />
                <Input label="Teléfono Empresa" name="empresa_telefono" value={formData.empresa_telefono} onChange={handleInputChange} icon={Phone} disabled={isAgente} />
              </div>

              <div className="mt-8 pt-8 border-t border-gray-100 space-y-6">
                <HeaderSection title="Redes Sociales del Corporativo" subtitle="Perfiles oficiales de tu organización." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Instagram Empresa" name="empresa_instagram" value={formData.empresa_instagram} onChange={handleInputChange} icon={Instagram} placeholder="@empresa" disabled={isAgente} />
                  <Input label="Facebook Empresa" name="empresa_facebook" value={formData.empresa_facebook} onChange={handleInputChange} icon={Facebook} placeholder="URL empresa" disabled={isAgente} />
                  <Input label="LinkedIn Empresa" name="empresa_linkedin" value={formData.empresa_linkedin} onChange={handleInputChange} icon={Linkedin} placeholder="URL empresa" disabled={isAgente} />
                  <Input label="Twitter Empresa" name="empresa_twitter" value={formData.empresa_twitter} onChange={handleInputChange} icon={Twitter} placeholder="@empresa" disabled={isAgente} />
                </div>
              </div>

              {isAgente && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="text-blue-600" size={20} />
                  <p className="text-xs text-blue-800 font-bold">Eres agente corporativo. Solo el representante legal puede editar estos datos.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'membresia' && (
            <div className="space-y-6">
              <HeaderSection title="Cuenta y Membresía" subtitle="Gestiona tu estatus y vinculaciones." />
              
              <div className="p-6 rounded-3xl bg-gray-50 border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo de Afiliado</p>
                    <p className="text-lg font-black text-gray-900">{user?.tipo_afiliado}</p>
                  </div>
                  <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {user?.estatus || 'Afiliado'}
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Código CIBIR</p>
                    <p className="font-bold text-gray-900">{user?.codigo_cibir || 'En trámite'}</p>
                  </div>
                </div>
              </div>

              {isAgente && (
                <div className="pt-6 border-t border-gray-100">
                  <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-1 text-center md:text-left">
                      <h4 className="font-black text-amber-900 flex items-center justify-center md:justify-start gap-2">
                        <ArrowRightLeft size={18} />
                        ¿Deseas independizarte?
                      </h4>
                      <p className="text-xs text-amber-800/80 font-bold">
                        Convertirte en Afiliado Natural te desvinculará de tu corporativo actual.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleConverttoNatural}
                      disabled={loading}
                      className="whitespace-nowrap px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-amber-200"
                    >
                      Independizarme
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab !== 'membresia' && (
            <div className="mt-12 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-3 px-10 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-200 active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

// ─── Sub-componentes internos ───────────────────────────────────────────

const HeaderSection = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <div className="mb-8">
    <h3 className="text-xl font-black tracking-tight text-gray-900">{title}</h3>
    <p className="text-xs font-bold text-gray-400 mt-1">{subtitle}</p>
    <div className="h-1 w-12 bg-emerald-600 rounded-full mt-3"></div>
  </div>
);

const Input = ({ label, icon: Icon, ...props }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">{label}</label>
    <div className="relative group">
      {Icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-600 transition-colors">
          <Icon size={16} />
        </div>
      )}
      <input
        {...props}
        className={`w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl ${Icon ? 'pl-11' : 'px-4'} pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all disabled:opacity-50 disabled:bg-gray-100`}
      />
    </div>
  </div>
);

export default SettingsPanel;
