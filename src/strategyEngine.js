// This is the "brain" of the bot. It analyzes data and decides what to do.
import { runMlStrategy } from './mlStrategy';

// Commented out duplicate function
// async function runMlStrategy(marketData, historicalData) {
//   // 1. Preprocess data (historical + real-time).
//   // 2. Feed data into your trained ML model (e.g., TensorFlow.js, ONNX).
//   // 3. The model predicts price movement or a direct action.
//   // 4. Return the signal.
//   console.log("Running custom ML/AI strategy...");
//   // For now, returns a placeholder signal.
//   return { signal: 'HOLD', reason: 'ML model analysis pending.' };
// }

// Example of a simpler, technical indicator-based strategy
function runMovingAverageCrossover(historicalData) {
    if (historicalData.length < 20) return { signal: 'HOLD', reason: 'Not enough data.' };
    
    const shortTermPeriod = 10;
    const longTermPeriod = 20;

    const shortTermData = historicalData.slice(-shortTermPeriod);
    const longTermData = historicalData.slice(-longTermPeriod);

    const shortTermAvg = shortTermData.reduce((sum, d) => sum + parseFloat(d[4]), 0) / shortTermPeriod; // d[4] is closing price
    const longTermAvg = longTermData.reduce((sum, d) => sum + parseFloat(d[4]), 0) / longTermPeriod;

    if (shortTermAvg > longTermAvg) {
        return { signal: 'BUY', reason: `Short avg (${shortTermAvg.toFixed(2)}) > Long avg (${longTermAvg.toFixed(2)})` };
    } else {
        return { signal: 'SELL', reason: `Short avg (${shortTermAvg.toFixed(2)}) < Long avg (${longTermAvg.toFixed(2)})` };
    }
}

// Helper function to calculate RSI
function calculateRSI(data, period = 14) {
    if (data.length <= period) return 50; // Return neutral if not enough data

    let gains = 0;
    let losses = 0;

    // Calculate initial average gains and losses
    for (let i = 1; i <= period; i++) {
        const change = data[i][4] - data[i - 1][4]; // index 4 is close price
        if (change > 0) {
            gains += change;
        } else {
            losses -= change;
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Smooth the rest
    for (let i = period + 1; i < data.length; i++) {
        const change = data[i][4] - data[i - 1][4];
        let gain = change > 0 ? change : 0;
        let loss = change < 0 ? -change : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100; // Prevent division by zero
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}


// New "Conservative Confluence" strategy
function runConservativeStrategy(historicalData) {
    if (historicalData.length < 50) return { signal: 'HOLD', reason: 'Not enough historical data.' };

    const shortTermPeriod = 12;
    const longTermPeriod = 26;

    const shortTermMA = historicalData.slice(-shortTermPeriod).reduce((sum, d) => sum + parseFloat(d[4]), 0) / shortTermPeriod;
    const longTermMA = historicalData.slice(-longTermPeriod).reduce((sum, d) => sum + parseFloat(d[4]), 0) / longTermPeriod;
    const rsi = calculateRSI(historicalData.slice(-50)); // Use last 50 periods for RSI calc

    // BUY Signal: Trend is up (short MA > long MA) AND we are not overbought (RSI < 70)
    if (shortTermMA > longTermMA && rsi < 70) {
        return {
            signal: 'BUY',
            reason: `Uptrend confirmed (MA) and not overbought (RSI: ${rsi.toFixed(2)})`
        };
    }

    // SELL Signal: Trend is down (short MA < long MA) AND we are not oversold (RSI > 30)
    if (shortTermMA < longTermMA && rsi > 30) {
        return {
            signal: 'SELL',
            reason: `Downtrend confirmed (MA) and not oversold (RSI: ${rsi.toFixed(2)})`
        };
    }

    // HOLD Signal: Conditions not met
    return {
        signal: 'HOLD',
        reason: `No clear signal. MA Trend: ${shortTermMA > longTermMA ? 'UP' : 'DOWN'}, RSI: ${rsi.toFixed(2)}`
    };
}

// Scalping strategy: look for very small, quick profits (0.05-0.2%)
function runScalpingStrategy(historicalData, marketData) {
  if (historicalData.length < 30) return { signal: 'HOLD', reason: 'Not enough data for scalping.' };
  
  // Extract recent price data
  const closes = historicalData.slice(-30).map(d => parseFloat(d[4]));
  const volumes = historicalData.slice(-30).map(d => parseFloat(d[5]));
  const currentPrice = parseFloat(marketData.price);
  
  // 1. Check for price consolidation (low volatility)
  const recentPrices = closes.slice(-10);
  const priceRange = Math.max(...recentPrices) - Math.min(...recentPrices);
  const volatility = priceRange / currentPrice * 100;
  
  // 2. Check for volume spike compared to average
  const avgVolume = volumes.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
  const recentVolume = volumes.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const volumeRatio = recentVolume / avgVolume;
  
  // 3. Check for short-term momentum (using 1-minute EMA crossover)
  const ema5 = calculateEMA(closes, 5);
  const ema10 = calculateEMA(closes, 10);
  const lastEma5 = ema5[ema5.length - 1];
  const lastEma10 = ema10[ema10.length - 1];
  
  // 4. Calculate trading fees (e.g., 0.1% per trade on Binance)
  const tradingFee = 0.1; // percent
  
  // Decision logic for scalping:
  // - We want low volatility (price consolidation)
  // - But increasing volume (accumulation)
  // - With small but clear directional bias
  // - And enough potential profit to cover fees
  
  if (volatility < 0.3 && volumeRatio > 1.2) {
    // Price is consolidating with increasing volume - potential breakout
    
    if (lastEma5 > lastEma10) {
      // Potential upward breakout
      // Check if potential profit (0.2%) is greater than trading fees
      const potentialProfit = 0.2 - tradingFee;
      
      if (potentialProfit > 0) {
        return {
          signal: 'BUY',
          reason: `Scalp: Low volatility (${volatility.toFixed(2)}%) with volume surge (${(volumeRatio-1)*100}%) and upward bias. Targeting +0.2%`,
          tradeType: 'scalp',
          targetProfit: 0.2,
          stopLoss: 0.1
        };
      }
    } else if (lastEma5 < lastEma10) {
      // Potential downward breakout
      // Check if potential profit (0.2%) is greater than trading fees
      const potentialProfit = 0.2 - tradingFee;
      
      if (potentialProfit > 0) {
        return {
          signal: 'SELL',
          reason: `Scalp: Low volatility (${volatility.toFixed(2)}%) with volume surge (${(volumeRatio-1)*100}%) and downward bias. Targeting +0.2%`,
          tradeType: 'scalp',
          targetProfit: 0.2,
          stopLoss: 0.1
        };
      }
    }
  }
  
  return { signal: 'HOLD', reason: 'No high-probability scalping opportunity detected.' };
}

// Function to analyze multiple timeframes simultaneously
function runMultiTimeframeStrategy(historicalData, marketData) {
  if (historicalData.length < 200) return { signal: 'HOLD', reason: 'Not enough historical data for multi-timeframe analysis.' };
  
  // Define timeframes for analysis
  const timeframes = {
    short: 20,  // Equivalent to ~20 minutes in 1m data or ~20 hours in 1h data
    medium: 50, // Equivalent to ~50 minutes or ~50 hours
    long: 200   // Equivalent to ~200 minutes or ~200 hours
  };
  
  // Calculate EMAs for each timeframe
  const shortEMA = calculateEMA(historicalData.map(d => parseFloat(d[4])), timeframes.short).slice(-1)[0];
  const mediumEMA = calculateEMA(historicalData.map(d => parseFloat(d[4])), timeframes.medium).slice(-1)[0];
  const longEMA = calculateEMA(historicalData.map(d => parseFloat(d[4])), timeframes.long).slice(-1)[0];
  
  // Calculate RSI for short timeframe
  const shortRSI = calculateRSI(historicalData.slice(-50)).slice(-1)[0];
  
  // Current price
  const currentPrice = parseFloat(marketData.price);
  
  // Analyze trend alignment across timeframes
  let trendAlignment = '';
  if (shortEMA > mediumEMA && mediumEMA > longEMA && currentPrice > shortEMA) {
    trendAlignment = 'strong_uptrend';
  } else if (shortEMA < mediumEMA && mediumEMA < longEMA && currentPrice < shortEMA) {
    trendAlignment = 'strong_downtrend';
  } else if (shortEMA > mediumEMA && mediumEMA < longEMA) {
    trendAlignment = 'mixed_bullish';
  } else if (shortEMA < mediumEMA && mediumEMA > longEMA) {
    trendAlignment = 'mixed_bearish';
  } else {
    trendAlignment = 'neutral';
  }
  
  // Generate signal based on trend alignment and momentum
  switch (trendAlignment) {
    case 'strong_uptrend':
      // In a strong uptrend, look for pullbacks (RSI dropping) as buying opportunities
      if (shortRSI < 40) {
        return {
          signal: 'BUY',
          reason: `Multi-TF: Strong uptrend across all timeframes with oversold condition (RSI: ${shortRSI.toFixed(2)})`
        };
      }
      break;
    
    case 'strong_downtrend':
      // In a strong downtrend, look for bounces (RSI rising) as selling opportunities
      if (shortRSI > 60) {
        return {
          signal: 'SELL',
          reason: `Multi-TF: Strong downtrend across all timeframes with overbought condition (RSI: ${shortRSI.toFixed(2)})`
        };
      }
      break;
    
    case 'mixed_bullish':
      // In a mixed but bullish environment, be more selective with entries
      if (shortRSI < 30) {
        return {
          signal: 'BUY',
          reason: `Multi-TF: Bullish bias with very oversold condition (RSI: ${shortRSI.toFixed(2)})`
        };
      }
      break;
      
    case 'mixed_bearish':
      // In a mixed but bearish environment, be more selective with entries
      if (shortRSI > 70) {
        return {
          signal: 'SELL',
          reason: `Multi-TF: Bearish bias with very overbought condition (RSI: ${shortRSI.toFixed(2)})`
        };
      }
      break;
  }
  
  return {
    signal: 'HOLD',
    reason: `Multi-TF: ${trendAlignment.replace('_', ' ')} detected, but no clear entry signal yet.`
  };
}

export async function runStrategy(strategy, marketData, historicalData) {
  switch (strategy) {
    case 'conservativeConfluence':
      return runConservativeStrategy(historicalData);
    case 'movingAverageCrossover':
      return runMovingAverageCrossover(historicalData);
    case 'mlPredictor':
      return await runMlStrategy(marketData, historicalData);
    case 'scalping':
      return runScalpingStrategy(historicalData, marketData);
    case 'multiTimeframe':
      return runMultiTimeframeStrategy(historicalData, marketData);
    default:
      return { signal: 'HOLD', reason: 'No strategy selected or implemented.' };
  }
}
