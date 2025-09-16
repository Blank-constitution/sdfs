// TensorFlow.js lazy loading
let tf = null;
let modelCache = {};

async function loadTensorflow() {
  if (!tf) {
    try {
      tf = await import('@tensorflow/tfjs');
      console.log('TensorFlow.js loaded:', tf.version);
    } catch (err) {
      console.error('Failed to load TensorFlow.js:', err);
      throw new Error('TensorFlow.js loading failed');
    }
  }
  return tf;
}

// Load a pre-trained model from a URL or local path
async function loadModel(modelPath) {
  if (modelCache[modelPath]) {
    return modelCache[modelPath];
  }
  
  try {
    const tf = await loadTensorflow();
    
    // Check if it's a local path or URL
    let model;
    if (modelPath.startsWith('http') || modelPath.startsWith('/')) {
      model = await tf.loadLayersModel(modelPath);
    } else if (typeof window !== 'undefined' && window.electron) {
      // Electron-specific loading from local file
      const localPath = `file://${window.electron.getAppPath()}/models/${modelPath}`;
      model = await tf.loadLayersModel(localPath);
    } else {
      // Default to public folder in web environment
      model = await tf.loadLayersModel(`/models/${modelPath}`);
    }
    
    modelCache[modelPath] = model;
    return model;
  } catch (err) {
    console.error('Failed to load ML model:', err);
    throw new Error(`Model loading failed: ${err.message}`);
  }
}

// Timeframe constants
const TIMEFRAMES = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000
};

// Preprocess historical data for ML models
function preprocessData(historicalData, lookback = 14) {
  // Extract price data
  const opens = historicalData.map(d => parseFloat(d[1]));
  const highs = historicalData.map(d => parseFloat(d[2]));
  const lows = historicalData.map(d => parseFloat(d[3]));
  const closes = historicalData.map(d => parseFloat(d[4]));
  const volumes = historicalData.map(d => parseFloat(d[5]));
  
  // Calculate price movements (percent changes)
  const priceChanges = [];
  for (let i = 1; i < closes.length; i++) {
    priceChanges.push((closes[i] - closes[i-1]) / closes[i-1] * 100);
  }
  
  // Calculate technical indicators
  const rsi = calculateRSI(closes);
  const { macd, signal, histogram } = calculateMACD(closes);
  const bb = calculateBollingerBands(closes);
  
  // Calculate volume metrics
  const volumeChanges = [];
  for (let i = 1; i < volumes.length; i++) {
    volumeChanges.push((volumes[i] - volumes[i-1]) / volumes[i-1] * 100);
  }
  
  // Normalize features
  const normalizedFeatures = [
    normalize(closes),
    normalize(highs),
    normalize(lows),
    normalize(volumes),
    normalize(priceChanges),
    normalize(rsi),
    normalize(histogram),
    normalize(volumeChanges)
  ];
  
  // Create sequences for LSTM model
  const sequences = [];
  const nextChanges = [];
  
  for (let i = lookback; i < closes.length - 1; i++) {
    const sequence = [];
    for (let j = i - lookback; j < i; j++) {
      const features = [];
      for (let k = 0; k < normalizedFeatures.length; k++) {
        if (normalizedFeatures[k][j] !== undefined) {
          features.push(normalizedFeatures[k][j]);
        }
      }
      sequence.push(features);
    }
    sequences.push(sequence);
    
    // Next price change (target)
    nextChanges.push(priceChanges[i]);
  }
  
  return {
    sequences,
    nextChanges,
    lastClose: closes[closes.length - 1],
    lastSequence: sequences[sequences.length - 1]
  };
}

// Helper functions for indicators
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) {
    return Array(prices.length).fill(50);
  }
  
  const rsiArray = [];
  let gains = 0;
  let losses = 0;
  
  // Calculate first average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // First RSI value
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsiArray.push(100 - (100 / (1 + rs)));
  
  // Calculate rest of RSI values
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiArray.push(100 - (100 / (1 + rs)));
  }
  
  return Array(period).fill(50).concat(rsiArray);
}

function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const ema12 = calculateEMA(prices, fastPeriod);
  const ema26 = calculateEMA(prices, slowPeriod);
  
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    macdLine.push(ema12[i] - ema26[i]);
  }
  
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  const histogram = [];
  for (let i = 0; i < macdLine.length; i++) {
    histogram.push(macdLine[i] - signalLine[i]);
  }
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram
  };
}

function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  const emaArray = [prices[0]];
  
  for (let i = 1; i < prices.length; i++) {
    emaArray.push(prices[i] * k + emaArray[i - 1] * (1 - k));
  }
  
  return emaArray;
}

function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  const bands = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    
    // Calculate standard deviation
    const squaredDiffs = slice.map(p => Math.pow(p - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const stdev = Math.sqrt(variance);
    
    bands.push({
      middle: sma,
      upper: sma + (stdDev * stdev),
      lower: sma - (stdDev * stdev)
    });
  }
  
  return bands;
}

// Helper function to normalize data
function normalize(data) {
  if (data.length === 0) return [];
  
  const min = Math.min(...data.filter(x => x !== undefined));
  const max = Math.max(...data.filter(x => x !== undefined));
  
  if (max === min) return data.map(() => 0.5);
  
  return data.map(x => x !== undefined ? (x - min) / (max - min) : 0.5);
}

// Create and train a TensorFlow.js model for price prediction
async function createPricePredictionModel(sequences, nextChanges) {
  // Create model
  const model = tf.sequential();
  
  // Add layers
  model.add(tf.layers.lstm({
    units: 64,
    returnSequences: true,
    inputShape: [sequences[0].length, sequences[0][0].length]
  }));
  
  model.add(tf.layers.dropout({ rate: 0.2 }));
  
  model.add(tf.layers.lstm({
    units: 32,
    returnSequences: false
  }));
  
  model.add(tf.layers.dense({ units: 1 }));
  
  // Compile model
  model.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError'
  });
  
  // Convert data to tensors
  const xs = tf.tensor3d(sequences);
  const ys = tf.tensor2d(nextChanges.map(c => [c]));
  
  // Train model
  await model.fit(xs, ys, {
    epochs: 25,
    batchSize: 32,
    shuffle: true,
    validationSplit: 0.1,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}, Loss: ${logs.loss.toFixed(4)}`);
      }
    }
  });
  
  return model;
}

// Predict the next price movement
async function predictPriceChange(model, lastSequence) {
  const input = tf.tensor3d([lastSequence]);
  const prediction = await model.predict(input);
  const predictedChange = prediction.dataSync()[0];
  return predictedChange;
}

// Function to find micro-opportunities for scalping
function findScalpingOpportunities(historicalData, fees = 0.1) {
  // This will analyze multiple timeframes to find scalping opportunities
  // that have high probability of small profits (0.05-0.2%)
  
  // Extract price data for the last 100 candles
  const recentData = historicalData.slice(-100);
  
  // Calculate short-term patterns
  const shortTermPatterns = analyzeShortTermPatterns(recentData);
  
  // Calculate quick momentum signals
  const quickMomentum = calculateQuickMomentum(recentData);
  
  // Analyze order book pressure (this would require order book data)
  // const orderBookPressure = analyzeOrderBookPressure(orderBook);
  
  // Identify potential scalping setups
  const setups = [];
  
  // Look for short-term reversal patterns at support/resistance levels
  for (let i = 0; i < shortTermPatterns.levels.length; i++) {
    const level = shortTermPatterns.levels[i];
    const currentPrice = parseFloat(recentData[recentData.length - 1][4]); // Last close
    
    // If price is near a support level and has positive momentum
    if (Math.abs(currentPrice - level.price) / currentPrice < 0.002 && 
        level.type === 'support' && 
        quickMomentum.direction === 'up') {
      
      // Calculate potential profit after fees
      const targetPrice = currentPrice * 1.002; // 0.2% target
      const potentialProfit = ((targetPrice / currentPrice) - 1) * 100 - fees;
      
      if (potentialProfit > 0) {
        setups.push({
          type: 'scalp_long',
          entryPrice: currentPrice,
          targetPrice,
          stopLoss: level.price * 0.998, // 0.2% below support
          potentialProfit,
          confidence: level.strength * quickMomentum.strength,
          reason: `Price at support level (${level.price.toFixed(2)}) with ${quickMomentum.strength.toFixed(2)} upward momentum`
        });
      }
    }
    
    // If price is near a resistance level and has negative momentum
    if (Math.abs(currentPrice - level.price) / currentPrice < 0.002 && 
        level.type === 'resistance' && 
        quickMomentum.direction === 'down') {
      
      // Calculate potential profit after fees
      const targetPrice = currentPrice * 0.998; // 0.2% target
      const potentialProfit = ((currentPrice / targetPrice) - 1) * 100 - fees;
      
      if (potentialProfit > 0) {
        setups.push({
          type: 'scalp_short',
          entryPrice: currentPrice,
          targetPrice,
          stopLoss: level.price * 1.002, // 0.2% above resistance
          potentialProfit,
          confidence: level.strength * quickMomentum.strength,
          reason: `Price at resistance level (${level.price.toFixed(2)}) with ${quickMomentum.strength.toFixed(2)} downward momentum`
        });
      }
    }
  }
  
  // Sort by confidence
  setups.sort((a, b) => b.confidence - a.confidence);
  
  return setups;
}

// Helper function to analyze short-term price patterns
function analyzeShortTermPatterns(data) {
  // Find support and resistance levels
  const closes = data.map(d => parseFloat(d[4]));
  const levels = [];
  
  // Simple algorithm to find swing highs and lows
  for (let i = 5; i < closes.length - 5; i++) {
    // Check for swing high (resistance)
    if (closes[i] > closes[i-1] && 
        closes[i] > closes[i-2] && 
        closes[i] > closes[i+1] && 
        closes[i] > closes[i+2]) {
      
      // Calculate how many times this level was tested
      let tests = 0;
      for (let j = 0; j < closes.length; j++) {
        if (Math.abs(closes[j] - closes[i]) / closes[i] < 0.003) {
          tests++;
        }
      }
      
      levels.push({
        price: closes[i],
        type: 'resistance',
        strength: tests / 10 // Normalize strength
      });
    }
    
    // Check for swing low (support)
    if (closes[i] < closes[i-1] && 
        closes[i] < closes[i-2] && 
        closes[i] < closes[i+1] && 
        closes[i] < closes[i+2]) {
      
      // Calculate how many times this level was tested
      let tests = 0;
      for (let j = 0; j < closes.length; j++) {
        if (Math.abs(closes[j] - closes[i]) / closes[i] < 0.003) {
          tests++;
        }
      }
      
      levels.push({
        price: closes[i],
        type: 'support',
        strength: tests / 10 // Normalize strength
      });
    }
  }
  
  return { levels };
}

// Helper function to calculate quick momentum
function calculateQuickMomentum(data) {
  const closes = data.map(d => parseFloat(d[4]));
  
  // Use 3 different timeframes for momentum calculation
  const ema8 = calculateEMA(closes, 8);
  const ema21 = calculateEMA(closes, 21);
  const rsi = calculateRSI(closes);
  
  const lastEma8 = ema8[ema8.length - 1];
  const lastEma21 = ema21[ema21.length - 1];
  const lastRsi = rsi[rsi.length - 1];
  
  // Calculate overall momentum
  let strength = 0;
  let direction = 'neutral';
  
  if (lastEma8 > lastEma21) {
    direction = 'up';
    strength = 0.5 + ((lastEma8 / lastEma21 - 1) * 10); // Normalized 0-1
    
    // Add RSI component
    if (lastRsi > 50) {
      strength += (lastRsi - 50) / 50; // Add 0-1 based on RSI
    } else {
      strength -= (50 - lastRsi) / 100; // Subtract 0-0.5 based on RSI
    }
  } else {
    direction = 'down';
    strength = 0.5 + ((lastEma21 / lastEma8 - 1) * 10); // Normalized 0-1
    
    // Add RSI component
    if (lastRsi < 50) {
      strength += (50 - lastRsi) / 50; // Add 0-1 based on RSI
    } else {
      strength -= (lastRsi - 50) / 100; // Subtract 0-0.5 based on RSI
    }
  }
  
  return {
    direction,
    strength: Math.min(1, Math.max(0, strength)) // Clamp 0-1
  };
}

// Main function to run the ML-enhanced strategy
export async function runMlStrategy(marketData, historicalData, apiKey = null) {
  try {
    // Try to load TensorFlow and model, fallback to simple strategy if it fails
    let useMlModel = false;
    let model = null;
    
    try {
      await loadTensorflow();
      // Attempt to load default price prediction model
      model = await loadModel('price_prediction_model/model.json');
      useMlModel = true;
    } catch (err) {
      console.warn('ML model not available, using basic strategy:', err.message);
    }
    
    // Process data regardless of model availability
    const { sequences, nextChanges, lastClose, lastSequence } = preprocessData(historicalData);
    
    // If model loaded successfully, use it for prediction
    if (useMlModel && model) {
      try {
        const predictedChange = await predictPriceChange(model, lastSequence);
        
        // Calculate predicted price
        const predictedPrice = lastClose * (1 + predictedChange / 100);
        
        // Generate signal based on prediction
        let signal = 'HOLD';
        let reason = '';
        
        if (predictedChange > 1.5) { // Significant upward movement expected
          signal = 'BUY';
          reason = `ML predicts ${predictedChange.toFixed(2)}% rise to $${predictedPrice.toFixed(2)}`;
        } else if (predictedChange < -1.5) { // Significant downward movement expected
          signal = 'SELL';
          reason = `ML predicts ${predictedChange.toFixed(2)}% drop to $${predictedPrice.toFixed(2)}`;
        } else {
          reason = `ML predicts small ${predictedChange > 0 ? 'rise' : 'drop'} of ${Math.abs(predictedChange).toFixed(2)}% to $${predictedPrice.toFixed(2)}`;
        }
        
        // Calculate confidence score based on model performance
        const confidence = Math.min(1, Math.max(0, Math.abs(predictedChange) / 5));
        
        return { 
          signal, 
          reason,
          confidence,
          tradeType: 'swing', // Mark this as a swing trade
          prediction: {
            value: predictedChange,
            price: predictedPrice
          }
        };
      } catch (modelError) {
        console.error('Error running ML prediction:', modelError);
        // Fall back to simple strategy
      }
    }
    
    // Fallback to simple strategy if model fails or isn't available
    const currentPrice = parseFloat(marketData.price);
    const priceChange = parseFloat(marketData.priceChangePercent || 0);
    
    if (priceChange > 2) {
      return {
        signal: 'BUY',
        reason: 'Strong upward momentum detected: ' + priceChange.toFixed(2) + '%',
        confidence: 0.7,
        tradeType: 'swing'
      };
    } else if (priceChange < -2) {
      return {
        signal: 'SELL',
        reason: 'Strong downward momentum detected: ' + priceChange.toFixed(2) + '%',
        confidence: 0.7,
        tradeType: 'swing'
      };
    } else {
      return {
        signal: 'HOLD',
        reason: 'Market conditions neutral: ' + priceChange.toFixed(2) + '%',
        confidence: 0.5
      };
    }
  } catch (error) {
    console.error('ML strategy error:', error);
    return { signal: 'HOLD', reason: 'Error in ML strategy: ' + error.message };
  }
}
