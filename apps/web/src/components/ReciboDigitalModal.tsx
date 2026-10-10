import React, { useRef } from 'react';
import { X, Printer, Download, CheckCircle2, ShieldCheck, DollarSign, Calendar, Hash, FileText } from 'lucide-react';
import { PagoDTO } from '@/types/pagos';
import { formatDateLatina } from '@/utils/formatters';

interface ReciboDigitalModalProps {
  pago: PagoDTO | null;
  onClose: () => void;
}

export const ReciboDigitalModal: React.FC<ReciboDigitalModalProps> = ({ pago, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!pago) return null;

  const handlePrint = () => {
    window.print();
  };

  const getMetodoLabel = (metodo: string) => {
    switch (metodo) {
      case 'efectivo_usd': return 'Efectivo Divisas (USD)';
      case 'efectivo_bs': return 'Efectivo Bolívares (VES)';
      case 'pago_movil': return 'Pago Móvil Interbancario';
      case 'transferencia_bs': return 'Transferencia Bancaria Nacional';
      case 'zelle': return 'Zelle (USD)';
      case 'pos_debito': return 'Punto de Venta / Tarjeta Débito (POS)';
      case 'binance_usdt': return 'Binance Pay / USDT';
      default: return metodo.toUpperCase();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-[#022c22]/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-white w-full max-w-2xl mx-auto rounded-[2rem] shadow-2xl overflow-hidden flex flex-col my-auto border border-emerald-100">
        
        {/* Header bar (no imprimible) */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-100/70 text-emerald-800">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Recibo de Pago Oficial
              </h3>
              <p className="text-[11px] font-bold text-emerald-700">
                {pago.numero_recibo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Imprimir o Guardar como PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div ref={printRef} className="p-6 sm:p-8 space-y-6 bg-white text-slate-800 printable-receipt">
          
          {/* Top Brand Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  Cámara Inmobiliaria del Estado Bolívar
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                RIF: J-30456789-0 · Afiliada a la Cámara Inmobiliaria de Venezuela
              </p>
              <p className="text-[11px] text-slate-400">
                Sede Administrativa · Puerto Ordaz, Edo. Bolívar
              </p>
            </div>

            <div className="text-left sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-100 w-full sm:w-auto">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                Comprobante Digital
              </span>
              <span className="text-base font-black text-emerald-800 block font-mono">
                {pago.numero_recibo}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Fecha: {formatDateLatina(pago.fecha_pago || pago.creado_en)}
              </span>
            </div>
          </div>

          {/* Status Banner */}
          <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 ${
            pago.estatus === 'Verificado'
              ? 'bg-emerald-50 border border-emerald-200/80 text-emerald-900'
              : pago.estatus === 'Pendiente'
                ? 'bg-amber-50 border border-amber-200/80 text-amber-900'
                : 'bg-rose-50 border border-rose-200/80 text-rose-900'
          }`}>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              <div>
                <span className="text-xs font-black uppercase tracking-wider block">
                  Estado: {pago.estatus.toUpperCase()}
                </span>
                <span className="text-[11px] opacity-90 font-medium">
                  {pago.estatus === 'Verificado'
                    ? `Verificado por administración el ${formatDateLatina(pago.fecha_verificacion || pago.creado_en)}`
                    : pago.estatus === 'Pendiente'
                      ? 'En proceso de conciliación bancaria'
                      : `Rechazado: ${pago.motivo_rechazo || 'Comprobante no válido'}`}
                </span>
              </div>
            </div>

            {pago.afiliado_codigo && (
              <div className="text-right">
                <span className="text-[9px] font-black uppercase tracking-widest block opacity-70">
                  Código Miembro
                </span>
                <span className="text-xs font-black font-mono">
                  #{pago.afiliado_codigo}
                </span>
              </div>
            )}
          </div>

          {/* Member & Payer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Miembro / Titular
              </span>
              <p className="text-sm font-black text-slate-900 mt-0.5">
                {pago.pagador_nombre || 'Afiliado'}
              </p>
              {pago.pagador_identificacion && (
                <p className="text-xs font-medium text-slate-600">
                  C.I. / RIF: {pago.pagador_identificacion}
                </p>
              )}
              {pago.tipo_afiliado && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-800 text-[10px] font-bold">
                  Membresía {pago.tipo_afiliado}
                </span>
              )}
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Forma de Pago
              </span>
              <p className="text-sm font-bold text-slate-800 mt-0.5">
                {getMetodoLabel(pago.metodo_pago)}
              </p>
              {pago.referencia && (
                <p className="text-xs font-mono text-slate-600">
                  Ref / Recibo: {pago.referencia}
                </p>
              )}
              {pago.banco_origen && (
                <p className="text-xs text-slate-500">
                  Banco: {pago.banco_origen}
                </p>
              )}
            </div>
          </div>

          {/* Breakdown Table */}
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
              Desglose de Conceptos
            </span>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Concepto</th>
                    <th className="p-3 text-right">Moneda</th>
                    <th className="p-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3">
                      <p className="font-bold text-slate-900">{pago.descripcion_concepto}</p>
                      {pago.notas && (
                        <p className="text-[11px] text-slate-500 mt-0.5 italic">{pago.notas}</p>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-600">
                      {pago.moneda}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-slate-900">
                      {pago.moneda === 'USD' ? `$${pago.monto.toFixed(2)}` : `Bs. ${pago.monto.toFixed(2)}`}
                    </td>
                  </tr>

                  {pago.tasa_bcv && (
                    <tr className="bg-slate-50/50 text-[11px] text-slate-600">
                      <td colSpan={2} className="p-2.5 text-right font-medium">
                        Tasa BCV Aplicada:
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        Bs. {pago.tasa_bcv.toFixed(2)} / USD
                      </td>
                    </tr>
                  )}

                  <tr className="bg-emerald-50/70 text-emerald-950 font-bold text-sm">
                    <td colSpan={2} className="p-3 text-right font-black uppercase text-xs tracking-wider">
                      Total Acreditado:
                    </td>
                    <td className="p-3 text-right font-black font-mono text-emerald-800 text-base">
                      {pago.moneda === 'USD' ? `$${pago.monto.toFixed(2)} USD` : `Bs. ${pago.monto.toFixed(2)}`}
                      {pago.moneda === 'VES' && pago.monto_usd_equivalente && (
                        <span className="block text-[10px] font-normal text-emerald-700">
                          (Equivalente: ${pago.monto_usd_equivalente.toFixed(2)} USD)
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer note & Stamp */}
          <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="text-[10px] text-slate-400 space-y-0.5">
              <p>Este documento es un comprobante electrónico oficial de la Cámara Inmobiliaria.</p>
              <p>Generado automáticamente a través de la plataforma gremial.</p>
            </div>

            <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                Sello Digital CIEB
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default ReciboDigitalModal;
