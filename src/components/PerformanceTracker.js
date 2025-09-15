import React, { useState, useEffect, useCallback } from 'react';
import { getBinanceTrades } from '../binanceApi';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function PerformanceTracker({ binanceApiKey, binanceApiSecret }) {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [tradeHistory, setTradeHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState({
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    totalPnL: 0,
    bestTrade: 0,
    worstTrade: 0
  });
  const [pnlChartData, setPnlChartData] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1m');
  const [timeframeOptions] = useState(['1d', '1w', '1m', '3m', 'all']);

  // Process trades to identify buy/sell pairs and calculate metrics
  const processTrades = useCallback((trades) => {
    // Sort trades by time (oldest first)
    const sortedTrades = [...trades].sort((a, b) => a.time - b.time);
    
    // Process trades to match buys with sells
    const processedTrades = [];
    const buyMap = new Map(); // Map to track buys by price point
    
    sortedTrades.forEach(trade => {
      if (trade.isBuyer) { // BUY trade
        // Add to buy map
        const key = trade.price + "-" + trade.time;
        buyMap.set(key, trade);
      } else { // SELL trade
        // Find matching buy
        // This is simplified - in a real app you'd need more sophisticated matching
        let matchingBuyKey = null;
        for (const [key, buyTrade] of buyMap.entries()) {
          if (parseFloat(buyTrade.qty) === parseFloat(trade.qty)) {
            matchingBuyKey = key;
            break;
          }
        }
        
        if (matchingBuyKey) {
          const buyTrade = buyMap.get(matchingBuyKey);
          buyMap.delete(matchingBuyKey);
          
          // Calculate P&L
          const entryAmount = parseFloat(buyTrade.qty) * parseFloat(buyTrade.price);
          const exitAmount = parseFloat(trade.qty) * parseFloat(trade.price);
          const pnl = exitAmount - entryAmount;
          const pnlPercent = (pnl / entryAmount) * 100;
          
          // Add complete trade to processed list
          processedTrades.push({
            entryTime: new Date(buyTrade.time).toLocaleString(),
            exitTime: new Date(trade.time).toLocaleString(),
            symbol: trade.symbol,
            quantity: parseFloat(trade.qty),
            entryPrice: parseFloat(buyTrade.price),
            exitPrice: parseFloat(trade.price),
            pnl,
            pnlPercent,
            durationMs: trade.time - buyTrade.time
          });
        }
      }
    });
    
    // Calculate metrics
    if (processedTrades.length > 0) {
      const winningTrades = processedTrades.filter(t => t.pnl > 0);
      const losingTrades = processedTrades.filter(t => t.pnl < 0);
      
      const totalPnL = processedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
      const totalWinAmount = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
      const totalLossAmount = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
      
      const bestTrade = processedTrades.length > 0 ? 
        Math.max(...processedTrades.map(t => t.pnlPercent)) : 0;
      const worstTrade = processedTrades.length > 0 ? 
        Math.min(...processedTrades.map(t => t.pnlPercent)) : 0;
      
      setMetrics({
        totalTrades: processedTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: (winningTrades.length / processedTrades.length) * 100,
        avgWin: winningTrades.length > 0 ? totalWinAmount / winningTrades.length : 0,
        avgLoss: losingTrades.length > 0 ? totalLossAmount / losingTrades.length : 0,
        profitFactor: totalLossAmount > 0 ? totalWinAmount / totalLossAmount : 0,
        totalPnL: totalPnL,
        bestTrade,
        worstTrade
      });
      
      // Create chart data
      const cumulativePnL = [];
      let runningTotal = 0;
      
      processedTrades.forEach(trade => {
        runningTotal += trade.pnl;
        cumulativePnL.push({
          time: trade.exitTime,
          pnl: runningTotal
        });
      });
      
      setPnlChartData({
        labels: cumulativePnL.map(point => point.time),
        datasets: [{
          label: 'Cumulative P&L ($)',
          data: cumulativePnL.map(point => point.pnl),
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        }]
      });
    }
    
    return processedTrades;
  }, []);

  // Fetch trade history
  const fetchTradeHistory = useCallback(async () => {
    if (!binanceApiKey || !binanceApiSecret) {
      setError('Binance API keys are not set.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const now = Date.now();
      let startTime = 0;
      
      // Calculate startTime based on selected timeframe
      switch (selectedTimeframe) {
        case '1d':
          startTime = now - (24 * 60 * 60 * 1000); // 1 day ago
          break;
        case '1w':
          startTime = now - (7 * 24 * 60 * 60 * 1000); // 1 week ago
          break;
        case '1m':
          startTime = now - (30 * 24 * 60 * 60 * 1000); // 1 month ago
          break;
        case '3m':
          startTime = now - (90 * 24 * 60 * 60 * 1000); // 3 months ago
          break;
        default:
          startTime = 0; // All time
      }
      
      const trades = await getBinanceTrades(binanceApiKey, binanceApiSecret, symbol);
      
      // Filter trades by timeframe if needed
      const filteredTrades = selectedTimeframe === 'all' ? 
        trades : 
        trades.filter(trade => trade.time >= startTime);
      
      const processedTrades = processTrades(filteredTrades);
      setTradeHistory(processedTrades);
    } catch (err) {
      setError(`Failed to fetch trade history: ${err.message || err}`);
      console.error(err);
    }
    
    setIsLoading(false);
  }, [binanceApiKey, binanceApiSecret, symbol, selectedTimeframe, processTrades]);

  // Fetch trades when parameters change
  useEffect(() => {
    fetchTradeHistory();
  }, [fetchTradeHistory, selectedTimeframe]);

  const handleSymbolChange = (e) => {
    setSymbol(e.target.value.toUpperCase());
  };

  const handleTimeframeChange = (e) => {
    setSelectedTimeframe(e.target.value);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Performance Tracker</h2>
      
      <div style={{ marginBottom: 20, display: 'flex', gap: '20px' }}>
        <div>
          <label>
            Symbol:&nbsp;
            <input type="text" value={symbol} onChange={handleSymbolChange} />
          </label>
          <button onClick={fetchTradeHistory} style={{ marginLeft: 10 }} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Fetch Trades'}
          </button>
        </div>
        
        <div>
          <label>
            Timeframe:&nbsp;
            <select value={selectedTimeframe} onChange={handleTimeframeChange}>
              <option value="1d">Last 24 hours</option>
              <option value="1w">Last week</option>
              <option value="1m">Last month</option>
              <option value="3m">Last 3 months</option>
              <option value="all">All time</option>
            </select>
          </label>
        </div>
      </div>
      
      {error && <div style={{ color: 'red', marginBottom: 15 }}>{error}</div>}
      
      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
        {/* Performance Metrics */}
        <div style={{ flex: '0 0 300px', padding: 15, border: '1px solid #ddd', borderRadius: 5 }}>
          <h3>Performance Metrics</h3>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td>Total Trades:</td>
                <td style={{ textAlign: 'right' }}>{metrics.totalTrades}</td>
              </tr>
              <tr>
                <td>Win Rate:</td>
                <td style={{ textAlign: 'right' }}>{metrics.winRate.toFixed(2)}%</td>
              </tr>
              <tr>
                <td>Profit Factor:</td>
                <td style={{ textAlign: 'right' }}>{metrics.profitFactor.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Total P&L:</td>
                <td style={{ 
                  textAlign: 'right',
                  color: metrics.totalPnL >= 0 ? 'green' : 'red'
                }}>
                  ${metrics.totalPnL.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td>Avg. Winning Trade:</td>
                <td style={{ textAlign: 'right', color: 'green' }}>
                  ${metrics.avgWin.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td>Avg. Losing Trade:</td>
                <td style={{ textAlign: 'right', color: 'red' }}>
                  -${metrics.avgLoss.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td>Best Trade:</td>
                <td style={{ textAlign: 'right', color: 'green' }}>
                  {metrics.bestTrade.toFixed(2)}%
                </td>
              </tr>
              <tr>
                <td>Worst Trade:</td>
                <td style={{ textAlign: 'right', color: 'red' }}>
                  {metrics.worstTrade.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* P&L Chart */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <h3>P&L Chart</h3>
          {pnlChartData ? (
            <Line data={pnlChartData} options={{ responsive: true }} />
          ) : (
            <div>No trade data available for the selected period.</div>
          )}
        </div>
      </div>
      
      {/* Trade History Table */}
      <div style={{ marginTop: 30 }}>
        <h3>Trade History</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid black' }}>
              <th style={{ textAlign: 'left' }}>Entry Time</th>
              <th style={{ textAlign: 'left' }}>Exit Time</th>
              <th style={{ textAlign: 'left' }}>Symbol</th>
              <th style={{ textAlign: 'right' }}>Quantity</th>
              <th style={{ textAlign: 'right' }}>Entry Price</th>
              <th style={{ textAlign: 'right' }}>Exit Price</th>
              <th style={{ textAlign: 'right' }}>P&L ($)</th>
              <th style={{ textAlign: 'right' }}>P&L (%)</th>
              <th style={{ textAlign: 'right' }}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {tradeHistory.length > 0 ? (
              tradeHistory.map((trade, index) => (
                <tr key={index} style={{ 
                  backgroundColor: trade.pnl >= 0 ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)'
                }}>
                  <td>{trade.entryTime}</td>
                  <td>{trade.exitTime}</td>
                  <td>{trade.symbol}</td>
                  <td style={{ textAlign: 'right' }}>{trade.quantity.toFixed(5)}</td>
                  <td style={{ textAlign: 'right' }}>${trade.entryPrice.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>${trade.exitPrice.toFixed(2)}</td>
                  <td style={{ 
                    textAlign: 'right',
                    color: trade.pnl >= 0 ? 'green' : 'red'
                  }}>
                    {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                  </td>
                  <td style={{ 
                    textAlign: 'right',
                    color: trade.pnl >= 0 ? 'green' : 'red'
                  }}>
                    {trade.pnl >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatDuration(trade.durationMs)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: 20 }}>
                  {isLoading ? 'Loading trade history...' : 'No trades found for the selected period.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Helper function to format duration
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default PerformanceTracker;
