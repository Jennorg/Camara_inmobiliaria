import React, { useState, useEffect } from 'react';
import { CreditCard, UploadCloud, Loader2, Info, Landmark, DollarSign, Building2, Copy, Check, ShieldCheck, Clock, FileText, ExternalLink, MapPin } from 'lucide-react';
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import FileUpload from '@/components/common/FileUpload';
import { CuentaBancariaDTO, PagoDTO, MetodoPago } from '@/types/pagos';
import { toast } from 'sonner';

interface WidgetFormalizarInscripcionProps {
  onSuccess: () => void;
}

const WidgetFormalizarInscripcion = ({ onSuccess }: WidgetFormalizarInscripcionProps) => {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<'digital' | 'taquilla'>('digital');
  const [cuentas, setCuentas] = useState<CuentaBancariaDTO[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Arancel breakdown
  const [arancelInfo, setArancelInfo] = useState<{
    cuotaInscripcion: number;
    primeraMensualidad: number;
    totalUSD: number;
  }>({
    cuotaInscripcion: 25,
    primeraMensualidad: 5,
    totalUSD: 30
  });

  // Estado de pagos existentes
  const [existingPagos, setExistingPagos] = useState<PagoDTO[]>([]);
  const [loadingPagos, setLoadingPagos] = useState<boolean>(true);

  // Form state
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('pago_movil');
  const [banco, setBanco] = useState('');
  const [referencia, setReferencia] = useState('');
  const [titularOrigen, setTitularOrigen] = useState('');
  const [telefonoOrigen, setTelefonoOrigen] = useState('');
  const [comprobanteUrl, setComprobanteUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const fetchInitialData = async () => {
    try {
      // 1. Cuentas bancarias
      const resC = await fetch(`${API_URL}/api/pagos/cuentas`);
      const jsonC = await resC.json();
      if (jsonC.success && Array.isArray(jsonC.data)) {
        setCuentas(jsonC.data);
      }

      // 2. Arancel de formalización
      const idAf = user?.id_afiliado;
      if (idAf) {
        const resA = await fetch(`${API_URL}/api/pagos/arancel-formalizacion/${idAf}`);
        const jsonA = await resA.json();
        if (jsonA.success && jsonA.data) {
          setArancelInfo({
            cuotaInscripcion: jsonA.data.cuotaInscripcion || 25,
            primeraMensualidad: jsonA.data.primeraMensualidad || 5,
            totalUSD: jsonA.data.totalUSD || 30
          });
        }

        // 3. Pagos previos del usuario
        const resP = await fetch(`${API_URL}/api/pagos/afiliado/${idAf}`, { headers });
        const jsonP = await resP.json();
        if (jsonP.success && Array.isArray(jsonP.data)) {
          setExistingPagos(jsonP.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCuentas(false);
      setLoadingPagos(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [user]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!user?.id_afiliado) {
      setErrorMsg('No se encontró el perfil de afiliado');
      setLoading(false);
      return;
    }

    if (!referencia || referencia.trim() === '') {
      setErrorMsg('El número de referencia es obligatorio');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        id_afiliado: user.id_afiliado,
        tipo_concepto: 'formalizacion_afiliacion',
        descripcion_concepto: `Formalización de Inscripción ($${arancelInfo.cuotaInscripcion.toFixed(2)}) + Primera Mensualidad ($${arancelInfo.primeraMensualidad.toFixed(2)})`,
        metodo_pago: metodoPago,
        moneda: metodoPago === 'zelle' ? 'USD' : 'VES',
        monto: arancelInfo.totalUSD,
        monto_usd_equivalente: arancelInfo.totalUSD,
        banco_origen: banco || null,
        referencia: referencia.trim(),
        titular_origen: titularOrigen.trim() || null,
        telefono_origen: telefonoOrigen.trim() || null,
        comprobante_url: comprobanteUrl || null
      };

      const res = await fetch(`${API_URL}/api/pagos/reportar`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al procesar la formalización');
      }

      toast.success('Pago reportado exitosamente');
      await fetchInitialData();
      onSuccess();
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Error de red. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const pagoPendiente = existingPagos.find(p => p.estatus === 'Pendiente');
  const pagoVerificado = existingPagos.find(p => p.estatus === 'Verificado');

  return (
    <DashboardCard title="Formalización de Inscripción & Membresía" icon={CreditCard} actionText="">
      <div className="py-2 space-y-5 text-slate-800">
        
        {/* Banner de bienvenida / Felicitación */}
        <div className="p-4 rounded-2xl flex items-start gap-3.5 bg-emerald-50 border border-emerald-200/70 text-emerald-950">
          <ShieldCheck size={24} className="flex-shrink-0 mt-0.5 text-emerald-600" />
          <div className="text-xs space-y-1">
            <h4 className="font-black text-sm text-emerald-900">¡Felicidades por culminar el proceso de admisión!</h4>
            <p className="opacity-90 leading-relaxed font-medium">
              Para formalizar tu acreditación como Miembro Oficial y activar tu carnet digital y solvencias, es necesario liquidar el arancel inicial de afiliación.
            </p>
          </div>
        </div>

        {/* Desglose del arancel */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Arancel Total de Formalización
            </span>
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="text-2xl font-black font-mono text-slate-900">
                ${arancelInfo.totalUSD.toFixed(2)} USD
              </span>
              <span className="text-xs text-slate-500 font-medium">
                (o equivalente en Bs. a Tasa Oficial BCV)
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Desglose: Cuota de Inscripción (${arancelInfo.cuotaInscripcion.toFixed(2)}) + 1ª Mensualidad (${arancelInfo.primeraMensualidad.toFixed(2)})
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 text-xs font-bold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('digital')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all ${
                activeTab === 'digital'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Pago Digital
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('taquilla')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all ${
                activeTab === 'taquilla'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Efectivo en Sede
            </button>
          </div>
        </div>

        {/* Si ya hay un pago pendiente */}
        {pagoPendiente && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Pago en Proceso de Verificación
                </span>
              </div>
              <span className="text-xs font-mono font-bold">{pagoPendiente.numero_recibo}</span>
            </div>
            <p className="text-xs font-medium leading-relaxed">
              Hemos recibido tu reporte de pago por <strong>{pagoPendiente.monto} {pagoPendiente.moneda}</strong> (Ref: {pagoPendiente.referencia}). La administración está conciliando el comprobante bancario. En cuanto sea confirmado, tu acceso quedará completamente habilitado.
            </p>
          </div>
        )}

        {/* Pestaña: Pago en Sede / Efectivo */}
        {activeTab === 'taquilla' && (
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span>Pago Presencial en Taquilla Administrativa</span>
            </div>
            <p className="text-slate-600 leading-relaxed font-medium">
              Puedes realizar el pago presencialmente en nuestra sede gremial en:
            </p>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Sede Cámara Inmobiliaria del Estado Bolívar</p>
                  <p className="text-[11px] text-slate-500">
                    Puerto Ordaz, Estado Bolívar · Horario de Atención: Lunes a Viernes de 8:30 AM a 4:30 PM.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 font-medium">
                💵 <strong>Efectivo Divisas</strong> ($30 USD)
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 font-medium">
                🇻🇪 <strong>Efectivo Bolívares</strong> (Tasa BCV del día)
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 font-medium">
                💳 <strong>Punto de Venta</strong> (Tarjeta Débito)
              </div>
            </div>
            <p className="text-[11px] text-emerald-800 font-semibold italic">
              * El recibo oficial se emite y se entrega de manera inmediata en taquilla al formalizar el pago.
            </p>
          </div>
        )}

        {/* Pestaña: Pago Digital */}
        {activeTab === 'digital' && (
          <div className="space-y-5">
            
            {/* Cuentas Bancarias Oficiales */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                Cuentas Bancarias Oficiales de la Cámara
              </span>

              {loadingCuentas ? (
                <div className="p-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cargando cuentas oficiales...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cuentas.map(c => (
                    <div
                      key={c.id_cuenta}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-200 transition-colors text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {c.tipo.replace('_', ' ')}
                        </span>
                        <span className="font-bold text-slate-800">{c.banco}</span>
                      </div>

                      <div className="text-[11px] text-slate-600 space-y-0.5 font-medium">
                        <p><strong className="text-slate-800">Titular:</strong> {c.beneficiario}</p>
                        
                        <div className="flex items-center justify-between">
                          <span><strong className="text-slate-800">RIF/C.I.:</strong> {c.identificacion}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(c.identificacion, `rif-${c.id_cuenta}`)}
                            className="text-slate-400 hover:text-emerald-600 p-0.5"
                            title="Copiar RIF"
                          >
                            {copiedKey === `rif-${c.id_cuenta}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>

                        {c.telefono && (
                          <div className="flex items-center justify-between">
                            <span><strong className="text-slate-800">Teléfono:</strong> {c.telefono}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(c.telefono || '', `tel-${c.id_cuenta}`)}
                              className="text-slate-400 hover:text-emerald-600 p-0.5"
                              title="Copiar Teléfono"
                            >
                              {copiedKey === `tel-${c.id_cuenta}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          </div>
                        )}

                        {c.numero_cuenta && (
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] truncate max-w-[200px]"><strong className="text-slate-800">Cuenta:</strong> {c.numero_cuenta}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(c.numero_cuenta || '', `cta-${c.id_cuenta}`)}
                              className="text-slate-400 hover:text-emerald-600 p-0.5 shrink-0"
                              title="Copiar Cuenta"
                            >
                              {copiedKey === `cta-${c.id_cuenta}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          </div>
                        )}

                        {c.email && (
                          <div className="flex items-center justify-between">
                            <span><strong className="text-slate-800">Zelle:</strong> {c.email}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(c.email || '', `email-${c.id_cuenta}`)}
                              className="text-slate-400 hover:text-emerald-600 p-0.5"
                              title="Copiar Correo"
                            >
                              {copiedKey === `email-${c.id_cuenta}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulario de Reporte */}
            <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-gray-100 text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Formulario de Declaración de Pago
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Método de Pago *</label>
                  <select
                    required
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 bg-white text-xs font-bold"
                  >
                    <option value="pago_movil">Pago Móvil (Bolívares)</option>
                    <option value="transferencia_bs">Transferencia Bancaria Nacional (Bolívares)</option>
                    <option value="zelle">Zelle (USD)</option>
                    <option value="binance_usdt">Binance Pay / USDT</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nº Referencia / Confirmación *</label>
                  <input
                    type="text"
                    required
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Ej. 182749320"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 bg-white text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Banco Emisor</label>
                  <input
                    type="text"
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    placeholder="Ej. Banesco, Mercantil, BDV, Chase"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 bg-white text-xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Titular de la Cuenta Emisora</label>
                  <input
                    type="text"
                    value={titularOrigen}
                    onChange={(e) => setTitularOrigen(e.target.value)}
                    placeholder="Nombre completo del titular"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 bg-white text-xs font-medium"
                  />
                </div>

                {metodoPago === 'pago_movil' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Teléfono Emisor</label>
                    <input
                      type="text"
                      value={telefonoOrigen}
                      onChange={(e) => setTelefonoOrigen(e.target.value)}
                      placeholder="Ej. 0414-1234567"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 bg-white text-xs font-mono"
                    />
                  </div>
                )}

                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Adjuntar Captura / Comprobante de Pago (PDF o Imagen)</label>
                  <FileUpload
                    label="Comprobante de Pago"
                    accept="image/*,.pdf"
                    folder="pagos"
                    initialUrl={comprobanteUrl}
                    onUploadSuccess={(url) => setComprobanteUrl(url)}
                    onClear={() => setComprobanteUrl('')}
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs font-bold text-red-500 text-center">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full font-black mt-4 py-4 rounded-xl flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-widest text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Reportando Pago...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} />
                    <span>Reportar Pago de Inscripción</span>
                  </>
                )}
              </button>
            </form>

          </div>
        )}

      </div>
    </DashboardCard>
  );
};

export default WidgetFormalizarInscripcion;
