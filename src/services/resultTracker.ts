/**
 * resultTracker.ts
 * Sistema de registro de win/loss com localStorage
 * Calcula win rate real por estratégia, ativo e horário
 */

export interface TradeRecord {
  id: string;
  timestamp: number;        // quando o sinal foi gerado
  closeTime: number;        // quando o resultado foi registrado
  asset: string;
  type: 'CALL' | 'PUT';
  result: 'WIN' | 'LOSS' | 'PENDING';
  confidence: number;
  strategy: string;         // nome da estratégia
  timeframe: string;
  entryPrice: number;
  payout: number;           // % de payout (ex: 85)
  stake: number;            // valor apostado
  profit: number;           // lucro/prejuízo real
}

export interface BankrollSettings {
  initialBalance: number;
  currentBalance: number;
  stakePercent: number;     // % da banca por operação
  stopLossDay: number;      // % máximo de loss por dia
  payout: number;           // % de payout padrão
}

export interface DayStats {
  date: string;
  wins: number;
  losses: number;
  winRate: number;
  profit: number;
  trades: number;
}

const STORAGE_KEY = 'quotex_bot_trades';
const SETTINGS_KEY = 'quotex_bot_settings';

// ─── Configurações padrão ─────────────────────────────────────────────────────

const DEFAULT_SETTINGS: BankrollSettings = {
  initialBalance: 1000,
  currentBalance: 1000,
  stakePercent: 2,
  stopLossDay: 10,
  payout: 85,
};

// ─── CRUD de trades ───────────────────────────────────────────────────────────

export function getAllTrades(): TradeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTrade(trade: TradeRecord): void {
  const trades = getAllTrades();
  const idx = trades.findIndex(t => t.id === trade.id);
  if (idx >= 0) {
    trades[idx] = trade;
  } else {
    trades.unshift(trade);
  }
  // Mantém máximo 1000 registros
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades.slice(0, 1000)));
}

export function deleteTrade(id: string): void {
  const trades = getAllTrades().filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

export function clearPendingTrades(): void {
  const trades = getAllTrades().filter(t => t.result !== 'PENDING');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

export function clearAllTrades(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Configurações de banca ───────────────────────────────────────────────────

export function getSettings(): BankrollSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: BankrollSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Criar novo registro de trade ─────────────────────────────────────────────

export function createTradeRecord(params: {
  asset: string;
  type: 'CALL' | 'PUT';
  confidence: number;
  strategy: string;
  timeframe: string;
  entryPrice: number;
}): TradeRecord {
  const settings = getSettings();
  const stake = parseFloat(((settings.currentBalance * settings.stakePercent) / 100).toFixed(2));

  return {
    id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Math.floor(Date.now() / 1000),
    closeTime: 0,
    asset: params.asset,
    type: params.type,
    result: 'PENDING',
    confidence: params.confidence,
    strategy: params.strategy,
    timeframe: params.timeframe,
    entryPrice: params.entryPrice,
    payout: settings.payout,
    stake,
    profit: 0,
  };
}

// ─── Registrar resultado ──────────────────────────────────────────────────────

export function registerResult(id: string, result: 'WIN' | 'LOSS'): TradeRecord | null {
  const trades = getAllTrades();
  const trade = trades.find(t => t.id === id);
  if (!trade) return null;

  const settings = getSettings();

  trade.result = result;
  trade.closeTime = Math.floor(Date.now() / 1000);
  trade.profit = result === 'WIN'
    ? parseFloat((trade.stake * (trade.payout / 100)).toFixed(2))
    : -trade.stake;

  // Atualiza saldo
  settings.currentBalance = parseFloat((settings.currentBalance + trade.profit).toFixed(2));
  saveSettings(settings);
  saveTrade(trade);

  return trade;
}

export function updateTradeRecord(id: string, updates: Partial<TradeRecord>): void {
  const trades = getAllTrades();
  const tradeIndex = trades.findIndex(t => t.id === id);
  if (tradeIndex === -1) return;

  const trade = trades[tradeIndex];
  const settings = getSettings();

  // Revert old profit from balance if it was already closed
  if (trade.result !== 'PENDING') {
    settings.currentBalance -= trade.profit;
  }

  // Apply updates
  const updatedTrade = { ...trade, ...updates };

  // Recalculate profit if it's closed
  if (updatedTrade.result !== 'PENDING') {
    updatedTrade.profit = updatedTrade.result === 'WIN'
      ? parseFloat((updatedTrade.stake * (updatedTrade.payout / 100)).toFixed(2))
      : -updatedTrade.stake;
    
    // Apply new profit to balance
    settings.currentBalance += updatedTrade.profit;
  } else {
    updatedTrade.profit = 0;
  }

  settings.currentBalance = parseFloat(settings.currentBalance.toFixed(2));
  saveSettings(settings);

  trades[tradeIndex] = updatedTrade;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

// ─── Estatísticas gerais ──────────────────────────────────────────────────────

export function getStats(trades?: TradeRecord[]) {
  const all = trades || getAllTrades().filter(t => t.result !== 'PENDING');
  const wins = all.filter(t => t.result === 'WIN').length;
  const losses = all.filter(t => t.result === 'LOSS').length;
  const total = wins + losses;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const profit = all.reduce((acc, t) => acc + t.profit, 0);

  return { total, wins, losses, winRate, profit };
}

// ─── Estatísticas por estratégia ──────────────────────────────────────────────

export function getStatsByStrategy() {
  const trades = getAllTrades().filter(t => t.result !== 'PENDING');
  const map: Record<string, TradeRecord[]> = {};

  trades.forEach(t => {
    const key = t.strategy.split(':')[0].trim();
    if (!map[key]) map[key] = [];
    map[key].push(t);
  });

  return Object.entries(map).map(([strategy, ts]) => ({
    strategy,
    ...getStats(ts),
  })).sort((a, b) => b.winRate - a.winRate);
}

// ─── Estatísticas por ativo ───────────────────────────────────────────────────

export function getStatsByAsset() {
  const trades = getAllTrades().filter(t => t.result !== 'PENDING');
  const map: Record<string, TradeRecord[]> = {};

  trades.forEach(t => {
    if (!map[t.asset]) map[t.asset] = [];
    map[t.asset].push(t);
  });

  return Object.entries(map).map(([asset, ts]) => ({
    asset,
    ...getStats(ts),
  })).sort((a, b) => b.winRate - a.winRate);
}

// ─── Estatísticas por dia ─────────────────────────────────────────────────────

export function getStatsByDay(): DayStats[] {
  const trades = getAllTrades().filter(t => t.result !== 'PENDING');
  const map: Record<string, TradeRecord[]> = {};

  trades.forEach(t => {
    const date = new Date(t.timestamp * 1000).toLocaleDateString('pt-BR');
    if (!map[date]) map[date] = [];
    map[date].push(t);
  });

  return Object.entries(map).map(([date, ts]) => {
    const s = getStats(ts);
    return { 
      date, 
      wins: s.wins, 
      losses: s.losses, 
      winRate: s.winRate, 
      profit: s.profit, 
      trades: s.total 
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Proteção de banca ────────────────────────────────────────────────────────

export function isTradingAllowed(): { allowed: boolean; reason?: string } {
  const settings = getSettings();
  const today = new Date().toLocaleDateString('pt-BR');
  const trades = getAllTrades().filter(t => {
    const d = new Date(t.timestamp * 1000).toLocaleDateString('pt-BR');
    return d === today && t.result !== 'PENDING';
  });

  // Stop loss diário
  const dayProfit = trades.reduce((acc, t) => acc + t.profit, 0);
  const maxLoss = -(settings.currentBalance * settings.stopLossDay / 100);
  if (dayProfit <= maxLoss) {
    return { allowed: false, reason: `Stop loss diário atingido (${dayProfit.toFixed(2)})` };
  }

  return { allowed: true };
}

// ─── Trades pendentes ─────────────────────────────────────────────────────────

export function getPendingTrades(): TradeRecord[] {
  return getAllTrades().filter(t => t.result === 'PENDING');
}
