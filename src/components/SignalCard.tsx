import React, { useState } from 'react';
import { Signal } from '../types';
import { Clock, Zap, Copy, Check, X } from 'lucide-react';
import { format } from 'date-fns';

interface SignalCardProps {
  signal: Signal;
  onDelete?: (id: string) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onDelete }) => {
  const isCall = signal.type === 'CALL';
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(signal.asset);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.warn('Falha ao copiar:', err);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(signal.id);
    }
  };

  return (
    <div className="p-5 bg-[#1a1b23]/60 rounded-2xl border border-white/5 hover:border-primary/30 transition-all group relative overflow-hidden">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-5">
          <div className={`px-4 py-2 rounded-xl flex flex-col items-center justify-center min-w-[85px] border-2 ${isCall ? 'bg-primary/10 text-primary border-primary/30 shadow-[0_0_20px_rgba(0,255,163,0.1)]' : 'bg-danger/10 text-danger border-danger/30 shadow-[0_0_20px_rgba(255,68,68,0.1)]'}`}>
            <span className="text-[9px] font-black uppercase tracking-tighter leading-none opacity-60">SINAL</span>
            <span className="text-[13px] font-black uppercase leading-none mt-1">{isCall ? 'Compra' : 'Venda'}</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-black tracking-tight text-white">{signal.asset.replace('USDT', '/USD')}</h4>
              <span className="text-[10px] font-black bg-white/5 px-2 py-0.5 rounded text-text-secondary border border-white/5 uppercase tracking-widest">{signal.timeframe}</span>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2 text-text-secondary">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold font-mono">{format(signal.time * 1000, 'HH:mm')}</span>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded tracking-tight ${signal.timing === 'NOW' ? 'bg-primary text-background' : 'bg-secondary text-background'}`}>
                {signal.timing === 'NOW' ? 'ENTRAR AGORA' : 'PRÓXIMA VELA'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-xl font-black tracking-tighter text-white">{signal.price.toFixed(2)}</div>
            <div className="flex items-center gap-2 justify-end mt-1">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <div className="text-[12px] font-black text-primary">{signal.confidence}%</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleCopy}
              className={`p-2 rounded-lg border transition-all ${copied ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white'}`}
              title="Copiar Ativo"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            {onDelete && (
              <button 
                onClick={handleDelete}
                className="p-2 rounded-lg border bg-white/5 border-white/10 text-text-secondary hover:bg-danger/20 hover:border-danger hover:text-danger transition-all"
                title="Remover Sinal"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-3">
        {signal.indicators && (
          <>
            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5">
              <span className="text-[9px] text-text-secondary uppercase font-bold">RSI</span>
              <span className={`text-[10px] font-black ${signal.indicators.rsi! > 70 ? 'text-danger' : signal.indicators.rsi! < 30 ? 'text-primary' : 'text-white'}`}>
                {signal.indicators.rsi?.toFixed(1)}
              </span>
            </div>
            {signal.indicators.bb !== 'NONE' && (
              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5">
                <span className="text-[9px] text-text-secondary uppercase font-bold">BB</span>
                <span className="text-[10px] font-black text-secondary">
                  {signal.indicators.bb === 'TOUCH_UPPER' ? 'TOPO' : 'FUNDO'}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5">
              <span className="text-[9px] text-text-secondary uppercase font-bold">TREND</span>
              <span className={`text-[10px] font-black ${signal.indicators.trend === 'UP' ? 'text-primary' : signal.indicators.trend === 'DOWN' ? 'text-danger' : 'text-text-secondary'}`}>
                {signal.indicators.trend === 'UP' ? 'ALTA' : signal.indicators.trend === 'DOWN' ? 'BAIXA' : 'LATERAL'}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 text-[11px] text-text-secondary leading-relaxed font-medium">
        ANÁLISE: <span className="text-text-primary">{signal.reason.split(':')[0]}.</span>
      </div>
    </div>
  );
};
