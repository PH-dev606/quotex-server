import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  HelpCircle, 
  Zap, 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertTriangle, 
  Volume2, 
  History,
  Settings,
  Cpu,
  BarChart2,
  CheckCircle2
} from 'lucide-react';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ isOpen, onClose }) => {
  const sections = [
    {
      title: 'Controles do Robô',
      items: [
        { icon: Shield, label: 'Modo Conservador', desc: 'Filtra apenas sinais com alta confiança (75%+). Quando desligado, o robô entra em modo Sniper.' },
        { icon: Zap, label: 'Modo Sniper', desc: 'Filtra sinais com confiança moderada (60%+). Quando desligado, o robô volta ao modo Conservador.' },
        { icon: Clock, label: 'Tempo (M1/M5)', desc: 'Alterna entre análise de velas de 1 ou 5 minutos. Desligar (M5) foca em tendências mais longas.' },
        { icon: Volume2, label: 'Voz do Bot', desc: 'Ativa alertas sonoros. Quando desligado, o bot opera em silêncio absoluto.' },
        { icon: History, label: 'Relatório', desc: 'Gera um resumo falado. Desligar apenas interrompe a leitura atual.' },
      ]
    },
    {
      title: 'Estratégias Ativas (Confluência)',
      items: [
        { icon: Cpu, label: 'Suporte & Resistência', desc: 'ESTRATÉGIA FIXA: O robô só opera se o preço estiver tocando um nível chave de S/R.' },
        { icon: TrendingUp, label: 'Zona de Liquidez', desc: 'ESTRATÉGIA FIXA: Analisa picos de volume e absorção. Obrigatória em todas as operações.' },
        { icon: Zap, label: 'Bounce (Rebote)', desc: 'Estratégia de alta probabilidade (70-80%) em mercados laterais. Opera o rebote em zonas de S/R com confirmação de Martelo ou RSI extremo.' },
        { icon: BarChart2, label: 'Engolfo + S/R', desc: 'Confirmação extra: Vela bearish com wick na baixa sendo engolida por vela bullish em suporte forte.' },
        { icon: TrendingUp, label: 'Fibonacci', desc: 'ESTRATÉGIA NOVA: Identifica pullbacks em níveis de 38.2%, 50% ou 61.8% com confirmação de candle e RSI.' },
        { icon: TrendingUp, label: 'RSI + Volume', desc: 'Confirmação extra: RSI em níveis extremos (40/60) combinado com spike de volume em zonas de S/R.' },
        { icon: AlertTriangle, label: 'Exaustão', desc: 'Confirmação extra: Identifica sequências longas de velas, prevendo correção.' },
      ]
    },
    {
      title: 'Alertas e Avisos',
      items: [
        { icon: AlertTriangle, label: 'Notícia', desc: 'O robô monitora o calendário econômico. Quando há notícias de alto impacto, as operações são pausadas.' },
        { icon: CheckCircle2, label: 'Confiança', desc: 'Calculada pela IA. Requer S/R + Liquidez + 1 estratégia extra para validar o sinal.' },
      ]
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/90 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Guia de Uso & Estratégias</h2>
                  <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">Entenda como o robô funciona</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2.5 hover:bg-white/5 rounded-xl transition-all text-text-secondary"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 space-y-8 custom-scrollbar">
              <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
                <p className="text-xs text-text-primary leading-relaxed">
                  Atualmente, temos <span className="text-primary font-black">5 ESTRATÉGIAS</span> rodando em confluência. O robô exige <span className="text-primary font-black">Nível Chave (S/R ou Fib) + Zona de Liquidez</span> como base fixa, somada a pelo menos uma confirmação extra para gerar um sinal.
                </p>
              </div>

              {sections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-4">
                  <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] border-l-2 border-primary pl-3">
                    {section.title}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.items.map((item, iIdx) => (
                      <div key={iIdx} className="flex gap-4 p-3 bg-white/2 rounded-xl border border-white/5 hover:bg-white/5 transition-all">
                        <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center shrink-0">
                          <item.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-text-primary uppercase tracking-tight mb-1">{item.label}</h4>
                          <p className="text-[10px] text-text-secondary leading-normal">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-white/5 flex items-center justify-center">
              <p className="text-[9px] text-text-secondary uppercase tracking-widest font-bold">
                Versão 9.1.0 • Inteligência Artificial Aplicada
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
