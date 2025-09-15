import React, { useEffect, useState } from 'react';
import { getBinanceMarketData, getHistoricalData } from '../binanceApi';
import { runStrategy } from '../strategyEngine';

// Expanded list of coins to scan
const COINS_TO_SCAN = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT',
  'AVAXUSDT', 'MATICUSDT', 'DOTUSDT', 'TRXUSDT', 'LTCUSDT', 'LINKUSDT', 'ATOMUSDT',
  'UNIUSDT', 'ETCUSDT', 'ALGOUSDT', 'FILUSDT', 'ICPUSDT', 'XMRUSDT'
];

function MarketScanner({ binanceApiKey, binanceApiSecret, strategy, onSelectSymbol }) {
  const [scanResults, setScanResults] = useState([]);
  const [status, setStatus] = useState('Ready to scan.');
  const [filters, setFilters] = useState({
    minVolume: 1000000, // $1M minimum 24h volume
    minChange: -100,     // minimum 24h % change
    maxChange: 100,      // maximum 24h % change
    signalTypes: ['BUY', 'SELL', 'HOLD'],
  });
  const [sortBy, setSortBy] = useState('score'); // score, volume, change
  const [sortDirection, setSortDirection] = useState('desc'); // asc, desc

  // Calculate technical indicators
  const calculateIndicators = (historicalData) => {
    if (!historicalData || historicalData.length < 50) return {};
    
    // Extract close prices
    const closes = historicalData.map(candle => parseFloat(candle[4]));
    
    // Calculate RSI (14-period)
    const rsi = calculateRSI(closes, 14);
    
    // Calculate MACD
    const macd = calculateMACD(closes);
    
    // Calculate Bollinger Bands
    const bollingerBands = calculateBollingerBands(closes, 20, 2);
    
    // Calculate Average Volume (last 20 periods)
    const volumes = historicalData.slice(-20).map(candle => parseFloat(candle[5]));
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    
    // Volume Change (current vs average)
    const volumeChange = ((volumes[volumes.length - 1] / avgVolume) - 1) * 100;
    
    // Trend Strength
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const trendStrength = (ema20 - ema50) / ema50 * 100;
    
    return {
      rsi,
      macd: macd.histogram,
      bollingerPosition: (closes[closes.length - 1] - bollingerBands.lower) / 
                         (bollingerBands.upper - bollingerBands.lower),
      volumeChange,
      trendStrength
    };
  };
  
  // Simplified EMA calculation
  const calculateEMA = (data, period) => {
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  };
  
  // Simplified RSI calculation
  const calculateRSI = (data, period) => {
    if (data.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = data[i] - data[i - 1];
      if (change >= 0) gains += change;
      else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    for (let i = period + 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(0, change)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(0, -change)) / period;
    }
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };
  
  // Simplified MACD calculation
  const calculateMACD = (data) => {
    const ema12 = calculateEMA(data, 12);
    const ema26 = calculateEMA(data, 26);
    const macdLine = ema12 - ema26;
    const signal = calculateEMA([...Array(data.length - 9).fill(0), macdLine], 9);
    return {
      macd: macdLine,
      signal,
      histogram: macdLine - signal
    };
  };
  
  // Simplified Bollinger Bands calculation
  const calculateBollingerBands = (data, period, multiplier) => {
    const sma = data.slice(-period).reduce((a, b) => a + b, 0) / period;
    const sumSquaredDiff = data.slice(-period).reduce((sum, val) => sum + Math.pow(val - sma, 2), 0);
    const stdDev = Math.sqrt(sumSquaredDiff / period);
    
    return {
      middle: sma,
      upper: sma + (multiplier * stdDev),
      lower: sma - (multiplier * stdDev)
    };
  };
  
  // Score the coin based on technical indicators
  const scoreOpportunity = (indicators, priceChange, signal) => {
    let score = 50; // Neutral starting point
    
    // Trend following component
    if (indicators.trendStrength > 0) {
      score += 10; // Uptrend
      if (signal === 'BUY') score += 15;
    } else {
      score -= 10; // Downtrend
      if (signal === 'SELL') score += 15;
    }
    
    // RSI component
    if (indicators.rsi < 30) {
      score += 15; // Oversold
      if (signal === 'BUY') score += 10;
    } else if (indicators.rsi > 70) {
      score -= 15; // Overbought
      if (signal === 'SELL') score += 10;
    }
    
    // MACD component
    if (indicators.macd > 0) {
      score += 10; // Bullish momentum
    } else {
      score -= 10; // Bearish momentum
    }
    
    // Bollinger position component
    if (indicators.bollingerPosition < 0.2) {
      score += 10; // Near lower band, potential buy
    } else if (indicators.bollingerPosition > 0.8) {
      score -= 10; // Near upper band, potential sell
    }
    
    // Volume component
    if (indicators.volumeChange > 20) {
      score += 15; // High volume increase
    }
    
    // Recent price action component
    if (priceChange > 5) {
      score += 5; // Strong recent performance
    } else if (priceChange < -5) {
      score -= 5; // Weak recent performance
    }
    
    return Math.min(100, Math.max(0, score));
  };

  const handleFilterChange = (key, value) => {
    setFilters({
      ...filters,
      [key]: value
    });
  };

  const handleSignalFilterChange = (signal) => {
    const newSignalTypes = [...filters.signalTypes];
    const index = newSignalTypes.indexOf(signal);
    
    if (index === -1) {
      newSignalTypes.push(signal);
    } else {
      newSignalTypes.splice(index, 1);
    }
    
    setFilters({
      ...filters,
      signalTypes: newSignalTypes
    });
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  useEffect(() => {
    if (binanceApiKey && binanceApiSecret) {
      const runScan = async () => {
        setStatus('Scanning market...');
        const results = [];
        
        for (const symbol of COINS_TO_SCAN) {
          try {
            const market = await getBinanceMarketData(symbol);
            if (parseFloat(market.quoteVolume) < filters.minVolume) {
              continue; // Skip low volume coins
            }
            
            const historicalData = await getHistoricalData(symbol);
            const signal = await runStrategy(strategy, market, historicalData);
            
            // Calculate technical indicators
            const indicators = calculateIndicators(historicalData);
            
            // Score this opportunity
            const opportunityScore = scoreOpportunity(
              indicators,
              parseFloat(market.priceChangePercent),
              signal.signal
            );
            
            results.push({
              symbol,
              price: parseFloat(market.lastPrice),
              change24h: parseFloat(market.priceChangePercent),
              volume24h: parseFloat(market.quoteVolume),
              signal: signal.signal,
              reason: signal.reason,
              indicators,
              score: opportunityScore
            });
          } catch (error) {
            console.error(`Could not scan ${symbol}:`, error);
          }
        }
        
        setScanResults(results);
        setStatus(`Scan complete. Found ${results.length} coins matching criteria.`);
      };

      runScan();
      const interval = setInterval(runScan, 300000); // Rescan every 5 minutes
      return () => clearInterval(interval);
    }
  }, [binanceApiKey, binanceApiSecret, strategy]);

  // Filter and sort results
  const filteredResults = scanResults
    .filter(result => (
      result.change24h >= filters.minChange &&
      result.change24h <= filters.maxChange &&
      filters.signalTypes.includes(result.signal)
    ))
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'change':
          comparison = a.change24h - b.change24h;
          break;
        case 'volume':
          comparison = a.volume24h - b.volume24h;
          break;
        case 'score':
          comparison = a.score - b.score;
          break;
        default:
          comparison = a.score - b.score;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  return (
    <div style={{ padding: 20 }}>
      <h2>Advanced Market Scanner</h2>
      <p><strong>Status:</strong> {status}</p>
      
      <div style={{ marginBottom: 20, padding: 10, border: '1px solid #ccc' }}>
        <h3>Filters</h3>
        <div style={{ display: 'flex', gap: '20px', marginBottom: 10 }}>
          <label>
            Min Volume ($):
            <input
              type="number"
              value={filters.minVolume}
              onChange={e => handleFilterChange('minVolume', parseInt(e.target.value))}
              style={{ marginLeft: 5, width: '100px' }}
            />
          </label>
          <label>
            Min Price Change (%):
            <input
              type="number"
              value={filters.minChange}
              onChange={e => handleFilterChange('minChange', parseFloat(e.target.value))}
              style={{ marginLeft: 5, width: '60px' }}
            />
          </label>
          <label>
            Max Price Change (%):
            <input
              type="number"
              value={filters.maxChange}
              onChange={e => handleFilterChange('maxChange', parseFloat(e.target.value))}
              style={{ marginLeft: 5, width: '60px' }}
            />
          </label>
        </div>
        <div>
          <span>Signal Types: </span>
          <label style={{ marginRight: 10 }}>
            <input
              type="checkbox"
              checked={filters.signalTypes.includes('BUY')}
              onChange={() => handleSignalFilterChange('BUY')}
            />
            BUY
          </label>
          <label style={{ marginRight: 10 }}>
            <input
              type="checkbox"
              checked={filters.signalTypes.includes('SELL')}
              onChange={() => handleSignalFilterChange('SELL')}
            />
            SELL
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.signalTypes.includes('HOLD')}
              onChange={() => handleSignalFilterChange('HOLD')}
            />
            HOLD
          </label>
        </div>
      </div>
      
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid black' }}>
            <th style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => handleSort('symbol')}>Symbol {sortBy === 'symbol' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</th>
            <th style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => handleSort('price')}>Price {sortBy === 'price' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</th>
            <th style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => handleSort('change')}>24h Change {sortBy === 'change' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</th>
            <th style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => handleSort('volume')}>Volume {sortBy === 'volume' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</th>
            <th style={{ textAlign: 'left' }}>Signal</th>
            <th style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => handleSort('score')}>Score {sortBy === 'score' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</th>
            <th style={{ textAlign: 'left' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredResults.map(result => (
            <tr key={result.symbol} style={{ 
              backgroundColor: 
                result.score > 75 ? '#d4f7dc' :
                result.score > 60 ? '#e8f7d4' :
                result.score < 30 ? '#f7d4d4' :
                result.signal === 'BUY' ? '#d4edda' : 
                result.signal === 'SELL' ? '#f8d7da' : 
                'transparent' 
            }}>
              <td>{result.symbol}</td>
              <td>${result.price.toFixed(2)}</td>
              <td style={{ color: result.change24h >= 0 ? 'green' : 'red' }}>
                {result.change24h.toFixed(2)}%
              </td>
              <td>${(result.volume24h / 1000000).toFixed(2)}M</td>
              <td>{result.signal}</td>
              <td>
                <div style={{ position: 'relative', width: '100px', height: '20px', backgroundColor: '#eee', borderRadius: '10px' }}>
                  <div 
                    style={{ 
                      position: 'absolute', 
                      width: `${result.score}%`, 
                      height: '100%',
                      backgroundColor: result.score > 75 ? '#28a745' : result.score > 50 ? '#ffc107' : '#dc3545',
                      borderRadius: '10px'
                    }}
                  ></div>
                  <div style={{ position: 'absolute', width: '100%', textAlign: 'center', color: result.score > 60 ? 'white' : 'black' }}>
                    {result.score.toFixed(0)}
                  </div>
                </div>
              </td>
              <td>
                <button onClick={() => onSelectSymbol(result.symbol)}>
                  Trade
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredResults.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          No coins match the selected criteria.
        </div>
      )}
    </div>
  );
}

export default MarketScanner;
