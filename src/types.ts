export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Signal {
  id: string;
  time: number;
  type: 'CALL' | 'PUT';
  price: number;
  asset: string;
  confidence: number;
  timeframe: string;
  reason: string;
  timing: 'NOW' | 'NEXT_CANDLE';
  status: 'pending' | 'active' | 'win' | 'loss';
  indicators?: {
    rsi?: number;
    bb?: 'TOUCH_UPPER' | 'TOUCH_LOWER' | 'NONE';
    trend?: 'UP' | 'DOWN' | 'NEUTRAL';
  };
}

export interface ScannerAsset {
  symbol: string;
  price: number;
  change: number;
  status: 'scanning' | 'alert' | 'ready';
  confidence?: number;
  signalType?: 'CALL' | 'PUT';
  strategy?: string;
  cooldown?: number;
}

export type Timeframe = '1m' | '5m' | '15m';
