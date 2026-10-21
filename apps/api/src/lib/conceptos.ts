/** Conceptos de ingreso para reportes (libro de ventas, ingresos por concepto). */
export const CONCEPTOS_REPORTE = ['mensualidad', 'afiliacion', 'cibir', 'preani', 'pegi', 'padi', 'curso', 'otros'] as const
export type ConceptoReporte = (typeof CONCEPTOS_REPORTE)[number]

export const ETIQUETA_CONCEPTO: Record<ConceptoReporte, string> = {
  mensualidad: 'Mensualidades',
  afiliacion: 'Afiliación',
  cibir: 'CIBIR',
  preani: 'PREANI',
  pegi: 'PEGI',
  padi: 'PADI',
  curso: 'Cursos',
  otros: 'Otros',
}

/** Agrupa un pago por su tipo y arancel. La formalización (inscripción + 1ª mensualidad) cuenta como afiliación. */
export function conceptoReporte(tipoConcepto: string | null, codigoArancel: string | null): ConceptoReporte {
  if (tipoConcepto === 'mensualidad') return 'mensualidad'
  if (tipoConcepto === 'formalizacion_afiliacion' || codigoArancel?.startsWith('inscripcion_')) return 'afiliacion'
  if (tipoConcepto === 'curso_cibir' || codigoArancel === 'curso_cibir') return 'cibir'
  if (codigoArancel === 'programa_preani') return 'preani'
  if (codigoArancel === 'programa_pegi') return 'pegi'
  if (codigoArancel === 'programa_padi') return 'padi'
  if (tipoConcepto === 'curso') return 'curso'
  return 'otros'
}

/** Tramo de antigüedad de una deuda según los días vencidos. */
export function tramoAntiguedad(dias: number): '0-30' | '31-60' | '61-90' | '90+' {
  if (dias <= 30) return '0-30'
  if (dias <= 60) return '31-60'
  if (dias <= 90) return '61-90'
  return '90+'
}
