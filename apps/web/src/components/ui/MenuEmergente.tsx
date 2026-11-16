import { useCallback, useLayoutEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react'
import { cn } from '@/lib/utils'

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Clic fuera del menú y de su contenedor, o Escape */
  onClose: () => void
  /** Abre hacia abajo (por defecto) o hacia arriba del contenedor */
  lado?: 'abajo' | 'arriba'
  /** Alinea el borde izquierdo (inicio) o derecho (fin) con el del contenedor */
  alinear?: 'inicio' | 'fin'
  /** Mismo ancho que el contenedor */
  anchoCompleto?: boolean
  /** Separación con el contenedor, en px */
  separacion?: number
  /** React 19: el ref llega como prop; se combina con el interno */
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}

/**
 * Menú desplegable en la capa superior (popover manual): no lo recortan los contenedores con overflow y funciona dentro de
 * los modales <dialog>. Se ancla al elemento padre del lugar donde se renderiza (el contenedor `relative` del botón).
 * El posicionamiento por CSS (anchor positioning) aún no llega a Chrome ni Firefox, así que se calcula con
 * getBoundingClientRect y se actualiza con el scroll y el redimensionado.
 * Se monta abierto: el padre lo renderiza solo mientras debe verse.
 */
export default function MenuEmergente({ onClose, lado = 'abajo', alinear = 'inicio', anchoCompleto, separacion = 4, className, style, ref, children, ...rest }: Props) {
  const marca = useRef<HTMLSpanElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const cerrar = useRef(onClose)
  cerrar.current = onClose

  const colocar = useCallback(() => {
    const ancla = marca.current?.parentElement, el = menu.current
    if (!ancla || !el) return
    const r = ancla.getBoundingClientRect()
    el.style.top = lado === 'abajo' ? `${r.bottom + separacion}px` : 'auto'
    el.style.bottom = lado === 'arriba' ? `${window.innerHeight - r.top + separacion}px` : 'auto'
    el.style.left = alinear === 'inicio' ? `${r.left}px` : 'auto'
    el.style.right = alinear === 'fin' ? `${document.documentElement.clientWidth - r.right}px` : 'auto'
    if (anchoCompleto) el.style.width = `${r.width}px`
  }, [lado, alinear, anchoCompleto, separacion])

  useLayoutEffect(() => {
    const el = menu.current, ancla = marca.current?.parentElement
    if (!el) return
    if (!el.matches(':popover-open')) el.showPopover()
    colocar()
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node
      if (!el.contains(t) && !ancla?.contains(t)) cerrar.current()
    }
    // Captura: Escape cierra el menú y no llega a cerrar el modal que lo contiene
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar.current() } }
    document.addEventListener('pointerdown', fuera, true)
    document.addEventListener('keydown', tecla, true)
    window.addEventListener('scroll', colocar, true)
    window.addEventListener('resize', colocar)
    return () => {
      document.removeEventListener('pointerdown', fuera, true)
      document.removeEventListener('keydown', tecla, true)
      window.removeEventListener('scroll', colocar, true)
      window.removeEventListener('resize', colocar)
      if (el.matches(':popover-open')) el.hidePopover()
    }
  }, [colocar])

  // w-min por defecto: con max-content las opciones inline-block se sumarían en una sola línea. Cada menú trae su min-w/w-*.
  return (
    <>
      <span ref={marca} hidden />
      <div
        ref={el => {
          menu.current = el
          if (typeof ref === 'function') ref(el)
          else if (ref) ref.current = el
        }}
        popover="manual"
        {...rest}
        style={{ position: 'fixed', inset: 'auto', ...style } as CSSProperties}
        className={cn('m-0 w-min overflow-visible border-0 p-0', className)}
      >
        {children}
      </div>
    </>
  )
}
