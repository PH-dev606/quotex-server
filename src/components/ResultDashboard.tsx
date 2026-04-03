/**
 * ResultDashboard.tsx
 * Painel de resultados, gestão de banca e registro de win/loss
 * Adicione este componente no App.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp, TrendingDown, BarChart2, DollarSign,
  CheckCircle, XCircle, Clock, Trash2, Settings,
  ChevronDown, ChevronUp, AlertTriangle, Target,
  Volume2
} from 'lucide-react';
import {
  getAllTrades, saveTrade, deleteTrade, clearAllTrades, clearPendingTrades,
  registerResult, getStats, getStatsByStrategy, getStatsByAsset,
  getStatsByDay, getSettings, saveSettings, isTradingAllowed,
  getPendingTrades, createTradeRecord,
  type TradeRecord, type BankrollSettings,
} from '../services/resultTracker';

// ─── Componente principal ─────────────────────────────────────────────────────

interface ResultDashboardProps {
  bridgeStatus?: { connected: boolean, isLoggedIn: boolean, account: string, balance?: number | null };
}

export const ResultDashboard: React.FC<ResultDashboardProps> = ({ bridgeStatus }) => {
  const [trades, setTrades]             = useState<TradeRecord[]>([]);
  const [settings, setSettings]         = useState<BankrollSettings>(getSettings());
  const [activeTab, setActiveTab]       = useState<'trades' | 'stats' | 'settings'>('trades');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingSettings, setEditingSettings]   = useState(false);
  const [tempSettings, setTempSettings]         = useState<BankrollSettings>(getSettings());
  const [isMinimized, setIsMinimized]   = useState(false);

  const reload = useCallback(() => {
    setTrades(getAllTrades());
    setSettings(getSettings());
  }, []);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 2000);
    return () => clearInterval(interval);
  }, [reload]);

  // Sync real balance from Quotex if logged in
  useEffect(() => {
    if (bridgeStatus?.isLoggedIn && bridgeStatus.balance !== undefined && bridgeStatus.balance !== null) {
      const currentSettings = getSettings();
      if (currentSettings.currentBalance !== bridgeStatus.balance) {
        currentSettings.currentBalance = bridgeStatus.balance;
        saveSettings(currentSettings);
        setSettings(currentSettings);
        setTempSettings(currentSettings);
      }
    }
  }, [bridgeStatus?.balance, bridgeStatus?.isLoggedIn]);

  const stats        = getStats();
  const byStrategy   = getStatsByStrategy();
  const byAsset      = getStatsByAsset();
  const byDay        = getStatsByDay();
  const pending      = getPendingTrades();
  const tradingCheck = isTradingAllowed();

  function handleResult(id: string, result: 'WIN' | 'LOSS') {
    registerResult(id, result);
    reload();
  }

  function handleDelete(id: string) {
    deleteTrade(id);
    reload();
  }

  function handleClearAll() {
    clearAllTrades();
    setShowClearConfirm(false);
    reload();
  }

  function handleClearPending() {
    clearPendingTrades();
    reload();
  }

  const announceDailyStats = useCallback(() => {
    const today = new Date().toLocaleDateString('pt-BR');
    const dayStats = getStatsByDay().find(d => d.date === today);
    
    let message = "";
    if (!dayStats || dayStats.trades === 0) {
      message = "Você ainda não registrou operações hoje.";
    } else {
      const winRate = dayStats.winRate.toFixed(0);
      message = `Relatório de hoje: Você teve ${dayStats.wins} vitórias e ${dayStats.losses} derrotas. Sua taxa de acerto é de ${winRate} por cento.`;
      if (dayStats.profit > 0) {
        message += ` Seu lucro total é de ${dayStats.profit.toFixed(0)} reais.`;
      } else if (dayStats.profit < 0) {
        message += ` Seu prejuízo total é de ${Math.abs(dayStats.profit).toFixed(0)} reais.`;
      }
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  function handleSaveSettings() {
    saveSettings(tempSettings);
    setSettings(tempSettings);
    setEditingSettings(false);
  }

  const profitColor = stats.profit >= 0 ? 'text-primary' : 'text-danger';

  return (
    <div className="glass-panel overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b border-white/5 cursor-pointer"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider">Registro de Resultados</h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span className={`text-[10px] font-bold ${stats.winRate >= 55 ? 'text-primary' : stats.winRate >= 45 ? 'text-secondary' : 'text-danger'}`}>
                {stats.total > 0 ? `${stats.winRate.toFixed(1)}% win rate` : 'Sem dados ainda'}
              </span>
              {stats.total > 0 && (
                <span className={`text-[10px] font-bold ${profitColor}`}>
                  {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)}
                </span>
              )}
              {!tradingCheck.allowed && (
                <span className="text-[9px] font-black text-danger uppercase tracking-widest bg-danger/10 px-1.5 py-0.5 rounded border border-danger/30">
                  STOP ATIVO
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              announceDailyStats();
            }}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-text-secondary hover:text-primary transition-all"
            title="Relatório de Voz"
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-bold text-text-secondary bg-white/5 px-2 py-1 rounded">
            Saldo: R$ {settings.currentBalance.toFixed(2)}
          </span>
          {isMinimized ? <ChevronDown className="w-4 h-4 text-text-secondary" /> : <ChevronUp className="w-4 h-4 text-text-secondary" />}
        </div>
      </div>

      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Pendentes */}
            {pending.length > 0 && (
              <div className="px-4 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[9px] font-black text-secondary uppercase tracking-widest">
                    Aguardando resultado ({pending.length})
                  </div>
                  <button
                    onClick={handleClearPending}
                    className="text-[9px] text-text-secondary hover:text-danger transition-all flex items-center gap-1"
                    title="Excluir todos aguardando"
                  >
                    <Trash2 className="w-3 h-3" /> Excluir todos
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {pending.map(trade => (
                    <div key={trade.id} className="flex items-center gap-3 p-3 bg-secondary/10 border border-secondary/20 rounded-xl">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${trade.type === 'CALL' ? 'bg-primary/20' : 'bg-danger/20'}`}>
                        {trade.type === 'CALL'
                          ? <TrendingUp className="w-5 h-5 text-primary" />
                          : <TrendingDown className="w-5 h-5 text-danger" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-black text-white">{trade.asset}</div>
                        <div className="text-[9px] text-text-secondary truncate">{trade.strategy.split(':')[0]}</div>
                        <div className="text-[9px] text-secondary font-bold">Stake: R$ {trade.stake.toFixed(2)}</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleResult(trade.id, 'WIN')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary/20 border border-primary/40 text-primary rounded-lg text-[10px] font-black uppercase hover:bg-primary/30 transition-all"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> WIN
                        </button>
                        <button
                          onClick={() => handleResult(trade.id, 'LOSS')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-danger/20 border border-danger/40 text-danger rounded-lg text-[10px] font-black uppercase hover:bg-danger/30 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" /> LOSS
                        </button>
                        <button
                          onClick={() => handleDelete(trade.id)}
                          className="p-1.5 text-text-secondary hover:text-danger transition-all"
                          title="Excluir sinal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 px-4 pt-4">
              {(['trades', 'stats', 'settings'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-primary text-background' : 'bg-white/5 text-text-secondary hover:text-text-primary'}`}
                >
                  {tab === 'trades' ? 'Histórico' : tab === 'stats' ? 'Estatísticas' : 'Banca'}
                </button>
              ))}
            </div>

            {/* Tab: Histórico */}
            {activeTab === 'trades' && (
              <div className="p-4">
                {/* Cards de resumo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'Total', value: stats.total, color: 'text-text-primary' },
                    { label: 'Wins', value: stats.wins, color: 'text-primary' },
                    { label: 'Loss', value: stats.losses, color: 'text-danger' },
                    { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 55 ? 'text-primary' : stats.winRate >= 45 ? 'text-secondary' : 'text-danger' },
                  ].map(item => (
                    <div key={item.label} className="bg-white/5 rounded-xl p-2 md:p-3 text-center border border-white/5">
                      <div className={`text-base md:text-lg font-black ${item.color}`}>{item.value}</div>
                      <div className="text-[8px] md:text-[9px] text-text-secondary uppercase tracking-widest mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Lista de trades */}
                <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                  {trades.filter(t => t.result !== 'PENDING').length === 0 ? (
                    <div className="text-center py-8 text-text-secondary/40 italic text-sm">
                      Nenhum resultado registrado ainda.<br />
                      <span className="text-[11px]">Quando um sinal aparecer, clique WIN ou LOSS acima.</span>
                    </div>
                  ) : (
                    Object.entries(
                      trades.filter(t => t.result !== 'PENDING').reduce((acc, trade) => {
                        const dateStr = new Date(trade.timestamp * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
                        if (!acc[dateStr]) acc[dateStr] = [];
                        acc[dateStr].push(trade);
                        return acc;
                      }, {} as Record<string, typeof trades>)
                    ).map(([date, dayTrades]) => (
                      <div key={date} className="space-y-2">
                        <div className="sticky top-0 bg-[#0a0b0e]/90 backdrop-blur-sm py-1 z-10 text-[10px] font-black text-text-secondary uppercase tracking-widest border-b border-white/5">
                          {date}
                        </div>
                        {dayTrades.slice(0, 100).map(trade => (
                          <div key={trade.id} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/5 hover:border-white/10 transition-all group">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${trade.result === 'WIN' ? 'bg-primary/20' : 'bg-danger/20'}`}>
                              {trade.result === 'WIN'
                                ? <CheckCircle className="w-4 h-4 text-primary" />
                                : <XCircle className="w-4 h-4 text-danger" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-white">{trade.asset}</span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${trade.type === 'CALL' ? 'bg-primary/20 text-primary' : 'bg-danger/20 text-danger'}`}>
                                  {trade.type}
                                </span>
                                <span className="text-[9px] text-text-secondary bg-white/5 px-1 rounded">{trade.timeframe}</span>
                                <span className="text-[9px] text-text-secondary">{trade.confidence}%</span>
                              </div>
                              <div className="text-[9px] text-text-secondary truncate mt-0.5">
                                {trade.strategy.split(':')[0]} • {trade.entryPrice ? trade.entryPrice.toFixed(5) : 'N/A'}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`text-[12px] font-black ${trade.profit >= 0 ? 'text-primary' : 'text-danger'}`}>
                                {trade.profit >= 0 ? '+' : ''}R$ {trade.profit.toFixed(2)}
                              </div>
                              <div className="text-[9px] text-text-secondary flex items-center justify-end gap-1">
                                <span>R$ {trade.stake.toFixed(2)}</span>
                                <span className="text-white/30">•</span>
                                <span>{new Date(trade.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                onClick={() => {
                                  const newStake = prompt('Novo valor de entrada (R$):', trade.stake.toString());
                                  if (newStake && !isNaN(parseFloat(newStake))) {
                                    const newPayout = prompt('Novo Payout (%):', trade.payout.toString());
                                    if (newPayout && !isNaN(parseFloat(newPayout))) {
                                      import('../services/resultTracker').then(({ updateTradeRecord }) => {
                                        updateTradeRecord(trade.id, { 
                                          stake: parseFloat(newStake), 
                                          payout: parseFloat(newPayout) 
                                        });
                                        reload();
                                      });
                                    }
                                  }
                                }}
                                className="p-1 text-text-secondary hover:text-primary transition-all"
                                title="Editar entrada/payout"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(trade.id)}
                                className="p-1 text-text-secondary hover:text-danger transition-all"
                                title="Excluir sinal"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                {trades.length > 0 && (
                  <div className="mt-3 flex justify-end">
                    {showClearConfirm ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-danger">Confirmar?</span>
                        <button onClick={handleClearAll} className="px-2 py-1 bg-danger text-white rounded text-[10px] font-bold">Sim, apagar</button>
                        <button onClick={() => setShowClearConfirm(false)} className="px-2 py-1 bg-white/10 text-text-secondary rounded text-[10px]">Cancelar</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowClearConfirm(true)}
                        className="text-[10px] text-text-secondary hover:text-danger transition-all flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Limpar histórico
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Estatísticas */}
            {activeTab === 'stats' && (
              <div className="p-4 space-y-4">
                {/* Por estratégia */}
                <div>
                  <div className="text-[9px] font-black text-text-secondary uppercase tracking-widest mb-2">Por Estratégia</div>
                  {byStrategy.length === 0 ? (
                    <div className="text-[11px] text-text-secondary/40 italic text-center py-4">Sem dados ainda</div>
                  ) : (
                    <div className="space-y-2">
                      {byStrategy.map(s => (
                        <div key={s.strategy} className="flex items-center gap-3 p-2.5 bg-white/5 rounded-xl border border-white/5">
                          <Target className="w-4 h-4 text-accent shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black text-white truncate">{s.strategy}</div>
                            <div className="text-[9px] text-text-secondary">{s.total} ops · {s.wins}W {s.losses}L</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-[13px] font-black ${s.winRate >= 55 ? 'text-primary' : s.winRate >= 45 ? 'text-secondary' : 'text-danger'}`}>
                              {s.winRate.toFixed(1)}%
                            </div>
                            <div className={`text-[9px] font-bold ${s.profit >= 0 ? 'text-primary' : 'text-danger'}`}>
                              {s.profit >= 0 ? '+' : ''}{s.profit.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Por ativo */}
                <div>
                  <div className="text-[9px] font-black text-text-secondary uppercase tracking-widest mb-2">Por Ativo</div>
                  {byAsset.length === 0 ? (
                    <div className="text-[11px] text-text-secondary/40 italic text-center py-4">Sem dados ainda</div>
                  ) : (
                    <div className="space-y-2">
                      {byAsset.slice(0, 6).map(a => (
                        <div key={a.asset} className="flex items-center gap-3 p-2.5 bg-white/5 rounded-xl border border-white/5">
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black text-white">{a.asset.replace(' (OTC)', ' OTC')}</div>
                            <div className="text-[9px] text-text-secondary">{a.total} operações</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-[9px] text-text-secondary">{a.wins}W {a.losses}L</div>
                            <div className={`text-[13px] font-black min-w-[45px] text-right ${a.winRate >= 55 ? 'text-primary' : a.winRate >= 45 ? 'text-secondary' : 'text-danger'}`}>
                              {a.winRate.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Por dia */}
                <div>
                  <div className="text-[9px] font-black text-text-secondary uppercase tracking-widest mb-2">Por Dia</div>
                  {byDay.length === 0 ? (
                    <div className="text-[11px] text-text-secondary/40 italic text-center py-4">Sem dados ainda</div>
                  ) : (
                    <div className="space-y-2">
                      {byDay.slice(0, 7).map(d => (
                        <div key={d.date} className="flex items-center gap-3 p-2.5 bg-white/5 rounded-xl border border-white/5">
                          <div className="flex-1">
                            <div className="text-[10px] font-black text-white">{d.date}</div>
                            <div className="text-[9px] text-text-secondary">{d.trades} ops</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`text-[13px] font-black ${d.winRate >= 55 ? 'text-primary' : d.winRate >= 45 ? 'text-secondary' : 'text-danger'}`}>
                              {d.winRate.toFixed(1)}%
                            </div>
                            <div className={`text-[12px] font-black min-w-[55px] text-right ${d.profit >= 0 ? 'text-primary' : 'text-danger'}`}>
                              {d.profit >= 0 ? '+' : ''}{d.profit.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Configurações de banca */}
            {activeTab === 'settings' && (
              <div className="p-4">
                {editingSettings ? (
                  <div className="space-y-3">
                    {[
                      { key: 'initialBalance', label: 'Saldo inicial (R$)', min: 1 },
                      { key: 'currentBalance', label: 'Saldo atual (R$)', min: 0 },
                      { key: 'stakePercent', label: 'Stake por operação (%)', min: 0.5, max: 10, step: 0.5 },
                      { key: 'stopLossDay', label: 'Stop loss diário (%)', min: 1, max: 50 },
                      { key: 'payout', label: 'Payout (%)', min: 50, max: 100 },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-1">
                          {field.label}
                        </label>
                        <input
                          type="number"
                          value={(tempSettings as any)[field.key]}
                          min={field.min}
                          max={field.max}
                          step={field.step || 1}
                          onChange={e => setTempSettings(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button onClick={handleSaveSettings} className="flex-1 py-2 bg-primary text-background font-black text-[11px] uppercase rounded-lg">Salvar</button>
                      <button onClick={() => setEditingSettings(false)} className="flex-1 py-2 bg-white/10 text-text-secondary font-bold text-[11px] uppercase rounded-lg">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Saldo inicial', value: `R$ ${settings.initialBalance.toFixed(2)}` },
                        { label: 'Saldo atual', value: `R$ ${settings.currentBalance.toFixed(2)}`, highlight: settings.currentBalance >= settings.initialBalance },
                        { label: 'Stake/operação', value: `${settings.stakePercent}% · R$ ${(settings.currentBalance * settings.stakePercent / 100).toFixed(2)}` },
                        { label: 'Stop loss/dia', value: `${settings.stopLossDay}% · R$ ${(settings.currentBalance * settings.stopLossDay / 100).toFixed(2)}` },
                        { label: 'Payout', value: `${settings.payout}%` },
                      ].map(item => (
                        <div key={item.label} className="bg-white/5 rounded-xl p-3 border border-white/5">
                          <div className="text-[9px] text-text-secondary uppercase tracking-widest">{item.label}</div>
                          <div className={`text-[12px] font-black mt-1 ${item.highlight === false ? 'text-danger' : item.highlight ? 'text-primary' : 'text-white'}`}>
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Lucro/prejuízo total */}
                    <div className={`p-3 rounded-xl border ${stats.profit >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-danger/10 border-danger/20'}`}>
                      <div className="text-[9px] text-text-secondary uppercase tracking-widest">Resultado total</div>
                      <div className={`text-xl font-black mt-1 ${stats.profit >= 0 ? 'text-primary' : 'text-danger'}`}>
                        {stats.profit >= 0 ? '+' : ''}R$ {stats.profit.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-text-secondary mt-1">
                        {stats.total} operações · {stats.winRate.toFixed(1)}% de acerto
                      </div>
                    </div>

                    <button
                      onClick={() => { setTempSettings(settings); setEditingSettings(true); }}
                      className="w-full py-2.5 bg-white/5 border border-white/10 text-text-primary font-bold text-[11px] uppercase tracking-wider rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <Settings className="w-4 h-4" /> Editar configurações
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Hook para usar no App.tsx ────────────────────────────────────────────────

export function useTradeRegistration() {
  const register = useCallback((signal: {
    asset: string;
    type: 'CALL' | 'PUT';
    confidence: number;
    reason: string;
    timeframe: string;
    price: number;
  }) => {
    const check = isTradingAllowed();
    if (!check.allowed) {
      console.warn('[TradeReg] Bloqueado:', check.reason);
      return null;
    }

    const trade = createTradeRecord({
      asset: signal.asset,
      type: signal.type,
      confidence: signal.confidence,
      strategy: signal.reason,
      timeframe: signal.timeframe,
      entryPrice: signal.price,
    });

    saveTrade(trade);
    return trade;
  }, []);

  return { register, isTradingAllowed };
}
