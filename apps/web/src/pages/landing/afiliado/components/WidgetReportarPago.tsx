import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UploadCloud, Loader2, Copy, Check, Building2, Landmark } from 'lucide-react';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import FileUpload from '@/components/common/FileUpload';
import type { CuentaBancariaDTO, MetodoPago } from '@/types/pagos';
import { toast } from 'sonner';

interface CursoPendiente {
  id_inscripcion: number;
  curso_nombre: string;
  monto_usd: number;
  reserva_vence_en: string | null;
}

/** Cobro del proceso de afiliación (formalización o CIBIR) que el afiliado tiene pendiente */
interface CobroProceso {
  concepto: 'formalizacion_afiliacion' | 'curso_cibir';
  etiqueta: string;
  detalle: string;
  monto_usd: number;
  estado: 'pagado' | 'por_verificar' | 'pendiente' | 'no_aplica';
}

interface Props {
  idAfiliado: number;
  /** Tras reportar, para refrescar la línea de tiempo de solvencia */
  onReportado?: () => void;
}

const METODOS: { value: MetodoPago; label: string; moneda: 'USD' | 'VES' }[] = [
  { value: 'pago_movil', label: 'Pago Móvil (Bolívares)', moneda: 'VES' },
  { value: 'transferencia_bs', label: 'Transferencia Bancaria Nacional (Bolívares)', moneda: 'VES' },
  { value: 'zelle', label: 'Zelle (USD)', moneda: 'USD' },
  { value: 'binance_usdt', label: 'Binance Pay / USDT', moneda: 'USD' },
];

const inputClase = 'w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-white text-xs font-medium';
const etiquetaClase = 'text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1';

/**
 * Formulario del afiliado para reportar un pago digital: mensualidades (uno o varios meses) o un
 * curso con cupo reservado. Queda 'Pendiente' hasta que Finanzas lo verifica.
 */
const WidgetReportarPago = ({ idAfiliado, onReportado }: Props) => {
  const { authHeaders } = useAuth();
  const [cuentas, setCuentas] = useState<CuentaBancariaDTO[]>([]);
  const [tasaBcv, setTasaBcv] = useState(0);
  const [montoMensual, setMontoMensual] = useState(0);
  const [cursos, setCursos] = useState<CursoPendiente[]>([]);
  const [copiado, setCopiado] = useState<string | null>(null);
  // null mientras se consulta; false cuando todos los pagos se canalizan por la administración
  const [electronicos, setElectronicos] = useState<boolean | null>(null);
  const [mensajeAdmin, setMensajeAdmin] = useState('');
  const [cobrosProceso, setCobrosProceso] = useState<CobroProceso[]>([]);

  // 'mensualidad', 'curso:<id_inscripcion>' o 'proceso:<concepto>'
  const [concepto, setConcepto] = useState('mensualidad');
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [meses, setMeses] = useState(1);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('pago_movil');
  const [referencia, setReferencia] = useState('');
  const [banco, setBanco] = useState('');
  const [titular, setTitular] = useState('');
  const [telefono, setTelefono] = useState('');
  const [comprobanteUrl, setComprobanteUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    const json = (url: string, init?: RequestInit) => fetch(url, init).then(r => r.json()).catch(() => null);
    const [c, t, s, mc, mod, cp] = await Promise.all([
      json(`${API_URL}/api/pagos/cuentas`),
      json(`${API_URL}/api/public/tasas-referencia`),
      json(`${API_URL}/api/pagos/solvencia/afiliado/${idAfiliado}`, { headers: authHeaders }),
      json(`${API_URL}/api/afiliados/me/cursos`, { headers: authHeaders }),
      json(`${API_URL}/api/pagos/modalidad`),
      json(`${API_URL}/api/pagos/afiliado/${idAfiliado}/cobros`, { headers: authHeaders }),
    ]);
    if (mod?.success) {
      setElectronicos(!!mod.data.electronicos);
      setMensajeAdmin(mod.data.mensaje || '');
    } else {
      setElectronicos(true);
    }
    if (cp?.success) {
      const pendientes = (cp.data as CobroProceso[]).filter(x => x.estado === 'pendiente' && x.monto_usd > 0);
      setCobrosProceso(pendientes);
      // Quien está en el proceso de afiliación paga primero lo que le corresponde de él
      if (pendientes.length) setConcepto(prev => (prev === 'mensualidad' ? `proceso:${pendientes[0].concepto}` : prev));
    }
    if (c?.success) setCuentas(c.data);
    if (t?.success) setTasaBcv(Number(t.data?.tasas?.USD_BCV?.tasa) || 0);
    if (s?.success) {
      setMontoMensual(Number(s.data.monto_mensual) || 0);
      // Sugerir desde el mes impago más antiguo y cubrir toda la deuda
      const impagos = (s.data.meses as { periodo: string; estado: string }[]).filter(m => m.estado === 'deuda' || m.estado === 'por_pagar');
      if (impagos.length) {
        setPeriodo(impagos[0].periodo);
        setMeses(Math.min(24, impagos.length));
      }
    }
    if (mc?.success) {
      setCursos((mc.data as any[]).filter(i =>
        Number(i.monto_usd) > 0 &&
        ['Preinscrito', 'Entrevista', 'Inscrito'].includes(i.estatus) &&
        !['Verificado', 'Pendiente'].includes(i.pago_estatus)
      ));
    }
  }, [idAfiliado, authHeaders]);

  useEffect(() => { cargar(); }, [cargar]);

  const cursoSel = concepto.startsWith('curso:') ? cursos.find(c => `curso:${c.id_inscripcion}` === concepto) : undefined;
  const procesoSel = concepto.startsWith('proceso:') ? cobrosProceso.find(x => `proceso:${x.concepto}` === concepto) : undefined;
  const montoUsd = cursoSel ? Number(cursoSel.monto_usd) : procesoSel ? procesoSel.monto_usd : meses * montoMensual;
  const moneda = METODOS.find(m => m.value === metodoPago)!.moneda;
  const montoVes = useMemo(() => Number((montoUsd * tasaBcv).toFixed(2)), [montoUsd, tasaBcv]);

  const copiar = (texto: string, clave: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(clave);
    setTimeout(() => setCopiado(null), 2000);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (moneda === 'VES' && !tasaBcv) {
      setError('No se pudo obtener la tasa BCV. Intenta de nuevo en unos minutos.');
      return;
    }
    setEnviando(true);
    try {
      const payload = {
        id_afiliado: idAfiliado,
        ...(cursoSel
          ? { tipo_concepto: 'curso', id_inscripcion_curso: cursoSel.id_inscripcion, descripcion_concepto: `Curso: ${cursoSel.curso_nombre}` }
          : procesoSel
          ? { tipo_concepto: procesoSel.concepto, descripcion_concepto: procesoSel.etiqueta }
          : {
              tipo_concepto: 'mensualidad',
              periodo,
              meses_cubiertos: meses,
              descripcion_concepto: meses > 1 ? `Cuotas Mensuales de Membresía Gremial (${meses} meses desde ${periodo})` : `Cuota Mensual de Membresía Gremial (${periodo})`,
            }),
        metodo_pago: metodoPago,
        moneda,
        monto: moneda === 'USD' ? montoUsd : montoVes,
        monto_usd_equivalente: montoUsd,
        tasa_bcv: moneda === 'VES' ? tasaBcv : null,
        banco_origen: banco.trim() || null,
        referencia: referencia.trim(),
        titular_origen: titular.trim() || null,
        telefono_origen: telefono.trim() || null,
        comprobante_url: comprobanteUrl || null,
      };
      const res = await fetch(`${API_URL}/api/pagos/reportar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo reportar el pago');
      toast.success(`Pago reportado (${json.data.numero_recibo}). Finanzas lo verificará en breve.`);
      setReferencia('');
      setComprobanteUrl('');
      await cargar();
      onReportado?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (electronicos === null) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" aria-label="Cargando" /></div>;
  }

  if (!electronicos) {
    return (
      <div role="status" className="p-5 rounded-2xl border border-amber-200 bg-amber-50/70 flex items-start gap-3 text-slate-700">
        <Landmark size={20} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-black text-slate-900">Los pagos se realizan en la administración</p>
          <p className="text-xs font-medium leading-relaxed">{mensajeAdmin || 'Acude a la sede de la Cámara para realizar tu pago; el recibo se emite al momento.'}</p>
          {cobrosProceso.length > 0 && (
            <ul className="pt-1 text-xs font-semibold text-slate-800 list-disc pl-4">
              {cobrosProceso.map(x => <li key={x.concepto}>{x.etiqueta}: ${x.monto_usd.toFixed(2)} <span className="font-medium text-slate-500">({x.detalle})</span></li>)}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-slate-800">
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">Cuentas oficiales de la Cámara</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cuentas.map(c => (
            <div key={c.id_cuenta} className="p-3.5 rounded-2xl border border-slate-200 bg-white text-[11px] text-slate-600 space-y-0.5 font-medium">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{c.tipo.replace('_', ' ')}</span>
                <span className="font-bold text-slate-800">{c.banco}</span>
              </div>
              <p><strong className="text-slate-800">Titular:</strong> {c.beneficiario}</p>
              {([['RIF/C.I.', c.identificacion], ['Teléfono', c.telefono], ['Cuenta', c.numero_cuenta], ['Zelle', c.email]] as const)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="truncate"><strong className="text-slate-800">{k}:</strong> {v}</span>
                    <button type="button" onClick={() => copiar(String(v), `${c.id_cuenta}-${k}`)} aria-label={`Copiar ${k}`} className="text-slate-400 hover:text-emerald-600 p-0.5 shrink-0">
                      {copiado === `${c.id_cuenta}-${k}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    </button>
                  </div>
                ))}
            </div>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Building2 size={13} className="text-emerald-600 shrink-0" />
          También puedes pagar en efectivo (USD o Bs) o Binance en la taquilla de la sede: el recibo se emite al momento.
        </p>
      </div>

      <form onSubmit={enviar} className="space-y-4 pt-4 border-t border-slate-100 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 md:col-span-2">
            <span className={etiquetaClase}>¿Qué estás pagando? *</span>
            <select value={concepto} onChange={e => setConcepto(e.target.value)} className={`${inputClase} font-bold`}>
              {cobrosProceso.map(x => (
                <option key={x.concepto} value={`proceso:${x.concepto}`}>{x.etiqueta} (${x.monto_usd.toFixed(2)})</option>
              ))}
              <option value="mensualidad">Mensualidad gremial</option>
              {cursos.map(c => (
                <option key={c.id_inscripcion} value={`curso:${c.id_inscripcion}`}>Curso: {c.curso_nombre} (${Number(c.monto_usd).toFixed(2)})</option>
              ))}
            </select>
          </label>

          {!cursoSel && !procesoSel && (
            <>
              <label className="space-y-1">
                <span className={etiquetaClase}>Desde el mes</span>
                <input type="month" readOnly value={periodo} aria-describedby="ayuda-mes-pago" className={`${inputClase} bg-slate-50 cursor-not-allowed`} />
                <span id="ayuda-mes-pago" className="text-[10px] font-medium text-slate-500 block ml-1">Tu pago se aplica primero a tu deuda más antigua.</span>
              </label>
              <label className="space-y-1">
                <span className={etiquetaClase}>Cantidad de meses *</span>
                <input type="number" inputMode="numeric" min={1} max={24} required value={meses}
                  onChange={e => setMeses(Math.min(24, Math.max(1, Math.trunc(e.currentTarget.valueAsNumber) || 1)))} className={inputClase} />
              </label>
            </>
          )}

          <div className="md:col-span-2 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Monto a pagar</span>
            <span className="text-lg font-black tabular-nums text-emerald-900">
              ${montoUsd.toFixed(2)} USD
              {moneda === 'VES' && tasaBcv > 0 && (
                <span className="ml-2 text-xs font-bold text-emerald-800">≈ Bs. {montoVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })} (BCV {tasaBcv.toFixed(2)})</span>
              )}
            </span>
          </div>

          <label className="space-y-1">
            <span className={etiquetaClase}>Método de pago *</span>
            <select required value={metodoPago} onChange={e => setMetodoPago(e.target.value as MetodoPago)} className={`${inputClase} font-bold`}>
              {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className={etiquetaClase}>N° de referencia *</span>
            <input type="text" required value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ej. 182749320…" autoComplete="off" spellCheck={false} className={`${inputClase} font-mono font-bold`} />
          </label>
          <label className="space-y-1">
            <span className={etiquetaClase}>Banco emisor</span>
            <input type="text" value={banco} onChange={e => setBanco(e.target.value)} placeholder="Ej. Banesco, Mercantil, BDV…" className={inputClase} />
          </label>
          <label className="space-y-1">
            <span className={etiquetaClase}>Titular de la cuenta emisora</span>
            <input type="text" value={titular} onChange={e => setTitular(e.target.value)} autoComplete="name" className={inputClase} />
          </label>
          {metodoPago === 'pago_movil' && (
            <label className="space-y-1">
              <span className={etiquetaClase}>Teléfono emisor</span>
              <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej. 0414-1234567…" autoComplete="tel" className={`${inputClase} font-mono`} />
            </label>
          )}
          <div className="md:col-span-2">
            <FileUpload
              label="Comprobante de pago (PDF o imagen)"
              accept="image/*,.pdf"
              folder="pagos"
              initialUrl={comprobanteUrl}
              onUploadSuccess={url => setComprobanteUrl(url)}
              onClear={() => setComprobanteUrl('')}
            />
          </div>
        </div>

        {error && <p role="alert" className="text-xs font-bold text-red-600 text-center">{error}</p>}

        <button
          type="submit"
          disabled={enviando || montoUsd <= 0}
          className="w-full font-black py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-widest text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 transition-colors"
        >
          {enviando ? <><Loader2 size={16} className="animate-spin" /> Reportando…</> : <><UploadCloud size={16} /> Reportar pago</>}
        </button>
      </form>
    </div>
  );
};

export default WidgetReportarPago;
