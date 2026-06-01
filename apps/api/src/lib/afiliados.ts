import { db } from './db.js';

/**
 * Busca el código numérico más alto en la tabla de afiliados y devuelve el siguiente.
 * Evita "rellenar huecos" y siempre sigue la secuencia a partir del último.
 */
export async function obtenerSiguienteCodigoAfiliado(): Promise<string> {
  const resultUltimoCode = await db.execute({
    sql: `SELECT codigo FROM afiliados 
          WHERE codigo GLOB '[0-9]*' 
          ORDER BY CAST(codigo AS INTEGER) DESC LIMIT 1`,
    args: []
  })

  let correlativo = 1
  if (resultUltimoCode.rows.length > 0 && resultUltimoCode.rows[0].codigo) {
    const lastCode = parseInt(resultUltimoCode.rows[0].codigo as string, 10)
    if (!isNaN(lastCode)) correlativo = lastCode + 1
  }
  return correlativo.toString()
}
