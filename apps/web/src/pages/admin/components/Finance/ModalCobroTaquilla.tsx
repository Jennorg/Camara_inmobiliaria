import React, { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Banknote, Landmark, CheckCircle2, Loader2, Info } from 'lucide-react';
import { BinanceIcon } from '@/components/icons/BinanceIcon';
import { API_URL } from '@/config/env';
import { MetodoPago, TipoConceptoPago, PagoDTO } from '@/types/pagos';
import Swal from 'sweetalert2';

/** Inscripción a un curso de pago que se cobra en taquilla (puede ser de alguien sin afiliación). */
export interface CursoPorCobrar {
  id_inscripcion: number;
  curso: string;
  /** Precio congelado al reservar */
  monto_usd: number | null;
  /** Precio según la afiliación actual de la persona */
  precio_actual: number;
}

interface ModalCobroTaquillaProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (pago: PagoDTO) => void;
  afiliadoId: number | null;
  afiliadoNombre: string;
  afiliadoTipo?: string;
  conceptoDefault?: TipoConceptoPago;
  idEdicionCibir?: number | null;
  cursoPorCobrar?: CursoPorCobrar | null;
  authHeaders: Record<string, string>;
}

export const ModalCobroTaquilla: React.FC<ModalCobroTaquillaProps> = ({
  open,
  onClose,
  onSuccess,
  afiliadoId,
  afiliadoNombre,
  afiliadoTipo = 'Natural',
  conceptoDefault = 'formalizacion_afiliacion',
  idEdicionCibir = null,
  cursoPorCobrar = null,
  authHeaders
}) => {
  const [tipoConcepto, setTipoConcepto] = useState<TipoConceptoPago>(conceptoDefault);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo_usd');
  const [moneda, setMoneda] = useState<'USD' | 'VES'>('USD');
  const [montoUSD, setMontoUSD] = useState<number>(30);
  const [tasaBcv, setTasaBcv] = useState<string>('875.65');
  const [tasaUsdt, setTasaUsdt] = useState<string>('1008.45');
  const [montoVES, setMontoVES] = useState<number>(0);
  const [referencia, setReferencia] = useState<string>('');
  const [bancoOrigen, setBancoOrigen] = useState<string>('');
  const [notas, setNotas] = useState<string>('Recibido en taquilla de sede administrativa');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingAranceles, setLoadingAranceles] = useState<boolean>(false);
  // Mes que cubre la mensualidad (AAAA-MM) y cuántos meses seguidos paga
  const [periodo, setPeriodo] = useState<string>(new Date().toISOString().slice(0, 7));
  const [mesesCubiertos, setMesesCubiertos] = useState<number>(1);

  // Cargar tasas dinámicas y aranceles configurados al abrir
  useEffect(() => {
    if (!open) return;

    setTipoConcepto(conceptoDefault);
    setLoadingAranceles(true);

    // 1. Cargar tasas activas de referencia
    fetch(`${API_URL}/api/public/tasas-referencia`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.tasas) {
          const tB = json.data.tasas.USD_BCV?.tasa;
          const tU = json.data.tasas.USDT_BINANCE?.tasa;
          if (tB) setTasaBcv(String(tB));
          if (tU) setTasaUsdt(String(tU));
          return tB || 875.65;
        }
        return 875.65;
      })
      .catch(() => 875.65)
      .then((activeTasa) => {
        // 2. Cargar aranceles
        return fetch(`${API_URL}/api/pagos/aranceles`)
          .then(res => res.json())
          .then(json => {
            if (json.success && Array.isArray(json.data)) {
              const aranceles = json.data;
              let suggestedMonto = 30;

              if (conceptoDefault === 'formalizacion_afiliacion') {
                const keyInscripcion = afiliadoTipo === 'Corporativo'
                  ? 'inscripcion_corporativo'
                  : afiliadoTipo === 'Agente Corporativo'
                    ? 'inscripcion_agente'
                    : 'inscripcion_natural';
                const arInsc = aranceles.find((a: any) => a.codigo === keyInscripcion);
                const arMens = aranceles.find((a: any) => a.codigo === 'mensualidad_base');
                const pInsc = arInsc ? Number(arInsc.monto_usd) : 25;
                const pMens = arMens ? Number(arMens.monto_usd) : 5;
                suggestedMonto = pInsc + pMens;
              } else if (conceptoDefault === 'curso_cibir') {
                const arCibir = aranceles.find((a: any) => a.codigo === 'curso_cibir');
                suggestedMonto = arCibir ? Number(arCibir.monto_usd) : 30;
              } else if (conceptoDefault === 'mensualidad') {
                const arMens = aranceles.find((a: any) => a.codigo === 'mensualidad_base');
                suggestedMonto = arMens ? Number(arMens.monto_usd) : 5;
              } else if (conceptoDefault === 'curso' && cursoPorCobrar) {
                suggestedMonto = Number(cursoPorCobrar.monto_usd) || cursoPorCobrar.precio_actual;
              }

              setMontoUSD(suggestedMonto);
              const t = parseFloat(String(activeTasa)) || 875.65;
              setMontoVES(Number((suggestedMonto * t).toFixed(2)));
            }
          });
      })
      .catch(err => console.error('Error cargando aranceles/tasas:', err))
      .finally(() => setLoadingAranceles(false));
  }, [open, conceptoDefault, afiliadoTipo, cursoPorCobrar]);

  // Actualizar montos en Bs al cambiar tasa o moneda
  const handleTasaChange = (val: string) => {
    setTasaBcv(val);
    const numTasa = parseFloat(val) || 0;
    if (numTasa > 0) {
      setMontoVES(Number((montoUSD * numTasa).toFixed(2)));
    }
  };

  const handleMontoUSDChange = (val: number) => {
    setMontoUSD(val);
    const numTasa = parseFloat(tasaBcv) || 0;
    if (numTasa > 0) {
      setMontoVES(Number((val * numTasa).toFixed(2)));
    }
  };

  const handleMetodoChange = (m: MetodoPago) => {
    setMetodoPago(m);
    if (m === 'efectivo_usd' || m === 'zelle' || m === 'binance_usdt') {
      setMoneda('USD');
    } else {
      setMoneda('VES');
    }
  };

  const handleConceptoChange = (c: TipoConceptoPago) => {
    setTipoConcepto(c);
    if (c === 'formalizacion_afiliacion') {
      handleMontoUSDChange(30);
      setNotas('Formalización de Inscripción ($25) + Primera Mensualidad ($5)');
    } else if (c === 'curso_cibir') {
      handleMontoUSDChange(30);
      setNotas('Arancel Curso de Inducción CIBIR');
    } else if (c === 'mensualidad') {
      setMesesCubiertos(1);
      handleMontoUSDChange(5);
      setNotas('Cuota mensual de membresía');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const finalMonto = moneda === 'USD' ? montoUSD : montoVES;
      const finalMontoUSD = montoUSD;
      const finalTasa = moneda === 'VES' ? parseFloat(tasaBcv) : null;

      let descConcepto = 'Formalización de Inscripción y Membresía Gremial';
      if (tipoConcepto === 'formalizacion_afiliacion') {
        descConcepto = `Formalización de Inscripción ($${(montoUSD - 5).toFixed(2)}) + Primera Mensualidad ($5.00)`;
      } else if (tipoConcepto === 'curso_cibir') {
        descConcepto = 'Arancel Curso de Inducción en Bienes Raíces (CIBIR)';
      } else if (tipoConcepto === 'curso' && cursoPorCobrar) {
        descConcepto = `Curso: ${cursoPorCobrar.curso}`;
      } else if (tipoConcepto === 'mensualidad') {
        descConcepto = mesesCubiertos > 1
          ? `Cuotas Mensuales de Membresía Gremial (${mesesCubiertos} meses desde ${periodo})`
          : `Cuota Mensual de Membresía Gremial (${periodo})`;
      }

      const payload = {
        id_afiliado: afiliadoId,
        id_edicion_cibir: idEdicionCibir,
        id_inscripcion_curso: cursoPorCobrar?.id_inscripcion ?? null,
        tipo_concepto: tipoConcepto,
        descripcion_concepto: descConcepto,
        metodo_pago: metodoPago,
        moneda,
        monto: finalMonto,
        monto_usd_equivalente: finalMontoUSD,
        tasa_bcv: finalTasa,
        banco_origen: bancoOrigen || null,
        referencia: referencia || `TAQ-${Date.now().toString().slice(-6)}`,
        notas: notas || null,
        ...(tipoConcepto === 'mensualidad' ? { periodo, meses_cubiertos: mesesCubiertos } : {})
      };

      const res = await fetch(`${API_URL}/api/pagos/admin/cobro-taquilla`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Error al procesar cobro');
      }

      Swal.fire({
        title: '¡Cobro Registrado y Formalizado!',
        text: `Se emitió el recibo ${json.data.numero_recibo} y se formalizó el registro exitosamente.`,
        icon: 'success',
        timer: 2500,
        showConfirmButton: false
      });

      onSuccess(json.data);
      onClose();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo registrar el cobro', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 sm:p-6 bg-[#022c22]/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-white w-full max-w-xl mx-auto rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col my-auto border border-emerald-100">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-sm shadow-emerald-200">
              <Banknote className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Registrar Cobro en Taquilla
              </h3>
              <p className="text-xs font-bold text-slate-500">
                Pagador: <span className="text-emerald-700">{afiliadoNombre}</span>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {cursoPorCobrar ? (
            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 block">Curso</span>
              <span className="text-sm font-bold text-slate-800">{cursoPorCobrar.curso}</span>
              {cursoPorCobrar.monto_usd != null && Number(cursoPorCobrar.monto_usd) !== cursoPorCobrar.precio_actual && (
                <p className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-700">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Reservó a ${Number(cursoPorCobrar.monto_usd).toFixed(2)}, pero según su afiliación actual le corresponden ${cursoPorCobrar.precio_actual.toFixed(2)}. Verifica su identidad antes de cobrar.
                </p>
              )}
            </div>
          ) : (
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Concepto del Cobro
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleConceptoChange('formalizacion_afiliacion')}
                className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                  tipoConcepto === 'formalizacion_afiliacion'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="block font-black text-[11px]">Formalización</span>
                <span className="text-[10px] opacity-70">Inscripción + 1º Mes</span>
              </button>

              <button
                type="button"
                onClick={() => handleConceptoChange('curso_cibir')}
                className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                  tipoConcepto === 'curso_cibir'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="block font-black text-[11px]">Curso CIBIR</span>
                <span className="text-[10px] opacity-70">Arancel Académico</span>
              </button>

              <button
                type="button"
                onClick={() => handleConceptoChange('mensualidad')}
                className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                  tipoConcepto === 'mensualidad'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="block font-black text-[11px]">Mensualidad</span>
                <span className="text-[10px] opacity-70">Solvencia</span>
              </button>
            </div>

            {tipoConcepto === 'mensualidad' && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Mes que cubre</span>
                  <input
                    type="month"
                    required
                    value={periodo}
                    onChange={e => setPeriodo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Meses pagados</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={mesesCubiertos}
                    onChange={e => {
                      const n = Math.min(24, Math.max(1, Math.trunc(Number(e.target.value)) || 1));
                      setMesesCubiertos(n);
                      handleMontoUSDChange(5 * n);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
              </div>
            )}
          </div>
          )}

          {/* Método de Pago */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Forma de Pago Recibida
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'efectivo_usd', label: 'Efectivo USD', icon: DollarSign },
                { key: 'efectivo_bs', label: 'Efectivo Bs', icon: Banknote },
                { key: 'binance_usdt', label: 'Binance (USDT)', icon: BinanceIcon },
                { key: 'pago_movil', label: 'Pago Móvil', icon: Landmark },
                { key: 'transferencia_bs', label: 'Transferencia Bs', icon: Landmark },
                { key: 'zelle', label: 'Zelle USD', icon: DollarSign },
              ].map(m => {
                const Icon = m.icon;
                const isSelected = metodoPago === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => handleMetodoChange(m.key as MetodoPago)}
                    className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${m.key === 'binance_usdt' && !isSelected ? 'text-[#F0B90B]' : ''}`} />
                    <span className="text-[10px] leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Montos y Conversión */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-emerald-900 block mb-1">
                  Arancel Base (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={montoUSD}
                    onChange={(e) => handleMontoUSDChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-emerald-200 bg-white text-sm font-black text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                {tipoConcepto === 'formalizacion_afiliacion' && (
                  <p className="text-[10px] text-emerald-700 mt-1 font-medium">
                    Incluye: $25 inscripción + $5 mensualidad
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-emerald-900 block mb-1">
                  Tasa BCV (Bs./USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Bs.</span>
                  <input
                    type="number"
                    step="0.01"
                    value={tasaBcv}
                    onChange={(e) => handleTasaChange(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-emerald-200 bg-white text-sm font-black text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Total Cobrado */}
            <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                Monto Final a Registrar ({moneda}):
              </span>
              <span className="text-base font-black font-mono text-emerald-900">
                {moneda === 'USD' ? `$${montoUSD.toFixed(2)} USD` : `Bs. ${montoVES.toFixed(2)} VES`}
              </span>
            </div>
          </div>

          {/* Referencia y Banco (opcional si es digital o Binance) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                {metodoPago === 'binance_usdt' ? 'Nº Referencia / Order ID / Hash (Opcional)' : 'Nº Referencia / Confirmación (Opcional)'}
              </label>
              <input
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder={metodoPago === 'binance_usdt' ? 'Ej. Order ID / TXID' : 'Ej. 182739'}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                {metodoPago === 'binance_usdt' ? 'Cuenta / Binance Pay ID (Opcional)' : 'Banco Origen (Opcional)'}
              </label>
              <input
                type="text"
                value={bancoOrigen}
                onChange={(e) => setBancoOrigen(e.target.value)}
                placeholder={metodoPago === 'binance_usdt' ? 'Ej. Binance Pay ID / Email' : 'Ej. Banesco, Mercantil, BDV'}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-medium"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Notas de Taquilla
            </label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas internas de la transacción..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 text-xs text-slate-600"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || montoUSD <= 0}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cobrar y Formalizar</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default ModalCobroTaquilla;
