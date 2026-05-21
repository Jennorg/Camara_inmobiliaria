import express, { Request, Response } from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { isOriginAllowed } from './lib/cors.js'
import { afiliadosRoutes, publicRoutes, cmsRoutes, uploadsRoutes, authRoutes, usersRoutes, academiaRoutes } from './routes/index.js'


const app = express()

// Normaliza paths con doble barra (evita 308 en Vercel sin cabeceras CORS)
app.use((req, _res, next) => {
  const q = req.url.indexOf('?')
  const path = q === -1 ? req.url : req.url.slice(0, q)
  const query = q === -1 ? '' : req.url.slice(q)
  const cleaned = path.replace(/\/{2,}/g, '/')
  if (cleaned !== path) req.url = cleaned + query
  next()
})

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (env.NODE_ENV !== 'production') return callback(null, true)

    if (isOriginAllowed(origin)) return callback(null, true)

    console.warn(`[CORS] Origin bloqueado: ${origin} | Permitidos: ${env.CORS_ORIGINS.join(', ')}`)
    return callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

app.use(corsMiddleware)
app.use(express.json())
app.options('{*path}', corsMiddleware)

// Rutas de API
app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/afiliados', afiliadosRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/cms', cmsRoutes)
app.use('/api/cms/uploads', uploadsRoutes)
app.use('/api/academia', academiaRoutes)

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
