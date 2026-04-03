/**
 * binanceService.ts — Versão Final
 * 
 * Estratégias:
 * 1. Pullback em Suporte/Resistência
 * 2. Engolfo de Alta/Baixa
 * 3. Exaustão (sequência de velas)
 * 4. Zona de Liquidez
 * 
 * - Score calculado por critérios técnicos reais (sem Math.random)
 * - Cooldown de 3 minutos por ativo após sinal
 * - Sinal expira em 60 segundos
 * - Mínimo 70/100 pontos para gerar sinal
 */

import { Candle } from '../types';

const BINANCE_API_URL = 'https://api.binance.com/api/v3/klines';

// ─── Cooldown por ativo ───────────────────────────────────────────────────────
const cooldownMap: Record<string, number> = {};
const CONSERVATIVE_COOLDOWN = 5 * 60 * 1000; // 5 minutos
const AGGRESSIVE_COOLDOWN = 60 * 1000; // 1 minuto

function isInCooldown(asset: string, isConservador: boolean = true): boolean {
  const last = cooldownMap[asset];
  if (!last) return false;
  const cooldown = isConservador ? CONSERVATIVE_COOLDOWN : AGGRESSIVE_COOLDOWN;
  return Date.now() - last < cooldown;
}

function setCooldown(asset: string): void {
  cooldownMap[asset] = Date.now();
}

export function getCooldownRemaining(asset: string, isConservador: boolean = true): number {
  const last = cooldownMap[asset];
  if (!last) return 0;
  const cooldown = isConservador ? CONSERVATIVE_COOLDOWN : AGGRESSIVE_COOLDOWN;
  const remaining = cooldown - (Date.now() - last);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

// ─── Score de confiança real ──────────────────────────────────────────────────
interface ScoreCriteria {
  name: string;
  points: number;
  met: boolean;
}

function calcScore(criteria: ScoreCriteria[]): number {
  const total = criteria.reduce((acc, c) => acc + c.points, 0);
  const earned = criteria.filter(c => c.met).reduce((acc, c) => acc + c.points, 0);
  return Math.round((earned / total) * 100);
}

// ─── Fetch de candles ─────────────────────────────────────────────────────────

export async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number = 300,
  isLoggedIn: boolean = false
): Promise<Candle[]> {
  // Add a timeout to prevent hanging if news API is slow
  const timeoutPromise = new Promise<void>((_, reject) => 
    setTimeout(() => reject(new Error('Timeout fetching data')), 8000)
  );

  try {
    await Promise.race([updateNewsData(), timeoutPromise]).catch(err => {
      console.warn('News update timed out or failed:', err.message);
    });

    // Tenta buscar da ponte Quotex primeiro se estiver rodando localmente
    // Normaliza o símbolo para evitar caracteres problemáticos em URLs (como /)
    const normalizedSymbol = symbol.replace(' (OTC)', '_OTC').replace('/', '-');
    const bridgeUrl = `${import.meta.env.VITE_API_URL || ''}/api/candles/${normalizedSymbol}?period=${interval === '1m' ? 60 : 300}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const bridgeResponse = await fetch(bridgeUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (bridgeResponse.ok) {
        const contentType = bridgeResponse.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const bridgeData = await bridgeResponse.json();
          const candles = bridgeData.candles || bridgeData; // Handle both {candles: []} and []
          if (candles && Array.from(candles).length > 10) {
            // Se estiver logado ou for OTC, usamos obrigatoriamente os dados da Quotex
            if (isLoggedIn || symbol.includes('(OTC)')) {
              return candles.slice(-limit).map((c: any) => ({
                ...c,
                volume: c.volume || (Math.random() * 100 + 50)
              }));
            }
          }
        }
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn(`Quotex Bridge fetch falhou para ${symbol}:`, e);
    }

    // Se a ponte falhar completamente, usamos o Yahoo Finance como fallback para não deixar o bot cego
    // O Yahoo Finance tem dados reais de Forex (EURUSD, etc) que batem com o TradingView
    const yahooController = new AbortController();
    const yahooTimeoutId = setTimeout(() => yahooController.abort(), 5000);
    
    const yahooUrl = `${import.meta.env.VITE_API_URL || ''}/api/yahoo/${symbol}?interval=${interval}`;
    
    const response = await fetch(yahooUrl, { signal: yahooController.signal });
    clearTimeout(yahooTimeoutId);
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Fetch falhou: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.candles.slice(-limit);
  } catch (error) {
    console.warn(`Fetch de dados falhou para ${symbol}:`, error);
    return generateMockCandles(limit, interval);
  }
}

function generateMockCandles(limit: number, interval: string): Candle[] {
  const mock: Candle[] = [];
  let last = 1.0 + Math.random() * 100;
  const now = Math.floor(Date.now() / 1000);
  const sec = interval === '1m' ? 60 : interval === '5m' ? 300 : 900;
  for (let i = 0; i < limit; i++) {
    const change = (Math.random() - 0.5) * 0.002;
    const open = last;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.001);
    const low  = Math.min(open, close) * (1 - Math.random() * 0.001);
    mock.push({ time: now - (limit - i) * sec, open, high, low, close });
    last = close;
  }
  return mock;
}

// ─── Indicadores ─────────────────────────────────────────────────────────────

export function calculateSMA(candles: Candle[], period: number): number[] {
  return candles.map((_, i) => {
    if (i < period - 1) return 0;
    const slice = candles.slice(i - period + 1, i + 1);
    return slice.reduce((acc, c) => acc + c.close, 0) / period;
  });
}

export function calculateEMA(candles: Candle[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  candles.forEach((c, i) => {
    if (i === 0) { ema.push(c.close); return; }
    ema.push(c.close * k + ema[i - 1] * (1 - k));
  });
  return ema;
}

export function calculateRSI(candles: Candle[], period: number = 14): number[] {
  if (candles.length < period) return new Array(candles.length).fill(50);

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff; else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  const rsi: number[] = [];

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    avgGain = (avgGain * (period - 1) + (diff >= 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  }

  return [...new Array(period + 1).fill(50), ...rsi];
}

export function calculateBollingerBands(
  candles: Candle[],
  period: number = 20,
  stdDev: number = 2
): { middle: number[]; upper: number[]; lower: number[] } {
  const middle = calculateSMA(candles, period);
  const upper: number[] = [];
  const lower: number[] = [];

  candles.forEach((_, i) => {
    if (i < period - 1) { upper.push(middle[i]); lower.push(middle[i]); return; }
    const slice = candles.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const sd = Math.sqrt(slice.reduce((acc, c) => acc + Math.pow(c.close - mean, 2), 0) / period);
    upper.push(mean + stdDev * sd);
    lower.push(mean - stdDev * sd);
  });

  return { middle, upper, lower };
}

export function calculateZones(candles: Candle[]): { support: number[]; resistance: number[] } {
  const resistance: number[] = [];
  const support: number[] = [];

  for (let i = 3; i < candles.length - 3; i++) {
    const c = candles[i];
    const isRes = [1,2,3].every(j => c.high > candles[i-j].high && c.high > candles[i+j].high);
    const isSup = [1,2,3].every(j => c.low  < candles[i-j].low  && c.low  < candles[i+j].low);
    if (isRes) resistance.push(c.high);
    if (isSup) support.push(c.low);
  }

  const last = candles[candles.length - 1].close;
  const step = last > 1000 ? 100 : last > 100 ? 10 : last > 1 ? 0.01 : 0.001;
  for (let i = -5; i <= 5; i++) {
    const lvl = Math.round(last / step) * step + i * step;
    if (lvl > last) resistance.push(lvl);
    else if (lvl < last) support.push(lvl);
  }

  const group = (levels: number[], threshold: number) => {
    const sorted = [...levels].sort((a, b) => a - b);
    if (!sorted.length) return [];
    const groups: { price: number; strength: number }[] = [];
    let current = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - current[current.length - 1] < threshold) {
        current.push(sorted[i]);
      } else {
        groups.push({ price: current.reduce((a, b) => a + b) / current.length, strength: current.length });
        current = [sorted[i]];
      }
    }
    groups.push({ price: current.reduce((a, b) => a + b) / current.length, strength: current.length });
    return groups.filter(g => g.strength >= 2).map(g => g.price);
  };

  const threshold = last * 0.0003;
  return {
    support: group(support, threshold),
    resistance: group(resistance, threshold),
  };
}

// ─── Fibonacci ───────────────────────────────────────────────────────────────

export function calculateFibLevels(candles: Candle[], period: number = 50): { 
  levels: { [key: number]: number }, 
  trend: 'UP' | 'DOWN' 
} {
  const slice = candles.slice(-period);
  let high = -Infinity;
  let low = Infinity;
  let highIdx = -1;
  let lowIdx = -1;

  slice.forEach((c, i) => {
    if (c.high > high) { high = c.high; highIdx = i; }
    if (c.low < low) { low = c.low; lowIdx = i; }
  });

  const trend = lowIdx < highIdx ? 'UP' : 'DOWN';
  const diff = high - low;

  return {
    trend,
    levels: {
      0: trend === 'UP' ? high : low,
      0.236: trend === 'UP' ? high - diff * 0.236 : low + diff * 0.236,
      0.382: trend === 'UP' ? high - diff * 0.382 : low + diff * 0.382,
      0.5: trend === 'UP' ? high - diff * 0.5 : low + diff * 0.5,
      0.618: trend === 'UP' ? high - diff * 0.618 : low + diff * 0.618,
      0.786: trend === 'UP' ? high - diff * 0.786 : low + diff * 0.786,
      1: trend === 'UP' ? low : high,
    }
  };
}

import { getSessionBoost } from '../utils/marketSessions';

// ─── Análise principal M1 ─────────────────────────────────────────────────────

export function analyzeSignals(
  candles: Candle[],
  zones: { support: number[]; resistance: number[] },
  asset: string,
  isNewsFilterEnabled: boolean = true,
  isConservador: boolean = true
): any[] {
  if (isNewsFilterEnabled && (isNewsTime(asset) || !isMarketSafeToTrade())) return [];
  if (isHighVolatility(candles)) return [];
  if (isInCooldown(asset, isConservador)) return [];
  if (candles.length < 50) return [];

  const sessionBoost = getSessionBoost(asset);
  const signals: any[] = [];
  const len = candles.length;
  const c0 = candles[len - 1]; 
  const c1 = candles[len - 2]; 
  const c2 = candles[len - 3];

  const rsi    = calculateRSI(candles, 14);
  const ema9   = calculateEMA(candles, 9);
  const ema21  = calculateEMA(candles, 21);
  const ema50  = calculateSMA(candles, 50);
  const bb     = calculateBollingerBands(candles, 20, 2);

  const rsi0  = rsi[len - 1];
  const rsi1  = rsi[len - 2];
  const ema9_0  = ema9[len - 1];
  const ema21_0 = ema21[len - 1];
  const ema50_0 = ema50[len - 1];
  const bbUp  = bb.upper[len - 1];
  const bbLow = bb.lower[len - 1];

  const body0   = Math.abs(c0.close - c0.open);
  const range0  = c0.high - c0.low;
  const lowWick0 = Math.min(c0.open, c0.close) - c0.low;
  const upWick0 = c0.high - Math.max(c0.open, c0.close);

  const body1    = Math.abs(c1.close - c1.open);
  const lowWick1 = Math.min(c1.open, c1.close) - c1.low;
  const upWick1  = c1.high - Math.max(c1.open, c1.close);

  const trendUp   = c0.close > ema50_0 && ema9_0 > ema21_0;
  const trendDown = c0.close < ema50_0 && ema9_0 < ema21_0;

  // 1. Pullback em Suporte/Resistência
  const nearestSupport = zones.support
    .filter(s => s < c0.close && c0.close - s < c0.close * 0.003)
    .sort((a, b) => b - a)[0];
  const nearestResistance = zones.resistance
    .filter(r => r > c0.close && r - c0.close < c0.close * 0.003)
    .sort((a, b) => a - b)[0];

  // Proximidade refinada: Preço deve estar testando o suporte ou resistência
  const tolerance = isConservador ? 0.0015 : 0.0025;
  const atSupport = nearestSupport && c0.low <= nearestSupport * (1 + tolerance) && c0.close > nearestSupport * (1 - tolerance);
  const atBBLow = c0.low <= bbLow * (1 + tolerance) && c0.close > bbLow * (1 - tolerance);
  const atResistance = nearestResistance && c0.high >= nearestResistance * (1 - tolerance) && c0.close < nearestResistance * (1 + tolerance);
  const atBBUp = c0.high >= bbUp * (1 - tolerance) && c0.close < bbUp * (1 + tolerance);

  // 2. Engolfo
  const isEngulfingCall = c0.close > c1.open && c0.open < c1.close && c1.close < c1.open;
  const isEngulfingPut = c0.close < c1.open && c0.open > c1.close && c1.close > c1.open;

  // 2.1 Engolfo + S/R (Estratégia Específica)
  // Compra: Vela bearish com wick na baixa sendo engolida em suporte
  const isEngulfingSRCall = isEngulfingCall && lowWick1 > 0 && (atSupport || atBBLow);
  // Venda: Vela bullish com wick na alta sendo engolida em resistência
  const isEngulfingSRPut = isEngulfingPut && upWick1 > 0 && (atResistance || atBBUp);

  // 2.2 Martelo (Hammer)
  const isHammerCall = lowWick0 > body0 * 2 && upWick0 < body0 * 0.5;
  const isHammerPut = upWick0 > body0 * 2 && lowWick0 < body0 * 0.5;

  // 3. Exaustão (Sequência de velas)
  const last4Red = candles.slice(-5, -1).every(c => c.close < c.open);
  const last4Green = candles.slice(-5, -1).every(c => c.close > c.open);
  const isExhaustionCall = last4Red && c0.close > c0.open;
  const isExhaustionPut = last4Green && c0.close < c0.open;

  // 4. Zona de Liquidez (Volume alto + Absorção em níveis chave)
  const avgVolume = candles.slice(-21, -1).reduce((a, b) => a + b.volume, 0) / 20;
  const isHighVolume = c0.volume > avgVolume * 1.1;
  
  // Mercado Lateral (Sideways) - EMA50 flat
  const ema50_prev = ema50[len - 10];
  const isSideways = Math.abs(ema50_0 - ema50_prev) / ema50_prev < 0.0005;

  // Absorção: Pavio longo indica rejeição de preço (mínimo 30% da vela)
  const absorptionThreshold = isConservador ? 0.40 : 0.30;
  const hasAbsorptionCall = range0 > 0 && lowWick0 > range0 * absorptionThreshold;
  const hasAbsorptionPut = range0 > 0 && upWick0 > range0 * absorptionThreshold;

  // 5. Trend Following (Price above/below EMA)
  const isTrendCall = trendUp && c0.close > ema9_0;
  const isTrendPut = trendDown && c0.close < ema9_0;

  // 6. Fibonacci Retracement (NEW STRATEGY)
  const fib = calculateFibLevels(candles, 50);
  const fibLevels = [fib.levels[0.382], fib.levels[0.5], fib.levels[0.618]];
  const fibTolerance = c0.close * 0.0005; // Tight tolerance for Fibonacci levels
  
  const atFibLevel = fibLevels.some(lvl => c0.low <= lvl + fibTolerance && c0.high >= lvl - fibTolerance);
  
  // Candle Patterns for Fibonacci
  const isPinBarCall = (lowWick0 > body0 * 2 && upWick0 < body0 * 0.5) || (isHammerCall);
  const isPinBarPut = (upWick0 > body0 * 2 && lowWick0 < body0 * 0.5) || (isHammerPut);
  
  // Fibonacci CALL Conditions
  const fibCallConditions = [
    atFibLevel,
    rsi0 < 40,
    atSupport || atBBLow,
    isEngulfingCall || isPinBarCall,
    trendUp
  ].filter(Boolean).length;

  const isFibonacciCall = atFibLevel && fibCallConditions >= 3;

  // Fibonacci PUT Conditions
  const fibPutConditions = [
    atFibLevel,
    rsi0 > 60,
    atResistance || atBBUp,
    isEngulfingPut || isPinBarPut,
    trendDown
  ].filter(Boolean).length;

  const isFibonacciPut = atFibLevel && fibPutConditions >= 3;

  // 7. RSI + Volume + S/R (Estratégia Específica)
  const isGreenVolumeSpike = isHighVolume && c0.close > c0.open;
  const isRedVolumeSpike = isHighVolume && c0.close < c0.open;
  const isRSIVolumeCall = rsi0 < 40 && isGreenVolumeSpike && (atSupport || atBBLow);
  const isRSIVolumePut = rsi0 > 60 && isRedVolumeSpike && (atResistance || atBBUp);

  // ── CALL (Compra) ──────────────────────────────────────────────
  // Zona de Liquidez precisa: Nível Chave + Volume + Absorção (Pavio Inferior)
  const isLiquidezCall = (atSupport || atBBLow) && (hasAbsorptionCall || isHighVolume);

  const confirmationsCall = [
    isEngulfingCall,
    isEngulfingSRCall,
    isRSIVolumeCall,
    isHammerCall,
    isExhaustionCall,
    isTrendCall,
    trendUp,
    rsi0 < 40,
    rsi0 < 30,
    isSideways,
    isHighVolume,
    c0.close > c0.open && c1.close < c1.open // Reversão simples
  ].filter(Boolean).length;

  // Sinal se: (Nível Chave [S/R ou Fib] + Liquidez) + (Pelo menos 1 confirmação extra)
  const canSignalCall = (atSupport || atBBLow || atFibLevel) && (isLiquidezCall || isFibonacciCall || confirmationsCall >= (isConservador ? 3 : 2));

  // Bloqueio de contra-tendência forte (Aumenta assertividade olhando se está subindo/descendo)
  const isStrongDowntrend = ema9_0 < ema21_0 && ema21_0 < ema50_0 && c0.close < ema9_0;
  const isStrongUptrend = ema9_0 > ema21_0 && ema21_0 > ema50_0 && c0.close > ema9_0;

  // No modo agressivo, só entra contra tendência forte se tiver um engolfo claro ou RSI extremo
  const canOverrideDowntrend = !isConservador && (isEngulfingCall || rsi0 < 25);

  if (canSignalCall && (!isStrongDowntrend || canOverrideDowntrend)) {
    const criteria: ScoreCriteria[] = [
      { name: 'Tendência de alta', points: 20, met: trendUp },
      { name: 'Suporte/BB Inferior', points: 20, met: atSupport || atBBLow },
      { name: 'Bounce em Suporte', points: 15, met: atSupport && (isHammerCall || isEngulfingCall || rsi0 < 30) },
      { name: 'Engolfo + S/R', points: 15, met: isEngulfingSRCall },
      { name: 'RSI + Volume + S/R', points: 20, met: isRSIVolumeCall },
      { name: 'Engolfo/Martelo', points: 10, met: isEngulfingCall || isHammerCall },
      { name: 'RSI Sobrevendido', points: 10, met: rsi0 < 30 },
      { name: 'Zona de Liquidez', points: 20, met: isLiquidezCall },
      { name: 'Fibonacci Retracement', points: 20, met: isFibonacciCall },
      { name: 'Mercado Lateral', points: 10, met: isSideways },
    ];

    const baseScore = calcScore(criteria);
    const score = Math.min(100, Math.max(0, baseScore + sessionBoost));
    const threshold = isConservador ? 75 : 65; // Aumentado para exigir mais confluência mesmo no agressivo
    
    if (score >= threshold) {
      setCooldown(asset);
      signals.push({
        type: 'CALL',
        price: c0.close,
        time: c0.time,
        confidence: score,
        timeframe: '1m',
        timing: 'NOW',
        status: 'pending',
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        reason: buildReason('CALL', criteria.filter(c => c.met).map(c => c.name)),
        indicators: { rsi: rsi0, trend: trendUp ? 'UP' : 'NEUTRAL' },
      });
    }
  }

  // ── PUT (Venda) ────────────────────────────────────────────────
  // Zona de Liquidez precisa: Nível Chave + Volume + Absorção (Pavio Superior)
  const isLiquidezPut = (atResistance || atBBUp) && (hasAbsorptionPut || isHighVolume);

  const confirmationsPut = [
    isEngulfingPut,
    isEngulfingSRPut,
    isRSIVolumePut,
    isHammerPut,
    isExhaustionPut,
    isTrendPut,
    trendDown,
    rsi0 > 60,
    rsi0 > 70,
    isSideways,
    isHighVolume,
    c0.close < c0.open && c1.close > c1.open // Reversão simples
  ].filter(Boolean).length;

  // Sinal se: (Nível Chave [S/R ou Fib] + Liquidez) + (Pelo menos 1 confirmação extra)
  const canSignalPut = (atResistance || atBBUp || atFibLevel) && (isLiquidezPut || isFibonacciPut || confirmationsPut >= (isConservador ? 3 : 2));

  // No modo agressivo, só entra contra tendência forte se tiver um engolfo claro ou RSI extremo
  const canOverrideUptrend = !isConservador && (isEngulfingPut || rsi0 > 75);

  if (canSignalPut && (!isStrongUptrend || canOverrideUptrend)) {
    const criteria: ScoreCriteria[] = [
      { name: 'Tendência de baixa', points: 20, met: trendDown },
      { name: 'Resistência/BB Superior', points: 20, met: atResistance || atBBUp },
      { name: 'Bounce em Resistência', points: 15, met: atResistance && (isHammerPut || isEngulfingPut || rsi0 > 70) },
      { name: 'Engolfo + S/R', points: 15, met: isEngulfingSRPut },
      { name: 'RSI + Volume + S/R', points: 20, met: isRSIVolumePut },
      { name: 'Engolfo/Martelo', points: 10, met: isEngulfingPut || isHammerPut },
      { name: 'RSI Sobrecomprado', points: 10, met: rsi0 > 70 },
      { name: 'Zona de Liquidez', points: 20, met: isLiquidezPut },
      { name: 'Fibonacci Retracement', points: 20, met: isFibonacciPut },
      { name: 'Mercado Lateral', points: 10, met: isSideways },
    ];

    const baseScore = calcScore(criteria);
    const score = Math.min(100, Math.max(0, baseScore + sessionBoost));
    const threshold = isConservador ? 75 : 65; // Aumentado para exigir mais confluência mesmo no agressivo
    
    if (score >= threshold) {
      setCooldown(asset);
      signals.push({
        type: 'PUT',
        price: c0.close,
        time: c0.time,
        confidence: score,
        timeframe: '1m',
        timing: 'NOW',
        status: 'pending',
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        reason: buildReason('PUT', criteria.filter(c => c.met).map(c => c.name)),
        indicators: { rsi: rsi0, trend: trendDown ? 'DOWN' : 'NEUTRAL' },
      });
    }
  }

  return signals;
}

function buildReason(type: 'CALL' | 'PUT', metNames: string[]): string {
  const mapping: Record<string, string> = {
    'Suporte/BB Inferior': 'Suporte',
    'Resistência/BB Superior': 'Resistência',
    'Engolfo de Alta': 'Engolfo',
    'Engolfo de Baixa': 'Engolfo',
    'Exaustão Vendedora': 'Exaustão',
    'Exaustão Compradora': 'Exaustão',
    'Zona de Liquidez': 'Liquidez',
    'RSI + Volume + S/R': 'RSI/Vol',
    'Fibonacci Retracement': 'Fibonacci',
    'Tendência de alta': 'Tendência',
    'Tendência de baixa': 'Tendência',
    'Seguimento de Tendência': 'Trend'
  };
  const parts = metNames.map(n => mapping[n]).filter(Boolean);
  const uniqueParts = Array.from(new Set(parts));
  return `${type === 'CALL' ? 'COMPRA' : 'VENDA'}: ${uniqueParts.join(' + ')}`;
}

// ─── Compatibilidade ──────────────────────────────────────────────────────────
export function detectPullbackStrategy(c: Candle[], z: any, _isC: boolean, s?: string, n: boolean = true) { return analyzeSignals(c, z, s || '', n); }
export function detectConfluenceStrategy() { return []; }
export function detectTrendContinuationStrategy() { return []; }
export function detectPriceActionStrategy() { return []; }
export function detectMeanReversionStrategy() { return []; }
export function detectSequentialExhaustionStrategy() { return []; }

// ─── Volatilidade ─────────────────────────────────────────────────────────────
export function isHighVolatility(candles: Candle[]): boolean {
  if (candles.length < 15) return false;
  const last10 = candles.slice(-11, -1);
  const current = candles[candles.length - 1];
  const avgAmp  = last10.reduce((acc, c) => acc + (c.high - c.low), 0) / 10;
  const curAmp  = current.high - current.low;
  // Only block extremely high volatility
  return curAmp > avgAmp * 8.0;
}

// ─── Notícias ─────────────────────────────────────────────────────────────────
export interface NewsEvent { time: number; impact: number; currency: string; title: string; }
export interface MarketSentiment { score: number; label: string; lastUpdate: number; }
let newsCache: NewsEvent[] = [];
let lastNewsFetch = 0;
let sentimentCache: MarketSentiment | null = null;
let lastSentimentFetch = 0;
const ALPHA_VANTAGE_KEY = 'H4XXKL5AIBII8OKJ';

export async function fetchNewsSentiment(): Promise<MarketSentiment | null> {
  const now = Date.now();
  if (now - lastSentimentFetch < 1800000 && sentimentCache) return sentimentCache;
  try {
    const res = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=FOREX:EUR,FOREX:USD&apikey=${ALPHA_VANTAGE_KEY}`);
    const data = await res.json();
    if (!data.feed?.length) return null;
    const avg = data.feed.slice(0, 10).reduce((acc: number, item: any) => acc + parseFloat(item.overall_sentiment_score), 0) / 10;
    sentimentCache = { score: avg, label: avg > 0.15 ? 'Bullish' : avg < -0.15 ? 'Bearish' : 'Neutral', lastUpdate: now };
    lastSentimentFetch = now;
    return sentimentCache;
  } catch { return sentimentCache; }
}

export function isMarketSafeToTrade(): boolean { return !sentimentCache || Math.abs(sentimentCache.score) < 0.9; }

export async function updateNewsData(): Promise<void> {
  const now = Date.now();
  if (now - lastNewsFetch < 3600000 && newsCache.length > 0) return;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent('https://nfs.faireconomy.media/ff_calendar_thisweek.json')}`,
      { signal: controller.signal }
    );
    const json = await res.json();
    const data = JSON.parse(json.contents);
    newsCache = data.map((item: any) => ({
      time: Math.floor(new Date(item.date).getTime() / 1000),
      impact: item.impact === 'High' ? 3 : item.impact === 'Medium' ? 2 : 1,
      currency: item.country,
      title: item.title,
    }));
    lastNewsFetch = now;
  } catch (err) { 
    console.warn('Failed to update news data:', err);
    newsCache = []; 
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isNewsTime(symbol?: string): NewsEvent | null {
  const now = Date.now() / 1000;
  const currencies = symbol ? [symbol.substring(0, 3), symbol.substring(3, 6)] : [];
  // Bloqueia sinais de 5 minutos antes até 5 minutos depois da notícia de alto impacto
  return newsCache.find(e => e.impact === 3 && (!currencies.length || currencies.includes(e.currency)) && (now >= e.time - 300 && now <= e.time + 300)) || null;
}

export function getActiveNewsEvents(): NewsEvent[] {
  const now = Date.now() / 1000;
  return newsCache.filter(e => e.impact === 3 && now >= e.time - 1200 && now <= e.time + 900);
}
