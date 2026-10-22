import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  src: string
  alt: string
  /** Clases de la imagen (p. ej. `object-cover` o `object-contain p-1`) */
  className?: string
  /** Silueta tenue que se ve bajo el esqueleto mientras carga la imagen */
  silueta?: ReactNode
  /** Qué mostrar si la imagen no carga (p. ej. las iniciales); sin él, queda el esqueleto quieto */
  alternativa?: ReactNode
  /** Foto principal visible al abrir la vista: pide al navegador que la cargue primero */
  prioritaria?: boolean
}

/**
 * Imagen que llena su contenedor con un esqueleto mientras carga y un fundido al aparecer, para que el recuadro
 * no se quede vacío ni la foto "salte". Si falla, muestra `alternativa`. Se vuelve a montar con otro `src`
 * (úsala con `key={src}` si cambia con el mismo componente en pantalla).
 */
export default function ImagenConSkeleton({ src, alt, className = '', silueta, alternativa, prioritaria = false }: Props) {
  const [estado, setEstado] = useState<'cargando' | 'lista' | 'error'>('cargando')
  const img = useRef<HTMLImageElement>(null)

  // Una imagen ya en caché puede estar completa antes de que React enganche `onLoad`
  useEffect(() => {
    const el = img.current
    if (el?.complete) setEstado(el.naturalWidth > 0 ? 'lista' : 'error')
  }, [])

  if (estado === 'error' && alternativa) return <>{alternativa}</>

  return (
    <span className="relative block h-full w-full">
      {estado !== 'lista' && (
        <span
          role={estado === 'cargando' ? 'status' : undefined}
          aria-label={estado === 'cargando' ? 'Cargando imagen' : undefined}
          className="absolute inset-0 flex items-center justify-center overflow-hidden bg-slate-200 text-slate-300"
        >
          {estado === 'cargando' && (
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent motion-safe:animate-[brillo-skeleton_1.4s_ease-in-out_infinite]" aria-hidden="true" />
          )}
          <span aria-hidden="true" className="relative">{silueta}</span>
        </span>
      )}
      <img
        ref={img}
        src={src}
        alt={alt}
        decoding="async"
        fetchPriority={prioritaria ? 'high' : undefined}
        onLoad={() => setEstado('lista')}
        onError={() => setEstado('error')}
        className={`${className} h-full w-full transition-opacity duration-300 motion-reduce:transition-none ${estado === 'lista' ? 'opacity-100' : 'opacity-0'}`}
      />
    </span>
  )
}
