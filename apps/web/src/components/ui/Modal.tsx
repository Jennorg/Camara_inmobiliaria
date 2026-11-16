import { useLayoutEffect, useRef, type DialogHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { subirAvisos } from './CapaAvisos'

interface Props extends Omit<DialogHTMLAttributes<HTMLDialogElement>, 'open' | 'onClose' | 'onCancel'> {
  /** Se llama con Esc, con el gesto "atrás" del móvil o si el navegador cierra el diálogo. El padre lo desmonta. */
  onClose: () => void
  children: ReactNode
}

/**
 * Modal sobre <dialog> nativo abierto con showModal(): el navegador da la capa superior, el foco atrapado y devuelto al
 * cerrar, la página de fondo inerte y Esc. Se monta abierto: el padre lo renderiza solo mientras debe verse.
 * El <dialog> ocupa toda la pantalla y hace de fondo (className del overlay), así el clic en el fondo
 * sigue funcionando con `e.target === e.currentTarget` como antes.
 */
export default function Modal({ onClose, className, children, ...rest }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const cerrar = useRef(onClose)
  cerrar.current = onClose

  // Layout effect: su limpieza corre antes de que React quite el <dialog> del DOM, y close() devuelve el foco a quien lo abrió
  useLayoutEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    subirAvisos()
    return () => { if (d?.open) d.close() }
  }, [])

  return (
    <dialog
      ref={ref}
      {...rest}
      onCancel={e => { e.preventDefault(); cerrar.current() }}
      // Respaldo: Chrome puede ignorar preventDefault en Esc repetido y cerrar el diálogo por su cuenta.
      // Si al llegar el evento el diálogo vuelve a estar abierto es el close() de la limpieza de StrictMode: se ignora.
      onClose={() => { if (!ref.current?.open) cerrar.current() }}
      className={cn(
        'fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-transparent not-open:hidden',
        className,
      )}
    >
      {children}
    </dialog>
  )
}
