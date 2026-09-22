import { config } from './config.js'
import { startScheduler } from './crawl/scheduler.js'
import { createApp } from './app.js'

const app = createApp()

app.listen(config.port, () => {
  console.log(`[api] listening on http://127.0.0.1:${config.port}`)
  startScheduler()
})
