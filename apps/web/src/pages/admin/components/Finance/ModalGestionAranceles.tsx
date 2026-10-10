import React, { useState, useEffect } from 'react';
import { X, DollarSign, Check, Loader2, Edit2, ShieldAlert } from 'lucide-react';
import { ArancelDTO } from '@/types/pagos';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';

interface ModalGestionArancelesProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  authHeaders?: Record<string, string>;
}

export const ModalGestionAranceles: React.FC<ModalGestionArancelesProps> = ({
  open,
  isOpen,
  onClose,
  authHeaders: customAuthHeaders
}) => {
  const { token } = useAuth();
  const effectiveOpen = open ?? isOpen ?? false;
  const headers = customAuthHeaders || (token ? { Authorization: `Bearer ${token}` } : {});

  const [aranceles, setAranceles] = useState<ArancelDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCodigo, setEditingCodigo] = useState<string | null>(null);
  const [editMonto, setEditMonto] = useState<number>(0);
  const [editNombre, setEditNombre] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');

  const fetchAranceles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/pagos/aranceles`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAranceles(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (effectiveOpen) {
      fetchAranceles();
    }
  }, [effectiveOpen]);

  const handleStartEdit = (a: ArancelDTO) => {
    setEditingCodigo(a.codigo);
    setEditMonto(a.monto_usd);
    setEditNombre(a.nombre);
    setEditDesc(a.descripcion || '');
  };

  const handleSave = async (codigo: string) => {
    try {
      const res = await fetch(`${API_URL}/api/pagos/admin/aranceles/${codigo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          monto_usd: editMonto,
          nombre: editNombre,
          descripcion: editDesc
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Error al guardar');

      Swal.fire({
        title: 'Arancel Actualizado',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });

      setEditingCodigo(null);
      fetchAranceles();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  if (!effectiveOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-[#022c22]/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-white w-full max-w-xl mx-auto rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col my-auto border border-emerald-100 max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-sm shadow-emerald-200">
              <DollarSign className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Aranceles y Tarifas Gremiales
              </h3>
              <p className="text-xs font-bold text-slate-500">
                Parametrizar precios de inscripción, mensualidades y CIBIR
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-800">
          
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-emerald-900 flex items-center gap-2.5">
            <span className="text-sm font-black">💡</span>
            <p className="text-[11px] leading-relaxed font-medium">
              Los montos se definen en <strong>Dólares Estadounidenses (USD)</strong> y se liquidan automáticamente a la Tasa Oficial BCV al momento del cobro.
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Cargando aranceles...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {aranceles.map((a) => {
                const isEditing = editingCodigo === a.codigo;
                return (
                  <div
                    key={a.codigo}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-200 transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 block">
                          {a.categoria} · {a.codigo}
                        </span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            className="mt-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold w-full focus:outline-none focus:border-emerald-500"
                          />
                        ) : (
                          <p className="text-sm font-black text-slate-900 mt-0.5">{a.nombre}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-400">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={editMonto}
                              onChange={(e) => setEditMonto(parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 rounded-lg border border-emerald-300 font-mono font-black text-sm text-emerald-800 text-right focus:outline-none"
                            />
                            <button
                              onClick={() => handleSave(a.codigo)}
                              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                              title="Guardar"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCodigo(null)}
                              className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black font-mono text-emerald-800">
                              ${Number(a.monto_usd).toFixed(2)} USD
                            </span>
                            <button
                              onClick={() => handleStartEdit(a)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                              title="Modificar precio"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Descripción del arancel..."
                        className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-600 focus:outline-none"
                      />
                    ) : (
                      a.descripcion && (
                        <p className="text-[11px] text-slate-500">{a.descripcion}</p>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default ModalGestionAranceles;
