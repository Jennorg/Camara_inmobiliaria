import { Check, CalendarPlus, X } from 'lucide-react';

export interface MesPagable {
  periodo: string; // AAAA-MM
  estado: 'deuda' | 'por_pagar' | 'futuro';
}

interface Props {
  lista: MesPagable[];
  /** Cantidad de meses seleccionados, siempre desde el primero de la lista */
  meses: number;
  onChange: (meses: number) => void;
}

export const sumarMeses = (ym: string, n: number) =>
  new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7);

/**
 * Meses que se pueden pagar: la racha de meses impagos desde el más antiguo y, a continuación, adelantos hasta
 * diciembre del año siguiente (máx. 36, el tope del backend).
 * shortcut: si un mes en revisión interrumpe la racha, la deuda posterior se paga en un reporte aparte, al verificarse.
 */
export function mesesPagables(mesesSolv: { periodo: string; estado: string }[]): MesPagable[] {
  const impago = (e: string) => e === 'deuda' || e === 'por_pagar';
  const out: MesPagable[] = [];
  let i = mesesSolv.findIndex(m => impago(m.estado));
  if (i >= 0) {
    for (; i < mesesSolv.length && impago(mesesSolv[i].estado); i++) out.push({ periodo: mesesSolv[i].periodo, estado: mesesSolv[i].estado as 'deuda' | 'por_pagar' });
    if (i < mesesSolv.length) return out;
  }
  let sig = mesesSolv.length ? sumarMeses(mesesSolv[mesesSolv.length - 1].periodo, 1) : new Date().toISOString().slice(0, 7);
  const limite = `${new Date().getFullYear() + 1}-12`;
  while (out.length < 36 && sig <= limite) { out.push({ periodo: sig, estado: 'futuro' }); sig = sumarMeses(sig, 1); }
  return out;
}

const fecha = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1);
const mesCorto = (ym: string) => fecha(ym).toLocaleDateString('es-VE', { month: 'short' }).replace('.', '');
const mesLargo = (ym: string) => fecha(ym).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });

/**
 * Calendario de pago: el pago se aplica siempre desde el mes pendiente más antiguo, así que al tocar
 * un mes se seleccionan también todos los anteriores; tocar el último seleccionado lo quita.
 */
export default function SelectorMesesPago({ lista, meses, onChange }: Props) {
  if (lista.length === 0) return null;
  const deudas = lista.filter(m => m.estado === 'deuda').length;
  const sel = lista.slice(0, meses);
  const anios = [...new Set(lista.map(m => m.periodo.slice(0, 4)))];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700">Elige hasta qué mes vas a pagar</span>
        <div className="flex flex-wrap gap-1.5">
          {deudas > 0 && (
            <button type="button" onClick={() => onChange(deudas)} aria-pressed={meses === deudas}
              className="px-2.5 py-1 rounded-full border border-red-200 bg-red-50 text-[11px] font-bold text-red-700 hover:bg-red-100 transition-colors">
              Toda la deuda ({deudas})
            </button>
          )}
          {meses > 0 && (
            <button type="button" onClick={() => onChange(0)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
              <X size={11} aria-hidden="true" /> Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
        {anios.map(anio => (
          <div key={anio}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[11px] font-black tracking-[0.2em] text-slate-500">{anio}</span>
              <span aria-hidden className="h-px flex-1 bg-slate-200" />
            </div>
            <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {lista.map((m, i) => {
                if (!m.periodo.startsWith(anio)) return null;
                const on = i < meses;
                const ultimo = i === meses - 1;
                const base = on
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : m.estado === 'deuda'
                  ? 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100'
                  : m.estado === 'futuro'
                  ? 'bg-white border-dashed border-slate-300 text-slate-700 hover:border-emerald-500 hover:bg-emerald-50'
                  : 'bg-white border-slate-300 text-slate-800 hover:border-emerald-500 hover:bg-emerald-50';
                return (
                  <li key={m.periodo}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`${mesLargo(m.periodo)}${m.estado === 'deuda' ? ', vencido' : m.estado === 'futuro' ? ', por adelantado' : ''}`}
                      onClick={() => onChange(ultimo ? i : i + 1)}
                      className={`relative w-full rounded-xl border-2 px-2 py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${base}`}
                    >
                      <span className="block text-sm font-black uppercase leading-none tracking-tight">{mesCorto(m.periodo)}</span>
                      <span className={`mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold leading-none ${on ? 'text-emerald-50' : 'text-slate-600'}`}>
                        {on ? <><Check size={11} aria-hidden="true" /> Incluido</>
                          : m.estado === 'deuda' ? 'Vencido'
                          : m.estado === 'futuro' ? <><CalendarPlus size={11} aria-hidden="true" /> Adelanto</>
                          : 'Mes actual'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p role="status" className="text-xs font-semibold text-slate-700 min-h-4">
        {sel.length > 0
          ? <>Pagarás <strong className="tabular-nums">{sel.length}</strong> {sel.length === 1 ? 'mes' : 'meses'}: {mesLargo(sel[0].periodo)}{sel.length > 1 && <> → {mesLargo(sel[sel.length - 1].periodo)}</>}</>
          : <span className="text-slate-500">Toca un mes para empezar. Se incluyen todos los anteriores, porque el pago cubre primero tu deuda más antigua.</span>}
      </p>
    </div>
  );
}
