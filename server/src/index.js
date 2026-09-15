import { config } from './config.js'
import { startScheduler } from './crawl/scheduler.js'
import { createApp } from './app.js'
import { connectMongoDB } from './db/mongodb.js'
import { productRouter } from './routes/productRequests.js'

// Connect to MongoDB for the new product requests feature
await connectMongoDB()

// Initialize the Express app with auth, CORS, and base routes
const app = createApp()

// Attach the new product requests routes
app.use('/api', productRouter)

app.listen(config.port, () => {
  console.log(`[api] listening on http://127.0.0.1:${config.port}`)
  startScheduler()
})