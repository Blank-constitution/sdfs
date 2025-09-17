import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { useTheme } from '../contexts/ThemeContext';
import { getHistoricalData } from '../api/binance';

const TradingViewChart = ({ symbol }) => {
  const { theme } = useTheme();
  const chartRef = useRef();
  const candleSeriesRef = useRef();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.resize(chartRef.current.clientWidth, chartRef.current.clientHeight);
      }
    };

    // Create chart
    chartRef.current = createChart('tradingview_chart_container', {
      width: chartRef.current.clientWidth,
      height: chartRef.current.clientHeight,
      layout: {
        backgroundColor: theme === 'dark' ? '#000' : '#fff',
        textColor: theme === 'dark' ? '#fff' : '#000',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
    });

    candleSeriesRef.current = chartRef.current.addCandlestickSeries();

    // Fetch historical data
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const history = await getHistoricalData(symbol, '1h', 200);
        const formattedData = history.map(d => ({
          time: d[0] / 1000,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));
        candleSeriesRef.current.setData(formattedData);
      } catch (error) {
        console.error("Failed to fetch historical data for chart:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    // Setup WebSocket for real-time updates
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_1m`);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const kline = message.k;
      candleSeriesRef.current.update({
        time: kline.t / 1000,
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      ws.close();
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [symbol, theme]);

  return (
    <div style={{ padding: 20 }}>
      <h2>TradingView Chart: {symbol}</h2>
      {loading && <p>Loading chart data...</p>}
      <div ref={chartRef} style={{ position: 'relative', height: 'calc(100vh - 100px)', padding: '10px' }} />
    </div>
  );
};

export default TradingViewChart;
export default TradingViewChart;
