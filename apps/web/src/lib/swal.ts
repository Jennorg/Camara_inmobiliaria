import SwalBase, { type SweetAlertOptions } from 'sweetalert2'

/**
 * SweetAlert compatible con los modales <dialog> nativos. Importar siempre desde aquí, no desde 'sweetalert2'.
 * - topLayer: la alerta va en la capa superior, encima del modal abierto.
 * - target: se crea dentro del último modal abierto. Un <dialog> modal vuelve inerte todo lo que está fuera de él,
 *   así que una alerta colgada de <body> se vería pero no recibiría clics.
 */
const Swal = SwalBase.mixin({ topLayer: true })

const modalAbierto = (): HTMLElement | undefined => [...document.querySelectorAll<HTMLElement>('dialog:modal')].at(-1)

const fireOriginal = Swal.fire.bind(Swal)
Swal.fire = ((...args: unknown[]) => {
  const opciones: SweetAlertOptions = typeof args[0] === 'object' && args[0] !== null
    ? (args[0] as SweetAlertOptions)
    : { title: args[0] as string | undefined, html: args[1] as string | undefined, icon: args[2] as SweetAlertOptions['icon'] }
  return fireOriginal({ target: modalAbierto() ?? 'body', ...opciones })
}) as typeof Swal.fire

export default Swal
