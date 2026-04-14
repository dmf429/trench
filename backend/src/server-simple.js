const express = require('express')
const cors = require('cors')
const http = require('http')

const app = express()
const server = http.createServer(app)

app.use(cors({ origin: process.env.FRONTEND_URL ?? '*' }))
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'TRENCH backend', ts: new Date().toISOString() })
})

app.get('/api/rooms', (req, res) => res.json({ rooms: [], total: 0 }))
app.get('/api/kols', (req, res) => res.json({ kols: [] }))

const PORT = process.env.PORT ?? 4000
server.listen(PORT, () => console.log(`TRENCH backend running on port ${PORT}`))
