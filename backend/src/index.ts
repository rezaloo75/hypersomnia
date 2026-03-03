import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { relayRouter } from './routes/relay.js'
import { aiRouter } from './routes/ai.js'
import { importRouter } from './routes/importOpenapi.js'

const app = express()
const PORT = parseInt(process.env.PORT ?? '3001', 10)

// Middleware
// Allow localhost in dev and any Netlify deploy URL in production.
// Set ALLOWED_ORIGIN to your specific Netlify URL to lock it down further.
const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? [process.env.ALLOWED_ORIGIN]
  : null   // null = checked dynamically below

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin) return callback(null, true)
    if (allowedOrigins) return callback(null, allowedOrigins.includes(origin))
    // Dev: allow localhost; Production: allow any netlify.app subdomain
    const allowed =
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin)
    callback(null, allowed)
  },
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.text({ limit: '10mb' }))

// Basic request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// Routes
app.use('/api/relay', relayRouter)
app.use('/api/ai', aiRouter)
app.use('/api/import', importRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiEnabled: !!process.env.OPENAI_API_KEY,
  })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Hypersomnia backend running on http://localhost:${PORT}`)
  console.log(`AI assistant: ${process.env.OPENAI_API_KEY ? 'enabled' : 'disabled (set OPENAI_API_KEY)'}`)
})
