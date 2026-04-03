import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  History, 
  Calendar, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search,
  ChevronDown,
  Download,
  Trash2,
  TrendingUp,
  TrendingDown,
  BarChart2
} from 'lucide-react';
import { TradeRecord, getAllTrades, clearAllTrades, getStats } from '../services/resultTracker';

interface TradeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TradeHistoryModal: React.FC<TradeHistoryModalProps> = ({ isOpen, onClose }) => {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [filterAsset, setFilterAsset] = useState('');
  const [filterResult, setFilterResult] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [filterPeriod, setFilterPeriod] = useState<'ALL' | 'DAY' | 'WEEK'>('ALL');
  const [sortField, setSortField] = useState<keyof TradeRecord>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load trades when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTrades(getAllTrades());
    }
  }, [isOpen]);

  const filteredTrades = useMemo(() => {
    let result = [...trades];

    // Filter by asset
    if (filterAsset) {
      result = result.filter(t => t.asset.toLowerCase().includes(filterAsset.toLowerCase()));
    }

    // Filter by result
    if (filterResult !== 'ALL') {
      result = result.filter(t => t.result === filterResult);
    }

    // Filter by period
    if (filterPeriod !== 'ALL') {
      const now = Math.floor(Date.now() / 1000);
      const dayInSec = 24 * 60 * 60;
      const weekInSec = 7 * dayInSec;
      
      if (filterPeriod === 'DAY') {
        result = result.filter(t => now - t.timestamp <= dayInSec);
      } else if (filterPeriod === 'WEEK') {
        result = result.filter(t => now - t.timestamp <= weekInSec);
      }
    }

    // Sort
    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      
      return 0;
    });

    return result;
  }, [trades, filterAsset, filterResult, filterPeriod, sortField, sortOrder]);

  const stats = useMemo(() => getStats(filteredTrades), [filteredTrades]);

  const handleSort = (field: keyof TradeRecord) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleClear = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o histórico?')) {
      clearAllTrades();
      setTrades([]);
    }
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Ativo', 'Tipo', 'Preço Entrada', 'Resultado', 'Lucro/Prejuízo', 'Estratégia'];
    const rows = filteredTrades.map(t => [
      new Date(t.timestamp * 1000).toLocaleString('pt-BR'),
      t.asset,
      t.type,
      t.entryPrice.toFixed(5),
      t.result,
      t.profit.toFixed(2),
      t.strategy
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historico_trades_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 md:p-4">
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
            className="relative w-full max-w-5xl h-[90vh] bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <History className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Histórico de Operações</h2>
                  <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">Relatório detalhado de performance</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={exportToCSV}
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-text-secondary hover:text-text-primary hidden md:flex"
                  title="Exportar CSV"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleClear}
                  className="p-2.5 bg-danger/10 hover:bg-danger/20 rounded-xl transition-all text-danger"
                  title="Limpar Histórico"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={onClose}
                  className="p-2.5 hover:bg-white/5 rounded-xl transition-all text-text-secondary"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 p-4 bg-white/2">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="text-[9px] text-text-secondary uppercase tracking-widest font-bold mb-1">Total Trades</div>
                <div className="text-xl font-black text-text-primary">{stats.total}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="text-[9px] text-text-secondary uppercase tracking-widest font-bold mb-1">Win Rate</div>
                <div className={`text-xl font-black ${stats.winRate >= 55 ? 'text-primary' : 'text-danger'}`}>{stats.winRate.toFixed(1)}%</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="text-[9px] text-text-secondary uppercase tracking-widest font-bold mb-1">Lucro Total</div>
                <div className={`text-xl font-black ${stats.profit >= 0 ? 'text-primary' : 'text-danger'}`}>
                  {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="text-[9px] text-text-secondary uppercase tracking-widest font-bold mb-1">Resultado</div>
                <div className="flex items-center gap-2 text-xl font-black">
                  <span className="text-primary">{stats.wins}W</span>
                  <span className="text-white/20">/</span>
                  <span className="text-danger">{stats.losses}L</span>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-white/5 flex flex-col md:flex-row gap-3 bg-white/2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input 
                  type="text" 
                  placeholder="Filtrar por ativo (ex: EURUSD)..."
                  value={filterAsset}
                  onChange={(e) => setFilterAsset(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
              <div className="flex gap-2">
                <select 
                  value={filterResult}
                  onChange={(e) => setFilterResult(e.target.value as any)}
                  className="bg-background border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 appearance-none cursor-pointer"
                >
                  <option value="ALL">Todos Resultados</option>
                  <option value="WIN">Apenas Wins</option>
                  <option value="LOSS">Apenas Loss</option>
                </select>
                <select 
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value as any)}
                  className="bg-background border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 appearance-none cursor-pointer"
                >
                  <option value="ALL">Todo Período</option>
                  <option value="DAY">Últimas 24h</option>
                  <option value="WEEK">Última Semana</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface z-10 shadow-sm">
                  <tr className="border-b border-white/10">
                    <th className="p-4 text-[10px] font-black text-text-secondary uppercase tracking-widest cursor-pointer hover:text-text-primary" onClick={() => handleSort('timestamp')}>
                      Data/Hora {sortField === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-4 text-[10px] font-black text-text-secondary uppercase tracking-widest cursor-pointer hover:text-text-primary" onClick={() => handleSort('asset')}>
                      Ativo {sortField === 'asset' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Tipo</th>
                    <th className="p-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Preço</th>
                    <th className="p-4 text-[10px] font-black text-text-secondary uppercase tracking-widest cursor-pointer hover:text-text-primary" onClick={() => handleSort('result')}>
                      Resultado {sortField === 'result' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-4 text-[10px] font-black text-text-secondary uppercase tracking-widest cursor-pointer hover:text-text-primary" onClick={() => handleSort('profit')}>
                      Lucro {sortField === 'profit' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-4 text-[10px] font-black text-text-secondary uppercase tracking-widest hidden md:table-cell">Estratégia</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.length > 0 ? (
                    filteredTrades.map((trade) => (
                      <tr key={trade.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        <td className="p-4">
                          <div className="text-xs font-bold text-text-primary">
                            {new Date(trade.timestamp * 1000).toLocaleDateString('pt-BR')}
                          </div>
                          <div className="text-[10px] text-text-secondary">
                            {new Date(trade.timestamp * 1000).toLocaleTimeString('pt-BR')}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-black text-text-primary uppercase">{trade.asset.replace('USDT', '')}</span>
                        </td>
                        <td className="p-4">
                          <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${trade.type === 'CALL' ? 'text-primary' : 'text-danger'}`}>
                            {trade.type === 'CALL' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {trade.type === 'CALL' ? 'Compra' : 'Venda'}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-mono text-text-secondary">{trade.entryPrice.toFixed(5)}</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${trade.result === 'WIN' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-danger/20 text-danger border border-danger/30'}`}>
                            {trade.result}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs font-black ${trade.profit >= 0 ? 'text-primary' : 'text-danger'}`}>
                            {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-tighter">{trade.strategy}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-30">
                          <BarChart2 className="w-16 h-16" />
                          <p className="text-sm font-bold uppercase tracking-widest">Nenhuma operação encontrada</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-white/5 flex items-center justify-between">
              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                Exibindo {filteredTrades.length} de {trades.length} operações
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Dados Sincronizados</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
