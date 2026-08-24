import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Home } from 'lucide-react';
import { API_URL } from '@/config/env';
import { apiFetch } from '@/lib/apiClient';

const VerificarEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando tu correo electrónico...');

  useEffect(() => {
    let active = true;

    if (!token) {
      setStatus('error');
      setMessage('El enlace de verificación de correo es incorrecto o está incompleto.');
      return;
    }

    const verificarToken = async () => {
      try {
        const data = await apiFetch(`${API_URL}/api/afiliados/registro/verificar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token })
        });

        if (!active) return;

        setStatus('success');
        setMessage(data.message || 'Correo verificado y candidato registrado exitosamente.');
      } catch (err: any) {
        if (!active) return;
        setStatus('error');
        let errMsg = err.message || 'Error al verificar el correo.';
        if (errMsg.toLowerCase().includes('token') || errMsg.toLowerCase().includes('expira') || errMsg.toLowerCase().includes('vencido') || errMsg.toLowerCase().includes('caducado')) {
          errMsg = 'El enlace de verificación no es válido o ha caducado. Por favor, realiza tu registro nuevamente.';
        }
        setMessage(errMsg);
      }
    };

    verificarToken();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-emerald-900/5 text-center space-y-6">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <Loader2 size={48} className="animate-spin text-emerald-600 mb-4" />
            <h2 className="text-xl font-bold text-slate-800">Cargando...</h2>
            <p className="text-slate-500 mt-2">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-emerald-50 mb-4">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-[#022c22]">¡Verificación Exitosa!</h2>
            <p className="text-slate-500 mt-2 leading-relaxed">
              {message}
            </p>
            <Link
              to="/cibir"
              className="mt-8 px-6 py-3 w-full rounded-xl bg-emerald-600 text-white font-bold tracking-wide flex items-center justify-center gap-2 hover:bg-emerald-700 transition"
            >
              <Home size={18} />
              Volver al Inicio
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-red-50 mb-4">
              <XCircle size={40} className="text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-red-900">Verificación Fallida</h2>
            <p className="text-slate-500 mt-2 leading-relaxed">
              {message}
            </p>
            <Link
              to="/cibir"
              className="mt-8 px-6 py-3 w-full rounded-xl bg-slate-100 text-slate-700 font-bold tracking-wide flex items-center justify-center gap-2 hover:bg-slate-200 transition"
            >
              <Home size={18} />
              Volver e intentar de nuevo
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificarEmailPage;
