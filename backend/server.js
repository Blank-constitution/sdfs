import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { configureOrchestrator, getOrchestratorState, toggleLive } from '../src/core/services/orchestrator.js';
import { getRiskState, setKillSwitch } from '../src/core/riskManager.js';
import { EVENTS, on } from '../src/core/eventBus.js';
import { registerStrategy, listStrategies } from '../src/core/strategyRegistry.js';
import { fetchRealMarketData } from '../src/marketDataService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.BOT_SERVER_PORT || 5055;
const app = express();
app.use(cors());
app.use(express.json());

// Simple in-memory clients
let wsClients = new Set();

function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload });
  wsClients.forEach(ws => {
    try { ws.send(msg); } catch {}
  });
}

// EventBus → WebSocket bridge
[
  EVENTS.MARKET_SNAPSHOT,
  EVENTS.STRATEGY_SIGNAL,
  EVENTS.ORDER_EXECUTED,
  EVENTS.ORDER_ERROR,
  EVENTS.RISK_BLOCK,
  EVENTS.HEARTBEAT,
  EVENTS.KILL_SWITCH,
  EVENTS.SYSTEM_STATUS
].forEach(evt => on(evt, data => broadcast(evt, data)));

// Security configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2a$10$XvQhbx1ahzxNnFyjHLwDQO/z8SlT.8ZSQdLzEKiQnx9xd3.fHxcHa'; // Default: "admin"

// User roles and permissions
const ROLES = {
  ADMIN: 'admin',     // Full access
  TRADER: 'trader',   // Can execute trades, change strategy settings
  VIEWER: 'viewer'    // Read-only access to data and signals
};

const PERMISSIONS = {
  [ROLES.ADMIN]: ['read', 'write', 'execute', 'system'],
  [ROLES.TRADER]: ['read', 'write', 'execute'],
  [ROLES.VIEWER]: ['read']
};

// In-memory user database (replace with proper DB in production)
const users = [
  { username: 'admin', passwordHash: ADMIN_PASSWORD_HASH, role: ROLES.ADMIN },
  // Add more users as needed
];

// Security middleware
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function authorize(permission) {
  return (req, res, next) => {
    const userRole = req.user.role;
    const userPermissions = PERMISSIONS[userRole] || [];
    
    if (userPermissions.includes(permission)) {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
}

// Use more secure CORS options
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign({ 
    username, 
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
  }, JWT_SECRET);
  
  res.json({ token, username, role: user.role });
});

// User management (admin only)
app.post('/api/users', authenticate, authorize('system'), async (req, res) => {
  const { username, password, role } = req.body;
  
  if (!username || !password || !Object.values(ROLES).includes(role)) {
    return res.status(400).json({ error: 'Invalid user data' });
  }
  
  if (users.some(u => u.username === username)) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = { username, passwordHash, role };
  users.push(newUser);
  
  res.status(201).json({ username, role });
});

// Protected API routes
app.get('/api/status', authenticate, authorize('read'), (req, res) => {
  res.json({
    orchestrator: getOrchestratorState(),
    risk: getRiskState(),
    strategies: listStrategies()
  });
});

app.post('/api/config', authenticate, authorize('write'), (req, res) => {
  configureOrchestrator(req.body || {});
  broadcast('CONFIG_UPDATED', { ...req.body, updatedBy: req.user.username });
  res.json({ ok: true });
});

app.post('/api/live', authenticate, authorize('execute'), (req, res) => {
  toggleLive(!!req.body.live);
  broadcast('TRADING_STATE_CHANGED', { 
    live: !!req.body.live, 
    changedBy: req.user.username,
    timestamp: new Date().toISOString()
  });
  res.json({ live: !!req.body.live });
});

app.post('/api/kill', authenticate, authorize('execute'), (req, res) => {
  setKillSwitch(!!req.body.kill);
  broadcast('KILL_SWITCH_TOGGLED', { 
    active: !!req.body.kill,
    changedBy: req.user.username,
    timestamp: new Date().toISOString()
  });
  res.json({ kill: !!req.body.kill });
});

// Strategy management (advanced users only)
app.post('/api/strategy/register', authenticate, authorize('system'), (req, res) => {
  const { key, code } = req.body || {};
  if (!key || !code) return res.status(400).json({ error: 'key & code required' });
  
  try {
    // Unsafe eval baseline (only for trusted local usage)
    // eslint-disable-next-line no-new-func
    const fn = new Function('ctx', code);
    registerStrategy(key, fn);
    broadcast('STRATEGY_REGISTERED', { 
      key, 
      registeredBy: req.user.username,
      timestamp: new Date().toISOString()
    });
    res.json({ ok: true, key });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Market data source routes
app.post('/api/market/data-source', authenticate, authorize('system'), (req, res) => {
  const { source, useTestnet } = req.body || {};
  
  if (!['binance', 'kraken', 'real-market', 'historical'].includes(source)) {
    return res.status(400).json({ error: 'Invalid data source' });
  }
  
  configureOrchestrator({ 
    dataSource: source,
    useTestnet: !!useTestnet 
  });
  
  broadcast('DATA_SOURCE_CHANGED', {
    source,
    useTestnet: !!useTestnet,
    changedBy: req.user.username
  });
  
  res.json({ ok: true, source, useTestnet: !!useTestnet });
});

const server = app.listen(PORT, () => {
  console.log(`[backend] control server listening on :${PORT}`);
});

// WebSocket layer
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws, req) => {
  let authenticated = false;
  let user = null;
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle authentication
      if (data.type === 'authenticate') {
        try {
          const decoded = jwt.verify(data.token, JWT_SECRET);
          authenticated = true;
          user = decoded;
          
          // Send welcome message with status
          ws.send(JSON.stringify({
            type: 'AUTHENTICATED',
            payload: {
              username: user.username,
              role: user.role,
              orchestrator: getOrchestratorState(),
              risk: getRiskState()
            }
          }));
          
          wsClients.add(ws);
        } catch (err) {
          ws.send(JSON.stringify({
            type: 'AUTH_ERROR',
            payload: { error: 'Invalid token' }
          }));
        }
      } else if (!authenticated) {
        ws.send(JSON.stringify({
          type: 'AUTH_REQUIRED',
          payload: { error: 'Authentication required' }
        }));
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
    }
  });
  
  ws.on('close', () => {
    if (authenticated) {
      wsClients.delete(ws);
    }
  });
});