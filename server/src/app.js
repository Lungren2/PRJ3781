import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { getDb } from './db/index.js'
import { optionalAuth } from './auth/middleware.js'
import { seedDemoAccounts } from './auth/repository.js'
import { createEntraProvider } from './auth/entra.js'
import { createAuthRouter } from './routes/auth.js'
import { router as certificationsRouter } from './routes/certifications.js'
import { workspaceRouter } from './routes/workspaces.js'

export function createApp({ entraProvider = createEntraProvider(config.auth.entra) } = {}) {
  getDb()
  seedDemoAccounts()

  const app = express()
  app.disable('x-powered-by')
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      // Same-origin and tooling requests arrive without an Origin header.
      if (!origin || config.cors.origins.includes(origin)) return callback(null, true)
      return callback(new Error(`origin not allowed: ${origin}`))
    },
  }))
  app.use(express.json({ limit: '32kb' }))
  app.use(optionalAuth)
  app.use('/api/auth', createAuthRouter({ entraProvider }))
  app.use('/api', workspaceRouter)
  app.use('/api', certificationsRouter)

  app.use((error, req, res, next) => {
    console.error('[api]', error.message)
    res.status(500).json({ error: 'internal error' })
  })
  return app
}
