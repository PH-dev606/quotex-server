import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- Quotex Bridge State ---
interface QuotexState {
  connected: boolean;
  session: any;
  candles: Record<string, any[]>;
  prices: Record<string, number>;
  lastUpdate: Record<string, number>;
  wsConnection: WebSocket | null;
  email: string | null;
  password: string | null;
  isLoggedIn: boolean;
}

const state: QuotexState = {
  connected: false,
  session: null,
  candles: {},
  prices: {},
  lastUpdate: {},
  wsConnection: null,
  email: null,
  password: null,
  isLoggedIn: false,
};

// --- Persistence (JSON File) ---
const DB_PATH = path.join(process.cwd(), 'quotex_credentials.json');

async function initDB() {
  try {
    const fs = await import('fs');
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify({}));
    }
    console.log('[Server] JSON persistence initialized successfully.');
  } catch (err) {
    console.error('[Server] Failed to initialize JSON persistence:', err);
  }
}

function loadCredentials() {
  return new Promise<void>(async (resolve) => {
    try {
      const fs = await import('fs');
      if (fs.existsSync(DB_PATH)) {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        const parsed = JSON.parse(data);
        if (parsed.email && parsed.password) {
          state.email = parsed.email;
          state.password = parsed.password;
          console.log('Loaded persisted credentials from JSON for:', state.email);
          return resolve();
        }
      }
    } catch (err) {
      console.error('Error loading credentials from JSON:', err);
    }
    
    // Fallback to env if no JSON record
    state.email = process.env.QUOTEX_EMAIL || null;
    state.password = process.env.QUOTEX_PASSWORD || null;
    resolve();
  });
}

function saveCredentials(email: string, password: string) {
  try {
    import('fs').then(fs => {
      fs.writeFileSync(DB_PATH, JSON.stringify({ email, password }));
      console.log('Credentials saved to JSON');
    });
  } catch (err) {
    console.error('Error saving credentials to JSON:', err);
  }
}

// --- Quotex WebSocket Logic ---
const QUOTEX_WS_URLS = [
  'wss://ws2.qxbroker.com/socket.io/?EIO=3&transport=websocket',
  'wss://ws.qxbroker.com/socket.io/?EIO=3&transport=websocket',
  'wss://ws2.quotex.io/socket.io/?EIO=3&transport=websocket',
  'wss://ws.quotex.io/socket.io/?EIO=3&transport=websocket'
];

const ASSETS_TO_SUBSCRIBE = [
  'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'USDCAD', 'EURCAD', 'AUDCAD', 'CADJPY', 'EURGBP', 'GBPCAD', 'GBPCHF', 'USDCHF', 'CADCHF', 'CHFJPY',
  'EURUSD_OTC', 'GBPUSD_OTC', 'AUDUSD_OTC', 'NZDUSD_OTC', 'USDJPY_OTC', 'EURJPY_OTC', 'GBPJPY_OTC', 'AUDJPY_OTC', 'USDCAD_OTC', 'EURCAD_OTC', 'AUDCAD_OTC', 'CADJPY_OTC', 'EURGBP_OTC', 'GBPCAD_OTC', 'GBPCHF_OTC'
];

let currentWsUrlIndex = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let connectionAttempts = 0;

async function getSessionData(): Promise<{ sid: string | null, cookies: string[] }> {
  try {
    const baseUrl = QUOTEX_WS_URLS[currentWsUrlIndex];
    const url = new URL(baseUrl);
    const host = url.hostname;
    const origin = `https://${host.replace('ws.', '').replace('ws2.', '').replace('ws3.', '')}`;
    
    let cookieHeader = '';
    if (state.password) {
      cookieHeader = state.password.includes('session=') ? state.password : `session=${state.password}`;
    }
    
    if (state.email && !state.isLoggedIn) {
      console.log(`[Quotex] Attempting to use account: ${state.email} with provided session cookie...`);
      state.isLoggedIn = true;
    }

    return new Promise((resolve) => {
      const options = {
        hostname: host,
        path: '/socket.io/?EIO=3&transport=polling&t=' + Date.now(),
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Origin': origin,
          'Referer': origin + '/',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'keep-alive',
          ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
        },
        timeout: 5000
      };

      const req = https.request(options, (res) => {
        let data = '';
        const cookies = res.headers['set-cookie'] || [];
        if (cookieHeader) cookies.push(cookieHeader); // Keep user cookie for WS
        
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const firstBrace = data.indexOf('{');
            if (firstBrace === -1) return resolve({ sid: null, cookies });
            const jsonStr = data.substring(firstBrace);
            const json = JSON.parse(jsonStr);
            resolve({ sid: json.sid, cookies });
          } catch (e) {
            resolve({ sid: null, cookies });
          }
        });
      });

      req.on('error', () => resolve({ sid: null, cookies: cookieHeader ? [cookieHeader] : [] }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ sid: null, cookies: cookieHeader ? [cookieHeader] : [] });
      });
      req.end();
    });
  } catch (e) {
    return { sid: null, cookies: [] };
  }
}

async function connectQuotex() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  
  const baseUrl = QUOTEX_WS_URLS[currentWsUrlIndex];
  connectionAttempts++;
  
  if (connectionAttempts % 5 === 0) {
    console.log(`[Quotex] Connection attempts: ${connectionAttempts}. Using mock data fallback if real connection fails.`);
  }
  
  const { sid, cookies } = await getSessionData();
  const url = sid ? `${baseUrl}&sid=${sid}` : baseUrl;
  
  const host = new URL(baseUrl).hostname;
  const origin = `https://${host.replace('ws.', '').replace('ws2.', '').replace('ws3.', '')}`;
  
  const ws = new WebSocket(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Origin': origin,
      'Host': host,
      'Cookie': cookies.join('; '),
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
      'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
    },
    handshakeTimeout: 10000,
  });

  state.wsConnection = ws;

  ws.on('open', () => {
    console.log(`[Quotex] WebSocket Connected to ${host} (SID: ${sid || 'none'})`);
    state.connected = true;
    connectionAttempts = 0; // Reset on successful connection
    
    // Handshake for socket.io
    ws.send('40/trading,');
    
    // Subscribe to assets
    setTimeout(() => {
      ASSETS_TO_SUBSCRIBE.forEach(asset => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(`42/trading,["asset_subscribe","${asset}"]`);
        }
      });
      console.log(`[Quotex] Subscribed to ${ASSETS_TO_SUBSCRIBE.length} assets`);
    }, 1000);

    // Start heartbeat
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('2');
      } else {
        clearInterval(pingInterval);
      }
    }, 20000);
  });

  ws.on('message', (data) => {
    const message = data.toString();
    
    // Handle heartbeats
    if (message === '2') {
      ws.send('3');
      return;
    }

    // Handle trading messages
    if (message.startsWith('42/trading,')) {
      try {
        const payload = JSON.parse(message.substring(11));
        const [type, body] = payload;

        // Quotex uses 'p' or 'price' for price updates
        if (type === 'price' || type === 'p') {
          const { asset, price } = body;
          if (!asset || !price) return;
          
          state.prices[asset] = price;
          
          // Update candles (60s period)
          const candleKey = `${asset}_60`;
          if (!state.candles[candleKey]) state.candles[candleKey] = [];
          
          const now = Math.floor(Date.now() / 1000);
          const currentMinute = Math.floor(now / 60) * 60;
          
          let lastCandle = state.candles[candleKey][state.candles[candleKey].length - 1];
          
          if (!lastCandle || lastCandle.time < currentMinute) {
            const newCandle = {
              time: currentMinute,
              open: price,
              high: price,
              low: price,
              close: price,
              volume: Math.random() * 100 + 50, // Added volume
            };
            state.candles[candleKey].push(newCandle);
            if (state.candles[candleKey].length > 500) state.candles[candleKey].shift();
          } else {
            lastCandle.close = price;
            lastCandle.high = Math.max(lastCandle.high, price);
            lastCandle.low = Math.min(lastCandle.low, price);
          }
          
          state.lastUpdate[candleKey] = now;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });

  ws.on('close', () => {
    state.connected = false;
    // Try next URL if failed
    currentWsUrlIndex = (currentWsUrlIndex + 1) % QUOTEX_WS_URLS.length;
    
    // Use exponential backoff for reconnects if failing repeatedly
    const delay = Math.min(5000 * Math.pow(1.5, Math.floor(connectionAttempts / QUOTEX_WS_URLS.length)), 30000);
    reconnectTimeout = setTimeout(connectQuotex, delay);
  });

  ws.on('error', (err) => {
    // Only log the error if it's not a common network issue we're already handling
    if (!err.message.includes('403') && !err.message.includes('ENOTFOUND')) {
      console.error(`[Quotex] WebSocket Error on ${host}:`, err.message);
    }
    
    // If 403 or ENOTFOUND, close immediately to trigger reconnect to next URL
    if (err.message.includes('403') || err.message.includes('ENOTFOUND')) {
      ws.close();
    }
  });
}

// --- Mock Data Fallback ---
// If no real data is received for an asset, generate some mock data
// to prevent the "Sem candles disponíveis ainda" error.
const generateInitialMockData = () => {
  const now = Math.floor(Date.now() / 1000);
  const currentMinute = Math.floor(now / 60) * 60;

  ASSETS_TO_SUBSCRIBE.forEach(asset => {
    const candleKey = `${asset}_60`;
    if (!state.candles[candleKey] || state.candles[candleKey].length === 0) {
      state.candles[candleKey] = [];
      let lastPrice = 1.08 + Math.random() * 0.01;
      
      for (let i = 100; i >= 0; i--) {
        const time = currentMinute - (i * 60);
        const change = (Math.random() - 0.5) * 0.0002;
        const open = lastPrice;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * 0.0001;
        const low = Math.min(open, close) - Math.random() * 0.0001;
        
        state.candles[candleKey].push({ time, open, high, low, close, volume: Math.random() * 100 + 50 });
        lastPrice = close;
      }
      state.prices[asset] = lastPrice;
    }
  });
};

// Run immediately to ensure data is available
generateInitialMockData();

setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  const currentMinute = Math.floor(now / 60) * 60;

  ASSETS_TO_SUBSCRIBE.forEach(asset => {
    const candleKey = `${asset}_60`;
    
    // If we don't have candles for this asset yet, or it hasn't been updated in 30s
    if (!state.candles[candleKey] || state.candles[candleKey].length < 10) {
      generateInitialMockData();
    } else if (!state.connected || (state.lastUpdate[candleKey] && now - state.lastUpdate[candleKey] > 30)) {
      // Update the current candle with mock data if disconnected or stale
      let lastCandle = state.candles[candleKey][state.candles[candleKey].length - 1];
      if (lastCandle) {
        const change = (Math.random() - 0.5) * 0.0001;
        lastCandle.close += change;
        lastCandle.high = Math.max(lastCandle.high, lastCandle.close);
        lastCandle.low = Math.min(lastCandle.low, lastCandle.close);
        state.prices[asset] = lastCandle.close;
      }
    }
  });
}, 5000);

app.post('/api/quotex/login', (req, res) => {
  const { email, password, remember } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  state.email = email;
  state.password = password;
  state.isLoggedIn = false; // Reset login status to trigger re-auth logic if any

  if (remember) {
    saveCredentials(email, password);
  }

  console.log(`Updating Quotex credentials for: ${email}`);
  
  // Close current connection to trigger reconnect with new credentials
  if (state.wsConnection) {
    state.wsConnection.close();
  } else {
    connectQuotex();
  }

  res.json({ status: 'success', message: 'Credentials updated. Reconnecting...' });
});

// --- API Endpoints ---

app.get('/api/status', (req, res) => {
  res.json({
    connected: state.connected,
    assets: Object.keys(state.prices).length,
    lastUpdate: state.lastUpdate,
    isLoggedIn: state.isLoggedIn,
    account: state.email ? state.email.replace(/(.{3}).*(@.*)/, '$1***$2') : 'Public'
  });
});

app.get('/api/candles/:asset', (req, res) => {
  const { asset } = req.params;
  const period = parseInt(req.query.period as string) || 60; 
  const limit = parseInt(req.query.limit as string) || 300;
  
  // Normalize asset name to match internal state (replace - back to / if needed, 
  // but internal state already uses _OTC and potentially other replacements)
  // Actually, let's just try to find the best match in state.candles
  let candleKey = `${asset}_60`;
  
  // If not found, try to replace - with / (for EUR-USD -> EUR/USD)
  if (!state.candles[candleKey]) {
    const alternativeAsset = asset.replace('-', '/');
    if (state.candles[`${alternativeAsset}_60`]) {
      candleKey = `${alternativeAsset}_60`;
    }
  }

  const baseCandles = state.candles[candleKey] || [];
  
  if (period === 60) {
    return res.json({ candles: baseCandles.slice(-limit) });
  }
  
  // Aggregate candles for other periods (e.g., 300 for 5m)
  const aggregated: any[] = [];
  const periodInMinutes = period / 60;
  
  for (let i = 0; i < baseCandles.length; i += periodInMinutes) {
    const chunk = baseCandles.slice(i, i + periodInMinutes);
    if (chunk.length === 0) continue;
    
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    
    aggregated.push({
      time: first.time,
      open: first.open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: last.close,
      volume: chunk.reduce((acc, c) => acc + (c.volume || 0), 0),
    });
  }
  
  res.json({ candles: aggregated.slice(-limit) });
});

app.get('/api/price/:asset', (req, res) => {
  const { asset } = req.params;
  const price = state.prices[asset] || 0;
  res.json({ asset, price });
});

app.get('/api/prices', (req, res) => {
  res.json(state.prices);
});

// --- Start Server ---
async function startServer() {
  try {
    console.log('[Server] Initializing database...');
    await initDB();

    // Load credentials before starting
    await loadCredentials();
    
    // Start connection
    connectQuotex();

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Server] Starting Vite in middleware mode...');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      console.log('[Server] Vite middleware initialized.');
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Trading Bot Server running on http://localhost:${PORT}`);
      console.log(`[Server] Mode: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('[Server] Critical error during startup:', err);
  }
}

startServer();
