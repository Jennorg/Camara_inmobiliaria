import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db.js', () => ({ db: { execute: vi.fn() } }))
const { validarArancelAnual } = await import('./pagos.service.js')

describe('validarArancelAnual', () => {
  it('acepta un monto menor a 12 cuotas con fecha límite', () => {
    expect(validarArancelAnual(50, '2027-01-31', 5)).toBeNull()
  })
  it('rechaza 12 cuotas o más, monto 0 y fechas inválidas', () => {
    expect(validarArancelAnual(60, '2027-01-31', 5)).toMatch(/menor a 12 cuotas/)
    expect(validarArancelAnual(0, '2027-01-31', 5)).toMatch(/mayor a 0/)
    expect(validarArancelAnual(50, '', 5)).toMatch(/fecha límite/)
    expect(validarArancelAnual(50, undefined, 5)).toMatch(/fecha límite/)
  })
})
