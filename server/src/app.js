import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { optionalAuth } from './auth/middleware.js'
import { createAuthRouter } from './routes/auth.js'
import { router as certificationsRouter } from './routes/certifications.js'
import { workspaceRouter } from './routes/workspaces.js'
import { resumeRouter } from './routes/resume.js'
import { productRouter } from './routes/productRequests.js'
import { jobsRouter } from './routes/jobs.js'
import { portfolioRouter } from './routes/portfolio.js'
import { sendEmail } from './auth/mail.js'
import { teamRouter } from './routes/team.js'

export function createApp({ sendMail = sendEmail } = {}) {
  const app = express()
  app.locals.sendMail = sendMail
  app.disable('x-powered-by')
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        // Same-origin and tooling requests arrive without an Origin header.
        if (!origin || config.cors.origins.includes(origin)) return callback(null, true)
        return callback(new Error(`origin not allowed: ${origin}`))
      },
    }),
  )
  app.use(express.json({ limit: '32kb' }))
  app.use(optionalAuth)
  app.use('/api/auth', createAuthRouter())
  app.use('/api', teamRouter)
  app.use('/api', resumeRouter)
  app.use('/api', workspaceRouter)
  app.use('/api', certificationsRouter)
  app.use('/api', productRouter)
  app.use('/api', jobsRouter)
  app.use('/api', portfolioRouter)

  app.use((error, req, res, next) => {
    console.error('[api]', error.message)
    if (res.headersSent) return res.destroy()
    res.status(500).json({ error: 'internal error' })
  })
  return app
}
