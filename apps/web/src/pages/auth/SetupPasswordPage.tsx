import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { API_URL } from '@/config/env';
import { toast } from 'sonner';
import logo from '@/assets/Logo2.webp';

export default function SetupPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const modo = searchParams.get('modo'); // si es 'reset', usamos endpoint de reset

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Validaciones básicas
  const isMatch = password === confirmPassword && password.length >= 8;
  const hasMinLength = password.length >= 8;

  const isReset = modo === 'reset';
  const title = isReset ? 'Restablece tu contraseña' : 'Configura tu acceso';
  const subtitle = isReset ? 'Crea una nueva contraseña para tu cuenta.' : 'Establece una contraseña segura para activar tu cuenta de afiliado.';
  const btnText = isReset ? 'Guardar Contraseña' : 'Activar mi Cuenta';
  const successMsg = isReset 
    ? '¡Tu contraseña ha sido actualizada correctamente! Ya puedes iniciar sesión.'
    : '¡Tu cuenta ha sido activada! Ya puedes iniciar sesión con tu nueva contraseña.';

  useEffect(() => {
    if (!token) {
      setStatus('error');
      const msg = 'El enlace de acceso es incorrecto o ha caducado. Por favor, solicita una nueva invitación.';
      setMessage(msg);
      toast.error(msg);
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatch) return;

    setLoading(true);
    setStatus('idle');

    const endpoint = isReset ? '/api/auth/reset-password' : '/api/auth/setup-initial-password';

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus('error');
        let errMsg = data.message || 'Error al procesar la solicitud.';
        if (errMsg.toLowerCase().includes('token') || errMsg.toLowerCase().includes('expira') || errMsg.toLowerCase().includes('vencido') || errMsg.toLowerCase().includes('caducado')) {
          errMsg = 'El enlace de activación no es válido, ya fue utilizado o ha caducado. Por favor, solicita una nueva invitación.';
        }
        setMessage(errMsg);
        toast.error(errMsg);
        return;
      }

      const data = await res.json();

      if (data.success) {
        setStatus('success');
        setMessage(successMsg);
        toast.success(successMsg);
      } else {
        setStatus('error');
        let errMsg = data.message || 'Error al procesar la solicitud.';
        if (errMsg.toLowerCase().includes('token') || errMsg.toLowerCase().includes('expira') || errMsg.toLowerCase().includes('vencido') || errMsg.toLowerCase().includes('caducado')) {
          errMsg = 'El enlace de activación no es válido, ya fue utilizado o ha caducado. Por favor, solicita una nueva invitación.';
        }
        setMessage(errMsg);
        toast.error(errMsg);
      }
    } catch (err) {
      setStatus('error');
      const connErr = 'Tiempo de espera agotado o error de conexión con el servidor. Por favor, intente de nuevo.';
      setMessage(connErr);
      toast.error(connErr);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-emerald-100/50 p-8 text-center space-y-6 border border-emerald-50">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="text-emerald-600 w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-800">¡Todo listo!</h1>
            <p className="text-slate-500 leading-relaxed">{message}</p>
          </div>
          <button 
            onClick={() => navigate('/')} 
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-200"
          >
            Ir al Inicio de Sesión <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 selection:bg-emerald-100 italic-none">
      <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl shadow-slate-200/50 p-8 sm:p-10 border border-slate-100 relative overflow-hidden">
        {/* Background micro-decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50" />
        
        <div className="relative">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <img
              src={logo}
              alt="Logo Cámara Inmobiliaria"
              className="h-40 w-auto object-contain transition-transform hover:scale-105 duration-300"
            />
          </div>

          <h1 className="text-2xl font-black text-slate-800 mb-2">{title}</h1>
          <p className="text-slate-400 text-sm mb-8">{subtitle}</p>

          {status === 'error' && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-2xl flex items-start gap-3 mb-6 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  disabled={status === 'error'}
                  className="w-full bg-slate-50 border border-slate-100 group-focus-within:border-emerald-500 group-focus-within:bg-white rounded-2xl pl-11 pr-12 py-4 text-slate-700 font-medium focus:outline-none transition-colors"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <ShieldCheck size={18} className="text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  disabled={status === 'error'}
                  className={`w-full bg-slate-50 border group-focus-within:bg-white rounded-2xl pl-11 pr-4 py-4 text-slate-700 font-medium focus:outline-none transition-colors ${
                    confirmPassword && !isMatch ? 'border-rose-200 focus:border-rose-500 bg-rose-50/30' : 'border-slate-100 focus:border-emerald-500'
                  }`}
                />
              </div>
              {confirmPassword && !isMatch && (
                <p className="text-[10px] text-rose-500 font-bold ml-1">Las contraseñas no coinciden</p>
              )}
            </div>

            {/* Password guidelines */}
            <div className="bg-slate-50/50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                <div className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                Al menos 8 caracteres
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isMatch || status === 'error'}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:grayscale text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-colors transition-transform shadow-xl shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : btnText}
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
