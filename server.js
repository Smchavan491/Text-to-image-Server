import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './config/mongodb.js'
import userRouter from './routes/userRoutes.js'
import imageRouter from './routes/imageRoutes.js'

const PORT = process.env.PORT || 4000
const app = express()

// List of allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL // e.g., https://text-to-image-client-alpha.vercel.app
]

app.use(express.json())

// CORS middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like Postman, server-to-server)
    if (!origin) return callback(null, true)

    // Check if the request origin is in allowedOrigins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    } else {
      return callback(new Error('CORS policy: This origin is not allowed'))
    }
  },
  credentials: true
}))

// Connect to MongoDB
await connectDB()

// Routes
app.use('/api/user', userRouter)
app.use('/api/image', imageRouter)

// Health check / root endpoint
app.get('/', (req, res) => res.send("API Working fine"))

// Start server
app.listen(PORT, () => console.log(`Server Running On PORT ${PORT}`))
