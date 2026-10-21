import React, { useEffect, useState } from 'react';
import { X, Search, Loader2, GraduationCap, AlertTriangle } from 'lucide-react';
import { API_URL } from '@/config/env';
import { formatDateLatina } from '@/utils/formatters';
import ModalCobroTaquilla, { type CursoPorCobrar } from './ModalCobroTaquilla';
import type { PagoDTO } from '@/types/pagos';

interface FilaPorCobrar extends CursoPorCobrar {
  id_estudiante: number;
  id_afiliado: number | null;
  estatus: string;
  reserva_vence_en: string | null;
  reserva_vencida: boolean;
  pago_pendiente: number;
  nombre: string | null;
  identificacion: string | null;
  email: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCobrado: (pago: PagoDTO) => void;
  authHeaders: Record<string, string>;
}

/** Inscripciones a cursos de pago sin pago verificado: la caja elige una y la cobra en taquilla. */
const ModalCursosPorCobrar: React.FC<Props> = ({ open, onClose, onCobrado, authHeaders }) => {
  const [q, setQ] = useState('');
  const [filas, setFilas] = useState<FilaPorCobrar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<FilaPorCobrar | null>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch(`${API_URL}/api/pagos/admin/cursos-por-cobrar?q=${encodeURIComponent(q)}`, { headers: authHeaders, signal: ctrl.signal })
        .then(r => r.json())
        .then(json => {
          if (!json.success) throw new Error(json.message);
          setFilas(json.data);
        })
        .catch(err => { if (err.name !== 'AbortError') setError(err.message || 'No se pudo cargar la lista'); })
        .finally(() => setLoading(false));
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [open, q, authHeaders]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-[#022c22]/60 backdrop-blur-sm overflow-y-auto">
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-cursos-por-cobrar" className="relative bg-white w-full max-w-2xl mx-auto rounded-[2rem] shadow-2xl overflow-hidden flex flex-col my-auto border border-emerald-100">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-emerald-600 text-white"><GraduationCap className="w-5 h-5" /></span>
              <div>
                <h3 id="titulo-cursos-por-cobrar" className="text-base font-black text-slate-900 uppercase tracking-tight">Cobrar Curso en Taquilla</h3>
                <p className="text-xs font-bold text-slate-500">Inscripciones a cursos de pago sin pago verificado</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-3">
            <label className="relative block">
              <span className="sr-only">Buscar por nombre, cédula, correo o curso</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                autoFocus
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Nombre, cédula, correo o curso…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>

            <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100" aria-live="polite">
              {loading && <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>}
              {!loading && error && <p className="p-4 text-sm text-red-600">{error}</p>}
              {!loading && !error && filas.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No hay cursos pendientes de cobro.</p>}
              {!loading && !error && filas.map(f => (
                <button
                  key={f.id_inscripcion}
                  type="button"
                  onClick={() => setSeleccion(f)}
                  className="w-full text-left p-3 hover:bg-emerald-50/60 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{f.nombre || 'Sin nombre'}</p>
                    <p className="text-xs text-slate-500 truncate">{f.identificacion} · {f.email}</p>
                    <p className="text-xs font-semibold text-emerald-700 truncate">{f.curso}</p>
                    {f.reserva_vencida ? (
                      <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Reserva vencida: solo se cobra si quedan cupos</p>
                    ) : f.reserva_vence_en ? (
                      <p className="text-[11px] text-slate-500">Reserva hasta {formatDateLatina(f.reserva_vence_en)}</p>
                    ) : null}
                    {!!f.pago_pendiente && <p className="text-[11px] font-semibold text-blue-700">Tiene un pago reportado por verificar</p>}
                  </div>
                  <span className="shrink-0 text-sm font-black tabular-nums text-slate-900">${(Number(f.monto_usd) || f.precio_actual).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {seleccion && (
        <ModalCobroTaquilla
          open
          onClose={() => setSeleccion(null)}
          onSuccess={(pago) => {
            setFilas(prev => prev.filter(f => f.id_inscripcion !== seleccion.id_inscripcion));
            onCobrado(pago);
          }}
          afiliadoId={seleccion.id_afiliado}
          afiliadoNombre={seleccion.nombre || 'Participante'}
          conceptoDefault="curso"
          cursoPorCobrar={seleccion}
          authHeaders={authHeaders}
        />
      )}
    </>
  );
};

export default ModalCursosPorCobrar;
