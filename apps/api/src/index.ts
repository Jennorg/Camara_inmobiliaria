import express, { Request, Response } from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { afiliadosRoutes, publicRoutes, cmsRoutes, uploadsRoutes, authRoutes, usersRoutes, academiaRoutes } from './routes/index.js'


const app = express()

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sin Origin (curl, server-to-server, Postman)
    if (!origin) return callback(null, true)
    // En dev permitimos todo para no bloquear el DX
    if (env.NODE_ENV !== 'production') return callback(null, true)

    const allowed = env.CORS_ORIGINS.includes(origin)
    return callback(allowed ? null : new Error('Not allowed by CORS'), allowed)
  },
  credentials: true,
}))
app.use(express.json())

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
