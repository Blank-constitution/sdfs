import React from 'react';
import TradingViewWidget from 'react-tradingview-widget';
import { useTheme } from '../contexts/ThemeContext';

const TradingViewChart = ({ symbol }) => {
  const { theme } = useTheme();

  return (
    <div style={{ height: 'calc(100vh - 100px)', padding: '10px' }}>
      <TradingViewWidget
        symbol={`BINANCE:${symbol}`}
        theme={theme === 'dark' ? 'dark' : 'light'}
        autosize
        interval="60"
        timezone="Etc/UTC"
        style="1"
        locale="en"
        toolbar_bg="#f1f3f6"
        enable_publishing={false}
        allow_symbol_change={true}
        container_id="tradingview_chart_container"
      />
    </div>
  );
};

export default TradingViewChart;
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
  }, [symbol]);

  return (
    <div style={{ padding: 20 }}>
      <h2>TradingView Chart: {symbol}</h2>
      {loading && <p>Loading chart data...</p>}
      <div ref={chartContainerRef} style={{ position: 'relative' }} />
    </div>
  );
};

export default TradingViewChart;
