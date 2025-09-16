import React, { useState, useEffect, useCallback } from 'react';
import { getBinanceMarketData, getBinanceAllTickers } from '../binanceApi';
import { getKrakenMarketData, getKrakenAllTickers } from '../krakenApi';
import { useNotification } from '../contexts/NotificationContext';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function ArbitrageDashboard({ binanceApiKey, binanceApiSecret, krakenApiKey, krakenApiSecret }) {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('cross-exchange');
  const [autoTrading, setAutoTrading] = useState(false);
  const [minProfitPercent, setMinProfitPercent] = useState(0.5);
  const [maxTradeSize, setMaxTradeSize] = useState(100);
  const [scanInterval, setScanInterval] = useState(5);
  const [historicalProfits, setHistoricalProfits] = useState([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [selectedPairs, setSelectedPairs] = useState([]);
  const [availablePairs, setAvailablePairs] = useState([]);
  const [statPairs, setStatPairs] = useState([
    { pair1: 'BTCUSDT', pair2: 'ETHUSDT', correlation: 0, spread: 0, zScore: 0, isViable: false }
  ]);
  const { addNotification } = useNotification();

  // Function to scan for cross-exchange arbitrage opportunities
  const scanCrossExchange = useCallback(async () => {
    if (!binanceApiKey || !krakenApiKey) {
      addNotification('API keys required for both exchanges', 'error');
      return;
    }

    setLoading(true);
    try {
      // Get all tickers from both exchanges
      const binanceTickers = await getBinanceAllTickers();
      const krakenTickers = await getKrakenAllTickers();

      // Find common pairs between exchanges
      const commonPairs = findCommonPairs(binanceTickers, krakenTickers);
      
      // Calculate price differences and identify arbitrage opportunities
      const newOpportunities = commonPairs.map(pair => {
        const binancePrice = parseFloat(binanceTickers[pair]?.price || 0);
        const krakenPrice = parseFloat(krakenTickers[pair]?.price || 0);
        
        if (!binancePrice || !krakenPrice) return null;
        
        const priceDiffPercent = Math.abs((binancePrice - krakenPrice) / krakenPrice * 100);
        const direction = binancePrice < krakenPrice ? 'Binance → Kraken' : 'Kraken → Binance';
        const estimatedProfit = calculateEstimatedProfit(binancePrice, krakenPrice, maxTradeSize);
        
        return {
          pair,
          binancePrice,
          krakenPrice,
          priceDiffPercent,
          direction,
          estimatedProfit,
          timestamp: Date.now(),
          isViable: priceDiffPercent > minProfitPercent && estimatedProfit > 0
        };
      }).filter(Boolean).filter(opp => opp.isViable);
      
      // Sort by profit potential
      newOpportunities.sort((a, b) => b.priceDiffPercent - a.priceDiffPercent);
      
      setOpportunities(newOpportunities);
      
      // Auto-execute trades if enabled and viable opportunities exist
      if (autoTrading && newOpportunities.length > 0) {
        const topOpportunity = newOpportunities[0];
        if (topOpportunity.priceDiffPercent > minProfitPercent * 1.2) { // 20% buffer
          executeArbitrageTrade(topOpportunity);
        }
      }
      
      addNotification(`Found ${newOpportunities.length} arbitrage opportunities`, 'info');
    } catch (error) {
      console.error('Error scanning for arbitrage:', error);
      addNotification('Failed to scan for arbitrage opportunities', 'error');
    } finally {
      setLoading(false);
    }
  }, [binanceApiKey, krakenApiKey, minProfitPercent, maxTradeSize, autoTrading, addNotification]);

  // Function to scan for triangular arbitrage opportunities
  const scanTriangular = useCallback(async () => {
    if (!binanceApiKey) {
      addNotification('Binance API key required for triangular arbitrage', 'error');
      return;
    }

    setLoading(true);
    try {
      // Get all tickers from Binance
      const binanceTickers = await getBinanceAllTickers();
      
      // Define common base assets (e.g., BTC, ETH, USDT)
      const baseAssets = ['BTC', 'ETH', 'USDT', 'BNB'];
      
      // Find triangular arbitrage opportunities
      const triangularOpps = findTriangularOpportunities(binanceTickers, baseAssets);
      
      // Filter for viable opportunities
      const viableOpps = triangularOpps.filter(opp => 
        opp.profitPercent > minProfitPercent && 
        opp.estimatedProfit > 0
      );
      
      setOpportunities(viableOpps);
      
      // Auto-execute trades if enabled
      if (autoTrading && viableOpps.length > 0) {
        const topOpportunity = viableOpps[0];
        if (topOpportunity.profitPercent > minProfitPercent * 1.2) {
          executeTriangularTrade(topOpportunity);
        }
      }
      
      addNotification(`Found ${viableOpps.length} triangular arbitrage opportunities`, 'info');
    } catch (error) {
      console.error('Error scanning for triangular arbitrage:', error);
      addNotification('Failed to scan for triangular arbitrage', 'error');
    } finally {
      setLoading(false);
    }
  }, [binanceApiKey, minProfitPercent, autoTrading, addNotification]);

  // Function to find triangular arbitrage opportunities
  const findTriangularOpportunities = (tickers, baseAssets) => {
    const opportunities = [];
    
    // Create a map of all available trading pairs
    const pairsMap = {};
    Object.keys(tickers).forEach(symbol => {
      pairsMap[symbol] = parseFloat(tickers[symbol].price);
    });
    
    // Identify all possible triangular paths
    baseAssets.forEach(baseAsset => {
      // Find all pairs with this base asset
      const basePairs = Object.keys(pairsMap).filter(pair => 
        pair.endsWith(baseAsset) || pair.startsWith(baseAsset)
      );
      
      // For each pair, find potential triangular paths
      basePairs.forEach(firstPair => {
        // Extract the non-base asset from the first pair
        const firstAsset = firstPair.replace(baseAsset, '');
        
        // Find pairs containing the first asset but not the base asset
        const secondPairs = Object.keys(pairsMap).filter(pair => 
          (pair.includes(firstAsset)) && 
          (!pair.includes(baseAsset))
        );
        
        // For each second pair, complete the triangle
        secondPairs.forEach(secondPair => {
          // Extract the other asset from the second pair
          const secondAsset = secondPair.replace(firstAsset, '');
          
          // Find the third pair to complete the triangle
          const thirdPair = Object.keys(pairsMap).find(pair => 
            (pair.includes(secondAsset) && pair.includes(baseAsset))
          );
          
          if (thirdPair) {
            // Calculate potential profit from this triangle
            const { profitPercent, path, estimatedProfit } = calculateTriangularProfit(
              baseAsset, firstAsset, secondAsset,
              firstPair, secondPair, thirdPair,
              pairsMap, maxTradeSize
            );
            
            if (profitPercent > 0) {
              opportunities.push({
                path,
                profitPercent,
                estimatedProfit,
                timestamp: Date.now(),
                type: 'triangular',
                exchange: 'Binance',
                isViable: profitPercent > minProfitPercent
              });
            }
          }
        });
      });
    });
    
    // Sort by profit potential
    return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
  };

  // Calculate profit for triangular arbitrage
  const calculateTriangularProfit = (baseAsset, firstAsset, secondAsset, firstPair, secondPair, thirdPair, prices, amount) => {
    // This is a simplified calculation - in production, you'd account for fees, slippage, etc.
    
    // Determine if we need to buy or sell for each step
    const firstPairBuy = firstPair.endsWith(baseAsset);
    const secondPairBuy = secondPair.endsWith(firstAsset);
    const thirdPairBuy = thirdPair.endsWith(secondAsset);
    
    // Start with base amount
    let currentAmount = amount;
    
    // First trade
    if (firstPairBuy) {
      currentAmount = currentAmount / prices[firstPair]; // Buy firstAsset with baseAsset
    } else {
      currentAmount = currentAmount * prices[firstPair]; // Sell baseAsset for firstAsset
    }
    
    // Second trade
    if (secondPairBuy) {
      currentAmount = currentAmount / prices[secondPair]; // Buy secondAsset with firstAsset
    } else {
      currentAmount = currentAmount * prices[secondPair]; // Sell firstAsset for secondAsset
    }
    
    // Third trade
    if (thirdPairBuy) {
      currentAmount = currentAmount / prices[thirdPair]; // Buy baseAsset with secondAsset
    } else {
      currentAmount = currentAmount * prices[thirdPair]; // Sell secondAsset for baseAsset
    }
    
    // Calculate profit
    const profitPercent = ((currentAmount - amount) / amount) * 100;
    const estimatedProfit = currentAmount - amount;
    
    // Describe the path
    const path = `${baseAsset} → ${firstAsset} → ${secondAsset} → ${baseAsset}`;
    
    return { profitPercent, path, estimatedProfit };
  };

  // Function to execute a cross-exchange arbitrage trade
  const executeArbitrageTrade = async (opportunity) => {
    try {
      addNotification(`Executing arbitrage trade for ${opportunity.pair}`, 'info');
      
      // In a real implementation, you would:
      // 1. Place a buy order on the cheaper exchange
      // 2. Place a sell order on the more expensive exchange
      // 3. Track and settle both orders
      
      // Simulate a successful trade for demo
      const newProfit = opportunity.estimatedProfit * 0.85; // Account for fees and slippage
      
      // Update historical profits
      const newHistoricalProfit = {
        timestamp: Date.now(),
        pair: opportunity.pair,
        profit: newProfit,
        type: 'cross-exchange'
      };
      
      setHistoricalProfits(prev => [...prev, newHistoricalProfit]);
      setTotalProfit(prev => prev + newProfit);
      
      addNotification(`Arbitrage trade completed! Profit: $${newProfit.toFixed(2)}`, 'success');
    } catch (error) {
      console.error('Error executing arbitrage trade:', error);
      addNotification('Failed to execute arbitrage trade', 'error');
    }
  };

  // Function to execute a triangular arbitrage trade
  const executeTriangularTrade = async (opportunity) => {
    try {
      addNotification(`Executing triangular trade: ${opportunity.path}`, 'info');
      
      // In a real implementation, you would:
      // 1. Execute each leg of the triangular trade in sequence
      // 2. Track and settle all orders
      
      // Simulate a successful trade for demo
      const newProfit = opportunity.estimatedProfit * 0.9; // Account for fees
      
      // Update historical profits
      const newHistoricalProfit = {
        timestamp: Date.now(),
        pair: opportunity.path,
        profit: newProfit,
        type: 'triangular'
      };
      
      setHistoricalProfits(prev => [...prev, newHistoricalProfit]);
      setTotalProfit(prev => prev + newProfit);
      
      addNotification(`Triangular trade completed! Profit: $${newProfit.toFixed(2)}`, 'success');
    } catch (error) {
      console.error('Error executing triangular trade:', error);
      addNotification('Failed to execute triangular trade', 'error');
    }
  };

  // Function to find common trading pairs between exchanges
  const findCommonPairs = (binanceTickers, krakenTickers) => {
    const binancePairs = new Set(Object.keys(binanceTickers));
    const krakenPairs = new Set(Object.keys(krakenTickers));
    
    // Find intersection of available pairs
    return Array.from(binancePairs).filter(pair => krakenPairs.has(pair));
  };

  // Calculate estimated profit for a cross-exchange arbitrage opportunity
  const calculateEstimatedProfit = (price1, price2, tradeSize) => {
    const lowerPrice = Math.min(price1, price2);
    const higherPrice = Math.max(price1, price2);
    
    const quantity = tradeSize / lowerPrice;
    const profit = (quantity * higherPrice) - tradeSize;
    
    // Account for trading fees (0.1% per trade on both exchanges)
    const fees = (tradeSize * 0.001) + (quantity * higherPrice * 0.001);
    
    return profit - fees;
  };

  // Function to scan for statistical arbitrage opportunities
  const scanStatistical = useCallback(async () => {
    if (!binanceApiKey) {
      addNotification('Binance API key required for statistical arbitrage', 'error');
      return;
    }
    setLoading(true);
    try {
      const opportunities = [];
      for (const pair of statPairs) {
        const data1 = await getHistoricalData(pair.pair1, '1h', 100);
        const data2 = await getHistoricalData(pair.pair2, '1h', 100);

        if (data1.length < 100 || data2.length < 100) continue;

        const prices1 = data1.map(d => parseFloat(d[4]));
        const prices2 = data2.map(d => parseFloat(d[4]));

        const spread = prices1.map((p1, i) => p1 / prices2[i]);
        const meanSpread = spread.reduce((a, b) => a + b, 0) / spread.length;
        const stdDev = Math.sqrt(spread.map(x => Math.pow(x - meanSpread, 2)).reduce((a, b) => a + b, 0) / spread.length);
        
        const currentSpread = prices1[prices1.length - 1] / prices2[prices2.length - 1];
        const zScore = (currentSpread - meanSpread) / stdDev;

        const isViable = Math.abs(zScore) > 2.0; // Trade if spread is > 2 std deviations from mean
        if (isViable) {
          const direction = zScore > 0 ? `Short ${pair.pair1} / Long ${pair.pair2}` : `Long ${pair.pair1} / Short ${pair.pair2}`;
          const estimatedProfit = Math.abs(currentSpread - meanSpread) * prices2[prices2.length - 1] * (maxTradeSize / prices1[prices1.length - 1]);

          opportunities.push({
            pair: `${pair.pair1}/${pair.pair2}`,
            type: 'statistical',
            priceDiffPercent: zScore.toFixed(2), // Using z-score as a metric
            estimatedProfit,
            direction,
            isViable,
            timestamp: Date.now()
          });
        }
      }
      setOpportunities(opportunities);
      addNotification(`Found ${opportunities.length} statistical arbitrage opportunities`, 'info');
    } catch (error) {
      console.error('Error scanning for statistical arbitrage:', error);
      addNotification('Failed to scan for statistical arbitrage', 'error');
    } finally {
      setLoading(false);
    }
  }, [binanceApiKey, statPairs, maxTradeSize, addNotification]);

  // Setup periodic scanning
  useEffect(() => {
    // Initial scan
    if (activeTab === 'cross-exchange') {
      scanCrossExchange();
    } else if (activeTab === 'triangular') {
      scanTriangular();
    } else if (activeTab === 'statistical') {
      scanStatistical();
    }
    
    // Setup interval for periodic scanning
    const intervalId = setInterval(() => {
      if (activeTab === 'cross-exchange') {
        scanCrossExchange();
      } else if (activeTab === 'triangular') {
        scanTriangular();
      } else if (activeTab === 'statistical') {
        scanStatistical();
      }
    }, scanInterval * 1000);
    
    return () => clearInterval(intervalId);
  }, [scanCrossExchange, scanTriangular, scanStatistical, activeTab, scanInterval]);

  // Prepare chart data for profit history
  const profitChartData = {
    labels: historicalProfits.map(p => new Date(p.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Arbitrage Profits ($)',
        data: historicalProfits.map(p => p.profit),
        fill: false,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
      },
    ],
  };

  return (
    <div className="arbitrage-dashboard">
      <h2>Arbitrage Dashboard</h2>
      
      {/* Strategy Selection Tabs */}
      <div className="strategy-tabs">
        <button 
          className={activeTab === 'cross-exchange' ? 'active' : ''} 
          onClick={() => setActiveTab('cross-exchange')}
        >
          Cross-Exchange
        </button>
        <button 
          className={activeTab === 'triangular' ? 'active' : ''} 
          onClick={() => setActiveTab('triangular')}
        >
          Triangular
        </button>
        <button 
          className={activeTab === 'statistical' ? 'active' : ''} 
          onClick={() => setActiveTab('statistical')}
        >
          Statistical (Beta)
        </button>
      </div>
      
      {/* Settings Panel */}
      <div className="settings-panel">
        <div>
          <label>
            Min. Profit %:
            <input 
              type="number" 
              value={minProfitPercent} 
              onChange={e => setMinProfitPercent(parseFloat(e.target.value))}
              min="0.1" 
              step="0.1"
            />
          </label>
          
          <label>
            Max Trade Size ($):
            <input 
              type="number" 
              value={maxTradeSize} 
              onChange={e => setMaxTradeSize(parseFloat(e.target.value))}
              min="10"
            />
          </label>
          
          <label>
            Scan Interval (sec):
            <input 
              type="number" 
              value={scanInterval} 
              onChange={e => setScanInterval(parseInt(e.target.value))}
              min="1"
            />
          </label>
        </div>
        
        <div className="trading-controls">
          <button onClick={() => {
            if (activeTab === 'cross-exchange') scanCrossExchange();
            else if (activeTab === 'triangular') scanTriangular();
            else if (activeTab === 'statistical') scanStatistical();
          }} disabled={loading}>
            {loading ? 'Scanning...' : 'Scan Now'}
          </button>
          
          <label className="auto-trade-toggle">
            <input 
              type="checkbox" 
              checked={autoTrading} 
              onChange={e => setAutoTrading(e.target.checked)}
            />
            Auto-Trading {autoTrading ? 'ON' : 'OFF'}
          </label>
        </div>
      </div>
      
      {/* Performance Stats */}
      <div className="performance-stats">
        <div>
          <h3>Performance</h3>
          <p>Total Profit: <span className="profit">${totalProfit.toFixed(2)}</span></p>
          <p>Trades Executed: {historicalProfits.length}</p>
        </div>
        
        {historicalProfits.length > 0 && (
          <div className="profit-chart">
            <Line data={profitChartData} options={{ maintainAspectRatio: false }} />
          </div>
        )}
      </div>
      
      {/* Opportunities Table */}
      <div className="opportunities-table">
        <h3>Current Opportunities</h3>
        {opportunities.length === 0 ? (
          <p>No viable arbitrage opportunities found. Try adjusting your parameters.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Asset/Pair</th>
                <th>Type</th>
                <th>Profit % / Z-Score</th>
                <th>Est. Profit</th>
                <th>Direction</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opp, index) => (
                <tr key={index}>
                  <td>{opp.pair}</td>
                  <td>{opp.type || 'cross-exchange'}</td>
                  <td>{opp.priceDiffPercent?.toFixed(2) || 'N/A'}</td>
                  <td>${opp.estimatedProfit.toFixed(2)}</td>
                  <td>{opp.direction || opp.path}</td>
                  <td>
                    <button 
                      onClick={() => activeTab === 'triangular' ? 
                        executeTriangularTrade(opp) : 
                        executeArbitrageTrade(opp) // Simplified for now
                      }
                      className="execute-btn"
                    >
                      Execute
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ArbitrageDashboard;
