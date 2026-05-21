import { Link } from 'react-router-dom'

const TICKER_TEXT =
  '¿Eres agente inmobiliario? Afíliate a la Cámara Inmobiliaria de Bolívar'

/** Repeticiones por bloque: debe cubrir más que el ancho de la pantalla */
const COPIES_PER_BLOCK = 12

interface AffiliationTickerProps {
  darkMode: boolean
}

function TickerBlock({
  className,
  'aria-hidden': ariaHidden,
}: {
  className: string
  'aria-hidden'?: boolean
}) {
  return (
    <div className="flex shrink-0 flex-nowrap" aria-hidden={ariaHidden}>
      {Array.from({ length: COPIES_PER_BLOCK }, (_, i) => (
        <span
          key={i}
          className={`inline-flex shrink-0 items-center text-[9px] sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${className}`}
        >
          {TICKER_TEXT}
        </span>
      ))}
    </div>
  )
}

export default function AffiliationTicker({ darkMode }: AffiliationTickerProps) {
  const textClass = darkMode
    ? 'text-emerald-300 group-hover:text-emerald-200'
    : 'text-emerald-700 group-hover:text-emerald-800'

  return (
    <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
      <Link
        to="/afiliate"
        className={`group block w-full h-5 overflow-hidden border-t ${
          darkMode
            ? 'border-emerald-500/20 bg-emerald-950/60 hover:bg-emerald-900/50'
            : 'border-emerald-100 bg-emerald-50/90 hover:bg-emerald-100/90'
        } transition-colors`}
        aria-label="Afíliate a la Cámara Inmobiliaria de Bolívar"
      >
        {/* Dos bloques idénticos: al mover -50% el segundo ocupa el lugar del primero sin salto */}
        <div className="flex w-max flex-nowrap animate-affiliation-ticker will-change-transform">
          <TickerBlock className={textClass} />
          <TickerBlock className={textClass} aria-hidden />
        </div>
      </Link>
    </div>
  )
}
