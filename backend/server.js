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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SECURITY: Use environment variables for sensitive configuration
const PORT = process.env.BOT_SERVER_PORT || 5055;
// SECURITY: JWT secret should be set as an environment variable in production
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' 
  ? (console.error('WARNING: JWT_SECRET environment variable not set in production'), crypto.randomUUID()) 
  : 'dev-secret-do-not-use-in-production');

// SECURITY: Default admin credentials should be set through environment variables
const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
// In production, if admin password hash isn't provided, disable the default account
const DEFAULT_ADMIN_PASSWORD_HASH = process.env.NODE_ENV === 'production' 
  ? (process.env.ADMIN_PASSWORD_HASH || null)
  : '$2a$10$XvQhbx1ahzxNnFyjHLwDQO/z8SlT.8ZSQdLzEKiQnx9xd3.fHxcHa'; // hash for "admin"

// SECURITY WARNING: Display security warnings for insecure configurations
if (process.env.NODE_ENV === 'production') {
  if (JWT_SECRET === 'dev-secret-do-not-use-in-production') {
    console.error('CRITICAL SECURITY WARNING: Using default JWT secret in production!');
  }
  if (!process.env.ADMIN_PASSWORD_HASH) {
    console.warn('Security notice: No admin password hash provided. Default admin account is disabled.');
  }
}

const app = express();

// SECURITY: Use strict CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : (process.env.NODE_ENV === 'production' 
    ? [] // Empty array means no default origins in production
    : ['http://localhost:3000']);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.length === 0) {
      console.warn('No allowed origins configured - rejecting cross-origin requests');
      return callback(new Error('Not allowed by CORS'), false);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Simple in-memory clients
let wsClients = new Set();

function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload });
  wsClients.forEach(ws => {
    try { 
      ws.send(msg); 
    } catch (error) {
      // BEST PRACTICE: Log WebSocket send errors for debugging
      console.error('WebSocket broadcast error:', error.message);
    }
  });
}

// User roles and permissions
const ROLES = {
  ADMIN: 'admin',
  TRADER: 'trader',
  VIEWER: 'viewer'
};

const PERMISSIONS = {
  [ROLES.ADMIN]: ['read', 'write', 'execute', 'system'],
  [ROLES.TRADER]: ['read', 'write', 'execute'],
  [ROLES.VIEWER]: ['read']
};

// SECURITY: In-memory user database for development
// BEST PRACTICE: In production, use a real database like MongoDB or PostgreSQL
let users = [];

// Initialize admin user if hash is provided
if (DEFAULT_ADMIN_PASSWORD_HASH) {
  users.push({ 
    username: DEFAULT_ADMIN_USERNAME, 
    passwordHash: DEFAULT_ADMIN_PASSWORD_HASH, 
    role: ROLES.ADMIN 
  });
}

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

// Strategy management (admin only)
app.post('/api/strategy/register', authenticate, authorize('system'), (req, res) => {
  const { key, code } = req.body || {};
  if (!key || !code) return res.status(400).json({ error: 'key & code required' });
  
  try {
    // SECURITY: Prevent dangerous strategy code
    if (process.env.NODE_ENV === 'production') {
      // Check for potentially dangerous patterns
      const dangerousPatterns = [
        'process.', 'require(', 'import(', 'eval(', 'Function(', 
        'setTimeout(', 'setInterval(', 'fetch(', 'window.'
      ];
      
      const hasDangerousCode = dangerousPatterns.some(pattern => code.includes(pattern));
      if (hasDangerousCode) {
        return res.status(400).json({ error: 'Strategy contains potentially unsafe code' });
      }
    }
    
    // SECURITY: In production, use a sandboxed strategy interpreter
    // Instead of eval or new Function, parse strategy into a safe AST and execute
    // For this example, we'll use a controlled subset of functionality
    let strategyFn;
    
    if (process.env.NODE_ENV === 'production') {
      // In production, use sandbox pattern with preset functions
      strategyFn = createSandboxedStrategy(code);
    } else {
      // In development, allow full JS for easier testing
      // eslint-disable-next-line no-new-func
      strategyFn = new Function('ctx', code);
    }
    
    registerStrategy(key, strategyFn);
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

// SECURITY: Create a sandboxed strategy with limited functionality
function createSandboxedStrategy(code) {
  // This is a simplified example - a real implementation would use a proper JS sandbox
  return async (ctx) => {
    // Allowed variables and functions in the strategy context
    const sandbox = {
      marketData: ctx.marketData,
      historicalData: ctx.historicalData,
      aiAnalysis: ctx.aiAnalysis,
      indicators: {
        calculateRSI: (prices, period) => {/* safe implementation */},
        calculateEMA: (prices, period) => {/* safe implementation */},
        calculateMACD: (prices) => {/* safe implementation */}
      },
      utils: {
        log: console.log,
        max: Math.max,
        min: Math.min,
        round: Math.round
      },
      // Result object that the strategy should modify
      result: {
        signal: 'HOLD',
        reason: '',
        confidence: 0.5
      }
    };
    
    try {
      // Execute the strategy in a VM/sandbox (simplified for example)
      // In a real implementation, use a proper sandbox like vm2
      const wrappedCode = `
        (function(marketData, historicalData, aiAnalysis, indicators, utils, result) {
          ${code}
          return result;
        })(sandbox.marketData, sandbox.historicalData, sandbox.aiAnalysis, 
           sandbox.indicators, sandbox.utils, sandbox.result);
      `;
      
      // Still using Function but with controlled inputs and outputs
      // In production, use a proper sandbox library
      // eslint-disable-next-line no-new-func
      const executeFn = new Function('sandbox', wrappedCode);
      const strategyResult = executeFn(sandbox);
      
      // Validate result has expected properties
      if (!['BUY', 'SELL', 'HOLD'].includes(strategyResult.signal)) {
        throw new Error('Invalid signal returned');
      }
      
      return strategyResult;
    } catch (error) {
      console.error('Strategy execution error:', error);
      return { signal: 'HOLD', reason: `Strategy error: ${error.message}`, confidence: 0 };
    }
  };
}

const server = app.listen(PORT, () => {
  console.log(`[backend] control server listening on :${PORT}`);
});

// WebSocket layer
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
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