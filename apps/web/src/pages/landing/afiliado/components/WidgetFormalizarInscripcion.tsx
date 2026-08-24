import React, { useState } from 'react';
import { CreditCard, UploadCloud, Loader2, Info } from 'lucide-react';
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';

interface WidgetFormalizarInscripcionProps {
  onSuccess: () => void;
}

const WidgetFormalizarInscripcion = ({ onSuccess }: WidgetFormalizarInscripcionProps) => {
  const { token } = useAuth();
  const [banco, setBanco] = useState('');
  const [referencia, setReferencia] = useState('');
  const [monto, setMonto] = useState('150.00'); // Monto fijo de inscripción sugerido
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch(`${API_URL}/api/afiliados/formalizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ banco, referencia, monto })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al procesar la formalización');
      }

      // Éxito, le decimos al padre que recargue
      onSuccess();
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Error de red. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardCard title="Formalización de Inscripción" icon={CreditCard} actionText="">
      <div className="py-2 space-y-5">
        <div className="p-4 rounded-xl flex items-start gap-4" style={{ backgroundColor: 'var(--color-accent-muted)', color: 'var(--color-primary)' }}>
          <Info size={24} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-bold mb-1">¡Felicidades por ser admitido en el CIBIR!</h4>
            <p className="opacity-90 leading-relaxed font-medium">
              Para desbloquear todas las funcionades de la academia, expediente y sistema de solvencias, es necesario que declares el pago de la inscripción inicial.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Banco Emisor</label>
              <select
                required
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 outline-none focus:border-emerald-500 bg-white text-sm"
              >
                <option value="">Selecciona Banco</option>
                <option value="Banesco">Banesco</option>
                <option value="Mercantil">Mercantil</option>
                <option value="Provincial">Provincial</option>
                <option value="Venezuela">Banco de Venezuela</option>
                <option value="PagoMovil">Pago Móvil (Cualquiera)</option>
                <option value="Zelle">Zelle / BinacePay</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nº Referencia / Recibo</label>
              <input
                type="text"
                required
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Ej. 182749320"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 outline-none focus:border-emerald-500 bg-white text-sm font-bold"
              />
            </div>
            
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Monto Declarado (USD)</label>
              <input
                type="number"
                step="0.01"
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 outline-none focus:border-emerald-500 bg-white text-sm font-bold text-emerald-700"
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs font-bold text-red-500 text-center">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-black mt-4 py-4 rounded-xl flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-widest text-xs"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-on-dark)',
              boxShadow: '0 4px 14px rgba(2, 44, 34, 0.15)'
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <><UploadCloud size={16} /> Declarar Pago e Ingresar</>}
          </button>
        </form>

      </div>
    </DashboardCard>
  );
};

export default WidgetFormalizarInscripcion;
