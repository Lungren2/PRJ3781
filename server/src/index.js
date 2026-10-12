import { config } from './config.js'
import { startScheduler } from './crawl/scheduler.js'
import { createApp } from './app.js'
import { connectMongoDB } from './db/mongodb.js'

// Accounts, resumes and product requests are stored in MongoDB.
await connectMongoDB()

const app = createApp()

app.listen(config.port, () => {
  console.log(`[api] listening on http://127.0.0.1:${config.port}`)
  startScheduler()
})
