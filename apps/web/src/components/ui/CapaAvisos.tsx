import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Contenedor de toasts en la capa superior (popover manual). Un modal <dialog> abierto tapa todo lo que no esté en esa capa,
 * así que sin esto los avisos lanzados desde un modal quedarían ocultos detrás de él.
 */
export default function CapaAvisos({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el && !el.matches(':popover-open')) el.showPopover()
  }, [])
  return (
    <div ref={ref} popover="manual" data-capa-avisos=""
      className="pointer-events-none m-0 h-0 w-0 overflow-visible border-0 bg-transparent p-0 [&>*]:pointer-events-auto">
      {children}
    </div>
  )
}

/** Vuelve a poner los avisos encima de todo: la capa superior se apila por orden de apertura. Lo llama cada Modal al abrirse. */
export function subirAvisos() {
  document.querySelectorAll<HTMLElement>('[data-capa-avisos]').forEach(el => {
    if (el.matches(':popover-open')) el.hidePopover()
    el.showPopover()
  })
}
