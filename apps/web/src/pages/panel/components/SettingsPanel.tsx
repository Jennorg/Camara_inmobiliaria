import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/env';
import { apiFetch } from '@/lib/apiClient';
import { 
  User, Mail, Shield, Building, ArrowRightLeft, 
  CheckCircle2, AlertCircle, Globe, Phone, MapPin, 
  Briefcase, GraduationCap, Instagram, Facebook, 
  Linkedin, Twitter, Save, Loader2, ChevronRight, ChevronDown, Clock,
  Music2, FileText, Hash, Calendar
} from 'lucide-react';
import Swal from 'sweetalert2';
import FileUpload from '@/components/common/FileUpload';

type SettingsTab = 'personal' | 'social' | 'empresa' | 'documentos';

interface ProfileFormData {
  nombres?: string;
  apellidos?: string;
  cedula?: string;
  cedula_tipo?: string;
  cedula_num?: string;
  email?: string;
  telefono?: string;
  telefono_prefix?: string;
  telefono_num?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  birth_formatted?: string;
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
  const { user, token, refreshUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('personal');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState<ProfileFormData>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [documentos, setDocumentos] = useState<{ tipo_doc: string; url: string; nombre_archivo?: string }[]>([]);

  const getDocUrl = (tipo: string) => {
    const found = documentos.find(d => d.tipo_doc === tipo)?.url;
    if (found) return found;
    // Fallback para preinscripciones corporativas previas
    const isCorporativo = isCorp || user?.tipo_afiliado === 'Corporativo';
    if (isCorporativo && tipo === 'rif_empresa') {
      return documentos.find(d => d.tipo_doc === 'titulo')?.url || '';
    }
    return '';
  };

  const getDocName = (tipo: string) => {
    const found = documentos.find(d => d.tipo_doc === tipo)?.nombre_archivo;
    if (found) return found;
    // Fallback para preinscripciones corporativas previas
    const isCorporativo = isCorp || user?.tipo_afiliado === 'Corporativo';
    if (isCorporativo && tipo === 'rif_empresa') {
      return documentos.find(d => d.tipo_doc === 'titulo')?.nombre_archivo || '';
    }
    return '';
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

  // 'personal' | 'empresa' — tipo del correo de acceso actual
  const [accesoTipo, setAccesoTipo] = useState<'personal' | 'empresa'>('personal');
  const [savingAccesoEmail, setSavingAccesoEmail] = useState(false);

  const handleAccesoTipoChange = async (tipo: 'personal' | 'empresa') => {
    console.log('[ACCESO] handleAccesoTipoChange llamado con tipo=', tipo, 'accesoTipo actual=', accesoTipo);
    if (tipo === accesoTipo) {
      console.log('[ACCESO] Mismo tipo, saliendo');
      return;
    }

    const targetEmail = tipo === 'empresa' ? formData.empresa_email : formData.email;
    console.log('[ACCESO] targetEmail=', targetEmail, 'empresa_email=', formData.empresa_email, 'email=', formData.email);
    if (!targetEmail) return;

    const confirmResult = await Swal.fire({
      title: '¿Cambiar correo de acceso?',
      text: `Tu usuario para iniciar sesión cambiará a: ${targetEmail}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
    });

    if (!confirmResult.isConfirmed) return;

    setSavingAccesoEmail(true);
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${user?.id_afiliado}/acceso-email`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tipo }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      console.log('[ACCESO] Respuesta del servidor:', data);
      if (data.success) {
        console.log('[ACCESO] Éxito! Llamando setAccesoTipo con:', tipo);
        setAccesoTipo(tipo);
        console.log('[ACCESO] setAccesoTipo llamado');
        Swal.fire({
          title: '¡Correo actualizado!',
          text: `Tu correo de acceso ahora es: ${targetEmail}`,
          icon: 'success',
          confirmButtonColor: '#10b981',
        });
      } else {
        console.log('[ACCESO] El servidor devolvió error:', data.message);
        throw new Error(data.message || 'No se pudo cambiar el correo de acceso');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSavingAccesoEmail(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!user?.id_afiliado) {
      setFetching(false);
      return;
    }
    const load = async () => {
      if (!active) return;
      await loadProfileData();
    };
    load();
    return () => { active = false; };
  }, [user?.id_afiliado]);

  const loadProfileData = async () => {
    if (!user?.id_afiliado) return;
    setFetching(true);
    try {
      const data = await apiFetch(`${API_URL}/api/afiliados/${user.id_afiliado}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data.success) {
        const af = data.data;
        const cedulaStr = af.cedula || '';
        const match = cedulaStr.match(/^([VEP])?-?(.+)$/i);
        const cedulaTipo = match && match[1] ? match[1].toUpperCase() : 'V';
        const cedulaNum = match ? match[2] : cedulaStr;

        const telStr = af.telefono || '';
        const telMatch = telStr.match(/^(\+\d+)?\s*(.+)$/);
        const telPrefix = telMatch && telMatch[1] ? telMatch[1] : '+58';
        const telNum = telMatch ? telMatch[2] : telStr;

        const birthDateStr = af.fecha_nacimiento || '';
        let birthFormatted = '';
        if (birthDateStr) {
          const parts = birthDateStr.split('-');
          if (parts.length === 3) {
            birthFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
          }
        }

        setFormData({
          nombres: af.nombres || '',
          apellidos: af.apellidos || '',
          cedula_tipo: cedulaTipo,
          cedula_num: cedulaNum,
          email: af.email || '',
          telefono_prefix: telPrefix,
          telefono_num: telNum,
          direccion: af.direccion || '',
          birth_formatted: birthFormatted,
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
        // Siempre setear el email de acceso desde la API (nunca desde el token)
        const resolvedAcceso = (af.acceso_email || af.email || '').trim().toLowerCase();
        const resolvedEmpresa = (af.empresa_email || '').trim().toLowerCase();
        setAccesoTipo(resolvedAcceso && resolvedEmpresa && resolvedAcceso === resolvedEmpresa ? 'empresa' : 'personal');
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

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // keep only numbers
    if (val.length > 8) val = val.substring(0, 8);
    
    // Format as DD/MM/YYYY
    let formatted = '';
    if (val.length > 0) {
      formatted += val.substring(0, 2);
    }
    if (val.length > 2) {
      formatted += '/' + val.substring(2, 4);
    }
    if (val.length > 4) {
      formatted += '/' + val.substring(4, 8);
    }
    setFormData(prev => ({ ...prev, birth_formatted: formatted }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const payload: any = { ...formData, documentos };
      if (formData.cedula_tipo || formData.cedula_num) {
        payload.cedula = `${formData.cedula_tipo || 'V'}-${formData.cedula_num || ''}`;
      }
      delete payload.cedula_tipo;
      delete payload.cedula_num;

      if (formData.telefono_prefix || formData.telefono_num) {
        payload.telefono = `${formData.telefono_prefix || '+58'}${formData.telefono_num || ''}`;
      }
      delete payload.telefono_prefix;
      delete payload.telefono_num;

      let birthYearValue: number | null = null;
      if (formData.birth_formatted) {
        const parts = formData.birth_formatted.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);
          
          const currentYear = new Date().getFullYear();
          if (
            day >= 1 && day <= 31 &&
            month >= 1 && month <= 12 &&
            year >= 1900 && year <= currentYear
          ) {
            payload.fecha_nacimiento = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            birthYearValue = year;
          } else {
            throw new Error('Fecha de nacimiento inválida (use el formato DD/MM/AAAA)');
          }
        } else if (formData.birth_formatted.trim() === '') {
          payload.fecha_nacimiento = null;
        } else {
          throw new Error('Fecha de nacimiento incompleta (use el formato DD/MM/AAAA)');
        }
      } else {
        payload.fecha_nacimiento = null;
      }
      delete payload.birth_formatted;

      // Validar año de inicio en el sector vs año de nacimiento
      if (formData.ano_inicio_servicio && birthYearValue !== null) {
        const startYear = parseInt(String(formData.ano_inicio_servicio), 10);
        if (startYear <= birthYearValue) {
          throw new Error('El año de inicio en el sector debe ser mayor que el año de nacimiento');
        }
      }

      const res = await fetch(`${API_URL}/api/afiliados/${user?.id_afiliado}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
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
        await refreshUser(); // Refresh context
        await loadProfileData(); // Reload profile data directly from database
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
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
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
    { id: 'social', label: 'Redes Sociales', icon: Globe },
    { id: 'empresa', label: 'Mi Corporativo', icon: Building, hide: !(isCorp || user?.tipo_afiliado === 'Corporativo') },
    { id: 'documentos', label: 'Expediente / Documentos', icon: FileText },
  ];

  return (
    <div className="transition-opacity transition-transform col-span-3 h-full lg:p-8 flex flex-col lg:grid lg:grid-cols-4 gap-4 lg:gap-8 fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      {/* Sidebar / Mobile Tabs */}
      <aside className="lg:col-span-1 flex flex-col shrink-0">
        <div className="hidden lg:block mb-6 px-4">
          <h2 className="text-xl font-black tracking-tight text-gray-900">Ajustes</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Gestiona tu presencia en la Cámara</p>
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
          {tabs.filter(t => !t.hide).map(tab => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors duration-200 text-left group ${
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
        </div>

        {/* Mobile Horizontal Menu */}
        <div className="lg:hidden flex items-center gap-2 overflow-x-auto p-4 bg-white border-b border-gray-100 scrollbar-hide">
          {tabs.filter(t => !t.hide).map(tab => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors text-xs font-black uppercase tracking-widest ${
                activeTab === tab.id 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                  : 'bg-gray-50 text-gray-400 border border-gray-100'
              }`}
            >
              <tab.icon size={14} />
              {tab.id === 'personal' ? 'Personal' : 
               tab.id === 'empresa' ? 'Corporativo' : 
               tab.id === 'documentos' ? 'Expediente' : 
               tab.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </aside>

      {/* Area de Formulario */}
      <div className="lg:col-span-3 bg-white lg:rounded-3xl border-t lg:border border-gray-100 shadow-sm overflow-y-auto flex flex-col custom-scrollbar">
        <form onSubmit={handleSave} className="p-6 lg:p-8 flex-grow">
          
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <HeaderSection title="Información Personal" subtitle="Datos básicos que te identifican como miembro." />
              
              <div className="flex flex-col md:flex-row items-center justify-center gap-6 py-4 w-full max-w-full overflow-hidden">
                {formData.foto_url && (
                  isAdmin ? (
                    <div className="w-full max-w-xs sm:max-w-sm">
                      <FileUpload
                        label="Foto de Perfil"
                        accept="image/*"
                        folder="fotos"
                        initialUrl={formData.foto_url}
                        enableCrop
                        cropAspect={4 / 5}
                        cropShape="rect"
                        defaultCropPosition="bottom"
                        onUploadSuccess={(url) => setFormData(prev => ({ ...prev, foto_url: url }))}
                        onClear={() => setFormData(prev => ({ ...prev, foto_url: '' }))}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Foto de Perfil
                      </span>
                      <div className="w-32 h-40 rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-emerald-500/20 shadow-md bg-slate-50 flex items-center justify-center relative">
                        <img src={formData.foto_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )
                )}

                {!(isCorp || user?.tipo_afiliado === 'Corporativo') && (
                  <div className="w-full max-w-xs sm:max-w-sm">
                    <FileUpload
                      label="Logo Comercial / Marca Personal"
                      accept="image/*"
                      folder="logos"
                      initialUrl={formData.empresa_logo_url}
                      enableCrop
                      cropAspect={1}
                      cropShape="rect"
                      lockAspect={true}
                      onUploadSuccess={(url) => setFormData(prev => ({ ...prev, empresa_logo_url: url }))}
                      onClear={() => setFormData(prev => ({ ...prev, empresa_logo_url: '' }))}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Nombres" name="nombres" value={formData.nombres} onChange={handleInputChange} icon={User} />
                <Input label="Apellidos" name="apellidos" value={formData.apellidos} onChange={handleInputChange} icon={User} />
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">Cédula</label>
                  <div className="flex gap-2">
                    <div className="relative w-28">
                      <select
                        name="cedula_tipo"
                        value={formData.cedula_tipo || 'V'}
                        onChange={handleInputChange}
                        className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-colors appearance-none cursor-pointer text-center pr-6"
                      >
                        <option value="V">V</option>
                        <option value="E">E</option>
                        <option value="P">P</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <ChevronDown size={16} />
                      </div>
                    </div>
                    <div className="relative flex-1 group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-600 transition-colors">
                        <Hash size={16} />
                      </div>
                      <input
                        type="text"
                        name="cedula_num"
                        value={formData.cedula_num || ''}
                        onChange={handleInputChange}
                        placeholder="Número de cédula"
                        className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>
                </div>
                <Input label="Email de Contacto" name="email" value={formData.email} onChange={handleInputChange} icon={Mail} />
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">Teléfono</label>
                  <div className="flex gap-2">
                    <div className="relative w-28">
                      <select
                        name="telefono_prefix"
                        value={formData.telefono_prefix || '+58'}
                        onChange={handleInputChange}
                        className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-colors appearance-none cursor-pointer"
                      >
                        <option value="+58">🇻🇪 +58</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+34">🇪🇸 +34</option>
                        <option value="+57">🇨🇴 +57</option>
                        <option value="+507">🇵🇦 +507</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <ChevronDown size={16} />
                      </div>
                    </div>
                    <div className="relative flex-1 group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-600 transition-colors">
                        <Phone size={16} />
                      </div>
                      <input
                        type="text"
                        name="telefono_num"
                        value={formData.telefono_num || ''}
                        onChange={handleInputChange}
                        placeholder="Número de teléfono"
                        className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>
                </div>
                <Input
                  label="Fecha de Nacimiento (DD/MM/AAAA)"
                  name="birth_formatted"
                  value={formData.birth_formatted || ''}
                  onChange={handleBirthDateChange}
                  placeholder="DD/MM/AAAA"
                  icon={Calendar}
                />

                {/* Perfil Profesional */}
                <div className="md:col-span-2 pt-6 border-t border-gray-100">
                  <h4 className="text-sm font-black uppercase tracking-widest text-emerald-600 mb-2">Perfil Profesional</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Comparte tu trayectoria y nivel académico.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">Nivel Académico</label>
                  <div className="relative">
                    <select
                      name="nivel_academico"
                      value={formData.nivel_academico}
                      onChange={handleInputChange}
                      className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="Bachiller">Bachiller</option>
                      <option value="TSU">TSU</option>
                      <option value="Nivel Profesional">Nivel Profesional</option>
                      <option value="Postgrado">Postgrado</option>
                      <option value="Doctorado">Doctorado</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>

                {formData.nivel_academico !== 'Bachiller' && (
                  <Input label="Profesión" name="profesion" value={formData.profesion} onChange={handleInputChange} icon={Briefcase} />
                )}

                <Input label="Año de inicio en el sector" name="ano_inicio_servicio" value={formData.ano_inicio_servicio} onChange={handleInputChange} type="number" icon={Clock} />

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">Descripción / Biografía Profesional</label>
                  <textarea
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleInputChange}
                    placeholder="Cuéntanos un poco sobre tu trayectoria..."
                    rows={4}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors resize-none"
                  />
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
              <HeaderSection 
                title={user?.tipo_afiliado === 'Corporativo' ? "Información de Corporativo" : "Información de Marca / Firma"} 
                subtitle={user?.tipo_afiliado === 'Corporativo' ? "Datos corporativos visibles en tu membresía." : "Datos comerciales de tu firma o marca independiente."} 
              />
              
              <div className="flex justify-center py-4">
                <FileUpload
                  label={user?.tipo_afiliado === 'Corporativo' ? "Logo de la Empresa" : "Logo Comercial / Marca"}
                  accept="image/*"
                  folder="logos"
                  initialUrl={formData.empresa_logo_url}
                  enableCrop
                  cropAspect={1}
                  cropShape="rect"
                  lockAspect={true}
                  onUploadSuccess={(url) => setFormData(prev => ({ ...prev, empresa_logo_url: url }))}
                  onClear={() => setFormData(prev => ({ ...prev, empresa_logo_url: '' }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Input 
                    label={user?.tipo_afiliado === 'Corporativo' ? "Razón Social" : "Nombre Comercial / Firma"} 
                    name="empresa_razon_social" 
                    value={formData.empresa_razon_social} 
                    onChange={handleInputChange} 
                    icon={Building} 
                    disabled={isAgente} 
                  />
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
                    <Input 
                      label={user?.tipo_afiliado === 'Corporativo' ? "Número RIF" : "RIF Personal / Comercial"} 
                      name="empresa_rif_numero" 
                      value={formData.empresa_rif_numero} 
                      onChange={handleInputChange} 
                      disabled={isAgente} 
                    />
                  </div>
                </div>
                <Input 
                  label={user?.tipo_afiliado === 'Corporativo' ? "Email Corporativo" : "Email Comercial"} 
                  name="empresa_email" 
                  value={formData.empresa_email} 
                  onChange={handleInputChange} 
                  icon={Mail} 
                  disabled={isAgente} 
                />
                <Input 
                  label="Website" 
                  name="empresa_website" 
                  value={formData.empresa_website} 
                  onChange={handleInputChange} 
                  icon={Globe} 
                  placeholder={user?.tipo_afiliado === 'Corporativo' ? "www.tuempresa.com" : "www.tufirma.com"} 
                  disabled={isAgente} 
                />
                <Input 
                  label={user?.tipo_afiliado === 'Corporativo' ? "Teléfono Empresa" : "Teléfono Comercial"} 
                  name="empresa_telefono" 
                  value={formData.empresa_telefono} 
                  onChange={handleInputChange} 
                  icon={Phone} 
                  disabled={isAgente} 
                />
              </div>

              <div className="mt-8 pt-8 border-t border-gray-100 space-y-6">
                <HeaderSection 
                  title={user?.tipo_afiliado === 'Corporativo' ? "Redes Sociales del Corporativo" : "Redes Sociales de tu Marca / Firma"} 
                  subtitle={user?.tipo_afiliado === 'Corporativo' ? "Perfiles oficiales de tu organización." : "Perfiles oficiales de tu marca o firma comercial."} 
                />
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
            <div className="transition-opacity space-y-6 fade-in duration-300">
              <HeaderSection title="Expediente y Documentación" subtitle="Sube o actualiza la documentación requerida para tu membresía." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FileUpload 
                  label={isCorp || user?.tipo_afiliado === 'Corporativo' ? "Curriculum Vitae del Representante (CV)" : "Curriculum Vitae (CV)"} 
                  initialUrl={getDocUrl('cv')}
                  initialFileName={getDocName('cv')}
                  disableImagePreview
                  onUploadSuccess={(url, name) => handleUploadSuccess('cv', url, name)}
                  onClear={() => handleClearDoc('cv')}
                />

                {!(isCorp || user?.tipo_afiliado === 'Corporativo') ? (
                  <FileUpload 
                    label="Título Universitario / Académico" 
                    initialUrl={getDocUrl('titulo')}
                    initialFileName={getDocName('titulo')}
                    disableImagePreview
                    onUploadSuccess={(url, name) => handleUploadSuccess('titulo', url, name)}
                    onClear={() => handleClearDoc('titulo')}
                  />
                ) : (
                  <FileUpload 
                    label="Título del Representante Legal" 
                    initialUrl={getDocUrl('titulo_representante')}
                    initialFileName={getDocName('titulo_representante')}
                    disableImagePreview
                    onUploadSuccess={(url, name) => handleUploadSuccess('titulo_representante', url, name)}
                    onClear={() => handleClearDoc('titulo_representante')}
                  />
                )}

                {(isCorp || user?.tipo_afiliado === 'Corporativo') && (
                  <>
                    <FileUpload 
                      label="Registro Mercantil de la Empresa" 
                      initialUrl={getDocUrl('registro_mercantil')}
                      initialFileName={getDocName('registro_mercantil')}
                      disableImagePreview
                      maxSizeMB={10}
                      onUploadSuccess={(url, name) => handleUploadSuccess('registro_mercantil', url, name)}
                      onClear={() => handleClearDoc('registro_mercantil')}
                    />

                    <FileUpload 
                      label="RIF de la Empresa" 
                      initialUrl={getDocUrl('rif_empresa')}
                      initialFileName={getDocName('rif_empresa')}
                      disableImagePreview
                      onUploadSuccess={(url, name) => handleUploadSuccess('rif_empresa', url, name)}
                      onClear={() => handleClearDoc('rif_empresa')}
                    />

                    <FileUpload 
                      label="Cédula del Representante Legal" 
                      initialUrl={getDocUrl('cedula_representante')}
                      initialFileName={getDocName('cedula_representante')}
                      disableImagePreview
                      onUploadSuccess={(url, name) => handleUploadSuccess('cedula_representante', url, name)}
                      onClear={() => handleClearDoc('cedula_representante')}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          <div className="mt-12 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-3 px-10 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-colors transition-transform shadow-xl shadow-emerald-200 active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
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
        className={`w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl ${Icon ? 'pl-11' : 'px-4'} pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-colors transition-opacity disabled:opacity-50 disabled:bg-gray-100`}
      />
    </div>
  </div>
);

export default SettingsPanel;
