/**
 * Candle processing utilities
 */

import type { Candle } from '../types';

/**
 * Process raw candle data into standardized format
 */
export function processCandles(rawData: any[], _period: number): Candle[] {
  const candles: Candle[] = [];
  
  for (const data of rawData) {
    // Handle different data formats
    if (data.open !== undefined) {
      const candle: any = {
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        time: data.time || data.timestamp,
      };
      if (data.volume !== undefined) candle.volume = data.volume;
      candles.push(candle as Candle);
    } else if (Array.isArray(data)) {
      // Handle array format [time, open, high, low, close, volume]
      const candle: any = {
        time: data[0],
        open: data[1],
        high: data[2],
        low: data[3],
        close: data[4],
      };
      if (data[5] !== undefined) candle.volume = data[5];
      candles.push(candle as Candle);
    }
  }
  
  return candles;
}

/**
 * Get candle color (green/red/gray)
 */
export function getCandleColor(candle: Candle): 'green' | 'red' | 'gray' {
  if (candle.open < candle.close) {
    return 'green';
  } else if (candle.open > candle.close) {
    return 'red';
  }
  return 'gray';
}

/**
 * Aggregate ticks into candles
 */
export function aggregateTicks(
  ticks: Array<{ price: number; time: number }>,
  period: number
): Candle[] {
  const candles: Map<number, any> = new Map();
  
  for (const tick of ticks) {
    const candleTime = Math.floor(tick.time / period) * period;
    
    if (!candles.has(candleTime)) {
      candles.set(candleTime, {
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        time: candleTime,
        volume: 1,
      });
    } else {
      const candle = candles.get(candleTime)!;
      candle.high = Math.max(candle.high, tick.price);
      candle.low = Math.min(candle.low, tick.price);
      candle.close = tick.price;
      candle.volume = (candle.volume || 0) + 1;
    }
  }
  
  return Array.from(candles.values()).sort((a, b) => a.time - b.time) as Candle[];
}

/**
 * Merge candles from different sources
 */
export function mergeCandles(candles1: Candle[], candles2: Candle[]): Candle[] {
  const merged = new Map<number, Candle>();
  
  for (const candle of [...candles1, ...candles2]) {
    merged.set(candle.time, candle);
  }
  
  return Array.from(merged.values()).sort((a, b) => a.time - b.time);
}

/**
 * Calculate candle body size
 */
export function getCandleBodySize(candle: Candle): number {
  return Math.abs(candle.close - candle.open);
}

/**
 * Calculate candle range (high - low)
 */
export function getCandleRange(candle: Candle): number {
  return candle.high - candle.low;
}

/**
 * Check if candle is bullish
 */
export function isBullish(candle: Candle): boolean {
  return candle.close > candle.open;
}

/**
 * Check if candle is bearish
 */
export function isBearish(candle: Candle): boolean {
  return candle.close < candle.open;
}

/**
 * Check if candle is doji
 */
export function isDoji(candle: Candle, threshold: number = 0.1): boolean {
  const bodySize = getCandleBodySize(candle);
  const range = getCandleRange(candle);
  return bodySize / range < threshold;
}

/**
 * Get upper shadow size
 */
export function getUpperShadow(candle: Candle): number {
  const top = Math.max(candle.open, candle.close);
  return candle.high - top;
}

/**
 * Get lower shadow size
 */
export function getLowerShadow(candle: Candle): number {
  const bottom = Math.min(candle.open, candle.close);
  return bottom - candle.low;
}

/**
 * Aggregate candle data (NEW_FUNCTION - matches Python SDK)
 * Port of Python SDK's aggregate_candle function
 */
export function aggregateCandle(
  tick: Record<number, any>,
  candles: Record<number, any>
): Record<number, any> {
  for (const [timestamp, data] of Object.entries(tick)) {
    const ts = Number(timestamp);
    
    if (!candles[ts]) {
      candles[ts] = {
        symbol: data.symbol,
        open: data.open,
        close: data.close,
        high: data.high,
        low: data.low,
        timestamp: ts,
      };
    } else {
      candles[ts].close = data.close;
      candles[ts].high = Math.max(candles[ts].high, data.high);
      candles[ts].low = Math.min(candles[ts].low, data.low);
    }
  }
  
  return candles;
}
