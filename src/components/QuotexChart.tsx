import React from 'react';

interface QuotexChartProps {
  asset: string;
  bridgeStatus: { connected: boolean, isLoggedIn: boolean, account: string, balance?: number | null };
}

export const QuotexChart: React.FC<QuotexChartProps> = ({ asset, bridgeStatus }) => {
  // Map asset to TradingView symbol
  const cleanAsset = asset.replace(' (OTC)', '');
  let symbol = `FX:${cleanAsset}`;
  
  // Special cases
  if (cleanAsset === 'XAUUSD') symbol = 'OANDA:XAUUSD';
  if (cleanAsset === 'BTCUSD') symbol = 'BINANCE:BTCUSDT';
  if (cleanAsset === 'ETHUSD') symbol = 'BINANCE:ETHUSDT';

  // Construct iframe URL with indicators
  const urlParams = new URLSearchParams({
    symbol: symbol,
    interval: '1',
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'br',
    toolbar_bg: '#0a0b0e',
    enable_publishing: 'false',
    hide_top_toolbar: 'false',
    hide_legend: 'true',
    save_image: 'false',
    backgroundColor: 'rgba(10, 11, 14, 1)',
    gridColor: 'rgba(255, 255, 255, 0.05)',
    container_id: 'tradingview_quotex',
    upColor: '#00ffb2',
    downColor: '#ff4444',
    borderUpColor: '#00ffb2',
    borderDownColor: '#ff4444',
    wickUpColor: '#00ffb2',
    wickDownColor: '#ff4444',
    // Adding indicators (studies)
    studies: JSON.stringify([
      "MASimple@tv-basicstudies",
      "RSI@tv-basicstudies",
      "BollingerBands@tv-basicstudies"
    ])
  });

  const iframeUrl = `https://s.tradingview.com/widgetembed/?${urlParams.toString()}`;

  return (
    <div className="w-full h-full relative bg-[#0a0b0e]">
      <iframe
        title="Quotex Live Chart"
        src={iframeUrl}
        className="w-full h-full border-none"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
      
      {/* Dynamic Connection Status Overlay */}
      <div className="absolute bottom-6 right-6 z-10 flex items-center gap-3 bg-background/90 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 shadow-2xl pointer-events-none">
        <div className="relative">
          <div className={`w-2.5 h-2.5 rounded-full ${bridgeStatus.isLoggedIn ? 'bg-primary shadow-[0_0_10px_rgba(0,255,157,0.6)] animate-pulse' : 'bg-danger shadow-[0_0_10px_rgba(255,68,68,0.6)]'}`} />
          {bridgeStatus.isLoggedIn && (
            <div className="absolute inset-0 w-2.5 h-2.5 bg-primary rounded-full animate-ping opacity-75" />
          )}
        </div>
        <div className="flex flex-col">
          <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${bridgeStatus.isLoggedIn ? 'text-primary' : 'text-danger'}`}>
            {bridgeStatus.isLoggedIn ? 'Sincronizado com Quotex' : 'Desconectado da Quotex'}
          </span>
          <span className="text-[7px] font-bold text-text-secondary uppercase tracking-[0.2em] mt-1">
            {bridgeStatus.isLoggedIn ? `CONTA: ${bridgeStatus.account}` : 'LOGIN NECESSÁRIO'}
          </span>
        </div>
      </div>
    </div>
  );
};
