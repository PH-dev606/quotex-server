import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, CandlestickData, Time, LineSeries, SeriesMarker, SeriesMarkerPosition, SeriesMarkerShape, HistogramSeries } from 'lightweight-charts';
import { Candle, Signal } from '../types';

interface TradingChartProps {
  data: Candle[];
  zones: { support: number[], resistance: number[] };
  signals: Signal[];
  indicators: {
    sma9: number[];
    sma21: number[];
    sma50: number[];
    sma200: number[];
    bb: { upper: number[], lower: number[], middle: number[] };
    rsi: number[];
  };
}

export const TradingChart: React.FC<TradingChartProps> = ({ data, zones, signals, indicators }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const sma9SeriesRef = useRef<any>(null);
  const sma21SeriesRef = useRef<any>(null);
  const sma50SeriesRef = useRef<any>(null);
  const sma200SeriesRef = useRef<any>(null);
  const bbUpperSeriesRef = useRef<any>(null);
  const bbLowerSeriesRef = useRef<any>(null);
  const rsiSeriesRef = useRef<any>(null);
  const rsiChartRef = useRef<any>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const volumeSeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !rsiContainerRef.current) return;
    console.log('[TradingChart] Initializing charts...');

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#060b15' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.05)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.05)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#3498db', width: 1, style: 2 },
        horzLine: { color: '#3498db', width: 1, style: 2 },
      },
      rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.1)' },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth || 800,
      height: chartContainerRef.current.clientHeight || 400,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00c897',
      downColor: '#e74c3c',
      borderVisible: false,
      wickUpColor: '#00c897',
      wickDownColor: '#e74c3c',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(0, 200, 151, 0.2)',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // Overlay on the main chart
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Indicators
    const sma9Series = chart.addSeries(LineSeries, { color: '#3498db', lineWidth: 1, title: 'SMA 9' });
    const sma21Series = chart.addSeries(LineSeries, { color: '#f1c40f', lineWidth: 1, title: 'SMA 21' });
    const sma50Series = chart.addSeries(LineSeries, { color: '#e67e22', lineWidth: 1, title: 'SMA 50' });
    const sma200Series = chart.addSeries(LineSeries, { color: '#9b59b6', lineWidth: 2, title: 'SMA 200' });
    
    const bbUpperSeries = chart.addSeries(LineSeries, { color: 'rgba(52, 152, 219, 0.3)', lineWidth: 1, lineStyle: 2, title: 'BB Upper' });
    const bbLowerSeries = chart.addSeries(LineSeries, { color: 'rgba(52, 152, 219, 0.3)', lineWidth: 1, lineStyle: 2, title: 'BB Lower' });

    // RSI Chart
    const rsiChart = createChart(rsiContainerRef.current, {
      layout: { background: { color: '#060b15' }, textColor: '#94a3b8' },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.05)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.05)' },
      },
      width: rsiContainerRef.current.clientWidth || 800,
      height: rsiContainerRef.current.clientHeight || 128,
      rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.1)', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { visible: false },
    });

    const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#9b59b6', lineWidth: 1, title: 'RSI' });
    
    // RSI Levels
    rsiChart.addSeries(LineSeries, { color: 'rgba(231, 76, 60, 0.3)', lineWidth: 1, lineStyle: 2 }).setData([{ time: 0 as Time, value: 70 }, { time: 9999999999 as Time, value: 70 }]);
    rsiChart.addSeries(LineSeries, { color: 'rgba(0, 200, 151, 0.3)', lineWidth: 1, lineStyle: 2 }).setData([{ time: 0 as Time, value: 30 }, { time: 9999999999 as Time, value: 30 }]);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    sma9SeriesRef.current = sma9Series;
    sma21SeriesRef.current = sma21Series;
    sma50SeriesRef.current = sma50Series;
    sma200SeriesRef.current = sma200Series;
    bbUpperSeriesRef.current = bbUpperSeries;
    bbLowerSeriesRef.current = bbLowerSeries;
    
    rsiChartRef.current = rsiChart;
    rsiSeriesRef.current = rsiSeries;

    // Sync charts
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      rsiChart.timeScale().setVisibleRange(range as any);
    });

    const handleResize = () => {
      if (chartContainerRef.current && rsiContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth || 800, 
          height: chartContainerRef.current.clientHeight || 400 
        });
        rsiChart.applyOptions({ 
          width: rsiContainerRef.current.clientWidth || 800, 
          height: rsiContainerRef.current.clientHeight || 128 
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);
    resizeObserver.observe(rsiContainerRef.current);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
      rsiChart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  const priceLinesRef = useRef<any[]>([]);

  useEffect(() => {
    if (candleSeriesRef.current && data.length > 0) {
      console.log(`[TradingChart] Updating data for ${data.length} candles`);
      const formattedData: CandlestickData<Time>[] = data.map(c => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      candleSeriesRef.current.setData(formattedData);

      const volumeData = data.map(c => ({
        time: c.time as Time,
        value: c.volume || 0,
        color: c.close >= c.open ? 'rgba(0, 200, 151, 0.3)' : 'rgba(231, 76, 60, 0.3)',
      }));
      volumeSeriesRef.current.setData(volumeData);

      // Indicators Data
      const formatIndicator = (values: number[]) => values.map((v, i) => ({ time: data[i].time as Time, value: v })).filter(v => v.value !== 0);
      
      sma9SeriesRef.current.setData(formatIndicator(indicators.sma9));
      sma21SeriesRef.current.setData(formatIndicator(indicators.sma21));
      sma50SeriesRef.current.setData(formatIndicator(indicators.sma50));
      sma200SeriesRef.current.setData(formatIndicator(indicators.sma200));
      bbUpperSeriesRef.current.setData(formatIndicator(indicators.bb.upper));
      bbLowerSeriesRef.current.setData(formatIndicator(indicators.bb.lower));
      rsiSeriesRef.current.setData(formatIndicator(indicators.rsi));

      // Markers (Signals)
    const markers: SeriesMarker<Time>[] = signals.map(s => {
      const isHighConfidence = s.confidence >= 90;
      const isMediumConfidence = s.confidence >= 80;
      const isCall = s.type === 'CALL';
      
      // Use confidence to determine size and color intensity
      const size = isHighConfidence ? 3 : isMediumConfidence ? 2 : 1;
      const color = isCall 
        ? (isHighConfidence ? '#00ffb2' : isMediumConfidence ? '#00e69d' : '#00c897') 
        : (isHighConfidence ? '#ff4444' : isMediumConfidence ? '#f05242' : '#e74c3c');
      
      return {
        time: s.time as Time,
        position: isCall ? 'belowBar' : 'aboveBar',
        color: color,
        shape: isCall ? 'arrowUp' : 'arrowDown',
        text: `${s.type} ${s.confidence}%`,
        size: size,
      };
    });
    
    if (candleSeriesRef.current && typeof candleSeriesRef.current.setMarkers === 'function') {
      try {
        candleSeriesRef.current.setMarkers(markers);
      } catch (e) {
        console.error('[TradingChart] Error setting markers:', e);
      }
    }
  }
}, [data, indicators, signals]);

  useEffect(() => {
    if (!candleSeriesRef.current) return;

    try {
      // Clear old lines
      priceLinesRef.current.forEach(line => {
        try {
          candleSeriesRef.current.removePriceLine(line);
        } catch (e) {
          // Ignore removal errors
        }
      });
      priceLinesRef.current = [];

      zones.resistance.forEach(price => {
        const line = candleSeriesRef.current.createPriceLine({
          price,
          color: 'rgba(231, 76, 60, 0.4)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'LIQ RES',
        });
        priceLinesRef.current.push(line);
      });

      zones.support.forEach(price => {
        const line = candleSeriesRef.current.createPriceLine({
          price,
          color: 'rgba(0, 200, 151, 0.4)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'LIQ SUP',
        });
        priceLinesRef.current.push(line);
      });
    } catch (e) {
      console.error('[TradingChart] Error updating zones:', e);
    }
  }, [zones]);

  return (
    <div className="w-full h-full flex flex-col bg-[#060b15] min-h-[400px] relative">
      <div className="flex-grow relative min-h-[300px]">
        <div ref={chartContainerRef} className="w-full h-full absolute inset-0" />
      </div>
      <div className="h-32 border-t border-slate-800/50 relative">
        <div ref={rsiContainerRef} className="w-full h-full absolute inset-0" />
        <div className="absolute top-2 left-2 text-[10px] uppercase tracking-wider text-slate-500 font-mono">RSI (14)</div>
      </div>
      
      {/* Chart Overlay Info */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
        <div className="flex items-center gap-2 bg-background/80 backdrop-blur-md px-2 py-1 rounded border border-white/5">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-[9px] font-black text-text-primary uppercase tracking-widest">IA SCANNER LIVE</span>
        </div>
      </div>
    </div>
  );
};
