import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { getHistoricalData } from '../binanceApi';
import { runStrategy } from '../strategyEngine';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function BacktestingDashboard() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [strategy, setStrategy] = useState('conservativeConfluence');
  const [startDate, setStartDate] = useState(getOneMonthAgo());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  function getOneMonthAgo() {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  }

  function getTodayDate() {
    return new Date().toISOString().split('T')[0];
  }

  async function runBacktest() {
    setIsLoading(true);
    setError('');
    try {
      // Fetch historical data for the date range
      const historicalData = await getHistoricalData(symbol, '1h', 1000); // Get max data
      
      // Filter by date range
      const startTimestamp = new Date(startDate).getTime();
      const endTimestamp = new Date(endDate).getTime() + 86400000; // Include end date (add one day)
      const filteredData = historicalData.filter(candle => {
        const candleTime = candle[0];
        return candleTime >= startTimestamp && candleTime <= endTimestamp;
      });
      
      if (filteredData.length === 0) {
        throw new Error('No data available for selected date range');
      }

      // Run the backtest simulation
      let balance = 1000; // Start with $1000 USDT
      let coin = 0;
      let lastSignal = null;
      let trades = [];

      const signals = [];
      const balances = [balance];
      const timestamps = [filteredData[0][0]];

      // Simulate trading
      for (let i = 50; i < filteredData.length; i++) { // Start at 50 to have enough data for indicators
        const dataSlice = filteredData.slice(0, i);
        const price = parseFloat(filteredData[i][4]); // Close price
        
        // Mock market data object
        const marketData = { price: price.toString() };
        
        // Get signal for this point in time
        const signal = await runStrategy(strategy, marketData, dataSlice);
        signals.push({ 
          timestamp: filteredData[i][0],
          price, 
          signal: signal.signal, 
          reason: signal.reason 
        });

        // Execute trade if signal changed
        if (signal.signal !== lastSignal) {
          if (signal.signal === 'BUY' && balance > 0) {
            coin = balance / price;
            balance = 0;
            trades.push({
              type: 'BUY',
              price,
              amount: coin,
              timestamp: filteredData[i][0]
            });
          } else if (signal.signal === 'SELL' && coin > 0) {
            balance = coin * price;
            coin = 0;
            trades.push({
              type: 'SELL',
              price,
              amount: balance / price,
              timestamp: filteredData[i][0]
            });
          }
          lastSignal = signal.signal;
        }

        // Record balance at this point
        balances.push(balance + (coin * price));
        timestamps.push(filteredData[i][0]);
      }

      // Final value
      const finalBalance = balance + (coin * parseFloat(filteredData[filteredData.length - 1][4]));
      const totalReturn = ((finalBalance - 1000) / 1000) * 100;
      const totalTrades = trades.length;
      
      // Prepare chart data
      const chartData = {
        labels: timestamps.map(ts => new Date(ts).toLocaleDateString()),
        datasets: [{
          label: 'Portfolio Value ($)',
          data: balances,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        }]
      };

      setResults({
        finalBalance,
        totalReturn,
        totalTrades,
        trades,
        chartData,
        signals: signals.filter(s => s.signal === 'BUY' || s.signal === 'SELL')
      });
    } catch (err) {
      setError(`Backtest failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Backtesting Dashboard</h2>
      <div style={{ marginBottom: 20, padding: 10, border: '1px solid #ccc' }}>
        <div style={{ display: 'flex', gap: '20px', marginBottom: 10 }}>
          <label>
            Symbol:&nbsp;
            <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} />
          </label>
          <label>
            Strategy:&nbsp;
            <select value={strategy} onChange={e => setStrategy(e.target.value)}>
              <option value="conservativeConfluence">Conservative Confluence</option>
              <option value="movingAverageCrossover">Moving Average Crossover</option>
              <option value="custom">Custom (advanced)</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '20px', marginBottom: 10 }}>
          <label>
            Start Date:&nbsp;
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </label>
          <label>
            End Date:&nbsp;
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </label>
        </div>
        <button 
          onClick={runBacktest} 
          disabled={isLoading}
          style={{ padding: '5px 10px' }}
        >
          {isLoading ? 'Running Backtest...' : 'Run Backtest'}
        </button>
      </div>
      
      {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
      
      {results && (
        <>
          <section>
            <h3>Backtest Results</h3>
            <div style={{ marginBottom: 20 }}>
              <strong>Starting Balance:</strong> $1,000.00<br />
              <strong>Final Balance:</strong> ${results.finalBalance.toFixed(2)}<br />
              <strong>Total Return:</strong> {results.totalReturn.toFixed(2)}%<br />
              <strong>Total Trades:</strong> {results.totalTrades}<br />
            </div>
          </section>
          
          <section>
            <h3>Performance Chart</h3>
            <Line data={results.chartData} options={{ responsive: true }} />
          </section>
          
          <section>
            <h3>Trade Signals</h3>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid black' }}>
                    <th>Date</th>
                    <th>Price</th>
                    <th>Signal</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {results.signals.map((signal, i) => (
                    <tr key={i} style={{ backgroundColor: signal.signal === 'BUY' ? '#d4edda' : '#f8d7da' }}>
                      <td>{new Date(signal.timestamp).toLocaleString()}</td>
                      <td>${signal.price}</td>
                      <td>{signal.signal}</td>
                      <td>{signal.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default BacktestingDashboard;
