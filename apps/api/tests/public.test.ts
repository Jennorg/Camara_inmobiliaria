import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/index'

describe('Public Endpoints', () => {
  it('GET /api/public/afiliados/buscar - should return success', async () => {
    const res = await request(app).get('/api/public/afiliados/buscar')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /api/public/afiliados/buscar with tipo=V - should return success', async () => {
    const res = await request(app).get('/api/public/afiliados/buscar?q=123456&tipo=V')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /api/public/afiliados/buscar with tipo=J - should return success', async () => {
    const res = await request(app).get('/api/public/afiliados/buscar?q=12345678&tipo=J')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /api/public/cursos - should return success', async () => {
    const res = await request(app).get('/api/public/cursos')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /api/public/normativas - should return success', async () => {
    const res = await request(app).get('/api/public/normativas')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /api/public/paginas/inicio - should return page data or 404', async () => {
    const res = await request(app).get('/api/public/paginas/inicio')
    expect([200, 404]).toContain(res.status)
  })

  it('GET /api/public/afiliados/:id - should return member profile or 404', async () => {
    const res = await request(app).get('/api/public/afiliados/1001')
    expect([200, 404]).toContain(res.status)
  })
})
