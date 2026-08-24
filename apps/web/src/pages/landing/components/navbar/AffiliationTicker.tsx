import { Link } from 'react-router-dom'

const TICKER_TEXT =
  '¿Eres agente inmobiliario? Afíliate a la Cámara Inmobiliaria del Estado Bolívar'

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
      {Array.from({ length: COPIES_PER_BLOCK }, (_, copyIdx) => (
        <span
          key={`ticker-copy-${copyIdx}`}
          className={`inline-flex shrink-0 items-center px-12 sm:px-16 text-xs sm:text-sm font-semibold uppercase tracking-widest whitespace-nowrap ${className}`}
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
    <div className="w-full">
      <Link
        to="/afiliate"
        className={`group flex items-center w-full h-10 sm:h-12 overflow-hidden border-t ${
          darkMode
            ? 'border-emerald-500/20 bg-emerald-950/60 hover:bg-emerald-900/50'
            : 'border-emerald-100 bg-emerald-50/90 hover:bg-emerald-100/90'
        } transition-colors`}
        aria-label="Afíliate a la Cámara Inmobiliaria de Bolívar"
      >
        {/* Dos bloques idénticos: al mover -50% el segundo ocupa el lugar del primero sin salto */}
        <div className="flex w-max flex-nowrap animate-affiliation-ticker">
          <TickerBlock className={textClass} />
          <TickerBlock className={textClass} aria-hidden />
        </div>
      </Link>
    </div>
  )
}
