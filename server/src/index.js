import { config } from './config.js'
import { startScheduler } from './crawl/scheduler.js'
import { createApp } from './app.js'

<<<<<<< HEAD
getDb()

const app = express()

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and tooling requests arrive without an Origin header.
      if (!origin || config.cors.origins.includes(origin)) return callback(null, true)
      return callback(new Error(`origin not allowed: ${origin}`))
    },
  }),
)

app.use('/api', router)

app.use((error, req, res, next) => {
  console.error('[api]', error.message)
  res.status(500).json({ error: 'internal error' })
})
=======
const app = createApp()
>>>>>>> origin/feat/auth-foundation

app.listen(config.port, () => {
  console.log(`[api] listening on http://127.0.0.1:${config.port}`)
  startScheduler()
})
