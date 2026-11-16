import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db.js', () => ({ db: { execute: vi.fn() } }))
const { repartoAnual } = await import('./cuotas-importadas.service.js')

describe('repartoAnual', () => {
  it('reparte el monto anual en 12 cuotas que suman exacto', () => {
    const r = repartoAnual(100)
    expect(r).toHaveLength(12)
    expect(r.slice(0, 11).every(m => m === 8.33)).toBe(true)
    expect(r[11]).toBe(8.37)
    expect(Math.round(r.reduce((a, b) => a + b, 0) * 100)).toBe(10000)
  })
})
