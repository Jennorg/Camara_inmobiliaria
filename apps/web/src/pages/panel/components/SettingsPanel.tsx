import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/env';
import { 
  User, Mail, Shield, Building, ArrowRightLeft, 
  CheckCircle2, AlertCircle, Globe, Phone, MapPin, 
  Briefcase, GraduationCap, Instagram, Facebook, 
  Linkedin, Twitter, Save, Loader2, ChevronRight, Clock,
  Music2, FileText
} from 'lucide-react';
import Swal from 'sweetalert2';
import FileUpload from '@/components/common/FileUpload';

type SettingsTab = 'personal' | 'profesional' | 'social' | 'empresa' | 'membresia' | 'documentos';

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
  descripcion?: string;
  ano_inicio_servicio?: number | string;
  es_corredor_inmobiliario?: boolean | number;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  twitter?: string;
  tiktok?: string;
  website?: string;
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
  empresa_tiktok?: string;
  foto_url?: string;
  empresa_logo_url?: string;
}

const SettingsPanel = () => {
  const { user, token, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('personal');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState<ProfileFormData>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [documentos, setDocumentos] = useState<{ tipo_doc: string; url: string; nombre_archivo?: string }[]>([]);

  const getDocUrl = (tipo: string) => {
    return documentos.find(d => d.tipo_doc === tipo)?.url || '';
  };

  const getDocName = (tipo: string) => {
    return documentos.find(d => d.tipo_doc === tipo)?.nombre_archivo || '';
  };

  const handleUploadSuccess = (tipo: string, url: string, name?: string) => {
    setDocumentos(prev => {
      const filtered = prev.filter(d => d.tipo_doc !== tipo);
      return [...filtered, { tipo_doc: tipo, url, nombre_archivo: name }];
    });
  };

  const handleClearDoc = (tipo: string) => {
    setDocumentos(prev => {
      const filtered = prev.filter(d => d.tipo_doc !== tipo);
      return [...filtered, { tipo_doc: tipo, url: '' }];
    });
  };

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
          descripcion: af.descripcion || af.notas || '',
          ano_inicio_servicio: af.ano_inicio_servicio || '',
          es_corredor_inmobiliario: af.es_corredor_inmobiliario === 1 || af.es_corredor_inmobiliario === true,
          instagram: af.instagram || '',
          facebook: af.facebook || '',
          linkedin: af.linkedin || '',
          twitter: af.twitter || '',
          tiktok: af.tiktok || '',
          website: af.website || '',
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
          empresa_tiktok: af.empresa_tiktok || '',
          foto_url: af.foto_url || '',
          empresa_logo_url: af.empresa_logo_url || '',
        });
        setDocumentos(af.documentos || []);
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
        body: JSON.stringify({ ...formData, documentos })
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
    { id: 'documentos', label: 'Expediente / Documentos', icon: FileText },
    { id: 'membresia', label: 'Cuenta', icon: Shield },
  ];

  return (
    <div className="col-span-3 h-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      {/* Sidebar de Ajustes */}
      <aside className="lg:col-span-1 space-y-2 overflow-y-auto pr-2">
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
      <div className="lg:col-span-3 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-y-auto flex flex-col">
        <form onSubmit={handleSave} className="p-6 lg:p-8 flex-grow">
          
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <HeaderSection title="Información Personal" subtitle="Datos básicos que te identifican como miembro." />
              
              <div className="flex justify-center py-4">
                <FileUpload 
                  label="Foto de Perfil"
                  accept="image/*"
                  folder="perfiles"
                  initialUrl={formData.foto_url}
                  onUploadSuccess={(url) => setFormData(prev => ({ ...prev, foto_url: url }))}
                  onClear={() => setFormData(prev => ({ ...prev, foto_url: '' }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Nombres" name="nombres" value={formData.nombres} onChange={handleInputChange} icon={User} />
                <Input label="Apellidos" name="apellidos" value={formData.apellidos} onChange={handleInputChange} icon={User} />
                <Input label="Cédula / RIF" name="cedula" value={formData.cedula} onChange={handleInputChange} icon={Shield} />
                <Input label="Email de Contacto" name="email" value={formData.email} onChange={handleInputChange} icon={Mail} />
                <Input label="Teléfono" name="telefono" value={formData.telefono} onChange={handleInputChange} icon={Phone} />
                <Input label="Fecha de Nacimiento" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleInputChange} type="date" />
                <div className="md:col-span-2">
                  <Input label="Dirección de Habitación" name="direccion" value={formData.direccion} onChange={handleInputChange} icon={MapPin} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">Descripción / Biografía Profesional</label>
                  <textarea
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleInputChange}
                    placeholder="Cuéntanos un poco sobre tu trayectoria..."
                    rows={4}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                  />
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
                    <option value="Bachiller">Bachiller</option>
                    <option value="TSU">TSU</option>
                    <option value="Nivel Profesional">Nivel Profesional</option>
                    <option value="Postgrado">Postgrado</option>
                    <option value="Doctorado">Doctorado</option>
                  </select>
                </div>
                {formData.nivel_academico !== 'Bachiller' && (
                  <Input label="Profesión" name="profesion" value={formData.profesion} onChange={handleInputChange} icon={Briefcase} />
                )}
                <Input label="Año de inicio en el sector" name="ano_inicio_servicio" value={formData.ano_inicio_servicio} onChange={handleInputChange} type="number" icon={Clock} />
                
                <div className="md:col-span-2 py-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        name="es_corredor_inmobiliario"
                        checked={!!formData.es_corredor_inmobiliario}
                        onChange={(e) => setFormData(prev => ({ ...prev, es_corredor_inmobiliario: e.target.checked }))}
                        className="sr-only" 
                      />
                      <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${formData.es_corredor_inmobiliario ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${formData.es_corredor_inmobiliario ? 'translate-x-6' : ''}`}></div>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-700 group-hover:text-emerald-600 transition-colors">¿Eres Corredor Inmobiliario Certificado?</span>
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-tighter">Marca esta opción si posees certificación oficial.</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="space-y-6">
              <HeaderSection title="Redes Sociales y Web" subtitle="Enlaces a tus perfiles para el directorio público." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="URL de Instagram" name="instagram" value={formData.instagram} onChange={handleInputChange} icon={Instagram} placeholder="https://www.instagram.com/tuusuario" />
                <Input label="URL de Facebook" name="facebook" value={formData.facebook} onChange={handleInputChange} icon={Facebook} placeholder="https://www.facebook.com/tuperfil" />
                <Input label="URL de LinkedIn" name="linkedin" value={formData.linkedin} onChange={handleInputChange} icon={Linkedin} placeholder="https://www.linkedin.com/in/tuperfil" />
                <Input label="URL de X (Twitter)" name="twitter" value={formData.twitter} onChange={handleInputChange} icon={XIcon} placeholder="https://x.com/tuusuario" />
                <Input label="URL de TikTok" name="tiktok" value={formData.tiktok} onChange={handleInputChange} icon={TikTokIcon} placeholder="https://www.tiktok.com/@tuusuario" />
                <Input label="Sitio Web Personal" name="website" value={formData.website} onChange={handleInputChange} icon={Globe} placeholder="https://www.tuweb.com" />
              </div>
            </div>
          )}

          {activeTab === 'empresa' && (
            <div className="space-y-6">
              <HeaderSection title="Información de Corporativo" subtitle="Datos corporativos visibles en tu membresía." />
              
              <div className="flex justify-center py-4">
                <FileUpload 
                  label="Logo de la Empresa"
                  accept="image/*"
                  folder="logos"
                  disabled={isAgente}
                  initialUrl={formData.empresa_logo_url}
                  onUploadSuccess={(url) => setFormData(prev => ({ ...prev, empresa_logo_url: url }))}
                  onClear={() => setFormData(prev => ({ ...prev, empresa_logo_url: '' }))}
                />
              </div>

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
                  <Input label="URL Instagram Empresa" name="empresa_instagram" value={formData.empresa_instagram} onChange={handleInputChange} icon={Instagram} placeholder="https://instagram.com/empresa" disabled={isAgente} />
                  <Input label="URL Facebook Empresa" name="empresa_facebook" value={formData.empresa_facebook} onChange={handleInputChange} icon={Facebook} placeholder="https://facebook.com/empresa" disabled={isAgente} />
                  <Input label="URL LinkedIn Empresa" name="empresa_linkedin" value={formData.empresa_linkedin} onChange={handleInputChange} icon={Linkedin} placeholder="https://linkedin.com/company/empresa" disabled={isAgente} />
                  <Input label="URL X (Twitter) Empresa" name="empresa_twitter" value={formData.empresa_twitter} onChange={handleInputChange} icon={XIcon} placeholder="https://x.com/empresa" disabled={isAgente} />
                  <Input label="URL TikTok Empresa" name="empresa_tiktok" value={formData.empresa_tiktok} onChange={handleInputChange} icon={TikTokIcon} placeholder="https://tiktok.com/@empresa" disabled={isAgente} />
                </div>
              </div>

              {isAgente && (
               <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                 <AlertCircle className="text-emerald-600" size={20} />
                 <p className="text-xs text-emerald-800 font-bold">Eres agente corporativo. Solo el representante legal puede editar estos datos.</p>
               </div>
              )}
            </div>
          )}

          {activeTab === 'documentos' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <HeaderSection title="Expediente y Documentación" subtitle="Sube o actualiza la documentación requerida para tu membresía." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FileUpload 
                  label="Curriculum Vitae (CV)" 
                  initialUrl={getDocUrl('cv')}
                  initialFileName={getDocName('cv')}
                  onUploadSuccess={(url, name) => handleUploadSuccess('cv', url, name)}
                  onClear={() => handleClearDoc('cv')}
                />

                <FileUpload 
                  label="Título Universitario / Académico" 
                  initialUrl={getDocUrl('titulo')}
                  initialFileName={getDocName('titulo')}
                  onUploadSuccess={(url, name) => handleUploadSuccess('titulo', url, name)}
                  onClear={() => handleClearDoc('titulo')}
                />

                {(isCorp || user?.tipo_afiliado === 'Corporativo') && (
                  <>
                    <FileUpload 
                      label="Registro Mercantil de la Empresa" 
                      initialUrl={getDocUrl('registro_mercantil')}
                      initialFileName={getDocName('registro_mercantil')}
                      onUploadSuccess={(url, name) => handleUploadSuccess('registro_mercantil', url, name)}
                      onClear={() => handleClearDoc('registro_mercantil')}
                    />

                    <FileUpload 
                      label="RIF de la Empresa" 
                      initialUrl={getDocUrl('rif_empresa')}
                      initialFileName={getDocName('rif_empresa')}
                      onUploadSuccess={(url, name) => handleUploadSuccess('rif_empresa', url, name)}
                      onClear={() => handleClearDoc('rif_empresa')}
                    />

                    <FileUpload 
                      label="Cédula del Representante Legal" 
                      initialUrl={getDocUrl('cedula_representante')}
                      initialFileName={getDocName('cedula_representante')}
                      onUploadSuccess={(url, name) => handleUploadSuccess('cedula_representante', url, name)}
                      onClear={() => handleClearDoc('cedula_representante')}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'membresia' && (
            <div className="space-y-6">
              <HeaderSection title="Cuenta" subtitle="Gestiona tu estatus y vinculaciones." />
              
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
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Código de Afiliado</p>
                    <p className="font-bold text-gray-900">{user?.codigo || 'En trámite'}</p>
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

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.486h2.039L6.486 3.24H4.298l13.31 17.399z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.14-.1-.27-.2-.4-.31v4.99c0 .24-.01.48-.03.71-.11 2.53-1.44 4.81-3.66 6.03-2.12 1.19-4.81 1.25-6.99.14-2.16-1.07-3.66-3.23-3.92-5.63-.33-2.43.74-4.99 2.82-6.28 1.34-.84 2.97-1.18 4.54-.93V11.1c-1-.22-2.11-.08-3 .42-.9.5-1.52 1.45-1.58 2.47-.07 1.16.51 2.33 1.51 2.89 1 .58 2.34.5 3.24-.22.6-.48.92-1.22.92-1.99V0z"/>
  </svg>
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
