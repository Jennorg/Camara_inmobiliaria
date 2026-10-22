import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  RefreshCw, 
  Clock, 
  Edit3, 
  Check, 
  X, 
  ShieldCheck, 
  Zap, 
  Calendar, 
  TrendingUp,
  History,
  Info,
  DollarSign
} from 'lucide-react';
import { BinanceIcon } from '@/components/icons/BinanceIcon';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import type { ReferenciasSnapshotDTO, HistorialTasaDTO } from '@/types/tasas';

export default function ReferenciasTasasPanel() {
  const { authHeaders } = useAuth();

  // Estados de datos
  const [snapshot, setSnapshot] = useState<ReferenciasSnapshotDTO | null>(null);
  const [historial, setHistorial] = useState<HistorialTasaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filtros del historial por categoría ('' = todas)
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroFuente, setFiltroFuente] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');

  // Modal / Edición manual
  const [editingCodigo, setEditingCodigo] = useState<'USD_BCV' | 'USDT_BINANCE' | null>(null);
  const [nuevaTasaManual, setNuevaTasaManual] = useState<string>('');

  // 1. Cargar tasas de referencia
  const fetchTasas = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/finanzas/referencias`, {
        headers: authHeaders
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSnapshot(json.data);
      }
    } catch (err: any) {
      console.error('Error cargando tasas:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [authHeaders]);

  // 2. Cargar historial
  const fetchHistorial = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/finanzas/referencias/historial?limite=40`, {
        headers: authHeaders
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setHistorial(json.data);
      }
    } catch (err: any) {
      console.error('Error cargando historial:', err);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchTasas(true);
    fetchHistorial();
  }, [fetchTasas, fetchHistorial]);

  // 3. Forzar sincronización en vivo
  const handleSincronizarEnVivo = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/finanzas/referencias/sync`, {
        method: 'POST',
        headers: authHeaders
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo sincronizar');
      }
      setSnapshot(json.data);
      toast.success('Tasas sincronizadas en vivo');
      await fetchHistorial();
    } catch (err: any) {
      toast.error(err.message || 'Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  // 4. Guardar ajuste manual
  const handleGuardarManual = async () => {
    if (!editingCodigo) return;
    const num = parseFloat(nuevaTasaManual);
    if (isNaN(num) || num <= 0) {
      toast.error('Ingrese una tasa válida mayor a 0');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/finanzas/referencias/${editingCodigo}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ tasa: num })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al guardar tasa');
      }
      toast.success(`Tasa ${editingCodigo} fijada manualmente a Bs. ${num.toFixed(2)}`);
      setEditingCodigo(null);
      setNuevaTasaManual('');
      await fetchTasas(false);
      await fetchHistorial();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    }
  };

  // 5. Restablecer a automático
  const handleRestablecerAuto = async (codigo: 'USD_BCV' | 'USDT_BINANCE') => {
    try {
      const res = await fetch(`${API_URL}/api/finanzas/referencias/${codigo}/manual`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al restablecer');
      }
      toast.success('Tasa restablecida a actualización automática');
      await fetchTasas(false);
      await fetchHistorial();
    } catch (err: any) {
      toast.error(err.message || 'Error al restablecer');
    }
  };

  // Tasas numéricas activas
  const tasaBcvNum = snapshot?.tasas.USD_BCV?.tasa || 875.65;
  const tasaUsdtNum = snapshot?.tasas.USDT_BINANCE?.tasa || 1008.45;

  // Opciones de cada filtro, tomadas de lo que realmente hay en el historial
  const fuentes = useMemo(() => [...new Set(historial.map(h => h.fuente))].sort(), [historial]);
  const fechas = useMemo(() => [...new Set(historial.map(h => h.fecha))].sort().reverse(), [historial]);

  const historialFiltrado = useMemo(
    () => historial.filter(h =>
      (!filtroTipo || h.codigo === filtroTipo) &&
      (!filtroFuente || h.fuente === filtroFuente) &&
      (!filtroFecha || h.fecha === filtroFecha)),
    [historial, filtroTipo, filtroFuente, filtroFecha],
  );
  const hayFiltros = !!(filtroTipo || filtroFuente || filtroFecha);

  // Formato minutos restantes
  const minutosRestantes = Math.ceil((snapshot?.tiempo_restante_cache_ms || 0) / 60000);

  return (
    <div className="space-y-6" data-testid="referencias-tasas-container">
      {/* ── BARRA SUPERIOR DE SINCRONIZACIÓN & INTERVALO 35 MIN ── */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
              Sistema de Cotizaciones Activas
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
              <Clock size={12} className="text-slate-400" />
              Intervalo automático: <strong>35 minutos</strong>
            </span>
            {snapshot?.desde_cache && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                En caché ({minutosRestantes} min restantes)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600">
            Valores de referencia para liquidación de aranceles, cobros de formalización y registro contable de compras.
          </p>
        </div>

        <button
          onClick={handleSincronizarEnVivo}
          disabled={syncing}
          data-testid="btn-sincronizar-tasas"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 transition-all shadow-xs cursor-pointer"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          <span>{syncing ? 'Sincronizando...' : 'Sincronizar en Vivo Ahora'}</span>
        </button>
      </div>

      {/* ── CARDS DE COTIZACIÓN EN VIVO ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TARJETA 1: DÓLAR BCV OFICIAL */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 relative overflow-hidden" data-testid="card-tasa-bcv">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold">
                <DollarSign size={20} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-slate-900 text-sm">Dólar Oficial (BCV)</h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Oficial
                  </span>
                  {snapshot?.tasas.USD_BCV?.es_manual && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                      Manual
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Banco Central de Venezuela</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setEditingCodigo('USD_BCV');
                  setNuevaTasaManual(String(tasaBcvNum));
                }}
                title="Ajustar manualmente"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Edit3 size={14} />
              </button>
              {snapshot?.tasas.USD_BCV?.es_manual && (
                <button
                  onClick={() => handleRestablecerAuto('USD_BCV')}
                  title="Restablecer a automático"
                  className="text-[10px] text-amber-600 hover:underline font-bold px-1"
                >
                  Auto
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-slate-900" data-testid="valor-tasa-bcv">
                Bs. {tasaBcvNum.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase">/ USD</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 space-y-0.5">
              <p>Fuente: <strong>{snapshot?.tasas.USD_BCV?.fuente || 'BCV'}</strong></p>
              <p>Actualización: {snapshot?.tasas.USD_BCV?.fecha_actualizacion ? new Date(snapshot.tasas.USD_BCV.fecha_actualizacion).toLocaleString('es-VE') : '-'}</p>
            </div>
          </div>
        </div>

        {/* TARJETA 2: BINANCE USDT (CRIPTOMERCADO) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 relative overflow-hidden" data-testid="card-tasa-usdt">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#F0B90B] font-bold">
                <BinanceIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-slate-900 text-sm">USDT Cripto (Binance P2P)</h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">
                    P2P Cripto
                  </span>
                  {snapshot?.tasas.USDT_BINANCE?.es_manual && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                      Manual
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Libro P2P en Bolívares</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setEditingCodigo('USDT_BINANCE');
                  setNuevaTasaManual(String(tasaUsdtNum));
                }}
                title="Ajustar manualmente"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Edit3 size={14} />
              </button>
              {snapshot?.tasas.USDT_BINANCE?.es_manual && (
                <button
                  onClick={() => handleRestablecerAuto('USDT_BINANCE')}
                  title="Restablecer a automático"
                  className="text-[10px] text-amber-600 hover:underline font-bold px-1"
                >
                  Auto
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-slate-900" data-testid="valor-tasa-usdt">
                Bs. {tasaUsdtNum.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase">/ USDT</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-1">
              <span>Fuente: <strong>{snapshot?.tasas.USDT_BINANCE?.fuente || 'Binance P2P'}</strong></span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono font-bold text-slate-700">
                Brecha / Spread: +{snapshot?.spread_porcentaje || 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE EDICIÓN MANUAL */}
      {editingCodigo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900">
                Ajuste Manual: {editingCodigo === 'USD_BCV' ? 'Dólar Oficial (BCV)' : 'Binance USDT'}
              </h4>
              <button onClick={() => setEditingCodigo(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500">Nueva Tasa en Bolívares (Bs.)</label>
              <input
                type="number"
                step="0.01"
                value={nuevaTasaManual}
                onChange={e => setNuevaTasaManual(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCodigo(null)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarManual}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700"
              >
                Guardar Tasa Manual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIAL DE COTIZACIONES (ESTÁNDAR GEMINI.MD) ── */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-emerald-700" />
            <h4 className="text-sm font-black text-slate-900">Historial Reciente de Cotizaciones</h4>
          </div>

          {/* Filtros por categoría */}
          <div className="flex items-center gap-2 flex-wrap">
            <select aria-label="Filtrar por tipo" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer">
              <option value="">Todos los tipos</option>
              <option value="USD_BCV">USD (BCV)</option>
              <option value="USDT_BINANCE">USDT (Binance)</option>
            </select>
            <select aria-label="Filtrar por fuente" value={filtroFuente} onChange={e => setFiltroFuente(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer">
              <option value="">Todas las fuentes</option>
              {fuentes.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select aria-label="Filtrar por fecha" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer">
              <option value="">Todas las fechas</option>
              {fechas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {hayFiltros && (
              <button type="button" onClick={() => { setFiltroTipo(''); setFiltroFuente(''); setFiltroFecha(''); }}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors">
                <X size={12} aria-hidden="true" /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Tabla de Historial */}
        <div className="overflow-x-auto border border-slate-200/70 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black uppercase text-slate-500">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Tipo / Código</th>
                <th className="p-3">Cotización</th>
                <th className="p-3">Fuente</th>
                <th className="p-3">Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {historialFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400">
                    Ninguna cotización coincide con los filtros elegidos.
                  </td>
                </tr>
              ) : (
                historialFiltrado.slice(0, 15).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono">{item.fecha}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.codigo === 'USD_BCV' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                      }`}>
                        {item.codigo === 'USD_BCV' ? 'USD (BCV)' : 'USDT (Binance)'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      Bs. {item.tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-[11px] text-slate-500">{item.fuente}</td>
                    <td className="p-3 font-mono text-[10px] text-slate-400">
                      {item.creado_en ? new Date(item.creado_en).toLocaleTimeString('es-VE') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
