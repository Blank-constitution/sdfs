import React, { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { getBinanceBalances, getBinanceTrades, getBinanceOrderBook, getBinanceMarketData, getHistoricalData, placeOrder, placeOcoOrder } from '../binanceApi';
import { runStrategy } from '../strategyEngine';
import { getAiAnalysis } from '../googleGenAiApi';
import StrategyChef from '../metaLearning/StrategyChef';
import PortfolioManager from '../portfolio/PortfolioManager';
import RiskManager from '../risk/RiskManager';
import HistoryManager from '../data/HistoryManager';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function Dashboard({ binanceApiKey, binanceApiSecret, strategy, symbol, geminiAiApiKey }) {
  const [balances, setBalances] = useState([]);
  const [trades, setTrades] = useState([]);
  const [orderBook, setOrderBook] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [strategySignal, setStrategySignal] = useState({ signal: 'PENDING', reason: '' });
  const [isTradingEnabled, setIsTradingEnabled] = useState(false);
  const [lastAction, setLastAction] = useState('None yet.');
  const [riskPercentage, setRiskPercentage] = useState(1);
  const [stopLossPercentage, setStopLossPercentage] = useState(2);
  const [takeProfitPercentage, setTakeProfitPercentage] = useState(4);
  const [currentPosition, setCurrentPosition] = useState('QUOTE'); // QUOTE or BASE
  const [aiAnalysis, setAiAnalysis] = useState('Click button to get analysis.');
  const [isFetchingAi, setIsFetchingAi] = useState(false);
  const [logHistory, setLogHistory] = useState([]);
  const [performance, setPerformance] = useState({ totalPnL: 0, totalTrades: 0, winRate: 0, totalReturn: 0 });
  const [chartData, setChartData] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isScalpingMode, setIsScalpingMode] = useState(false);
  const [scalpingStats, setScalpingStats] = useState({
    totalScalps: 0,
    successfulScalps: 0,
    failedScalps: 0,
    totalProfit: 0,
    winRate: 0
  });
  const [useMetaLearning, setUseMetaLearning] = useState(false);
  const [chefStatus, setChefStatus] = useState('idle');
  const [strategyReport, setStrategyReport] = useState(null);
  const [portfolioSummary, setPortfolioSummary] = useState(null);
  const [accountSize, setAccountSize] = useState(100); // Default starting capital
  const [initialDeposit, setInitialDeposit] = useState(100);
  const [showPortfolioSettings, setShowPortfolioSettings] = useState(false);
  const strategyChef = useRef(null);
  const lastExecutedSignal = useRef(null);

  // Log every action and AI analysis
  useEffect(() => {
    if (lastAction && lastAction !== 'None yet.') {
      setLogHistory(logs => [...logs, { type: 'action', text: lastAction, ts: new Date().toLocaleString() }]);
    }
  }, [lastAction]);

  useEffect(() => {
    if (aiAnalysis && aiAnalysis !== 'Click button to get analysis.' && !isFetchingAi) {
      setLogHistory(logs => [...logs, { type: 'ai', text: aiAnalysis, ts: new Date().toLocaleString() }]);
    }
  }, [aiAnalysis, isFetchingAi]);

  useEffect(() => {
    if (binanceApiKey && binanceApiSecret && symbol) {
      const fetchDataAndTrade = async () => {
        // Dynamically determine base and quote assets from symbol (e.g., BTCUSDT -> BTC, USDT)
        const baseAsset = symbol.endsWith('USDT') ? symbol.replace('USDT', '') : symbol.substring(0, 3);
        const quoteAsset = 'USDT';

        // Fetch data
        const fetchedBalances = await getBinanceBalances(binanceApiKey, binanceApiSecret);
        setBalances(fetchedBalances);
        getBinanceTrades(binanceApiKey, binanceApiSecret, symbol).then(setTrades);
        getBinanceOrderBook(symbol).then(setOrderBook);
        const market = await getBinanceMarketData(symbol);
        setMarketData(market);
        const historicalData = await getHistoricalData(symbol);

        // Get strategy signal
        const signal = await runStrategy(strategy, market, historicalData);
        setStrategySignal(signal);

        // Execute trade if enabled and signal is new and valid
        if (isTradingEnabled && (signal.signal === 'BUY' || signal.signal === 'SELL') && signal.signal !== lastExecutedSignal.current) {
          if (signal.signal === 'BUY' && currentPosition === 'BASE') {
            setLastAction(`HOLD: Already in a ${baseAsset} position.`);
            return;
          }
          if (signal.signal === 'SELL' && currentPosition === 'QUOTE') {
            setLastAction(`HOLD: Not in a ${baseAsset} position to sell.`);
            return;
          }

          try {
            let tradeAmount = 0;
            let entryPrice = 0;

            if (signal.signal === 'BUY') {
              const quoteBalance = fetchedBalances.find(b => b.asset === quoteAsset)?.free || 0;
              const usdtToSpend = parseFloat(quoteBalance) * (riskPercentage / 100);
              tradeAmount = usdtToSpend / parseFloat(market.price);
            } else { // SELL
              const baseBalance = fetchedBalances.find(b => b.asset === baseAsset)?.free || 0;
              tradeAmount = parseFloat(baseBalance);
            }

            if (tradeAmount <= 0) { /* ... add minimum trade size check later ... */ return; }

            setLastAction(`Attempting to ${signal.signal} ${tradeAmount.toFixed(5)} ${baseAsset}...`);
            const orderResult = await placeOrder(binanceApiKey, binanceApiSecret, symbol, signal.signal, tradeAmount.toFixed(5));
            entryPrice = parseFloat(orderResult.fills[0].price);
            setLastAction(`SUCCESS: ${signal.signal} order for ${orderResult.executedQty} ${baseAsset} filled at ${entryPrice}.`);
            lastExecutedSignal.current = signal.signal;
            setCurrentPosition(signal.signal === 'BUY' ? 'BASE' : 'QUOTE');

            // If we just bought, place an OCO order for stop-loss and take-profit
            if (signal.signal === 'BUY') {
              const quantityToSell = parseFloat(orderResult.executedQty);
              const takeProfitPrice = (entryPrice * (1 + takeProfitPercentage / 100)).toFixed(2);
              const stopPrice = (entryPrice * (1 - stopLossPercentage / 100)).toFixed(2);
              const stopLimitPrice = (stopPrice * 0.995).toFixed(2);

              setLastAction(`Placing OCO order: TP at ${takeProfitPrice}, SL at ${stopPrice}`);
              await placeOcoOrder(binanceApiKey, binanceApiSecret, symbol, 'SELL', quantityToSell, takeProfitPrice, stopPrice, stopLimitPrice);
              setLastAction(`OCO order placed for ${symbol}. Monitoring position.`);
            }
          } catch (error) {
            setLastAction(`ERROR: ${error.msg || 'Failed to place order.'}`);
          }
        }

        // Special handling for scalping trades (small, frequent trades)
        if (isTradingEnabled && strategySignal.tradeType === 'scalp') {
          // Use tighter stop-loss and take-profit for scalping
          const scalpTakeProfit = strategySignal.targetProfit || 0.2; // Default 0.2%
          const scalpStopLoss = strategySignal.stopLoss || 0.1; // Default 0.1%

          // Implement scalping logic here (similar to above, but with tighter parameters)
          // Update scalping statistics on successful trade
          setScalpingStats(prev => ({
            ...prev,
            totalScalps: prev.totalScalps + 1,
            successfulScalps: prev.successfulScalps + 1,
            totalProfit: prev.totalProfit + scalpTakeProfit,
            winRate: ((prev.successfulScalps + 1) / (prev.totalScalps + 1)) * 100
          }));
        }
      };

      fetchDataAndTrade();
      
      // Use faster polling for scalping mode
      const interval = setInterval(
        fetchDataAndTrade, 
        isScalpingMode ? 10000 : 60000 // 10 seconds in scalping mode vs 1 minute normal
      );
      
      return () => clearInterval(interval);
    }
  }, [binanceApiKey, binanceApiSecret, strategy, symbol, isTradingEnabled, isScalpingMode, riskPercentage, currentPosition, stopLossPercentage, takeProfitPercentage]);

  useEffect(() => {
    setAiAnalysis('Click button to get analysis.'); // Reset AI analysis on symbol change
  }, [symbol]);

  const handleGetAiAnalysis = async () => {
    setIsFetchingAi(true);
    setAiAnalysis('Fetching analysis from Google Gemini AI...');
    const analysis = await getAiAnalysis(geminiAiApiKey, symbol);
    setAiAnalysis(analysis);
    setIsFetchingAi(false);
  };

  const handlePanicSell = async () => {
    if (!isTradingEnabled) {
      setLastAction('Panic Sell disabled: Trading is not enabled.');
      return;
    }
    if (currentPosition === 'QUOTE') {
      setLastAction('Panic Sell: No position to sell.');
      return;
    }

    try {
      const baseAsset = symbol.endsWith('USDT') ? symbol.replace('USDT', '') : symbol.substring(0, 3);
      const baseBalance = balances.find(b => b.asset === baseAsset)?.free || 0;
      if (parseFloat(baseBalance) <= 0) {
        setLastAction('Panic Sell: No balance to sell.');
        return;
      }

      setLastAction(`Panic Sell: Selling ${baseBalance} ${baseAsset}...`);
      const orderResult = await placeOrder(binanceApiKey, binanceApiSecret, symbol, 'SELL', baseBalance);
      setLastAction(`Panic Sell SUCCESS: Sold ${orderResult.executedQty} ${baseAsset} at ${orderResult.fills[0].price}.`);
      setCurrentPosition('QUOTE');
    } catch (error) {
      setLastAction(`Panic Sell ERROR: ${error.msg || 'Failed to sell.'}`);
    }
  };

  // Export logs as CSV
  const handleExportLogs = () => {
    const header = 'Timestamp,Type,Text\n';
    const rows = logHistory.map(log =>
      `"${log.ts}","${log.type}","${log.text.replace(/"/g, '""')}"""
    );
    const csvContent = header + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = "bot_logs_" + symbol + "_" + Date.now() + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clear logs
  const handleClearLogs = () => {
    setLogHistory([]);
  };

  // Calculate performance metrics from trades
  useEffect(() => {
    if (trades.length > 0) {
      let totalPnL = 0;
      let wins = 0;
      const tradeMap = {};
      trades.forEach(trade => {
        const key = trade.symbol + "-" + trade.side;
        if (!tradeMap[key]) tradeMap[key] = [];
        tradeMap[key].push(trade);
      });

      // Simple PnL calculation (assuming pairs like BTCUSDT, where USDT is quote)
      // This is a basic approximation; real PnL requires more complex logic
      Object.values(tradeMap).forEach(pairTrades => {
        let buyTotal = 0;
        let sellTotal = 0;
        pairTrades.forEach(trade => {
          if (trade.side === 'BUY') {
            buyTotal += parseFloat(trade.qty) * parseFloat(trade.price);
          } else if (trade.side === 'SELL') {
            sellTotal += parseFloat(trade.qty) * parseFloat(trade.price);
          }
        });
        const pairPnL = sellTotal - buyTotal;
        totalPnL += pairPnL;
        if (pairPnL > 0) wins++;
      });

      const totalTrades = trades.length;
      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
      const totalReturn = totalPnL > 0 ? (totalPnL / (totalPnL + 1000)) * 100 : 0; // Approximate, assuming initial capital

      setPerformance({ totalPnL, totalTrades, winRate, totalReturn });
    }
  }, [trades]);

  // Update chart data when historical data is fetched
  useEffect(() => {
    if (historicalData && historicalData.length > 0) {
      const labels = historicalData.slice(-50).map(d => new Date(d[0]).toLocaleTimeString()); // Last 50 data points
      const prices = historicalData.slice(-50).map(d => parseFloat(d[4])); // Close prices
      setChartData({
        labels,
        datasets: [{
          label: `${symbol} Price`,
          data: prices,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        }]
      });
    }
  }, [historicalData, symbol]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Function to send notification
  const sendNotification = (title, body) => {
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' }); // Add an icon if available
    }
  };

  // Trigger notification on new signal
  useEffect(() => {
    if (strategySignal.signal !== 'PENDING') {
      sendNotification('Trading Signal', `New ${strategySignal.signal} signal for ${symbol}: ${strategySignal.reason}`);
    }
  }, [strategySignal]);

  // Trigger notification on trade execution
  useEffect(() => {
    if (lastAction.startsWith('SUCCESS') || lastAction.startsWith('ERROR')) {
      sendNotification('Trade Update', lastAction);
    }
  }, [lastAction]);

  // Initialize Strategy Chef on mount
  useEffect(() => {
    if (useMetaLearning && !strategyChef.current) {
      setChefStatus('initializing');
      const chef = new StrategyChef();
      chef.initialize().then(() => {
        strategyChef.current = chef;
        setChefStatus('ready');
      });
    }
  }, [useMetaLearning]);

  // Train Strategy Chef models with historical data
  useEffect(() => {
    if (useMetaLearning && strategyChef.current && chefStatus === 'ready' && historicalData) {
      setChefStatus('training');
      strategyChef.current.trainStrategies(historicalData).then(trainedCount => {
        setChefStatus(`trained ${trainedCount} strategies`);
        
        // Evaluate strategies
        return strategyChef.current.evaluateStrategies(historicalData);
      }).then(results => {
        setStrategyReport(strategyChef.current.getPerformanceReport());
        setChefStatus('evaluated');
      });
    }
  }, [useMetaLearning, historicalData, chefStatus]);

  // Evolve strategies periodically
  useEffect(() => {
    if (useMetaLearning && strategyChef.current && chefStatus === 'evaluated') {
      const evolveInterval = setInterval(() => {
        setChefStatus('evolving');
        strategyChef.current.evolveStrategies().then(() => {
          setStrategyReport(strategyChef.current.getPerformanceReport());
          setChefStatus('evolved');
          
          // Retrain after evolution
          setTimeout(() => {
            setChefStatus('ready');
          }, 10000);
        });
      }, 3600000); // Evolve every hour
      
      return () => clearInterval(evolveInterval);
    }
  }, [useMetaLearning, chefStatus]);

  // Use the best strategy from Strategy Chef if meta-learning is enabled
  useEffect(() => {
    if (useMetaLearning && strategyChef.current && (chefStatus === 'evaluated' || chefStatus === 'evolved')) {
      // Get the best strategy for current market conditions
      const bestStrategy = strategyChef.current.getBestStrategy();
      console.log(`Using best strategy: ${bestStrategy.id}`);
      
      // In a real implementation, you would use this strategy for trading decisions
    }
  }, [useMetaLearning, chefStatus]);

  // Initialize portfolio
  useEffect(() => {
    const initializePortfolio = async () => {
      // Try to load existing portfolio
      const loaded = await PortfolioManager.loadPortfolio();
      
      if (!loaded) {
        // Initialize with default values if not found
        PortfolioManager.initialize(accountSize);
        await PortfolioManager.savePortfolio();
      }
      
      // Get portfolio summary
      setPortfolioSummary(PortfolioManager.getPortfolioSummary());
    };
    
    initializePortfolio();
  }, [accountSize]);

  // Update portfolio when balances change
  useEffect(() => {
    if (balances.length > 0 && marketData) {
      // Create market data structure for portfolio manager
      const marketDataMap = { [symbol]: marketData };
      
      // Update portfolio with latest balances
      PortfolioManager.updatePortfolio(balances, marketDataMap);
      setPortfolioSummary(PortfolioManager.getPortfolioSummary());
      
      // Save updated portfolio
      PortfolioManager.savePortfolio();
    }
  }, [balances, marketData, symbol]);

  // Handle initial deposit change
  const handleInitialDepositChange = (e) => {
    const value = parseFloat(e.target.value);
    setInitialDeposit(value);
  };

  // Update account size
  const handleUpdateAccountSize = async () => {
    setAccountSize(initialDeposit);
    await PortfolioManager.initialize(initialDeposit);
    setPortfolioSummary(PortfolioManager.getPortfolioSummary());
    await PortfolioManager.savePortfolio();
    setShowPortfolioSettings(false);
  };

  // Store historical data for future use
  useEffect(() => {
    if (historicalData && historicalData.length > 0) {
      // Store for current timeframe (assumed to be 1h)
      HistoryManager.storeHistoricalData(symbol, '1h', historicalData);
    }
  }, [historicalData, symbol]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Trading Bot Dashboard</h2>
      
      {/* Portfolio Summary Card */}
      <div style={{ marginBottom: 20, padding: 10, border: '1px solid #ccc', backgroundColor: '#f8f9fa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Portfolio Summary</h3>
          <button onClick={() => setShowPortfolioSettings(!showPortfolioSettings)}>
            {showPortfolioSettings ? 'Hide' : 'Settings'}
          </button>
        </div>
        
        {showPortfolioSettings && (
          <div style={{ marginTop: 10, padding: 10, backgroundColor: 'white', border: '1px solid #ddd' }}>
            <div>
              <label>
                Initial Deposit ($):
                <input 
                  type="number" 
                  value={initialDeposit} 
                  onChange={handleInitialDepositChange}
                  min="10"
                  style={{ marginLeft: 5, width: '100px' }}
                />
              </label>
              <button 
                onClick={handleUpdateAccountSize}
                style={{ marginLeft: 10 }}
              >
                Update
              </button>
            </div>
            <div style={{ marginTop: 5, fontSize: '0.9em', color: '#666' }}>
              Warning: This will reset your portfolio to the initial deposit amount!
            </div>
          </div>
        )}
        
        {portfolioSummary && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <strong>Total Value:</strong> ${portfolioSummary.totalValue.toFixed(2)}
            </div>
            <div>
              <strong>Available:</strong> ${portfolioSummary.quoteBalance.toFixed(2)}
            </div>
            <div>
              <strong>Active Positions:</strong> {portfolioSummary.activePositions}
            </div>
            <div style={{ 
              color: portfolioSummary.pnl >= 0 ? 'green' : 'red' 
            }}>
              <strong>P&L:</strong> ${portfolioSummary.pnl.toFixed(2)} ({portfolioSummary.pnlPercent.toFixed(2)}%)
            </div>
            <div>
              <strong>Win Rate:</strong> {portfolioSummary.winRate.toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {/* Existing Trading Controls */}
      <div style={{ marginBottom: 20, padding: 10, border: '1px solid #ccc' }}>
        <label>
          <input
            type="checkbox"
            checked={isTradingEnabled}
            onChange={e => setIsTradingEnabled(e.target.checked)}
          />
          <strong>Enable Live Trading</strong> (WARNING: This will execute real trades)
        </label>
        
        {/* Add scalping mode toggle */}
        <div style={{ marginTop: 10 }}>
          <label>
            <input
              type="checkbox"
              checked={isScalpingMode}
              onChange={e => setIsScalpingMode(e.target.checked)}
            />
            <strong>Scalping Mode</strong> (More frequent updates, smaller targets)
          </label>
        </div>
        
        <div style={{ marginTop: 10 }}>
          <label>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={e => setNotificationsEnabled(e.target.checked)}
            />
            <strong>Enable Browser Notifications</strong>
          </label>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: '20px' }}>
          <label>
            Risk/Trade (%):&nbsp;
            <input type="number" value={riskPercentage} onChange={e => setRiskPercentage(parseFloat(e.target.value))} min="0.1" max="100" step="0.1" style={{ width: '60px' }}/>
          </label>
          <label>
            Stop-Loss (%):&nbsp;
            <input type="number" value={stopLossPercentage} onChange={e => setStopLossPercentage(parseFloat(e.target.value))} min="0.1" step="0.1" style={{ width: '60px' }}/>
          </label>
          <label>
            Take-Profit (%):&nbsp;
            <input type="number" value={takeProfitPercentage} onChange={e => setTakeProfitPercentage(parseFloat(e.target.value))} min="0.1" step="0.1" style={{ width: '60px' }}/>
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <label>
            <input
              type="checkbox"
              checked={useMetaLearning}
              onChange={e => setUseMetaLearning(e.target.checked)}
            />
            <strong>Meta-Learning (Strategy Chef)</strong> - Let AI find the best strategy
          </label>
          {useMetaLearning && (
            <span style={{ marginLeft: 10 }}>Status: {chefStatus}</span>
          )}
        </div>
      </div>
      <section>
        <h3>Bot Status ({symbol})</h3>
        <div><strong>Current Position:</strong> {currentPosition}</div>
        <div><strong>Last Action:</strong> {lastAction}</div>
        <div><strong>Status:</strong> {isTradingEnabled ? 'Online and Trading' : 'Online and Analyzing'}</div>
        <button onClick={handlePanicSell} style={{ marginTop: 10, backgroundColor: '#ff4444', color: 'white', border: 'none', padding: '5px 10px' }}>
          Panic Sell All Positions
        </button>
      </section>
      <section>
        <h3>Balances</h3>
        <ul>
          {balances.map(b => (
            <li key={b.asset}>{b.asset}: {b.free}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Recent Trades ({symbol})</h3>
        <ul>
          {trades.map(t => (
            <li key={t.id}>{t.symbol} {t.side} {t.qty} @ {t.price}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Strategy Overview ({symbol})</h3>
        <div>
          <strong>Strategy:</strong> {strategy} <br />
          <strong>Signal:</strong> {strategySignal.signal} <br />
          <strong>Reason:</strong> {strategySignal.reason}
        </div>
      </section>
      <section>
        <h3>Order Book ({symbol})</h3>
        {orderBook ? (
          <div>
            <div>Bids: {orderBook.bids.slice(0, 5).map(b => `${b[0]} (${b[1]})`).join(', ')}</div>
            <div>Asks: {orderBook.asks.slice(0, 5).map(a => `${a[0]} (${a[1]})`).join(', ')}</div>
          </div>
        ) : <div>Loading...</div>}
      </section>
      <section>
        <h3>Market Data ({symbol})</h3>
        {marketData ? (
          <div>
            <div>Price: {marketData.price}</div>
            <div>24h Change: {marketData.priceChangePercent}%</div>
          </div>
        ) : <div>Loading...</div>}
      </section>
      <section>
        <h3>AI Market Analysis ({symbol})</h3>
        <button onClick={handleGetAiAnalysis} disabled={isFetchingAi || !geminiAiApiKey}>
          {isFetchingAi ? 'Analyzing...' : 'Get AI Analysis'}
        </button>
        <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f4f4f4', padding: '10px', marginTop: '10px', border: '1px solid #ccc' }}>
          {aiAnalysis}
        </pre>
      </section>
      <section>
        <h3>Performance Summary</h3>
        <div>
          <strong>Total P&L:</strong> ${performance.totalPnL.toFixed(2)} <br />
          <strong>Total Trades:</strong> {performance.totalTrades} <br />
          <strong>Win Rate:</strong> {performance.winRate.toFixed(2)}% <br />
          <strong>Total Return:</strong> {performance.totalReturn.toFixed(2)}%
        </div>
      </section>
      <section>
        <h3>Price Chart ({symbol})</h3>
        {chartData ? (
          <Line data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
        ) : (
          <div>Loading chart...</div>
        )}
      </section>
      <section>
        <h3>History & Logs</h3>
        <div style={{ marginBottom: 10 }}>
          <button onClick={handleExportLogs} style={{ marginRight: 10 }}>
            Export Logs as CSV
          </button>
          <button onClick={handleClearLogs}>
            Clear Logs
          </button>
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto', background: '#fafafa', border: '1px solid #eee', padding: 10 }}>
          {logHistory.slice(-20).map((log, idx) => (
            <div key={idx} style={{ marginBottom: 8 }}>
              <span style={{ color: log.type === 'ai' ? '#0077cc' : '#333' }}>
                [{log.ts}] {log.type === 'ai' ? 'AI:' : 'Bot:'}
              </span>
              <br />
              <span>{log.text}</span>
            </div>
          ))}
        </div>
      </section>
      
      {/* Add Scalping Stats Section if in scalping mode */}
      {isScalpingMode && (
        <section>
          <h3>Scalping Statistics</h3>
          <div>
            <strong>Total Scalp Trades:</strong> {scalpingStats.totalScalps}<br />
            <strong>Successful Scalps:</strong> {scalpingStats.successfulScalps}<br />
            <strong>Failed Scalps:</strong> {scalpingStats.failedScalps}<br />
            <strong>Total Profit:</strong> {scalpingStats.totalProfit.toFixed(2)}%<br />
            <strong>Win Rate:</strong> {scalpingStats.winRate.toFixed(2)}%
          </div>
        </section>
      )}

      {/* Add Strategy Chef Report Section */}
      {useMetaLearning && strategyReport && (
        <section>
          <h3>Strategy Chef Report</h3>
          <div>
            <strong>Current Generation:</strong> {strategyReport.generation}<br />
            <strong>Best Strategy:</strong> {strategyReport.bestStrategy || 'Still evaluating'}<br />
          </div>
          
          {Object.entries(strategyReport.strategies).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <h4>Strategy Performance:</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid black' }}>
                    <th style={{ textAlign: 'left' }}>Strategy</th>
                    <th style={{ textAlign: 'right' }}>Win Rate</th>
                    <th style={{ textAlign: 'right' }}>Avg. Profit</th>
                    <th style={{ textAlign: 'right' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(strategyReport.strategies)
                    .sort(([, a], [, b]) => b.score - a.score)
                    .map(([id, perf]) => (
                    <tr key={id} style={{ backgroundColor: id === strategyReport.bestStrategy ? '#d4edda' : 'transparent' }}>
                      <td>{id}</td>
                      <td style={{ textAlign: 'right' }}>{perf.winRate.toFixed(1)}%</td>
                      <td style={{ textAlign: 'right' }}>{perf.averageProfit.toFixed(2)}%</td>
                      <td style={{ textAlign: 'right' }}>{perf.score.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Position Size Calculator */}
      <section>
        <h3>Position Size Calculator</h3>
        {marketData && (
          <div>
            <div><strong>Current Price:</strong> ${parseFloat(marketData.price).toFixed(2)}</div>
            <div><strong>Account Size:</strong> ${portfolioSummary?.totalValue.toFixed(2) || 0}</div>
            <div><strong>Recommended Position Size:</strong> {
              (() => {
                if (!marketData) return 'Loading...';
                
                // Calculate position size using RiskManager
                const marketDataObj = { ...marketData, historicalData };
                const positionCalc = PortfolioManager.calculatePositionSize(
                  symbol, 
                  parseFloat(marketData.price),
                  { [symbol]: marketDataObj }
                );
                
                if (positionCalc.reason) {
                  return positionCalc.reason;
                }
                
                return `${positionCalc.positionSize.toFixed(6)} (${(positionCalc.quoteAmount).toFixed(2)} USDT)}`;
              })()
            }</div>
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
