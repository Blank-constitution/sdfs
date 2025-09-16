import { emit, EVENTS } from './eventBus';

// Cache for API responses to avoid duplicating requests
const analysisCache = new Map();
// Track when last analysis was performed for each market
const lastAnalysisTime = new Map();

/**
 * Analyze market data using Google Gemini AI API
 */
export async function analyzeMarketWithAI(symbol, marketData, historicalData, apiKey) {
  try {
    if (!apiKey) {
      return { success: false, error: 'API key not provided' };
    }

    // Check cache first (valid for 30 minutes)
    const cacheKey = `${symbol}-${Date.now() - (Date.now() % 1800000)}`;
    if (analysisCache.has(cacheKey)) {
      return analysisCache.get(cacheKey);
    }

    // Don't analyze too frequently (max once per 15 minutes per symbol)
    const lastTime = lastAnalysisTime.get(symbol) || 0;
    if (Date.now() - lastTime < 900000) {
      return { 
        success: false, 
        cached: true,
        error: 'Analysis rate limit (15min)', 
        lastAnalysis: new Date(lastTime).toISOString() 
      };
    }

    // Prepare market data summary
    const marketSummary = prepareMarketSummary(symbol, marketData, historicalData);
    
    // Call Google Gemini API
    const analysis = await callGeminiAI(marketSummary, apiKey);
    
    // Update cache and timestamp
    lastAnalysisTime.set(symbol, Date.now());
    analysisCache.set(cacheKey, analysis);
    
    // Emit event with analysis results
    emit(EVENTS.AI_ANALYSIS_COMPLETE, {
      symbol,
      timestamp: Date.now(),
      analysis
    });
    
    return analysis;
  } catch (error) {
    console.error('AI market analysis error:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error in AI analysis'
    };
  }
}

/**
 * Prepare market summary for AI analysis
 */
function prepareMarketSummary(symbol, marketData, historicalData) {
  // Current price and 24h stats
  const currentPrice = parseFloat(marketData.lastPrice || marketData.price);
  const priceChange24h = parseFloat(marketData.priceChangePercent || 0);
  const volume24h = parseFloat(marketData.volume || 0);
  
  // Calculate key metrics from historical data
  const recentCandles = historicalData.slice(0, 30); // Last 30 candles
  
  // Price levels
  const closes = recentCandles.map(candle => parseFloat(candle[4]));
  const highs = recentCandles.map(candle => parseFloat(candle[2]));
  const lows = recentCandles.map(candle => parseFloat(candle[3]));
  
  // Simple moving averages
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  
  // Volatility
  const atr = calculateATR(recentCandles, 14);
  const volatility = atr / currentPrice * 100; // As percentage of price
  
  return {
    symbol,
    currentPrice,
    priceChange24h,
    volume24h,
    technicalIndicators: {
      sma20,
      sma50,
      rsi: calculateRSI(closes, 14),
      macd: calculateMACD(closes),
      volatility
    },
    keyLevels: {
      recentHigh: Math.max(...highs),
      recentLow: Math.min(...lows),
      support: findSupportLevel(lows),
      resistance: findResistanceLevel(highs)
    },
    pattern: identifyPattern(recentCandles)
  };
}

/**
 * Call the Google Gemini AI API for market analysis
 */
async function callGeminiAI(marketSummary, apiKey) {
  try {
    // Import the Google Generative AI library (dynamically to avoid issues if not available)
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    
    // Initialize the API
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Create the prompt with market data
    const prompt = `
    Analyze this cryptocurrency market data and provide trading insights:
    
    Symbol: ${marketSummary.symbol}
    Current Price: $${marketSummary.currentPrice.toFixed(2)}
    24h Change: ${marketSummary.priceChange24h.toFixed(2)}%
    
    Technical Indicators:
    - SMA20: $${marketSummary.technicalIndicators.sma20.toFixed(2)}
    - SMA50: $${marketSummary.technicalIndicators.sma50.toFixed(2)}
    - RSI(14): ${marketSummary.technicalIndicators.rsi.toFixed(2)}
    - MACD: Signal Line Difference: ${marketSummary.technicalIndicators.macd.histogram.toFixed(4)}
    - Volatility: ${marketSummary.technicalIndicators.volatility.toFixed(2)}%
    
    Key Price Levels:
    - Recent High: $${marketSummary.keyLevels.recentHigh.toFixed(2)}
    - Recent Low: $${marketSummary.keyLevels.recentLow.toFixed(2)}
    - Support: $${marketSummary.keyLevels.support.toFixed(2)}
    - Resistance: $${marketSummary.keyLevels.resistance.toFixed(2)}
    
    Identified Pattern: ${marketSummary.pattern.name || "None"}
    
    Provide a concise analysis with:
    1. Market sentiment (bullish/bearish/neutral)
    2. Key support and resistance levels to watch
    3. Potential entry and exit points
    4. Risk assessment (high/medium/low)
    5. A confidence score (0-100%) for your analysis
    
    Format your response as JSON with the following structure:
    {
      "sentiment": "bullish/bearish/neutral",
      "keyLevels": { "support": [], "resistance": [] },
      "strategy": { "entry": number or null, "exit": number or null, "stopLoss": number or null },
      "risk": "high/medium/low",
      "confidence": number,
      "reasoning": "brief explanation"
    }
    `;
    
    // Generate the analysis
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse the JSON response
    // Use a try-catch here as the AI might not always return valid JSON
    try {
      // Find JSON in the response (in case the AI adds text before or after)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const jsonStr = jsonMatch[0];
      const analysis = JSON.parse(jsonStr);
      
      return {
        success: true,
        timestamp: Date.now(),
        analysis
      };
    } catch (jsonError) {
      console.error('Error parsing AI response as JSON:', jsonError);
      return {
        success: false,
        error: 'Invalid response format from AI',
        rawResponse: text
      };
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return {
      success: false,
      error: error.message || 'Unknown error calling AI API'
    };
  }
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(prices, period) {
  if (prices.length < period) {
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  }
  
  return prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
}

/**
 * Calculate Relative Strength Index using standard formula
 */
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) {
    return 50; // Default neutral value
  }
  
  let gains = 0;
  let losses = 0;
  
  // Calculate first average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i - 1] - prices[i];
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
  let rsiValues = [100 - (100 / (1 + rs))];
  
  // Calculate remaining RSI values
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i - 1] - prices[i];
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    
    // Use proper smoothing formula
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - (100 / (1 + rs)));
  }
  
  // Pad beginning with 50 (neutral)
  return [...Array(prices.length - rsiValues.length).fill(50), ...rsiValues];
}

/**
 * Calculate MACD using standard formula
 */
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < Math.max(fastPeriod, slowPeriod, signalPeriod)) {
    return { macd: 0, signal: 0, histogram: 0 };
  }
  
  // Calculate EMAs
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  
  // Calculate MACD line
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    macdLine.push(fastEMA[i] - slowEMA[i]);
  }
  
  // Calculate signal line (EMA of MACD line)
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  // Calculate histogram
  const histogram = [];
  for (let i = 0; i < macdLine.length; i++) {
    histogram.push(macdLine[i] - signalLine[i]);
  }
  
  // Get the latest values
  const latestIndex = macdLine.length - 1;
  return {
    macd: macdLine[latestIndex],
    signal: signalLine[latestIndex],
    histogram: histogram[latestIndex]
  };
}

/**
 * Calculate Exponential Moving Average using standard formula
 */
function calculateEMA(prices, period) {
  if (prices.length < period) {
    return Array(prices.length).fill(prices[0]);
  }
  
  const k = 2 / (period + 1);
  const emaArray = [prices[0]]; // Start with first price
  
  for (let i = 1; i < prices.length; i++) {
    emaArray.push(prices[i] * k + emaArray[i - 1] * (1 - k));
  }
  
  return emaArray;
}

/**
 * Calculate Average True Range
 */
function calculateATR(candles, period = 14) {
  if (candles.length < 2) {
    return 0;
  }
  
  const trValues = [];
  
  for (let i = 1; i < candles.length; i++) {
    const high = parseFloat(candles[i - 1][2]);
    const low = parseFloat(candles[i - 1][3]);
    const close = parseFloat(candles[i - 1][4]);
    const currentHigh = parseFloat(candles[i][2]);
    const currentLow = parseFloat(candles[i][3]);
    
    // True Range is the greatest of:
    // 1. Current High - Current Low
    // 2. |Current High - Previous Close|
    // 3. |Current Low - Previous Close|
    const tr1 = currentHigh - currentLow;
    const tr2 = Math.abs(currentHigh - close);
    const tr3 = Math.abs(currentLow - close);
    
    trValues.push(Math.max(tr1, tr2, tr3));
  }
  
  // Calculate simple average of TR values
  return trValues.reduce((sum, tr) => sum + tr, 0) / trValues.length;
}

/**
 * Find support level from recent lows
 */
function findSupportLevel(lows) {
  // Simple support level is just the recent low
  return Math.min(...lows);
}

/**
 * Find resistance level from recent highs
 */
function findResistanceLevel(highs) {
  // Simple resistance level is just the recent high
  return Math.max(...highs);
}

/**
 * Identify chart patterns (very simplified)
 */
function identifyPattern(candles) {
  if (candles.length < 5) {
    return { name: null, confidence: 0 };
  }
  
  const closes = candles.map(candle => parseFloat(candle[4]));
  
  // Simple trend identification
  let upCount = 0;
  let downCount = 0;
  
  for (let i = 1; i < closes.length; i++) {
    if (closes[i-1] < closes[i]) upCount++;
    if (closes[i-1] > closes[i]) downCount++;
  }
  
  const trendStrength = Math.abs(upCount - downCount) / closes.length;
  
  if (upCount > downCount * 2) {
    return { name: "Strong Uptrend", confidence: trendStrength };
  } else if (downCount > upCount * 2) {
    return { name: "Strong Downtrend", confidence: trendStrength };
  } else if (upCount > downCount * 1.5) {
    return { name: "Moderate Uptrend", confidence: trendStrength };
  } else if (downCount > upCount * 1.5) {
    return { name: "Moderate Downtrend", confidence: trendStrength };
  } else {
    // Check for potential reversal patterns
    const recentTrend = closes[3] > closes[0] ? "up" : "down";
    const lastMove = closes[0] > closes[1] ? "up" : "down";
    
    if (recentTrend === "up" && lastMove === "down") {
      return { name: "Potential Reversal (Bearish)", confidence: 0.6 };
    } else if (recentTrend === "down" && lastMove === "up") {
      return { name: "Potential Reversal (Bullish)", confidence: 0.6 };
    }
    
    return { name: "Sideways/Consolidation", confidence: 0.7 };
  }
}
