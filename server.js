const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

// Usa o fetch nativo do Node.js (18+) ou importa o node-fetch se necessário
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Estado global
let sessionToken = '';
let isLoggedIn = false;
let ws = null;
const candlesData = {}; 

// 1. Login na Quotex via HTTP Simples
async function loginQuotex() {
  const email = process.env.QUOTEX_EMAIL;
  const password = process.env.QUOTEX_PASSWORD;

  if (!email || !password) {
    console.log('[Auth] Variáveis QUOTEX_EMAIL e QUOTEX_PASSWORD não definidas. Iniciando sem login.');
    connectWebSocket(); // Conecta mesmo sem login para pegar dados públicos
    return;
  }

  console.log(`[Auth] Tentando login HTTP para ${email}...`);

  try {
    // Endpoint genérico de autorização da Quotex
    const response = await fetch('https://qxbroker.com/api/v1/authorization/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      const data = await response.json();
      sessionToken = data.token || data.session || '';
      
      // Tenta extrair dos cookies se o token não vier no corpo do JSON
      const cookies = response.headers.get('set-cookie');
      if (cookies && cookies.includes('session=')) {
        const match = cookies.match(/session=([^;]+)/);
        if (match) sessionToken = match[1];
      }

      if (sessionToken) {
        isLoggedIn = true;
        console.log('[Auth] Login bem-sucedido! Token obtido.');
      } else {
        console.log('[Auth] Login falhou: Token não encontrado na resposta.');
      }
    } else {
      console.log(`[Auth] Falha no login. Status HTTP: ${response.status}`);
    }
  } catch (error) {
    console.error('[Auth] Erro durante a requisição de login:', error.message);
  } finally {
    // Conecta ao WebSocket independentemente do sucesso do login HTTP
    connectWebSocket();
  }
}

// 2. Conexão WebSocket
function connectWebSocket() {
  if (ws) {
    ws.close();
  }

  console.log('[WS] Conectando ao WebSocket da Quotex...');
  ws = new WebSocket('wss://ws2.qxbroker.com/socket.io/?EIO=3&transport=websocket', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://qxbroker.com'
    }
  });

  ws.on('open', () => {
    console.log('[WS] Conectado!');
    ws.send('40'); // Handshake inicial do Socket.io
  });

  ws.on('message', (data) => {
    const message = data.toString();
    
    // Responde ao Ping do servidor para manter a conexão viva
    if (message === '2') {
      ws.send('3'); 
      return;
    }

    // Quando o servidor aceita a conexão (40)
    if (message.startsWith('40')) {
      if (sessionToken) {
        const authPayload = `42["authorization",{"session":"${sessionToken}","isDemo":1}]`;
        ws.send(authPayload);
        console.log('[WS] Autorização enviada.');
      }
    }

    // Processa mensagens de dados (42)
    if (message.startsWith('42')) {
      try {
        const parsed = JSON.parse(message.substring(2));
        const event = parsed[0];
        const payload = parsed[1];

        // Atualiza o cache de candles em tempo real
        if (event === 'candles' && payload && payload.data) {
          const asset = payload.asset;
          candlesData[asset] = payload.data;
        }
      } catch (e) {
        // Ignora erros de parse de pacotes incompletos
      }
    }
  });

  ws.on('close', () => {
    console.log('[WS] Desconectado. Tentando reconectar em 5s...');
    setTimeout(connectWebSocket, 5000);
  });

  ws.on('error', (err) => {
    console.error('[WS] Erro:', err.message);
  });
}

// 3. API REST

// GET /api/status
app.get('/api/status', (req, res) => {
  res.json({
    connected: ws && ws.readyState === WebSocket.OPEN,
    isLoggedIn: isLoggedIn,
    account: isLoggedIn ? 'Demo/Real' : 'Public',
    uptime: process.uptime()
  });
});

// GET /api/candles/:asset?period=60
app.get('/api/candles/:asset', (req, res) => {
  const asset = req.params.asset;
  const period = parseInt(req.query.period) || 60;
  
  // Solicita os candles ao WebSocket se estiver conectado
  if (ws && ws.readyState === WebSocket.OPEN) {
    // Envia o comando para a Quotex enviar os dados deste ativo
    const subscribePayload = `42["instruments/update",{"asset":"${asset}","period":${period}}]`;
    ws.send(subscribePayload);
  }

  // Retorna os dados em cache (pode estar vazio na primeira requisição até o WS responder)
  const data = candlesData[asset] || [];

  res.json({
    asset,
    period,
    candles: data
  });
});

app.listen(PORT, () => {
  console.log(`[Server] API REST rodando na porta ${PORT}`);
  loginQuotex();
});
