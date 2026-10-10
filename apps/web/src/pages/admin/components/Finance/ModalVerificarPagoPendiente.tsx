import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, ExternalLink, ShieldCheck, DollarSign, Calendar, Hash, FileText, Loader2, AlertCircle } from 'lucide-react';
import { PagoDTO } from '@/types/pagos';
import { API_URL } from '@/config/env';
import { formatDateLatina } from '@/utils/formatters';
import Swal from 'sweetalert2';

interface ModalVerificarPagoPendienteProps {
  open: boolean;
  onClose: () => void;
  pago: PagoDTO | null;
  onVerified: (pago: PagoDTO) => void;
  authHeaders: Record<string, string>;
}

export const ModalVerificarPagoPendiente: React.FC<ModalVerificarPagoPendienteProps> = ({
  open,
  onClose,
  pago,
  onVerified,
  authHeaders
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (!open || !pago) return null;

  const handleAprobar = async () => {
    const confirm = await Swal.fire({
      title: '¿Confirmar Verificación de Pago?',
      text: `El pago de ${pago.monto} ${pago.moneda} será marcado como Verificado y se formalizará automáticamente la afiliación de ${pago.pagador_nombre || 'el aspirante'}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, Aprobar y Formalizar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    setLoadingAction('aprobar');
    try {
      const res = await fetch(`${API_URL}/api/pagos/admin/${pago.id_pago}/verificar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        }
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Error al verificar pago');
      }

      Swal.fire({
        title: '¡Pago Verificado!',
        text: 'La afiliación ha sido formalizada exitosamente.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });

      onVerified(json.data);
      onClose();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo verificar el pago', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRechazar = async () => {
    const { value: motivo } = await Swal.fire({
      title: 'Rechazar Pago Reportado',
      input: 'textarea',
      inputLabel: 'Motivo del rechazo (será notificado al aspirante):',
      inputPlaceholder: 'Ej. La referencia no aparece en el estado de cuenta bancario...',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Rechazar Pago',
      cancelButtonText: 'Cancelar',
      inputValidator: (val) => {
        if (!val || val.trim() === '') {
          return 'Debes ingresar el motivo del rechazo';
        }
      }
    });

    if (!motivo) return;

    setLoadingAction('rechazar');
    try {
      const res = await fetch(`${API_URL}/api/pagos/admin/${pago.id_pago}/rechazar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ motivo })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Error al rechazar pago');
      }

      Swal.fire({
        title: 'Pago Rechazado',
        text: 'Se ha notificado al aspirante para que corrija su comprobante.',
        icon: 'info',
        timer: 2000,
        showConfirmButton: false
      });

      onVerified(json.data);
      onClose();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo rechazar el pago', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-[#022c22]/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-white w-full max-w-xl mx-auto rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col my-auto border border-emerald-100">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-sm shadow-amber-200">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Validar Pago Reportado
              </h3>
              <p className="text-xs font-bold text-slate-500">
                Recibo: <span className="text-amber-700 font-mono">{pago.numero_recibo}</span>
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

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-800">
          
          {/* Aspirante Info */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Aspirante
              </span>
              <p className="text-sm font-black text-slate-900 mt-0.5">
                {pago.pagador_nombre || 'Afiliado'}
              </p>
              {pago.pagador_email && (
                <p className="text-[11px] text-slate-500">{pago.pagador_email}</p>
              )}
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Concepto
              </span>
              <p className="text-xs font-bold text-emerald-800 mt-0.5">
                {pago.descripcion_concepto}
              </p>
            </div>
          </div>

          {/* Transaction Info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Monto Declarado
              </span>
              <p className="text-base font-black font-mono text-emerald-900 mt-0.5">
                {pago.moneda === 'USD' ? `$${pago.monto.toFixed(2)}` : `Bs. ${pago.monto.toFixed(2)}`}
              </p>
              {pago.moneda === 'VES' && pago.monto_usd_equivalente && (
                <span className="text-[10px] text-emerald-700">(${pago.monto_usd_equivalente.toFixed(2)} USD)</span>
              )}
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Método de Pago
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1 uppercase">
                {pago.metodo_pago.replace('_', ' ')}
              </p>
              {pago.banco_origen && (
                <p className="text-[10px] text-slate-500">{pago.banco_origen}</p>
              )}
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Referencia
              </span>
              <p className="text-xs font-mono font-black text-slate-900 mt-1">
                {pago.referencia || 'S/R'}
              </p>
              <span className="text-[10px] text-slate-400">{formatDateLatina(pago.fecha_pago || pago.creado_en)}</span>
            </div>
          </div>

          {/* Comprobante Adjunto */}
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
              Comprobante de Pago Adjunto
            </span>
            {pago.comprobante_url ? (
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-700 truncate">
                    Captura / Recibo Bancario
                  </span>
                </div>
                <a
                  href={pago.comprobante_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver Comprobante</span>
                </a>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-100 text-slate-500 text-center font-medium">
                Sin archivo de comprobante adjunto.
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-gray-100 flex gap-2">
            <button
              onClick={handleRechazar}
              disabled={loadingAction !== null}
              className="flex-1 py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {loadingAction === 'rechazar' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  <span>Rechazar Pago</span>
                </>
              )}
            </button>

            <button
              onClick={handleAprobar}
              disabled={loadingAction !== null}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
            >
              {loadingAction === 'aprobar' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aprobar y Formalizar</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default ModalVerificarPagoPendiente;
