import { useId, useRef } from 'react'
import { CalendarDays } from 'lucide-react'
import { formatDateLatinaMes } from '@/utils/formatters'

interface Props {
  /** AAAA-MM-DD o vacío */
  value: string
  onChange: (valor: string) => void
  id?: string
  required?: boolean
  min?: string
  max?: string
  disabled?: boolean
  placeholder?: string
  className?: string
}

/**
 * Campo de fecha que se muestra en formato latino DD/mmm/AA (22/oct/26) y abre el calendario nativo al pulsarlo.
 * El valor que entrega sigue siendo AAAA-MM-DD, así que no cambia lo que espera la API.
 */
export default function DateInput({ value, onChange, id, required, min, max, disabled, placeholder = 'dd/mmm/aa', className = '' }: Props) {
  const nativo = useRef<HTMLInputElement>(null)
  const generado = useId()
  const idCampo = id ?? generado
  const texto = value ? formatDateLatinaMes(value.slice(0, 10)) : ''
  // Sin showPicker (navegadores antiguos) el input nativo queda encima y recibe el clic directamente
  const soportaPicker = typeof HTMLInputElement !== 'undefined' && 'showPicker' in HTMLInputElement.prototype

  return (
    <div className="relative">
      <button
        type="button"
        id={idCampo}
        disabled={disabled}
        onClick={() => { try { nativo.current?.showPicker?.() } catch { nativo.current?.focus() } }}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
      >
        <span className={texto ? 'text-slate-900' : 'text-slate-400'}>{texto || placeholder}</span>
        <CalendarDays size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
      </button>
      <input
        ref={nativo}
        type="date"
        value={value ? value.slice(0, 10) : ''}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => onChange(e.target.value)}
        className={`absolute inset-0 h-full w-full opacity-0 ${soportaPicker ? 'pointer-events-none' : 'cursor-pointer'}`}
      />
    </div>
  )
}
