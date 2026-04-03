import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, TrendingUp, TrendingDown, Copy, Check, Clock, Search, AlertTriangle } from 'lucide-react';
import { getCooldownRemaining } from '../services/binanceService';
import type { Signal } from '../types';

interface SignalBannerProps {
  signal: Signal | null;
  onCopy?: (signal: Signal) => void;
  onExpire?: () => void;
  currentAsset?: string;
}

export const SignalBanner: React.FC<SignalBannerProps> = ({
  signal,
  onCopy,
  onExpire,
  currentAsset = '',
}) => {
  const [copied, setCopied]         = useState(false);
  const [timeLeft, setTimeLeft]     = useState(60);
  const [expired, setExpired]       = useState(false);
  const [cooldown, setCooldown]     = useState(0);

  // Atualiza cooldown do ativo atual
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentAsset) {
        setCooldown(getCooldownRemaining(currentAsset));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentAsset]);

  // Contador regressivo quando há sinal
  useEffect(() => {
    if (!signal) {
      setTimeLeft(60);
      setExpired(false);
      return;
    }

    // Calcula tempo restante baseado no expiresAt do sinal
    const expiresAt = (signal as any).expiresAt;
    if (expiresAt) {
      const remaining = expiresAt - Math.floor(Date.now() / 1000);
      setTimeLeft(Math.max(0, remaining));
      setExpired(remaining <= 0);
    } else {
      setTimeLeft(60);
      setExpired(false);
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          setExpired(true);
          onExpire?.();
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [signal?.id]);

  const handleCopy = useCallback(async () => {
    if (!signal) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(signal.asset);
      }
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.(signal);
  }, [signal, onCopy]);

  // ── Sem sinal ──────────────────────────────────────────────────
  if (!signal) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-panel p-6 md:p-10 flex flex-col items-center justify-center text-center bg-surface/30 border-dashed border-white/10"
      >
        <div className="w-12 h-12 md:w-16 md:h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
          <Search className="w-6 h-6 md:w-8 md:h-8 text-text-secondary animate-pulse" />
        </div>
        <h2 className="text-lg md:text-xl font-bold text-text-secondary">Analisando setups de alta probabilidade...</h2>
        <p className="text-xs md:text-sm text-text-secondary/40 mt-1">Aguardando confluência de 3+ critérios técnicos</p>
        {cooldown > 0 && (
          <div className="mt-4 flex items-center gap-2 text-secondary text-[10px] md:text-[11px] font-bold bg-secondary/10 px-3 py-1.5 rounded-full border border-secondary/20">
            <Clock className="w-3.5 h-3.5" />
            Cooldown: {Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, '0')}
          </div>
        )}
      </motion.div>
    );
  }

  const isCall      = signal.type === 'CALL';
  const signalColor = isCall ? 'primary' : 'danger';
  const urgency     = timeLeft <= 15 ? 'danger' : timeLeft <= 30 ? 'secondary' : 'primary';

  // Barra de progresso do timer (100% → 0%)
  const timerPercent = (timeLeft / 60) * 100;

  // ── Sinal expirado ─────────────────────────────────────────────
  if (expired) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-panel p-6 md:p-8 flex items-center justify-center gap-4 md:gap-6 border-white/5 bg-surface/30"
      >
        <AlertTriangle className="w-8 h-8 md:w-10 md:h-10 text-text-secondary/40" />
        <div className="text-center">
          <div className="text-base md:text-lg font-black text-text-secondary/40 uppercase tracking-tight">Sinal Expirado</div>
          <div className="text-xs md:text-sm text-text-secondary/30 mt-1">Aguardando próximo setup...</div>
        </div>
      </motion.div>
    );
  }

  // ── Sinal ativo ────────────────────────────────────────────────
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={signal.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`glass-panel overflow-hidden relative ${isCall ? 'border-primary/20' : 'border-danger/20'}`}
      >
        {/* Barra de timer no topo */}
        <div className="h-1 bg-white/5 w-full">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.5 }}
            className={`h-full transition-colors duration-1000 ${
              urgency === 'danger' ? 'bg-danger' :
              urgency === 'secondary' ? 'bg-secondary' : 'bg-primary'
            }`}
          />
        </div>

        <div className="p-4 md:p-6 flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Esquerda: tipo + ativo + análise */}
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full lg:w-auto">
            {/* Badge de direção */}
            <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-2xl flex flex-col items-center justify-center border-2 shrink-0 ${
              isCall
                ? 'bg-primary/10 border-primary/40 shadow-[0_0_30px_rgba(0,200,151,0.15)]'
                : 'bg-danger/10 border-danger/40 shadow-[0_0_30px_rgba(231,76,60,0.15)]'
            }`}>
              {isCall
                ? <TrendingUp className={`w-6 h-6 md:w-7 md:h-7 text-primary`} />
                : <TrendingDown className={`w-6 h-6 md:w-7 md:h-7 text-danger`} />}
              <span className={`text-[8px] md:text-[10px] font-black uppercase mt-1 ${isCall ? 'text-primary' : 'text-danger'}`}>
                {isCall ? 'COMPRA' : 'VENDA'}
              </span>
              {/* Ping */}
              <div className={`absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center ${isCall ? 'bg-primary' : 'bg-danger'}`}>
                <Zap className="w-2.5 h-2.5 md:w-3 md:h-3 text-background fill-current" />
              </div>
            </div>

            {/* Ativo + detalhes */}
            <div className="text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 mb-1">
                <h2 className="text-2xl md:text-4xl font-black tracking-tighter text-white">
                  {signal.asset
                    .replace('USDT', '/USD')
                    .replace('EURUSD', 'EUR/USD')
                    .replace('GBPUSD', 'GBP/USD')
                    .replace('USDJPY', 'USD/JPY')}
                </h2>
                <div className="flex items-center gap-2">
                  {signal.asset.includes('OTC') && (
                    <span className="px-1.5 py-0.5 bg-secondary/20 text-secondary text-[8px] md:text-[9px] font-black rounded border border-secondary/30 uppercase tracking-widest">OTC</span>
                  )}
                  <span className={`px-2 py-0.5 md:px-2.5 md:py-1 text-[8px] md:text-[10px] font-black rounded-lg uppercase tracking-widest ${
                    isCall ? 'bg-primary text-background' : 'bg-danger text-white'
                  }`}>
                    ENTRAR AGORA
                  </span>
                </div>
              </div>

              {/* Razão do sinal */}
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                <p className="text-xs md:text-sm font-bold text-text-primary">
                  {signal.reason}
                </p>
              </div>

              {/* Indicadores */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                {signal.indicators?.rsi !== undefined && (
                  <span className={`text-[8px] md:text-[10px] font-black px-2 py-0.5 rounded border ${
                    signal.indicators.rsi < 35 ? 'bg-primary/10 border-primary/30 text-primary' :
                    signal.indicators.rsi > 65 ? 'bg-danger/10 border-danger/30 text-danger' :
                    'bg-white/5 border-white/10 text-text-secondary'
                  }`}>
                    RSI {signal.indicators.rsi.toFixed(0)}
                  </span>
                )}
                {signal.indicators?.bb && signal.indicators.bb !== 'NONE' && (
                  <span className="text-[8px] md:text-[10px] font-black px-2 py-0.5 rounded border bg-accent/10 border-accent/30 text-accent">
                    BB {signal.indicators.bb === 'TOUCH_LOWER' ? 'FUNDO' : 'TOPO'}
                  </span>
                )}
                {signal.indicators?.trend && signal.indicators.trend !== 'NEUTRAL' && (
                  <span className={`text-[8px] md:text-[10px] font-black px-2 py-0.5 rounded border ${
                    signal.indicators.trend === 'UP'
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-danger/10 border-danger/30 text-danger'
                  }`}>
                    TREND {signal.indicators.trend === 'UP' ? '▲' : '▼'}
                  </span>
                )}
                <span className="text-[8px] md:text-[10px] font-bold text-text-secondary bg-white/5 px-2 py-0.5 rounded border border-white/5">
                  {signal.timeframe.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Direita: confiança + timer + botão */}
          <div className="flex flex-col sm:flex-row items-center gap-6 md:gap-8 shrink-0 w-full lg:w-auto">
            <div className="flex items-center gap-8">
              {/* Score de confiança */}
              <div className="text-center sm:text-right">
                <div className="text-[9px] md:text-[11px] font-bold text-text-secondary uppercase tracking-widest mb-0.5">Assertividade</div>
                <div className={`text-3xl md:text-5xl font-black tracking-tighter ${
                  signal.confidence >= 85 ? 'text-primary' :
                  signal.confidence >= 75 ? 'text-secondary' : 'text-danger'
                }`}>
                  {signal.confidence}%
                </div>
              </div>

              {/* Timer */}
              <div className="text-center">
                <div className="text-[9px] md:text-[11px] font-bold text-text-secondary uppercase tracking-widest mb-0.5">Expira em</div>
                <div className={`text-2xl md:text-4xl font-black tracking-tighter tabular-nums ${
                  urgency === 'danger' ? 'text-danger animate-pulse' :
                  urgency === 'secondary' ? 'text-secondary' : 'text-white'
                }`}>
                  {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                </div>
              </div>
            </div>

            {/* Botão copiar */}
            <button
              onClick={handleCopy}
              disabled={expired}
              className={`w-full sm:w-auto px-6 md:px-10 py-3 md:py-5 font-black text-sm md:text-base uppercase tracking-widest rounded-2xl transition-all active:scale-95 ${
                copied
                  ? 'bg-secondary text-background shadow-[0_8px_30px_rgba(243,156,18,0.3)]'
                  : isCall
                    ? 'bg-primary text-background shadow-[0_8px_30px_rgba(0,200,151,0.3)] hover:scale-105'
                    : 'bg-danger text-white shadow-[0_8px_30px_rgba(231,76,60,0.3)] hover:scale-105'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {copied
                  ? <><Check className="w-4 h-4 md:w-5 md:h-5" /> COPIADO!</>
                  : <><Copy className="w-4 h-4 md:w-5 md:h-5" /> COPIAR SINAL</>}
              </div>
            </button>
          </div>
        </div>

      </motion.div>
    </AnimatePresence>
  );
};
