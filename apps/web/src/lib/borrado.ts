import Swal from 'sweetalert2'

export type ModoBorrado = 'logico' | 'definitivo'

/**
 * Todos los roles eliminan de forma lógica (se puede restaurar desde la papelera). El súper administrador elige:
 * enviar a la papelera o eliminar definitivamente. Devuelve null si cancela.
 */
export async function elegirModoBorrado(esSuperAdmin: boolean): Promise<ModoBorrado | null> {
  if (!esSuperAdmin) return 'logico'
  const r = await Swal.fire({
    title: '¿Cómo quieres eliminarlo?',
    html: 'En la <b>papelera</b> se puede restaurar. El borrado <b>definitivo</b> no se puede deshacer.',
    icon: 'question',
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: 'Enviar a la papelera',
    denyButtonText: 'Eliminar definitivamente',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#059669',
    denyButtonColor: '#334155',
    cancelButtonColor: '#64748B',
  })
  return r.isConfirmed ? 'logico' : r.isDenied ? 'definitivo' : null
}

/** Agrega ?definitivo=true a la ruta cuando corresponde. */
export const conModo = (ruta: string, modo: ModoBorrado) => (modo === 'definitivo' ? `${ruta}${ruta.includes('?') ? '&' : '?'}definitivo=true` : ruta)
