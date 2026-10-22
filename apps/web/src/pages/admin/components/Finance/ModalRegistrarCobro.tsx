import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Banknote, AlertTriangle } from 'lucide-react';
import { API_URL } from '@/config/env';
import { formatDateLatina } from '@/utils/formatters';
import ModalCobroTaquilla, { type CursoPorCobrar } from './ModalCobroTaquilla';
import type { PagoDTO, TipoConceptoPago } from '@/types/pagos';

interface FilaCurso extends CursoPorCobrar {
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

interface Pagador {
  id_afiliado: number;
  codigo: string | null;
  tipo_afiliado: string;
  estatus: string;
  nombre: string;
  identificacion: string | null;
  formalizacion_pendiente: number;
  cibir_pendiente: number;
}

type Concepto = Extract<TipoConceptoPago, 'mensualidad' | 'formalizacion_afiliacion' | 'curso_cibir' | 'curso'>;

const CONCEPTOS: { id: Concepto; label: string }[] = [
  { id: 'mensualidad', label: 'Cuota de sostenimiento' },
  { id: 'formalizacion_afiliacion', label: 'Formalización de afiliación' },
  { id: 'curso_cibir', label: 'CIBIR' },
  { id: 'curso', label: 'Curso o taller' },
];

const CAMPOS = [
  { id: 'nombre', label: 'Nombre', placeholder: 'Nombre o razón social…' },
  { id: 'cedula', label: 'Cédula / RIF', placeholder: 'Número de cédula o RIF…' },
  { id: 'codigo', label: 'Código de afiliado', placeholder: 'Ej. CIEBO-0012…' },
] as const;

const CAMPO_CLASE = 'px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500';

interface Props {
  open: boolean;
  onClose: () => void;
  onCobrado: (pago: PagoDTO) => void;
  authHeaders: Record<string, string>;
}

/** Punto único de la caja para registrar un cobro físico: se elige qué se cobra y a quién, y se abre el formulario de taquilla. */
const ModalRegistrarCobro: React.FC<Props> = ({ open, onClose, onCobrado, authHeaders }) => {
  const [concepto, setConcepto] = useState<Concepto>('mensualidad');
  const [campo, setCampo] = useState<(typeof CAMPOS)[number]['id']>('nombre');
  const [q, setQ] = useState('');
  const [curso, setCurso] = useState('');
  const [pagadores, setPagadores] = useState<Pagador[]>([]);
  const [cursos, setCursos] = useState<FilaCurso[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagador, setPagador] = useState<Pagador | null>(null);
  const [inscripcion, setInscripcion] = useState<FilaCurso | null>(null);

  const esCurso = concepto === 'curso';

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const pedir = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = esCurso
          ? `${API_URL}/api/pagos/admin/cursos-por-cobrar`
          : `${API_URL}/api/pagos/admin/pagadores?campo=${campo}&q=${encodeURIComponent(q)}`;
        const json = await fetch(url, { headers: authHeaders, signal: ctrl.signal }).then(r => r.json());
        if (!json.success) throw new Error(json.message);
        if (esCurso) setCursos(json.data); else setPagadores(json.data);
      } catch (err: any) {
        if (err.name !== 'AbortError') setError(err.message || 'No se pudo cargar la lista');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    const t = setTimeout(pedir, esCurso ? 0 : 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [open, esCurso, campo, q, authHeaders]);

  const nombresCurso = useMemo(() => [...new Set(cursos.map(c => c.curso))].sort(), [cursos]);
  const cursosVisibles = cursos.filter(c => !curso || c.curso === curso);

  if (!open) return null;

  const cambiarConcepto = (c: Concepto) => {
    setConcepto(c);
    setQ('');
    setCurso('');
    setError(null);
  };

  const campoActual = CAMPOS.find(c => c.id === campo)!;

  return (
    <>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-[#022c22]/60 backdrop-blur-sm overflow-y-auto">
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-registrar-cobro" className="relative bg-white w-full max-w-2xl mx-auto rounded-[2rem] shadow-2xl overflow-hidden flex flex-col my-auto border border-emerald-100">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-emerald-600 text-white"><Banknote className="w-5 h-5" aria-hidden="true" /></span>
              <div>
                <h3 id="titulo-registrar-cobro" className="text-base font-black text-slate-900 uppercase tracking-tight">Registrar cobro</h3>
                <p className="text-xs font-bold text-slate-500">Pago recibido en taquilla: elige qué se cobra y a quién</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="p-6 space-y-3">
            <div className="flex flex-wrap gap-2">
              <select aria-label="Qué se cobra" value={concepto} onChange={e => cambiarConcepto(e.target.value as Concepto)} className={CAMPO_CLASE}>
                {CONCEPTOS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>

              {esCurso ? (
                <select aria-label="Filtrar por curso" value={curso} onChange={e => setCurso(e.target.value)} className={`${CAMPO_CLASE} min-w-0 flex-1`}>
                  <option value="">Todos los cursos</option>
                  {nombresCurso.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : (
                <>
                  <select aria-label="Buscar por" value={campo} onChange={e => setCampo(e.target.value as typeof campo)} className={CAMPO_CLASE}>
                    {CAMPOS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <input
                    type="search"
                    aria-label={`Buscar afiliado por ${campoActual.label.toLowerCase()}`}
                    autoFocus
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder={campoActual.placeholder}
                    className={`${CAMPO_CLASE} min-w-0 flex-1`}
                  />
                </>
              )}
            </div>

            <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100" aria-live="polite">
              {loading && <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" aria-label="Cargando" /></div>}
              {!loading && error && <p className="p-4 text-sm text-red-600">{error}</p>}

              {!loading && !error && esCurso && cursosVisibles.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No hay cursos pendientes de cobro.</p>}
              {!loading && !error && esCurso && cursosVisibles.map(f => (
                <button key={f.id_inscripcion} type="button" onClick={() => setInscripcion(f)}
                  className="w-full text-left p-3 hover:bg-emerald-50/60 transition-colors flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{f.nombre || 'Sin nombre'}</p>
                    <p className="text-xs text-slate-500 truncate">{f.identificacion} · {f.email}</p>
                    <p className="text-xs font-semibold text-emerald-700 truncate">{f.curso}</p>
                    {f.reserva_vencida ? (
                      <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" aria-hidden="true" /> Reserva vencida: solo se cobra si quedan cupos</p>
                    ) : f.reserva_vence_en ? (
                      <p className="text-[11px] text-slate-500">Reserva hasta {formatDateLatina(f.reserva_vence_en)}</p>
                    ) : null}
                    {!!f.pago_pendiente && <p className="text-[11px] font-semibold text-blue-700">Tiene un pago reportado por verificar</p>}
                  </div>
                  <span className="shrink-0 text-sm font-black tabular-nums text-slate-900">${(Number(f.monto_usd) || f.precio_actual).toFixed(2)}</span>
                </button>
              ))}

              {!loading && !error && !esCurso && q.trim().length < 2 && <p className="p-6 text-center text-sm text-slate-500">Escribe al menos 2 caracteres para buscar al afiliado.</p>}
              {!loading && !error && !esCurso && q.trim().length >= 2 && pagadores.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Ningún afiliado coincide.</p>}
              {!loading && !error && !esCurso && q.trim().length >= 2 && pagadores.map(p => (
                <button key={p.id_afiliado} type="button" onClick={() => setPagador(p)}
                  className="w-full text-left p-3 hover:bg-emerald-50/60 transition-colors flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{p.nombre || 'Sin nombre'}</p>
                    <p className="text-xs text-slate-500 truncate">{p.identificacion}{p.codigo ? ` · ${p.codigo}` : ''}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{p.estatus.replace(/^\d_/, '').replace('_', ' ')}</span>
                    {!!p.formalizacion_pendiente && <span className="text-[10px] font-bold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">Formalización pendiente</span>}
                    {!!p.cibir_pendiente && <span className="text-[10px] font-bold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">CIBIR pendiente</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {pagador && (
        <ModalCobroTaquilla
          open
          onClose={() => setPagador(null)}
          onSuccess={onCobrado}
          afiliadoId={pagador.id_afiliado}
          afiliadoNombre={pagador.nombre}
          afiliadoTipo={pagador.tipo_afiliado}
          conceptoDefault={concepto}
          authHeaders={authHeaders}
        />
      )}

      {inscripcion && (
        <ModalCobroTaquilla
          open
          onClose={() => setInscripcion(null)}
          onSuccess={(pago) => {
            setCursos(prev => prev.filter(f => f.id_inscripcion !== inscripcion.id_inscripcion));
            onCobrado(pago);
          }}
          afiliadoId={inscripcion.id_afiliado}
          afiliadoNombre={inscripcion.nombre || 'Participante'}
          conceptoDefault="curso"
          cursoPorCobrar={inscripcion}
          authHeaders={authHeaders}
        />
      )}
    </>
  );
};

export default ModalRegistrarCobro;
