const express = require('express')
const cors = require('cors')
const http = require('http')

const app = express()
const server = http.createServer(app)

app.use(cors({ origin: '*' }))
app.use(express.json())

app.get('/', (req, res) => res.json({ service: 'TRENCH', status: 'ok' }))
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'TRENCH backend', ts: new Date().toISOString() }))
app.get('/api/rooms', (req, res) => res.json({ rooms: [], total: 0 }))
app.get('/api/kols', (req, res) => res.json({ kols: [] }))

const PORT = parseInt(process.env.PORT) || 3000
server.listen(PORT, '0.0.0.0', () => console.log(`TRENCH backend running on port ${PORT}`))
