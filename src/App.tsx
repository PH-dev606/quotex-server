import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchKlines, calculateZones, calculateSMA, calculateRSI, calculateBollingerBands, analyzeSignals, isNewsTime, fetchNewsSentiment, MarketSentiment, isMarketSafeToTrade, isHighVolatility, getActiveNewsEvents, NewsEvent, getCooldownRemaining } from './services/binanceService';
import { Candle, Signal, ScannerAsset, Timeframe } from './types';
import { TradingChart } from './components/TradingChart';
import { QuotexChart } from './components/QuotexChart';
import { SignalCard } from './components/SignalCard';
import { SignalBanner } from './components/SignalBanner';
import { ResultDashboard, useTradeRegistration } from './components/ResultDashboard';
import { TradeHistoryModal } from './components/TradeHistoryModal';
import { HelpGuideModal } from './components/HelpGuideModal';
import { getStatsByDay } from './services/resultTracker';
import { getActiveSessions } from './utils/marketSessions';
import { 
  Activity, 
  LayoutDashboard, 
  Settings, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  AlertTriangle, 
  Volume2, 
  ShieldCheck, 
  Clock, 
  Zap, 
  ChevronDown,
  ChevronUp,
  Search,
  History,
  Cpu,
  User,
  Lock,
  Mail,
  X,
  Check,
  HelpCircle,
  BarChart2,
  RefreshCw,
  Globe,
  Terminal,
  Database,
  Key,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Reusable Header Control Button with Label and Visual Confirmation
const HeaderControlButton = ({ 
  icon: Icon, 
  label, 
  isActive, 
  onClick, 
  activeClass, 
  tooltip,
  isToggle = true,
  badge = null
}: { 
  icon: any, 
  label: string, 
  isActive: boolean, 
  onClick: () => void, 
  activeClass: string, 
  tooltip: string,
  isToggle?: boolean,
  badge?: React.ReactNode
}) => {
  const [showConfirm, setShowConfirm] = React.useState(false);

  const handleClick = () => {
    onClick();
    if (isToggle) {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 800);
    }
  };

  return (
    <div className="relative group flex flex-col items-center gap-1.5 min-w-[54px] py-1">
      <button 
        onClick={handleClick}
        className={`p-2 rounded-lg transition-all relative ${isActive ? activeClass : 'text-text-secondary hover:bg-white/5'}`}
      >
        <Icon className="w-4 h-4" />
        {badge}
        <AnimatePresence>
          {showConfirm && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 0 }}
              animate={{ opacity: 1, scale: 1.2, y: -25 }}
              exit={{ opacity: 0, scale: 0.8, y: -40 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
            >
              <div className={`p-1 rounded-full shadow-lg ${isActive ? 'bg-primary text-background' : 'bg-danger text-white'}`}>
                {isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
      <span className="text-[7px] font-black uppercase tracking-tighter text-text-secondary group-hover:text-text-primary transition-colors text-center leading-none max-w-[50px]">
        {label}
      </span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-2 py-1 bg-surface border border-white/10 rounded text-[9px] font-bold text-white uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60] shadow-xl">
        {tooltip}
      </div>
    </div>
  );
};

const REGULAR_ASSETS = [
  'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 
  'EURJPY', 'GBPJPY', 'AUDJPY', 'USDCAD', 'EURCAD', 
  'AUDCAD', 'CADJPY', 'EURGBP', 'GBPCAD', 'GBPCHF', 
  'USDCHF', 'CADCHF', 'CHFJPY'
];

const OTC_ASSETS = [
  'USDBRL (OTC)', 'USDIDR (OTC)', 'NZDUSD (OTC)', 'USDARS (OTC)', 'USDCOP (OTC)',
  'USDPHP (OTC)', 'USDPKR (OTC)', 'AUDNZD (OTC)', 'NZDJPY (OTC)', 'USDEGP (OTC)',
  'EURNZD (OTC)', 'USDNGN (OTC)', 'NZDCAD (OTC)'
];

const SYMBOL_MAP: Record<string, string> = {
  'EURUSD': 'EURUSDT',
  'GBPUSD': 'GBPUSDT',
  'AUDUSD': 'AUDUSDT',
  'NZDUSD': 'NZDUSDT',
  'USDJPY': 'USDJPY',
  'EURJPY': 'EURJPY',
  'GBPJPY': 'GBPJPY',
  'AUDJPY': 'AUDJPY',
  'USDCAD': 'USDCAD',
  'EURCAD': 'EURCAD',
  'AUDCAD': 'AUDCAD',
  'CADJPY': 'CADJPY',
  'EURGBP': 'EURGBP',
  'GBPCAD': 'GBPCAD',
  'GBPCHF': 'GBPCHF',
  'USDCHF': 'USDCHF',
  'CADCHF': 'CADCHF',
  'CHFJPY': 'CHFJPY',
};

const getBinanceSymbol = (asset: string) => {
  const cleanAsset = asset.replace(' (OTC)', '');
  return SYMBOL_MAP[cleanAsset] || `${cleanAsset}USDT`;
};

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#060b15] flex items-center justify-center p-4">
          <div className="glass-panel p-8 max-w-md w-full text-center">
            <AlertTriangle className="w-16 h-16 text-danger mx-auto mb-4" />
            <h1 className="text-xl font-black text-white uppercase tracking-widest mb-2">Erro de Inicialização</h1>
            <p className="text-text-secondary text-xs mb-6 leading-relaxed">
              Ocorreu um erro crítico ao carregar o bot. Isso pode ser devido a uma falha na conexão ou dados corrompidos.
            </p>
            <div className="bg-black/40 p-3 rounded-lg text-left mb-6 overflow-auto max-h-32">
              <code className="text-[10px] text-danger font-mono break-all">
                {this.state.error?.message}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-primary text-background font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all"
            >
              Reiniciar Sistema
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  console.log('[App] Rendering main component...');
  const [isOTC, setIsOTC] = useState(true);
  const [bridgeStatus, setBridgeStatus] = useState<{ connected: boolean, isLoggedIn: boolean, account: string, balance?: number | null }>({ connected: false, isLoggedIn: false, account: 'Public', balance: null });
  const [currentAsset, setCurrentAsset] = useState('EURUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [zones, setZones] = useState<{ support: number[], resistance: number[] }>({ support: [], resistance: [] });
  const [activeAssetSignals, setActiveAssetSignals] = useState<Signal[]>([]);
  const [indicators, setIndicators] = useState({
    sma9: [] as number[],
    sma21: [] as number[],
    sma50: [] as number[],
    sma200: [] as number[],
    bb: { upper: [] as number[], lower: [] as number[], middle: [] as number[] },
    rsi: [] as number[],
  });
  const [signals, setSignals] = useState<Signal[]>([]);
  const { register } = useTradeRegistration();
  
  const currentAssets = isOTC ? OTC_ASSETS : REGULAR_ASSETS;

  const [scannerAssets, setScannerAssets] = useState<ScannerAsset[]>(
    currentAssets.map(asset => ({
      symbol: asset,
      price: 0,
      change: 0,
      status: 'scanning',
      confidence: 0
    }))
  );

  useEffect(() => {
    // Update scanner assets when OTC mode changes
    setScannerAssets(currentAssets.map(asset => ({
      symbol: asset,
      price: 0,
      change: 0,
      status: 'scanning',
      confidence: 0
    })));
    
    // Switch current asset if it's not in the new list
    const cleanCurrent = currentAsset.replace(' (OTC)', '');
    if (isOTC) {
      setCurrentAsset(`${cleanCurrent} (OTC)`);
    } else {
      setCurrentAsset(cleanCurrent);
    }
  }, [isOTC]);
  const [bestOpportunity, setBestOpportunity] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConservador, setIsConservador] = useState(true);
  const [isM1Active, setIsM1Active] = useState(true);
  const [isVoiceActive, setIsVoiceActive] = useState(true);
  const [isAutoSwitch, setIsAutoSwitch] = useState(true);
  const [isNewsFilterEnabled, setIsNewsFilterEnabled] = useState(true);
  const [showQuotexChart, setShowQuotexChart] = useState(false);
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [isUpdateLogOpen, setIsUpdateLogOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [quotexEmail, setQuotexEmail] = useState(() => localStorage.getItem('quotex_email') || '');
  const [quotexPassword, setQuotexPassword] = useState(() => localStorage.getItem('quotex_password') || '');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [signalExpired, setSignalExpired] = useState(false);

  useEffect(() => {
    setSignalExpired(false);
  }, [bestOpportunity?.id]);

  const handleCopy = useCallback((signal: Signal) => {
    setCurrentAsset(signal.asset);
  }, []);

  const [marketSentiment, setMarketSentiment] = useState<MarketSentiment | null>(null);
  const [isMarketStable, setIsMarketStable] = useState(true);
  const [activeNewsAlerts, setActiveNewsAlerts] = useState<NewsEvent[]>([]);
  const [acknowledgedNewsIds, setAcknowledgedNewsIds] = useState<Set<string>>(new Set());
  const [newsAlertSound, setNewsAlertSound] = useState<'default' | 'siren' | 'bell'>('siren');

  // News Alert Monitor
  useEffect(() => {
    const checkNews = () => {
      if (!isNewsFilterEnabled) return;
      
      const activeNews = getActiveNewsEvents();
      const newAlerts = activeNews.filter(event => {
        const id = `${event.time}-${event.currency}-${event.title}`;
        return !acknowledgedNewsIds.has(id);
      });

      if (newAlerts.length > 0) {
        setActiveNewsAlerts(prev => {
          const combined = [...prev, ...newAlerts];
          // Deduplicate
          const unique = Array.from(new Map(combined.map(item => [`${item.time}-${item.currency}-${item.title}`, item])).values());
          return unique;
        });

        // Play sound
        playNewsSound();
      }
    };

    const interval = setInterval(checkNews, 30000); // Check every 30 seconds
    checkNews(); // Initial check

    return () => clearInterval(interval);
  }, [isNewsFilterEnabled, acknowledgedNewsIds]);

  const playNewsSound = () => {
    if (!isVoiceActive) return;
    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioContextClass) return;
      
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (newsAlertSound === 'siren') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5);
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 1.0);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 1.5);
      } else if (newsAlertSound === 'bell') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.0);
      } else {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      }

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 2.0);
    } catch (e) {
      console.warn('Audio context error:', e);
    }
  };

  const acknowledgeNews = (event: NewsEvent) => {
    const id = `${event.time}-${event.currency}-${event.title}`;
    setAcknowledgedNewsIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setActiveNewsAlerts(prev => prev.filter(e => `${e.time}-${e.currency}-${e.title}` !== id));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isAssetSelectorOpen && !(event.target as HTMLElement).closest('.asset-selector-container')) {
        setIsAssetSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAssetSelectorOpen]);
  const [toast, setToast] = useState<Signal | null>(null);
  const lastGlobalSignalTimeRef = useRef<number>(0);
  const lastRegisteredIds = useRef<Set<string>>(new Set());

  // Global Scanner: Analyzes all assets to find the best opportunity
  const scanAllAssets = useCallback(async () => {
    const results = await Promise.all(currentAssets.map(async (asset) => {
      try {
        const binanceSymbol = getBinanceSymbol(asset);
        const interval = isM1Active ? '1m' : '5m';
        // Use Quotex Bridge for analysis as requested
        const data = await fetchKlines(asset, interval, 300, bridgeStatus.isLoggedIn);
        const calculatedZones = calculateZones(data);
        
        const allRawSignals = analyzeSignals(data, calculatedZones, asset, isNewsFilterEnabled, isConservador);
        
        const callSignals = allRawSignals.filter(s => s.type === 'CALL');
        const putSignals = allRawSignals.filter(s => s.type === 'PUT');
        
        const assetSignals = allRawSignals
          .filter(s => s.confidence >= (isConservador ? 70 : 55))
          .map(s => {
            const strategyKey = s.reason.includes('Pullback') ? 'PB' : 
                                s.reason.includes('Confluência') ? 'CF' : 
                                s.reason.includes('Tendência') ? 'TC' :
                                s.reason.includes('Price Action') ? 'PA' : 
                                s.reason.includes('Exaustão') ? 'EX' : 
                                s.reason.includes('Fibonacci') ? 'FB' : 'MR';
            
            // If it has confluence, boost the reason text
            const sameTypeSignals = s.type === 'CALL' ? callSignals : putSignals;
            const uniqueStrategies = new Set(sameTypeSignals.map(sig => sig.reason.split(':')[0]));
            const confluenceText = uniqueStrategies.size >= 2 ? ` [CONFLUÊNCIA x${uniqueStrategies.size}]` : '';
            
            const currentInterval = isM1Active ? '1m' : '5m';
            return {
              ...s,
              id: `sig-${s.time}-${s.type}-${asset}-${strategyKey}-${currentInterval}`,
              asset,
              reason: s.reason + confluenceText,
              timeframe: currentInterval as Timeframe
            };
          });

        const lastCandle = data[data.length - 1];
        // Simulate OTC price jitter if active
        const displayPrice = isOTC ? lastCandle.close * (1 + (Math.random() * 0.0001 - 0.00005)) : lastCandle.close;
        
        const bestAssetSignal = assetSignals.length > 0 
          ? assetSignals.reduce((p, c) => p.confidence > c.confidence ? p : c) 
          : null;

        const cooldown = getCooldownRemaining(asset, isConservador);

        return {
          asset: {
            symbol: asset,
            price: displayPrice,
            change: ((lastCandle.close - data[0].close) / data[0].close) * 100,
            status: assetSignals.length > 0 ? 'alert' : 'scanning',
            confidence: bestAssetSignal ? bestAssetSignal.confidence : Math.floor(Math.random() * 10) + 60,
            signalType: bestAssetSignal?.type,
            strategy: bestAssetSignal?.reason.split(':')[0],
            cooldown
          } as ScannerAsset,
          signals: assetSignals
        };
      } catch (e) {
        return {
          asset: {
            symbol: asset,
            price: 0,
            change: 0,
            status: 'scanning',
            confidence: 0
          } as ScannerAsset,
          signals: []
        };
      }
    }));

    const validResults = results.filter((r): r is { asset: ScannerAsset, signals: Signal[] } => r !== null);
    const sortedAssets = validResults.map(r => r.asset).sort((a, b) => {
      if (a.status === 'alert' && b.status !== 'alert') return -1;
      if (a.status !== 'alert' && b.status === 'alert') return 1;
      if (isOTC) {
        const aIsOTC = a.symbol.includes('(OTC)');
        const bIsOTC = b.symbol.includes('(OTC)');
        if (aIsOTC && !bIsOTC) return -1;
        if (!aIsOTC && bIsOTC) return 1;
      }
      return b.confidence - a.confidence;
    });
    setScannerAssets(sortedAssets);

    const allSignals = validResults.flatMap(r => r.signals);

    if (allSignals.length > 0) {
      const best = allSignals.reduce((prev, current) => (prev.confidence > current.confidence) ? prev : current);
      setBestOpportunity(best);
      
      // Auto-switch to best opportunity if enabled and confidence is high
      if (isAutoSwitch && best.confidence >= (isConservador ? 70 : 55)) {
        setCurrentAsset(best.asset);
      }
      
      // Register new signals directly here to avoid skipping
      const newSignalsToRegister = allSignals.filter(s => 
        !lastRegisteredIds.current.has(s.id) && 
        s.confidence >= (isConservador ? 70 : 55)
      );

      if (newSignalsToRegister.length > 0) {
        newSignalsToRegister.forEach(s => {
          lastRegisteredIds.current.add(s.id);
          register({
            asset: s.asset,
            type: s.type,
            confidence: s.confidence,
            reason: s.reason,
            timeframe: s.timeframe,
            price: s.price
          });
        });

        // Keep the set size manageable
        if (lastRegisteredIds.current.size > 200) {
          const idsArray = Array.from(lastRegisteredIds.current);
          lastRegisteredIds.current = new Set(idsArray.slice(-100));
        }
      }

      setSignals(prev => {
        const now = Date.now();
        
        // Filter out signals we already have in the UI list
        const newSignalsForUI = allSignals.filter(s => !prev.some(p => p.id === s.id));
        
        if (newSignalsForUI.length === 0) return prev;
        
        // Update global signal time for cooldown logic if needed elsewhere
        lastGlobalSignalTimeRef.current = now;
        
        // Add all new signals to the UI history (up to 100 for better tracking)
        return [...newSignalsForUI, ...prev].sort((a, b) => b.time - a.time).slice(0, 100);
      });
    } else {
      setBestOpportunity(null);
    }
  }, [currentAssets, isM1Active, isConservador, isOTC, isAutoSwitch, register, bridgeStatus.isLoggedIn, isNewsFilterEnabled]);

  useEffect(() => {
    scanAllAssets();
    const scanInterval = setInterval(scanAllAssets, 5000); // High frequency scan
    
    // Sentiment update every 60s to avoid API rate limits and blocking
    const sentimentInterval = setInterval(async () => {
      const sentiment = await fetchNewsSentiment();
      setMarketSentiment(sentiment);
    }, 60000);

    return () => {
      clearInterval(scanInterval);
      clearInterval(sentimentInterval);
    };
  }, [scanAllAssets]);

  const lastAnnouncedIds = useRef<Set<string>>(new Set());

  // Voice Alerts for All New High-Confidence Signals
  useEffect(() => {
    if (!isVoiceActive || signals.length === 0) return;

    const latestSignals = signals.filter(s => !lastAnnouncedIds.current.has(s.id) && s.confidence >= (isConservador ? 70 : 55));
    
    if (latestSignals.length > 0) {
      // Announce the best of the new ones
      const bestNew = latestSignals.reduce((p, c) => p.confidence > c.confidence ? p : c);
      
      // Mark all new ones as announced to avoid repeated alerts
      latestSignals.forEach(s => lastAnnouncedIds.current.add(s.id));
      
      // Keep the set size manageable
      if (lastAnnouncedIds.current.size > 100) {
        const idsArray = Array.from(lastAnnouncedIds.current);
        lastAnnouncedIds.current = new Set(idsArray.slice(-50));
      }

      // Show Toast Notification
      setToast(bestNew);
      setTimeout(() => setToast(null), 5000);

      // Play Alert Sound
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5); // A4
        
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
      } catch (e) {
        console.warn('Audio context not allowed yet');
      }

      const typeText = bestNew.type === 'CALL' ? 'COMPRA' : 'VENDA';
      const message = `${bestNew.asset.replace(' (OTC)', ' OTC')} ${typeText}`;
      
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, [signals, isVoiceActive]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const binanceSymbol = getBinanceSymbol(currentAsset);
      // Use Quotex Bridge for analysis as requested
      const data = await fetchKlines(currentAsset, timeframe, 300, bridgeStatus.isLoggedIn);
      setCandles(data);
      setIsMarketStable(!isHighVolatility(data));
      setError(null);
      
      const calculatedZones = calculateZones(data);
      setZones(calculatedZones);

      // Run strategies on the full data set for the active chart to show historical signals
      const historicalSignals = analyzeSignals(data, calculatedZones, currentAsset, isNewsFilterEnabled)
        .filter(s => s.confidence >= 70) // Lowered from 85 to 70
        .map(s => ({
          ...s,
          asset: currentAsset,
          id: `hist-${s.time}-${s.type}-${currentAsset}`
        }));
      
      setActiveAssetSignals(historicalSignals);

      // Calculate Indicators for the active chart
      const sma9 = calculateSMA(data, 9);
      const sma21 = calculateSMA(data, 21);
      const sma50 = calculateSMA(data, 50);
      const sma200 = calculateSMA(data, 200);
      const bb = calculateBollingerBands(data, 20, 2.0); // Standard BB for visualization
      const rsi = calculateRSI(data, 14);

      setIndicators({
        sma9,
        sma21,
        sma50,
        sma200,
        bb,
        rsi
      });

      setLoading(false);
    } catch (err) {
      console.error(`Error fetching ${currentAsset}:`, err);
      setError(`Failed to fetch ${currentAsset}.`);
      setLoading(false);
    }
  }, [currentAsset, timeframe]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/status`);
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await res.json();
            setBridgeStatus(data);
          }
        }
      } catch (e) {
        console.warn('Bridge status check failed');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, isConservador ? 10000 : 5000);
    return () => clearInterval(interval);
  }, [fetchData, isConservador]);

  const activeSignal = signals.find(s => s.status === 'pending');

  const handleQuotexLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    
    // Simulate a bit of delay for better UX feel
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/quotex/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: quotexEmail, 
          password: quotexPassword,
          remember: true
        }),
      });
      
      if (!response.ok) {
        let errorData: any = {};
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            errorData = await response.json();
          } else {
            throw new Error(`O servidor não retornou um JSON válido. Verifique se o VITE_API_URL está apontando para o backend correto (e não para o frontend na Vercel).`);
          }
        } catch (parseError: any) {
          if (parseError.message.includes('VITE_API_URL')) {
            throw parseError;
          }
          throw new Error('Erro ao processar a resposta do servidor. Verifique a URL do backend.');
        }

        if (response.status === 401) {
          throw new Error('Credenciais inválidas. Verifique seu e-mail e senha da Quotex.');
        } else if (response.status === 400) {
          throw new Error('Dados incompletos. Por favor, preencha todos os campos.');
        } else {
          throw new Error(errorData.error || 'Falha na comunicação com o servidor. Tente novamente.');
        }
      }

      localStorage.setItem('quotex_email', quotexEmail);
      localStorage.setItem('quotex_password', quotexPassword);
      
      setIsLoginModalOpen(false);
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setLoginError('Não foi possível conectar ao servidor. Verifique sua conexão com a internet.');
      } else {
        setLoginError(err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-text-primary font-sans overflow-x-hidden">
      {/* Header */}
      <header className="min-h-[60px] md:min-h-[80px] h-auto md:h-20 border-b border-white/5 bg-surface/30 backdrop-blur-xl sticky top-0 z-50 px-2 md:px-6 py-2 md:py-0">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-2 md:gap-6 h-full">
          {/* Left: Brand & Connection */}
          <div className="flex items-center justify-between w-full md:w-auto gap-2 md:gap-6 shrink-0">
          <div className="relative group flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 rotate-3 hover:rotate-0 transition-transform duration-500">
              <Activity className="text-background w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <h1 className="text-base md:text-lg font-black tracking-tighter leading-none text-white">
                  QUOTEX <span className="text-primary">TRADE</span>
                </h1>
                <span className={`text-[7px] md:text-[8px] font-bold px-1 md:px-1.5 py-0.5 rounded border uppercase tracking-widest ${!isConservador ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                  {!isConservador ? 'SNIPER' : 'SAFE'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 mt-1 md:mt-1.5">
                <div className="flex items-center gap-1 px-1 py-0.5 bg-white/5 rounded text-[6px] md:text-[7px] font-bold text-text-secondary uppercase tracking-widest">
                  <span className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                  LIVE
                </div>
                <div className="flex items-center gap-1 px-1 py-0.5 bg-white/5 rounded text-[6px] md:text-[7px] font-bold text-text-secondary uppercase tracking-widest">
                  {isM1Active ? 'M1' : 'M5'}
                </div>
                <div className="flex items-center gap-1 px-1 py-0.5 bg-white/5 rounded text-[6px] md:text-[7px] font-bold text-text-secondary uppercase tracking-widest">
                  {bridgeStatus.isLoggedIn ? 'QUOTEX' : 'YAHOO'}
                </div>
                {isOTC && (
                  <div className="flex items-center gap-1 px-1 py-0.5 bg-secondary/10 border border-secondary/20 rounded text-[6px] md:text-[7px] font-bold text-secondary uppercase tracking-widest">
                    OTC
                  </div>
                )}
              </div>
            </div>
            <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-surface border border-white/10 rounded-lg text-[10px] font-medium text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60] shadow-2xl">
              <p className="text-white font-bold mb-1">Quotex Trade Bot v10.0.0</p>
              <p>Sistema de análise automatizada de alta precisão (Session Aware).</p>
            </div>
          </div>

          <div className="h-8 md:h-10 w-px bg-white/10" />

          <div className="flex flex-col gap-0.5 md:gap-1 relative group">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${bridgeStatus.connected ? 'bg-primary shadow-[0_0_8px_rgba(0,255,157,0.5)] animate-pulse' : 'bg-danger shadow-[0_0_8px_rgba(255,68,68,0.5)]'}`} />
              <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] text-text-secondary">Conexão</span>
            </div>
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center gap-1.5 md:gap-2 group/btn"
            >
              <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-colors ${bridgeStatus.isLoggedIn ? 'text-primary' : 'text-text-secondary group-hover/btn:text-text-primary'}`}>
                {bridgeStatus.isLoggedIn ? 'Ativa' : 'Login'}
              </span>
              <User className={`w-2.5 h-2.5 md:w-3 md:h-3 transition-colors ${bridgeStatus.isLoggedIn ? 'text-primary' : 'text-text-secondary group-hover/btn:text-text-primary'}`} />
            </button>
            <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-surface border border-white/10 rounded-lg text-[10px] font-medium text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60] shadow-2xl">
              <p className="text-white font-bold mb-1">Status da Conta</p>
              <p>{bridgeStatus.isLoggedIn ? 'Conectado à sua conta real Quotex.' : 'Conecte sua conta para operar com saldo real.'}</p>
            </div>
          </div>
        </div>

        {/* Center: Market Intelligence */}
        <div className="flex items-center justify-center gap-2 md:gap-3 w-full md:w-auto py-1 md:py-0">
          {(() => {
            const activeNews = isNewsFilterEnabled ? isNewsTime() : null;
            if (activeNews) {
              return (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-danger/10 border border-danger/30 rounded-xl shadow-[0_0_30px_rgba(255,68,68,0.1)]"
                >
                  <AlertTriangle className="w-3.5 md:w-4 h-3.5 md:h-4 text-danger animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-[8px] md:text-[10px] font-black text-danger uppercase tracking-widest leading-none">ALERTA: {activeNews.title}</span>
                    <span className="text-[7px] md:text-[8px] font-bold text-danger/60 uppercase tracking-widest mt-0.5">Pausado</span>
                  </div>
                </motion.div>
              );
            }
            return (
              <div className="flex items-center gap-1.5 md:gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                <div className="relative group">
                  <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-primary/5 rounded-lg border border-primary/10">
                    <Cpu className="w-3 md:w-3.5 h-3 md:h-3.5 text-primary animate-pulse" />
                    <span className="text-[8px] md:text-[9px] font-black text-primary uppercase tracking-widest">IA</span>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface border border-white/10 rounded text-[9px] font-bold text-white uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60] shadow-xl">
                    Inteligência Artificial Analisando
                  </div>
                </div>
                
                {marketSentiment && (
                  <div className="relative group">
                    <div className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border transition-colors ${isMarketSafeToTrade() ? 'bg-primary/5 border-primary/10' : 'bg-danger/5 border-danger/10'}`}>
                      <TrendingUp className={`w-3 md:w-3.5 h-3 md:h-3.5 ${isMarketSafeToTrade() ? 'text-primary' : 'text-danger'}`} />
                      <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest ${isMarketSafeToTrade() ? 'text-primary' : 'text-danger'}`}>
                        {marketSentiment.label}
                      </span>
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface border border-white/10 rounded text-[9px] font-bold text-white uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60] shadow-xl">
                      Sentimento do Mercado Global
                    </div>
                  </div>
                )}

                {(() => {
                  const sessions = getActiveSessions();
                  if (sessions.length === 0) return null;
                  return (
                    <div className="relative group">
                      <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border bg-accent/5 border-accent/10">
                        <Globe className="w-3 md:w-3.5 h-3 md:h-3.5 text-accent" />
                        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-accent">
                          {sessions.map(s => s.name).join(' + ')}
                        </span>
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface border border-white/10 rounded text-[9px] font-bold text-white uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60] shadow-xl">
                        Sessões de Mercado Ativas
                      </div>
                    </div>
                  );
                })()}

                <div className="relative group">
                  <div className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border transition-colors ${isMarketStable ? 'bg-primary/5 border-primary/10' : 'bg-danger/5 border-danger/10'}`}>
                    <ShieldCheck className={`w-3 md:w-3.5 h-3 md:h-3.5 ${isMarketStable ? 'text-primary' : 'text-danger'}`} />
                    <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest ${isMarketStable ? 'text-primary' : 'text-danger'}`}>
                      {isMarketStable ? 'Estável' : 'Instável'}
                    </span>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface border border-white/10 rounded text-[9px] font-bold text-white uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60] shadow-xl">
                    Estabilidade da Volatilidade
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right: Trading Controls */}
        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-center md:justify-end overflow-x-auto no-scrollbar pb-2 md:pb-0">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 shrink-0">
            <HeaderControlButton 
              icon={AlertTriangle}
              label="Notícias"
              isActive={isNewsFilterEnabled}
              onClick={() => setIsNewsFilterEnabled(!isNewsFilterEnabled)}
              activeClass="bg-danger text-white"
              tooltip="Filtro de Notícias"
              badge={isNewsFilterEnabled && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full border-2 border-background animate-pulse" />
              )}
            />

            <HeaderControlButton 
              icon={Zap}
              label="Auto-Ativo"
              isActive={isAutoSwitch}
              onClick={() => setIsAutoSwitch(!isAutoSwitch)}
              activeClass="bg-primary text-background"
              tooltip="Troca Automática de Ativos"
            />

            <HeaderControlButton 
              icon={ShieldCheck}
              label="Seguro"
              isActive={isConservador}
              onClick={() => setIsConservador(!isConservador)}
              activeClass="bg-primary text-background"
              tooltip="Modo Conservador (Mais Seguro)"
            />

            <HeaderControlButton 
              icon={() => <span className="text-[10px] font-black">{isM1Active ? 'M1' : 'M5'}</span>}
              label="Tempo"
              isActive={isM1Active}
              onClick={() => {
                const next = !isM1Active;
                setIsM1Active(next);
                setTimeframe(next ? '1m' : '5m');
              }}
              activeClass="bg-accent text-white"
              tooltip="Tempo de Vela (M1 ou M5)"
            />

            <HeaderControlButton 
              icon={() => <span className="text-[10px] font-black">OTC</span>}
              label="Mercado"
              isActive={isOTC}
              onClick={() => setIsOTC(!isOTC)}
              activeClass="bg-secondary text-background"
              tooltip="Mercado OTC (Fim de Semana)"
            />
          </div>

          <div className="h-8 w-px bg-white/10 mx-1" />

          <div className="flex items-center gap-1">
            <HeaderControlButton 
              icon={Volume2}
              label="Voz"
              isActive={isVoiceActive}
              onClick={() => setIsVoiceActive(!isVoiceActive)}
              activeClass="bg-primary text-background shadow-lg shadow-primary/20"
              tooltip="Voz do Bot (Alertas Sonoros)"
            />

            <HeaderControlButton 
              icon={History}
              label="Relatório"
              isActive={false}
              isToggle={false}
              onClick={() => {
                const today = new Date().toLocaleDateString('pt-BR');
                const dayStats = getStatsByDay().find(d => d.date === today);
                let message = "";
                if (!dayStats || dayStats.trades === 0) {
                  message = "Você ainda não registrou operações hoje.";
                } else {
                  const winRate = dayStats.winRate.toFixed(0);
                  message = `Relatório de hoje: Você teve ${dayStats.wins} vitórias e ${dayStats.losses} derrotas. Sua taxa de acerto é de ${winRate} por cento.`;
                }
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = 'pt-BR';
                window.speechSynthesis.speak(utterance);
              }}
              activeClass="bg-accent/10 text-accent"
              tooltip="Relatório de Performance (Voz)"
            />

            <HeaderControlButton 
              icon={BarChart2}
              label="Histórico"
              isActive={isHistoryModalOpen}
              onClick={() => setIsHistoryModalOpen(true)}
              activeClass="bg-accent text-white"
              tooltip="Histórico Completo de Trades"
              isToggle={false}
            />

            <HeaderControlButton 
              icon={HelpCircle}
              label="Guia"
              isActive={isHelpModalOpen}
              onClick={() => setIsHelpModalOpen(true)}
              activeClass="bg-secondary text-background"
              tooltip="Guia de Uso e Estratégias"
              isToggle={false}
              badge={
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[8px] font-black flex items-center justify-center rounded-full border border-background">
                  4
                </div>
              }
            />
          </div>
        </div>
      </div>
    </header>

      <main className="p-2 md:p-4 max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* OTC Warning Banner */}
        {isOTC && !bridgeStatus.isLoggedIn && (
          <div className="col-span-1 md:col-span-12 bg-danger/10 border border-danger/30 rounded-xl p-3 flex items-center justify-center gap-2 text-danger text-xs font-bold uppercase tracking-widest">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-center">Atenção: Modo OTC requer a Extensão Quotex Bridge ativa para ler os gráficos reais da corretora. Os sinais atuais estão usando dados aproximados do mercado aberto.</span>
          </div>
        )}
        {/* Top Banner Signal */}
        <div className="col-span-1 md:col-span-12">
          <SignalBanner
            signal={signalExpired ? null : bestOpportunity}
            currentAsset={currentAsset}
            onCopy={async (signal) => {
              setCurrentAsset(signal.asset);
              try {
                if (navigator.clipboard && window.isSecureContext) {
                  await navigator.clipboard.writeText(signal.asset);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              } catch {}
            }}
            onExpire={() => {
              setSignalExpired(true);
              setBestOpportunity(null);
            }}
          />
        </div>

        {/* Left Column: Scanner & Chart */}
        <div className="col-span-1 md:col-span-8 space-y-4">
          {/* Scanner (Redesigned to match video) */}
          <section className="glass-panel p-3 md:p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-tight text-base">Scanner de Mercado <span className="text-text-secondary font-medium text-xs">(Prioridade OTC)</span></h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                    <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">Análise em Tempo Real</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-3 pr-2 custom-scrollbar no-scrollbar">
              {scannerAssets.map((asset) => (
                <button 
                  key={asset.symbol}
                  onClick={() => setCurrentAsset(asset.symbol)}
                  className={`flex-shrink-0 w-[190px] p-4 rounded-xl border transition-all text-left relative overflow-hidden ${currentAsset === asset.symbol ? 'bg-primary/5 border-primary/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-[10px] font-black text-white uppercase tracking-tight">{asset.symbol.replace('USDT', '/USD')}</div>
                      <div className="text-lg font-black tracking-tighter mt-1 text-text-primary">{asset.price > 0 ? asset.price.toFixed(2) : '---'}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {asset.status === 'alert' && (
                        <div className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${asset.signalType === 'CALL' ? 'bg-primary text-background' : 'bg-danger text-white'}`}>
                          {asset.signalType === 'CALL' ? 'COMPRA' : 'VENDA'}
                        </div>
                      )}
                      {isNewsTime(asset.symbol) && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-danger/20 border border-danger/30 rounded text-[8px] font-bold text-danger animate-pulse">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          NOTÍCIA
                        </div>
                      )}
                      {asset.cooldown && asset.cooldown > 0 && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-accent/20 border border-accent/30 rounded text-[8px] font-bold text-accent">
                          <Clock className="w-2.5 h-2.5" />
                          {asset.cooldown}s
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex flex-col">
                      <div className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                        {asset.status === 'alert' ? `${asset.confidence}% CONFIANÇA` : 'IA ANALISANDO...'}
                      </div>
                      {asset.strategy && (
                        <div className="text-[8px] font-black text-primary/60 uppercase tracking-tighter mt-0.5">
                          {asset.strategy}
                        </div>
                      )}
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full ${asset.status === 'alert' ? 'bg-primary shadow-[0_0_10px_rgba(0,255,163,0.5)]' : 'bg-white/10 animate-pulse'}`} />
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Chart */}
          <section className="glass-panel p-3 md:p-4 h-[400px] md:h-[550px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="flex bg-white/5 p-1 rounded-lg gap-1">
                  <button 
                    onClick={() => setShowQuotexChart(false)}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md uppercase tracking-wider transition-all ${!showQuotexChart ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Análise (Indicadores)
                  </button>
                  <button 
                    onClick={() => setShowQuotexChart(true)}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md uppercase tracking-wider transition-all ${showQuotexChart ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Quotex Live
                  </button>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="text-[10px] font-bold text-text-primary uppercase tracking-widest bg-white/5 px-2 py-1 rounded flex items-center gap-2">
                  {currentAsset.replace('USDT', '/USD')}
                  <span className="text-[8px] text-text-secondary font-normal lowercase tracking-normal">
                    ({showQuotexChart ? 'Visual' : 'Bot Strategy'})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!showQuotexChart && (
                  <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                    <span className="text-[8px] font-black text-primary uppercase tracking-widest">Estratégias Ativas: RSI + BB + S/R + VOL</span>
                  </div>
                )}
                <button 
                  onClick={() => scanAllAssets()}
                  className="p-2 rounded-lg bg-white/5 text-text-secondary hover:text-primary transition-all group relative"
                  title="Forçar Varredura"
                >
                  <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                </button>
                <button className="p-2 rounded-lg bg-white/5 text-text-secondary hover:text-text-primary transition-all">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-background/50 rounded-xl overflow-hidden border border-white/5 relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Carregando Gráfico...</span>
                  </div>
                </div>
              ) : showQuotexChart ? (
                <QuotexChart asset={currentAsset} bridgeStatus={bridgeStatus} />
              ) : (
                <TradingChart 
                  key={`${currentAsset}-${timeframe}`}
                  data={candles} 
                  zones={zones} 
                  signals={activeAssetSignals}
                  indicators={indicators}
                />
              )}
              
              {!loading && !showQuotexChart && candles.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                  <div className="text-center">
                    <RefreshCw className="w-10 h-10 text-primary mx-auto mb-3 animate-spin" />
                    <p className="text-white font-black uppercase tracking-widest text-sm">Aguardando Dados do Mercado...</p>
                    <p className="text-text-secondary text-[10px] mt-2">Conectando ao servidor de ativos {currentAsset}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Signal Status & History */}
        <div className="col-span-4 space-y-4">
          {/* Result Dashboard & Bankroll Management */}
          <ResultDashboard bridgeStatus={bridgeStatus} />

          {/* Current Signal Details */}
          <section className="glass-panel p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold uppercase tracking-wider text-xs">Sinal Atual</h3>
                {signals.some(s => s.asset === currentAsset) && (
                  <span className="px-1.5 py-0.5 bg-secondary/20 text-secondary text-[7px] font-bold rounded uppercase tracking-widest border border-secondary/30">
                    Alerta de Pré-Sinal
                  </span>
                )}
              </div>
              <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">{currentAsset.replace('USDT', '/USD')}</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 mb-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${signals.some(s => s.asset === currentAsset) ? 'bg-secondary/20' : 'bg-white/5'}`}>
                <div className="text-[9px] font-bold text-text-secondary text-center leading-none">
                  STATUS<br/>
                  <span className={`text-xs font-black ${signals.some(s => s.asset === currentAsset) ? 'text-secondary' : 'text-text-primary'}`}>
                    {signals.some(s => s.asset === currentAsset) ? 'AGUARDE' : '---'}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-xs font-bold">Análise Técnica</h4>
                  <span className="text-[8px] font-bold text-text-secondary uppercase tracking-widest bg-white/5 px-1.5 py-0.5 rounded">
                    {signals.some(s => s.asset === currentAsset) ? 'Preparar Entrada' : 'Análise em curso'}
                  </span>
                </div>
                <div className="text-[9px] font-mono text-text-secondary">
                  {candles.length > 0 ? candles[candles.length - 1].close.toFixed(4) : '0.0000'}
                </div>
                <div className="h-1 bg-white/5 rounded-full mt-1.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: signals.some(s => s.asset === currentAsset) ? '95%' : '65%' }}
                    className={`h-full ${signals.some(s => s.asset === currentAsset) ? 'bg-secondary' : 'bg-primary'}`}
                  />
                </div>
              </div>
            </div>

            {signals.some(s => s.asset === currentAsset) && (
              <div className="mb-4 p-3 bg-secondary/10 border border-secondary/20 rounded-xl flex gap-3">
                <AlertTriangle className="w-4 h-4 text-secondary shrink-0" />
                <div>
                  <h5 className="text-[9px] font-bold text-secondary uppercase tracking-widest">Aguarde a Confirmação</h5>
                  <p className="text-[8px] text-text-secondary mt-1 leading-relaxed">
                    Este é um pré-sinal. Não entre na operação ainda. O Bot está aguardando o gatilho de reversão para confirmar a entrada.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Recent Signals */}
          <section className="glass-panel p-4 flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-accent/20 rounded-lg flex items-center justify-center">
                  <History className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-xs">Sinais Recentes</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1 h-1 bg-primary rounded-full animate-ping" />
                    <span className="text-[8px] font-bold text-text-secondary uppercase tracking-widest">Análise Global Ativa</span>
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest bg-white/5 px-2 py-1 rounded">Últimas 24h</span>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              <AnimatePresence initial={false}>
                {signals.length === 0 ? (
                  <div className="text-center py-8 opacity-30 italic text-xs">
                    Nenhum sinal registrado ainda.
                  </div>
                ) : (
                  signals.map((signal) => (
                    <motion.div
                      key={signal.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="cursor-pointer"
                      onClick={() => setCurrentAsset(signal.asset)}
                    >
                      <SignalCard 
                        signal={signal} 
                        onDelete={(id) => setSignals(prev => prev.filter(s => s.id !== id))}
                      />
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Alert Settings */}
          <section className="glass-panel p-4 bg-surface/20 border-dashed border-white/5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-3.5 h-3.5 text-primary" />
              <h3 className="font-bold uppercase tracking-wider text-[9px]">Configurações de Alerta</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-1.5 block">Som de Notícia</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['default', 'siren', 'bell'] as const).map((sound) => (
                    <button
                      key={sound}
                      onClick={() => {
                        setNewsAlertSound(sound);
                        // Play preview logic
                        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const oscillator = audioCtx.createOscillator();
                        const gainNode = audioCtx.createGain();
                        oscillator.connect(gainNode);
                        gainNode.connect(audioCtx.destination);
                        if (sound === 'siren') {
                          oscillator.type = 'sine';
                          oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
                          oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5);
                        } else if (sound === 'bell') {
                          oscillator.type = 'triangle';
                          oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
                          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                        } else {
                          oscillator.type = 'square';
                          oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
                          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                        }
                        oscillator.start();
                        oscillator.stop(audioCtx.currentTime + 0.5);
                      }}
                      className={`px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border ${newsAlertSound === sound ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/5 text-text-secondary'}`}
                    >
                      {sound === 'default' ? 'Padrão' : sound === 'siren' ? 'Sirene' : 'Sino'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Version History / Update Log */}
          <section className="glass-panel p-4 bg-surface/20 border-dashed border-white/5 overflow-hidden">
            <div 
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => setIsUpdateLogOpen(!isUpdateLogOpen)}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <h3 className="font-bold uppercase tracking-wider text-[9px]">Log de Atualizações</h3>
              </div>
              {isUpdateLogOpen ? <ChevronUp className="w-3.5 h-3.5 text-text-secondary group-hover:text-primary transition-all" /> : <ChevronDown className="w-3.5 h-3.5 text-text-secondary group-hover:text-primary transition-all" />}
            </div>
            
            <AnimatePresence>
              {isUpdateLogOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  <div className="flex gap-3">
                    <div className="w-1 h-1 bg-primary rounded-full mt-1.5 shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold text-text-primary">v10.0.0 - Session Aware Engine</div>
                      <div className="text-[9px] text-text-secondary mt-0.5">O bot agora identifica as sessões de mercado ativas (Londres, Nova York, Tóquio, Sydney) e ajusta a confiança dos sinais com base nos pares de moedas mais recomendados para o horário.</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1 h-auto bg-primary rounded-full" />
                    <div>
                      <div className="text-[10px] font-bold text-text-primary">v9.5.0 - Login Quotex Personalizado</div>
                      <div className="text-[9px] text-text-secondary mt-0.5">Implementado sistema de login para que cada usuário possa conectar sua própria conta da Quotex diretamente pela interface.</div>
                    </div>
                  </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-primary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v8.0.0 - High Frequency Sniper</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Otimização extrema para sinais a cada 5 segundos. Filtros técnicos recalibrados para alta frequência sem perder a lógica de análise real dos gráficos Quotex. Sniper Engine ativado para capturar micro-oportunidades.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-primary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v7.0.0 - Ultra Precision Engine</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Nova arquitetura de análise com alinhamento triplo de tendência (SMA 50/200). Filtros de volatilidade e rejeição de pavio 2x mais rígidos. Confiança mínima elevada para 95% para eliminar Loss.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-primary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v6.3.0 - Precisão de Entrada & Cópia Rápida</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Adicionado indicador visual de entrada (AGORA/PRÓX. VELA) no sinal principal. Botão de copiar ativo adicionado em todos os sinais recentes. Filtros de confiança elevados para 93% para reduzir Loss.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-primary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v6.1.0 - Confluência Obrigatória</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Confluência de 2+ estratégias agora é o padrão para todos os sinais. Frequência reduzida para máxima assertividade e proteção contra Loss.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-primary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v6.0.0 - Modo Conservador Dinâmico</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">O Modo Conservador agora altera drasticamente a rigidez. Quando OFF: Sinais equilibrados (estilo v5.8). Quando ON: Confluência obrigatória de estratégias e filtros técnicos ultra-rígidos.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-primary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v5.9.0 - Confluência Rígida</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Implementado sistema de confluência obrigatória (mínimo 2 estratégias) ou confiança extrema ({'>'}96%). Critérios técnicos tornados mais rígidos para máxima precisão.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-primary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v5.8.0 - Otimização de Estratégias</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Ativado processamento simultâneo de todas as estratégias (Pullback, Confluência, Price Action, etc). Ajuste de sensibilidade para maior volume de sinais e exibição da estratégia no scanner.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-primary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v5.7.1 - Correção de Erros de Script</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Corrigido erro de 'contentWindow' no gráfico da Quotex e otimização da inicialização de áudio para maior estabilidade.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-primary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v5.7.0 - Integração Visual Quotex</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Adicionado suporte para acompanhamento em tempo real do gráfico da Quotex diretamente no bot. Sincronização de ativos e visualização de alta precisão.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-primary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v5.6.0 - Alertas Persistentes e Sons</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Alertas de notícias que exigem confirmação do usuário. Sons de alerta customizáveis (Sirene, Sino, Padrão). Avisos visuais por moeda no scanner.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-primary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v5.5.0 - Alertas de Notícias e Estabilidade</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Sistema de alertas proeminentes para notícias de 3 touros com título e moeda. Monitoramento de estabilidade pós-notícia e integração com o filtro de notícias.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-secondary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v5.4.0 - Análise de Sentimento Alpha Vantage</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Integração com Alpha Vantage para análise de sentimento de mercado em tempo real. O bot agora bloqueia operações em momentos de extrema volatilidade ou pânico no mercado.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-secondary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v5.3.0 - Copiar Ativo e Versionamento</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Botão de copiar sinal agora copia o nome do ativo para a área de transferência. Implementado sistema de versionamento oficial.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-secondary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v5.2.0 - Automação Total e Alertas Globais</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">O bot agora anuncia e exibe sinais de todos os ativos automaticamente, sem necessidade de cliques. Filtro de notícias aprimorado.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-secondary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v4.1.0 - Correção de Filtro de Notícias</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Removido o bloqueio de sinais que ocorria durante os primeiros e últimos 15 minutos de cada hora (Filtro de Notícias). Sinais agora fluem 100% do tempo.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-secondary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v4.0.0 - Foco Total em Sinais Automáticos</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Interface simplificada para focar apenas no recebimento automático das melhores oportunidades, sem necessidade de intervenção manual.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-secondary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v3.0.0 - Automação Total de Sinais</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">O bot agora opera de forma 100% autônoma, buscando as melhores oportunidades e trocando de gráfico sem intervenção humana.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-secondary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v2.7.0 - Notificações e Novas Estratégias</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Adicionado sistema de Toasts (pop-ups), alertas sonoros e estratégia de Cruzamento de Médias.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-secondary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v2.6.0 - Auto-Switch e Análise Global</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">O bot agora troca automaticamente o gráfico para a melhor oportunidade encontrada no scanner global.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-secondary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v2.5.1 - Remoção de Criptoativos</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Foco exclusivo em pares de moedas Forex conforme solicitado.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-secondary rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v2.5.0 - Expansão de Ativos Quotex</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Suporte a 20+ pares de moedas simultâneos. Scanner com rolagem e mapeamento otimizado.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-auto bg-accent rounded-full" />
                <div>
                  <div className="text-[10px] font-bold text-text-primary">v2.4.0 - Orientação de Entrada</div>
                  <div className="text-[9px] text-text-secondary mt-0.5">Aviso visual e sonoro para entradas "Agora" ou "Próxima Vela". Scanner multi-ativo contínuo.</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-white/5 bg-surface/30 px-6 flex items-center justify-between text-[10px] font-bold text-text-secondary uppercase tracking-widest">
        <div className="flex items-center gap-6">
          <span>© 2026 QUOTEX TRADE AI <span className="text-primary/50 ml-2">v10.0.0 SESSION AWARE ENGINE</span></span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary rounded-full" />
            <span>Servidor: São Paulo (BR)</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span>Latência: 12ms</span>
          <span>API: {bridgeStatus.connected ? 'Quotex Bridge (Live)' : 'Yahoo Finance (Live)'}</span>
          <div className="flex items-center gap-1 text-primary">
            <ShieldCheck className="w-3 h-3" />
            <span>Conexão Segura</span>
          </div>
        </div>
      </footer>

      {/* News Alert Overlay (Persistent) */}
      <AnimatePresence>
        {activeNewsAlerts.length > 0 && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md glass-panel p-8 border-danger/50 shadow-[0_0_50px_rgba(255,68,68,0.3)]"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-danger/20 rounded-full flex items-center justify-center mb-6 relative">
                  <AlertTriangle className="w-10 h-10 text-danger animate-bounce" />
                  <span className="absolute inset-0 rounded-full border-4 border-danger animate-ping opacity-20" />
                </div>
                
                <h2 className="text-2xl font-black text-danger uppercase tracking-tighter mb-2">ALERTA DE NOTÍCIA!</h2>
                <p className="text-sm text-text-secondary mb-8">
                  Foram detectadas notícias de alto impacto. Recomendamos cautela extrema ou pausa nas operações nos ativos afetados.
                </p>

                <div className="w-full space-y-3 mb-8 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                  {activeNewsAlerts.map((news) => (
                    <div key={`${news.time}-${news.currency}-${news.title}`} className="p-4 bg-white/5 rounded-xl border border-white/10 text-left">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black text-danger uppercase tracking-widest">{news.currency}</span>
                        <span className="text-[10px] font-bold text-text-secondary">{new Date(news.time * 1000).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-xs font-bold text-text-primary leading-tight">{news.title}</div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => {
                    activeNewsAlerts.forEach(news => acknowledgeNews(news));
                  }}
                  className="w-full py-4 bg-danger text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-danger/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  ESTOU CIENTE E DESEJO CONTINUAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="fixed bottom-20 right-6 z-[100] w-80 glass-panel p-4 border-primary/50 shadow-2xl shadow-primary/20"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${toast.type === 'CALL' ? 'bg-primary/20 text-primary' : 'bg-danger/20 text-danger'}`}>
                {toast.type === 'CALL' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-black tracking-tight">{toast.asset.replace('USDT', '/USD')}</h4>
                  <span className="text-[10px] font-bold text-primary">{toast.confidence}%</span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest mt-1">
                  {toast.type === 'CALL' ? 'COMPRA' : 'VENDA'} • {toast.timing === 'NOW' ? 'AGORA' : 'PRÓX. VELA'}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-[9px] text-text-secondary italic truncate max-w-[180px]">{toast.reason}</span>
              <button 
                onClick={() => {
                  setCurrentAsset(toast.asset);
                  setToast(null);
                }}
                className="text-[9px] font-bold text-primary uppercase tracking-widest hover:underline"
              >
                Ver Gráfico
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Login Modal */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
            >
              {/* Left Side: Instructions */}
              <div className="w-full md:w-6/12 bg-background/50 p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-center overflow-y-auto max-h-[80vh] md:max-h-none">
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary text-[10px] font-bold uppercase tracking-widest mb-4">
                    <Zap className="w-3 h-3" />
                    Configuração Única
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Conexão de Alta Precisão</h2>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Siga este passo a passo detalhado para conectar sua conta. <strong>Você só precisa fazer isso uma vez</strong> (o sistema salvará seu acesso automaticamente).
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-1">
                      <Globe className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">1. Acesse a Corretora</h3>
                      <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                        Abra uma <strong>nova aba</strong> no seu navegador (Chrome, Edge ou Brave) e faça login normalmente na sua conta da Quotex.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-1">
                      <Terminal className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">2. Abra as Ferramentas (F12)</h3>
                      <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                        Na página da Quotex, aperte a tecla <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">F12</kbd> no teclado. <br/>
                        <span className="opacity-70">(Se não funcionar, clique com o botão direito em qualquer lugar da página e escolha "Inspecionar").</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-1">
                      <Database className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">3. Vá em "Application" (Aplicativo)</h3>
                      <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                        No menu superior da janela que abriu, clique na aba <strong>Application</strong> (ou Aplicativo). <br/>
                        <span className="opacity-70">Dica: Se não estiver vendo, clique nas setinhas <kbd className="bg-white/10 px-1 py-0.5 rounded text-[9px]">{'>>'}</kbd> para revelar mais opções.</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-1">
                      <Key className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">4. Copie o Token "session"</h3>
                      <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                        No menu lateral esquerdo, abra <strong>Cookies</strong> e clique no link da Quotex. Na tabela à direita, procure na coluna "Name" por <strong>session</strong>. Dê dois cliques no código gigante ao lado (na coluna "Value") e copie (<kbd className="bg-white/10 px-1 py-0.5 rounded text-[9px]">Ctrl+C</kbd>).
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Form */}
              <div className="w-full md:w-6/12 flex flex-col">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Acesso Quotex</h2>
                      <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">Cole seu token para iniciar</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsLoginModalOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-lg transition-all text-text-secondary"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleQuotexLogin} className="p-6 space-y-4 flex-1 flex flex-col justify-center">
                  {loginError && (
                    <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3 text-danger text-[10px] font-bold uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {loginError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">E-mail da Corretora</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input 
                        type="email" 
                        required
                        value={quotexEmail}
                        onChange={(e) => setQuotexEmail(e.target.value)}
                        placeholder="seu-email@exemplo.com"
                        className="w-full bg-background border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-text-secondary/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Token de Sessão (Cookie)</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input 
                        type="text" 
                        required
                        value={quotexPassword}
                        onChange={(e) => setQuotexPassword(e.target.value)}
                        placeholder="Cole seu cookie 'session' aqui (eyJ...)"
                        className="w-full bg-background border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-text-secondary/30 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <p className="text-[9px] text-text-secondary leading-relaxed">
                      <span className="text-primary font-bold">Aviso Importante:</span> O sistema salvará seu Token automaticamente. Você só precisará repetir este processo se a Quotex desconectar sua conta no navegador original.
                    </p>
                  </div>

                  <button 
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-background font-black py-4 rounded-xl uppercase tracking-[0.2em] text-xs shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 relative overflow-hidden mt-2"
                  >
                    {isLoggingIn ? (
                      <>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 1.5, ease: "easeInOut" }}
                          className="absolute bottom-0 left-0 h-1 bg-white/30"
                        />
                        <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                        <span className="animate-pulse">AUTENTICANDO...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        CONECTAR AGORA
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trade History Modal */}
      <TradeHistoryModal 
        isOpen={isHistoryModalOpen} 
        onClose={() => setIsHistoryModalOpen(false)} 
      />

      {/* Help Guide Modal */}
      <HelpGuideModal 
        isOpen={isHelpModalOpen} 
        onClose={() => setIsHelpModalOpen(false)} 
      />
    </div>
    </ErrorBoundary>
  );
};

export default App;
