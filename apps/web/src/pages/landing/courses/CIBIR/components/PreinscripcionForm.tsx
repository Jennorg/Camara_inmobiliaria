import React, { useState } from 'react';
import { User, Mail, CheckCircle2, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { apiUrl } from '@/config/env'

const COUNTRIES = [
  { code: '+58', flag: '🇻🇪', label: 'Venezuela' },
  { code: '+57', flag: '🇨🇴', label: 'Colombia' },
  { code: '+34', flag: '🇪🇸', label: 'España' },
  { code: '+1',  flag: '🇺🇸', label: 'Estados Unidos' },
  { code: '+507',flag: '🇵🇦', label: 'Panamá' },
  { code: '+52', flag: '🇲🇽', label: 'México' },
  { code: '+54', flag: '🇦🇷', label: 'Argentina' },
  { code: '+56', flag: '🇨🇱', label: 'Chile' },
  { code: '+51', flag: '🇵🇪', label: 'Perú' },
  { code: '+593',flag: '🇪🇨', label: 'Ecuador' },
  { code: '+1',  flag: '🇩🇴', label: 'Rep. Dominicana' },
  { code: '+506',flag: '🇨🇷', label: 'Costa Rica' },
  { code: '+502',flag: '🇬🇹', label: 'Guatemala' },
  { code: '+504',flag: '🇭🇳', label: 'Honduras' },
  { code: '+503',flag: '🇸🇻', label: 'El Salvador' },
  { code: '+505',flag: '🇳🇮', label: 'Nicaragua' },
  { code: '+595',flag: '🇵🇾', label: 'Paraguay' },
  { code: '+598',flag: '🇺🇾', label: 'Uruguay' },
  { code: '+591',flag: '🇧🇴', label: 'Bolivia' },
  { code: '+1',  flag: '🇵🇷', label: 'Puerto Rico' },
];

const PreinscripcionForm = () => {
  const [formData, setFormData] = useState({ 
    fullName: '', 
    cedulaPrefix: 'V',
    cedulaNumber: '', 
    email: '', 
    phonePrefix: '+58',
    phone: '' 
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // --- VALIDACIONES ---
    const nombreTrim = formData.fullName.trim();
    if (nombreTrim.length < 5 || !/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]+$/.test(nombreTrim)) {
      setErrorMsg('Por favor, ingresa un nombre completo válido.');
      return;
    }

    const cedulaNum = formData.cedulaNumber.replace(/\D/g, '');
    if (cedulaNum.length < 6 || cedulaNum.length > 12) {
      setErrorMsg('La identificación debe tener entre 6 y 12 dígitos.');
      return;
    }

    const phoneNum = formData.phone.replace(/\D/g, '');
    if (phoneNum.length < 7 || phoneNum.length > 15) {
      setErrorMsg('Por favor, ingresa un número de teléfono válido.');
      return;
    }

    setLoading(true);

    const cedulaRif = `${formData.cedulaPrefix}-${cedulaNum}`;
    const phone = `${formData.phonePrefix}${phoneNum}`;

    try {
      const response = await fetch(apiUrl('/api/public/preinscripciones'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programaCodigo: 'CIBIR',
          nombreCompleto: nombreTrim,
          cedulaRif,
          email: formData.email,
          telefono: phone
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error al conectar');
      
      const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV || import.meta.env.VITE_NODE_ENV === 'development'
      if (isDev && data.data?.token) {
        window.location.href = `/cursos/verificar?token=${data.data.token}`
        return
      }

      setSubmitted(true);
    } catch (error: any) {
      setErrorMsg(error.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="py-16 flex flex-col items-center text-center space-y-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center bg-emerald-50">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h3 className="text-2xl font-black text-[#022c22]">¡Solicitud Enviada!</h3>
        <p className="text-sm max-w-xs leading-relaxed text-slate-500">
          Te hemos enviado un correo de validación. Por favor confírmalo para completar tu registro.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="text-sm font-bold underline transition-colors text-emerald-600 hover:text-emerald-500"
        >
          Enviar otra solicitud
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">Nombre Completo</label>
          <div className="group relative">
            <User size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              name="fullName"
              required
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Ej. Carlos Mendoza"
              className="w-full pl-12 pr-5 py-4 bg-white rounded-xl outline-none transition-all placeholder:text-slate-300 font-medium text-sm border border-slate-200 text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">Cédula o RIF</label>
          <div className="flex gap-0 group focus-within:ring-4 focus-within:ring-emerald-500/10 rounded-xl transition-all shadow-sm">
            <div className="relative flex-shrink-0">
              <select
                name="cedulaPrefix"
                value={formData.cedulaPrefix}
                onChange={handleChange}
                className="h-full pl-4 pr-9 bg-slate-50 border-y border-l border-slate-200 rounded-l-xl outline-none transition-all font-bold text-sm text-slate-700 hover:bg-slate-100 appearance-none cursor-pointer"
              >
                {['V', 'E', 'J', 'G', 'P'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="relative flex-1">
              <input
                type="text"
                name="cedulaNumber"
                required
                value={formData.cedulaNumber}
                onChange={handleChange}
                placeholder="00000000"
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-r-xl outline-none transition-all placeholder:text-slate-300 font-medium text-sm text-slate-800 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">Correo Electrónico</label>
          <div className="group relative">
            <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="usuario@ejemplo.com"
              className="w-full pl-12 pr-5 py-4 bg-white rounded-xl outline-none transition-all placeholder:text-slate-300 font-medium text-sm border border-slate-200 text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">Teléfono</label>
          <div className="flex gap-0 group focus-within:ring-4 focus-within:ring-emerald-500/10 rounded-xl transition-all shadow-sm">
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                className="h-full pl-4 pr-9 bg-slate-50 border-y border-l border-slate-200 rounded-l-xl outline-none transition-all font-bold text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2 min-w-[100px]"
              >
                <span className="text-lg">{COUNTRIES.find(c => c.code === formData.phonePrefix)?.flag}</span>
                <span>{formData.phonePrefix}</span>
                <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showCountryDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowCountryDropdown(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-48 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-200">
                      {COUNTRIES.map(c => (
                        <button
                          key={`${c.label}-${c.code}`}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, phonePrefix: c.code }));
                            setShowCountryDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-emerald-50 transition-colors ${formData.phonePrefix === c.code ? 'bg-emerald-50/50' : ''}`}
                        >
                          <span className="text-xl">{c.flag}</span>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{c.label}</span>
                            <span className="text-xs font-bold text-emerald-600">{c.code}</span>
                          </div>
                          {formData.phonePrefix === c.code && (
                            <CheckCircle2 size={14} className="ml-auto text-emerald-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative flex-1">
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="4XX 0000000"
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-r-xl outline-none transition-all placeholder:text-slate-300 font-medium text-sm text-slate-800 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full font-black py-5 rounded-xl flex items-center justify-center gap-3 transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-widest text-xs shadow-xl bg-emerald-600 text-white shadow-emerald-600/30 hover:bg-[#022c22]"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : 'Solicitar Preinscripción'}
      </button>

      {errorMsg && (
        <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-xl text-xs font-bold justify-center">
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}
    </form>
  );
};

export default PreinscripcionForm;
