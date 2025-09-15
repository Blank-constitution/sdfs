import React, { useState, useEffect } from 'react';
import { getHistoricalData } from '../binanceApi';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Available indicators for strategy building
const INDICATORS = [
  { id: 'price', name: 'Price', type: 'value', params: [] },
  { id: 'sma', name: 'Simple Moving Average', type: 'value', params: [{ name: 'period', default: 20 }] },
  { id: 'ema', name: 'Exponential Moving Average', type: 'value', params: [{ name: 'period', default: 20 }] },
  { id: 'rsi', name: 'Relative Strength Index', type: 'value', params: [{ name: 'period', default: 14 }] },
  { id: 'macd', name: 'MACD', type: 'value', params: [
    { name: 'fastPeriod', default: 12 },
    { name: 'slowPeriod', default: 26 },
    { name: 'signalPeriod', default: 9 }
  ]},
  { id: 'bbands', name: 'Bollinger Bands', type: 'band', params: [
    { name: 'period', default: 20 },
    { name: 'stdDev', default: 2 }
  ]},
  { id: 'volume', name: 'Volume', type: 'value', params: [] }
];

// Available conditions for rules
const CONDITIONS = [
  { id: 'crossAbove', name: 'Crosses Above', valueType: 'indicator' },
  { id: 'crossBelow', name: 'Crosses Below', valueType: 'indicator' },
  { id: 'isAbove', name: 'Is Above', valueType: 'indicator' },
  { id: 'isBelow', name: 'Is Below', valueType: 'indicator' },
  { id: 'increases', name: 'Increases By', valueType: 'percent' },
  { id: 'decreases', name: 'Decreases By', valueType: 'percent' },
  { id: 'isOverbought', name: 'Is Overbought (RSI > 70)', valueType: 'none' },
  { id: 'isOversold', name: 'Is Oversold (RSI < 30)', valueType: 'none' }
];

function StrategyBuilder() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [historicalData, setHistoricalData] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [selectedIndicators, setSelectedIndicators] = useState([]);
  const [buyRules, setBuyRules] = useState([]);
  const [sellRules, setSellRules] = useState([]);
  const [strategyName, setStrategyName] = useState('Custom Strategy');
  const [testResults, setTestResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch historical data when symbol or timeframe changes
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await getHistoricalData(symbol, timeframe);
        setHistoricalData(data);
        
        // Prepare chart data
        const labels = data.slice(-50).map(d => new Date(d[0]).toLocaleString());
        const prices = data.slice(-50).map(d => parseFloat(d[4]));
        
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
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [symbol, timeframe]);
  
  // Add an indicator to the strategy
  const handleAddIndicator = () => {
    setSelectedIndicators([
      ...selectedIndicators,
      {
        id: `indicator_${Date.now()}`,
        type: 'sma',
        params: { period: 20 }
      }
    ]);
  };
  
  // Update an indicator's settings
  const handleUpdateIndicator = (id, type, params) => {
    setSelectedIndicators(selectedIndicators.map(ind => 
      ind.id === id ? { ...ind, type, params } : ind
    ));
  };
  
  // Remove an indicator
  const handleRemoveIndicator = (id) => {
    setSelectedIndicators(selectedIndicators.filter(ind => ind.id !== id));
  };
  
  // Add a buy rule
  const handleAddBuyRule = () => {
    if (selectedIndicators.length === 0) {
      alert('Please add at least one indicator first');
      return;
    }
    
    setBuyRules([
      ...buyRules,
      {
        id: `rule_${Date.now()}`,
        indicator1: selectedIndicators[0].id,
        condition: 'crossAbove',
        indicator2: selectedIndicators.length > 1 ? selectedIndicators[1].id : selectedIndicators[0].id,
        value: 0
      }
    ]);
  };
  
  // Update a buy rule
  const handleUpdateBuyRule = (id, updates) => {
    setBuyRules(buyRules.map(rule => 
      rule.id === id ? { ...rule, ...updates } : rule
    ));
  };
  
  // Remove a buy rule
  const handleRemoveBuyRule = (id) => {
    setBuyRules(buyRules.filter(rule => rule.id !== id));
  };
  
  // Add a sell rule
  const handleAddSellRule = () => {
    if (selectedIndicators.length === 0) {
      alert('Please add at least one indicator first');
      return;
    }
    
    setSellRules([
      ...sellRules,
      {
        id: `rule_${Date.now()}`,
        indicator1: selectedIndicators[0].id,
        condition: 'crossBelow',
        indicator2: selectedIndicators.length > 1 ? selectedIndicators[1].id : selectedIndicators[0].id,
        value: 0
      }
    ]);
  };
  
  // Update a sell rule
  const handleUpdateSellRule = (id, updates) => {
    setSellRules(sellRules.map(rule => 
      rule.id === id ? { ...rule, ...updates } : rule
    ));
  };
  
  // Remove a sell rule
  const handleRemoveSellRule = (id) => {
    setSellRules(sellRules.filter(rule => rule.id !== id));
  };
  
  // Test the strategy on historical data
  const handleTestStrategy = () => {
    if (buyRules.length === 0 || sellRules.length === 0) {
      alert('Please add at least one buy rule and one sell rule');
      return;
    }
    
    setIsLoading(true);
    
    // Simulate strategy performance on historical data
    // This is a simplified example - in a real system, this would be more complex
    
    // Start with 1000 USDT
    let balance = 1000;
    let position = 0;
    let trades = [];
    const balanceHistory = [balance];
    
    // Loop through historical data (starting from enough bars to calculate indicators)
    for (let i = 50; i < historicalData.length; i++) {
      const price = parseFloat(historicalData[i][4]);
      
      // Check buy rules (if we don't have a position)
      if (position === 0) {
        const shouldBuy = buyRules.some(rule => {
          // In a real implementation, this would evaluate the rule against indicator values
          // For this example, we'll just simulate random buys to show the concept
          return Math.random() > 0.95;
        });
        
        if (shouldBuy) {
          position = balance / price;
          balance = 0;
          trades.push({
            type: 'BUY',
            price,
            quantity: position,
            value: position * price,
            timestamp: historicalData[i][0]
          });
        }
      }
      // Check sell rules (if we have a position)
      else {
        const shouldSell = sellRules.some(rule => {
          // In a real implementation, this would evaluate the rule against indicator values
          // For this example, we'll just simulate random sells
          return Math.random() > 0.95;
        });
        
        if (shouldSell) {
          balance = position * price;
          trades.push({
            type: 'SELL',
            price,
            quantity: position,
            value: position * price,
            timestamp: historicalData[i][0]
          });
          position = 0;
        }
      }
      
      // Track balance history
      balanceHistory.push(balance + (position * price));
    }
    
    // Calculate final results
    const startingBalance = 1000;
    const finalBalance = balance + (position * parseFloat(historicalData[historicalData.length - 1][4]));
    const totalReturn = ((finalBalance - startingBalance) / startingBalance) * 100;
    const totalTrades = trades.length;
    
    // Create chart data for backtest results
    const performanceChartData = {
      labels: historicalData.slice(-balanceHistory.length).map(d => new Date(d[0]).toLocaleDateString()),
      datasets: [{
        label: 'Portfolio Value ($)',
        data: balanceHistory,
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.1
      }]
    };
    
    setTestResults({
      startingBalance,
      finalBalance,
      totalReturn,
      totalTrades,
      trades,
      performanceChartData
    });
    
    setIsLoading(false);
  };
  
  // Save the strategy
  const handleSaveStrategy = () => {
    const strategy = {
      name: strategyName,
      indicators: selectedIndicators,
      buyRules,
      sellRules
    };
    
    // In a real app, you'd save this to a database or local storage
    console.log('Strategy saved:', strategy);
    alert('Strategy saved!');
  };
  
  return (
    <div style={{ padding: 20 }}>
      <h2>Visual Strategy Builder</h2>
      
      <div style={{ display: 'flex', marginBottom: 20 }}>
        <div style={{ marginRight: 20 }}>
          <label>
            Symbol:&nbsp;
            <input 
              type="text" 
              value={symbol} 
              onChange={e => setSymbol(e.target.value.toUpperCase())} 
            />
          </label>
        </div>
        <div>
          <label>
            Timeframe:&nbsp;
            <select value={timeframe} onChange={e => setTimeframe(e.target.value)}>
              <option value="1m">1 Minute</option>
              <option value="5m">5 Minutes</option>
              <option value="15m">15 Minutes</option>
              <option value="30m">30 Minutes</option>
              <option value="1h">1 Hour</option>
              <option value="4h">4 Hours</option>
              <option value="1d">1 Day</option>
            </select>
          </label>
        </div>
      </div>
      
      <div style={{ display: 'flex', marginBottom: 20 }}>
        <div style={{ flex: 1, marginRight: 20 }}>
          <h3>Price Chart</h3>
          {chartData && (
            <Line 
              data={chartData} 
              options={{ 
                responsive: true, 
                plugins: { 
                  legend: { position: 'top' } 
                }
              }} 
            />
          )}
        </div>
        
        <div style={{ width: 350 }}>
          <h3>Strategy Settings</h3>
          <div style={{ marginBottom: 15 }}>
            <label>
              Strategy Name:&nbsp;
              <input 
                type="text" 
                value={strategyName} 
                onChange={e => setStrategyName(e.target.value)} 
                style={{ width: 200 }}
              />
            </label>
          </div>
          
          <div style={{ marginBottom: 15 }}>
            <h4>Indicators</h4>
            <button onClick={handleAddIndicator}>Add Indicator</button>
            
            {selectedIndicators.map(indicator => (
              <div key={indicator.id} style={{ marginTop: 10, border: '1px solid #ddd', padding: 10 }}>
                <select 
                  value={indicator.type} 
                  onChange={e => handleUpdateIndicator(indicator.id, e.target.value, indicator.params)}
                >
                  {INDICATORS.map(ind => (
                    <option key={ind.id} value={ind.id}>{ind.name}</option>
                  ))}
                </select>
                
                {INDICATORS.find(i => i.id === indicator.type)?.params.map(param => (
                  <div key={param.name}>
                    <label>
                      {param.name}:&nbsp;
                      <input 
                        type="number" 
                        value={indicator.params[param.name] || param.default} 
                        onChange={e => handleUpdateIndicator(
                          indicator.id, 
                          indicator.type, 
                          { ...indicator.params, [param.name]: parseInt(e.target.value) }
                        )}
                        style={{ width: 60 }}
                      />
                    </label>
                  </div>
                ))}
                
                <button 
                  onClick={() => handleRemoveIndicator(indicator.id)}
                  style={{ marginTop: 5 }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          
          <div style={{ marginBottom: 15 }}>
            <h4>Buy Rules</h4>
            <button onClick={handleAddBuyRule}>Add Buy Rule</button>
            
            {buyRules.map(rule => (
              <div key={rule.id} style={{ marginTop: 10, border: '1px solid #ddd', padding: 10 }}>
                <div>
                  <select 
                    value={rule.indicator1} 
                    onChange={e => handleUpdateBuyRule(rule.id, { indicator1: e.target.value })}
                  >
                    {selectedIndicators.map(ind => (
                      <option key={ind.id} value={ind.id}>
                        {INDICATORS.find(i => i.id === ind.type)?.name}
                      </option>
                    ))}
                  </select>
                  
                  <select 
                    value={rule.condition} 
                    onChange={e => handleUpdateBuyRule(rule.id, { condition: e.target.value })}
                    style={{ margin: '0 5px' }}
                  >
                    {CONDITIONS.map(cond => (
                      <option key={cond.id} value={cond.id}>{cond.name}</option>
                    ))}
                  </select>
                  
                  {CONDITIONS.find(c => c.id === rule.condition)?.valueType === 'indicator' ? (
                    <select 
                      value={rule.indicator2} 
                      onChange={e => handleUpdateBuyRule(rule.id, { indicator2: e.target.value })}
                    >
                      {selectedIndicators.map(ind => (
                        <option key={ind.id} value={ind.id}>
                          {INDICATORS.find(i => i.id === ind.type)?.name}
                        </option>
                      ))}
                    </select>
                  ) : CONDITIONS.find(c => c.id === rule.condition)?.valueType === 'percent' ? (
                    <input 
                      type="number" 
                      value={rule.value} 
                      onChange={e => handleUpdateBuyRule(rule.id, { value: parseFloat(e.target.value) })}
                      style={{ width: 60 }}
                    />
                  ) : null}
                </div>
                
                <button 
                  onClick={() => handleRemoveBuyRule(rule.id)}
                  style={{ marginTop: 5 }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          
          <div style={{ marginBottom: 15 }}>
            <h4>Sell Rules</h4>
            <button onClick={handleAddSellRule}>Add Sell Rule</button>
            
            {sellRules.map(rule => (
              <div key={rule.id} style={{ marginTop: 10, border: '1px solid #ddd', padding: 10 }}>
                <div>
                  <select 
                    value={rule.indicator1} 
                    onChange={e => handleUpdateSellRule(rule.id, { indicator1: e.target.value })}
                  >
                    {selectedIndicators.map(ind => (
                      <option key={ind.id} value={ind.id}>
                        {INDICATORS.find(i => i.id === ind.type)?.name}
                      </option>
                    ))}
                  </select>
                  
                  <select 
                    value={rule.condition} 
                    onChange={e => handleUpdateSellRule(rule.id, { condition: e.target.value })}
                    style={{ margin: '0 5px' }}
                  >
                    {CONDITIONS.map(cond => (
                      <option key={cond.id} value={cond.id}>{cond.name}</option>
                    ))}
                  </select>
                  
                  {CONDITIONS.find(c => c.id === rule.condition)?.valueType === 'indicator' ? (
                    <select 
                      value={rule.indicator2} 
                      onChange={e => handleUpdateSellRule(rule.id, { indicator2: e.target.value })}
                    >
                      {selectedIndicators.map(ind => (
                        <option key={ind.id} value={ind.id}>
                          {INDICATORS.find(i => i.id === ind.type)?.name}
                        </option>
                      ))}
                    </select>
                  ) : CONDITIONS.find(c => c.id === rule.condition)?.valueType === 'percent' ? (
                    <input 
                      type="number" 
                      value={rule.value} 
                      onChange={e => handleUpdateSellRule(rule.id, { value: parseFloat(e.target.value) })}
                      style={{ width: 60 }}
                    />
                  ) : null}
                </div>
                
                <button 
                  onClick={() => handleRemoveSellRule(rule.id)}
                  style={{ marginTop: 5 }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: 20 }}>
            <button 
              onClick={handleTestStrategy}
              disabled={isLoading || buyRules.length === 0 || sellRules.length === 0}
              style={{ marginRight: 10 }}
            >
              {isLoading ? 'Testing...' : 'Test Strategy'}
            </button>
            
            <button 
              onClick={handleSaveStrategy}
              disabled={isLoading || buyRules.length === 0 || sellRules.length === 0}
            >
              Save Strategy
            </button>
          </div>
        </div>
      </div>
      
      {testResults && (
        <div>
          <h3>Strategy Test Results</h3>
          <div style={{ display: 'flex', marginBottom: 20 }}>
            <div style={{ flex: 1, marginRight: 20 }}>
              <Line 
                data={testResults.performanceChartData} 
                options={{ 
                  responsive: true, 
                  plugins: { 
                    legend: { position: 'top' } 
                  }
                }} 
              />
            </div>
            
            <div style={{ width: 350 }}>
              <h4>Performance Summary</h4>
              <div>
                <strong>Starting Balance:</strong> ${testResults.startingBalance.toFixed(2)}<br />
                <strong>Final Balance:</strong> ${testResults.finalBalance.toFixed(2)}<br />
                <strong>Total Return:</strong> {testResults.totalReturn.toFixed(2)}%<br />
                <strong>Total Trades:</strong> {testResults.totalTrades}<br />
              </div>
              
              <h4>Recent Trades</h4>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {testResults.trades.slice(-5).map((trade, index) => (
                  <div key={index} style={{ 
                    padding: 5, 
                    marginBottom: 5, 
                    backgroundColor: trade.type === 'BUY' ? '#d4edda' : '#f8d7da' 
                  }}>
                    <strong>{trade.type}</strong> {trade.quantity.toFixed(4)} @ ${trade.price.toFixed(2)}<br />
                    <small>{new Date(trade.timestamp).toLocaleString()}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StrategyBuilder;
