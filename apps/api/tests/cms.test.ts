import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/index'

describe('CMS Admin Endpoints', () => {
  let token: string

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@admin.com',
        password: 'admin12'
      })
    token = res.body.token
  })

  it('GET /api/cms/noticias - should return success (public)', async () => {
    const res = await request(app).get('/api/cms/noticias')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
  })

  it('POST /api/cms/noticias - should return 401 without token', async () => {
    const res = await request(app)
      .post('/api/cms/noticias')
      .send({ titulo: 'Test', extracto: 'Test' })
    expect(res.status).toBe(401)
  })

  it('POST /api/cms/noticias - should return success with token', async () => {
    const res = await request(app)
      .post('/api/cms/noticias')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titulo: 'Noticia de Prueba',
        contenido: 'Esta es una noticia de prueba generada por el test.',
        publicado: 0
      })
    
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    
    // Cleanup
    const id = res.body.data.id
    await request(app)
      .delete(`/api/cms/noticias/${id}`)
      .set('Authorization', `Bearer ${token}`)
  })
})
