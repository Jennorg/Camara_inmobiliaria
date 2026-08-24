import express, { Request, Response } from 'express'
import { env } from './config/env.js'
import { isOriginAllowed, corsMiddleware } from './lib/cors.js'
import { afiliadosRoutes, publicRoutes, cmsRoutes, uploadsRoutes, authRoutes, usersRoutes, academiaRoutes, notificationsRoutes, analyticsRoutes } from './routes/index.js'


const app = express() // v1.0.3

// Normaliza paths con doble barra (evita 308 en Vercel sin cabeceras CORS)
app.use((req, _res, next) => {
  const q = req.url.indexOf('?')
  const path = q === -1 ? req.url : req.url.slice(0, q)
  const query = q === -1 ? '' : req.url.slice(q)
  const cleaned = path.replace(/\/{2,}/g, '/')
  if (cleaned !== path) req.url = cleaned + query
  next()
})

app.use(corsMiddleware)
app.use(express.json())

// ── Debug: endpoint para diagnosticar CORS desde producción ──────────
app.get('/api/cors-check', (req, res) => {
  const origin = req.headers.origin || '(sin-origin)'
  res.json({
    ok: true,
    origin,
    allowed_origin: isOriginAllowed(origin),
    allowed: env.CORS_ORIGINS,
    app_url: env.APP_URL,
    node_env: env.NODE_ENV,
    request_host: req.headers.host,
  })
})

// Rutas de API
app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/afiliados', afiliadosRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/cms', cmsRoutes)
app.use('/api/cms/uploads', uploadsRoutes)
app.use('/api/academia', academiaRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/analytics', analyticsRoutes)

// Rutas base
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'API de Cámara Inmobiliaria en línea' })
})

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app

// Solo escuchar si no estamos en un entorno serverless (Vercel)
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(env.PORT, () => {
    console.log(`API ejecutándose en http://localhost:${env.PORT}`)
  })
}
