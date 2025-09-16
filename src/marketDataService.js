import axios from 'axios';

// Multiple data source providers for accurate market data
const DATA_SOURCES = {
  ALPHA_VANTAGE: 'alpha-vantage',
  TWELVE_DATA: 'twelve-data',
  HISTORICAL_CSV: 'historical-csv'
};

// API keys should be environment variables in production
const API_KEYS = {
  [DATA_SOURCES.ALPHA_VANTAGE]: process.env.ALPHA_VANTAGE_API_KEY || '',
  [DATA_SOURCES.TWELVE_DATA]: process.env.TWELVE_DATA_API_KEY || ''
};

// Cache to avoid unnecessary API calls
const dataCache = {
  historical: {},
  realtime: {}
};

/**
 * Fetch real market data from commercial data providers
 * This ensures accurate backtesting and ML training without "fake" testnet data
 */
export async function fetchRealMarketData(symbol, interval = '1h', source = DATA_SOURCES.TWELVE_DATA) {
  const cacheKey = `${symbol}-${interval}-${source}`;
  
  // Check cache first (1 minute TTL for realtime data)
  const cachedData = dataCache.realtime[cacheKey];
  if (cachedData && (Date.now() - cachedData.timestamp) < 60000) {
    return cachedData.data;
  }
  
  try {
    let data;
    
    switch (source) {
      case DATA_SOURCES.ALPHA_VANTAGE:
        data = await fetchAlphaVantageData(symbol, interval);
        break;
        
      case DATA_SOURCES.TWELVE_DATA:
        data = await fetchTwelveData(symbol, interval);
        break;
        
      case DATA_SOURCES.HISTORICAL_CSV:
        data = await loadHistoricalCsvData(symbol, interval);
        break;
        
      default:
        throw new Error(`Unsupported data source: ${source}`);
    }
    
    // Cache the result
    dataCache.realtime[cacheKey] = {
      timestamp: Date.now(),
      data
    };
    
    return data;
  } catch (error) {
    console.error(`Error fetching real market data for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Fetch historical data for backtesting and ML model training
 */
export async function fetchHistoricalData(symbol, interval = '1d', limit = 1000, source = DATA_SOURCES.TWELVE_DATA) {
  const cacheKey = `${symbol}-${interval}-${limit}-${source}`;
  
  // Check cache first (1 day TTL for historical data)
  const cachedData = dataCache.historical[cacheKey];
  if (cachedData && (Date.now() - cachedData.timestamp) < 86400000) {
    return cachedData.data;
  }
  
  try {
    let data;
    
    switch (source) {
      case DATA_SOURCES.ALPHA_VANTAGE:
        data = await fetchAlphaVantageHistorical(symbol, interval, limit);
        break;
        
      case DATA_SOURCES.TWELVE_DATA:
        data = await fetchTwelveDataHistorical(symbol, interval, limit);
        break;
        
      case DATA_SOURCES.HISTORICAL_CSV:
        data = await loadHistoricalCsvData(symbol, interval, limit);
        break;
        
      default:
        throw new Error(`Unsupported data source: ${source}`);
    }
    
    // Cache the result
    dataCache.historical[cacheKey] = {
      timestamp: Date.now(),
      data
    };
    
    return data;
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    throw error;
  }
}

// Alpha Vantage API integration
async function fetchAlphaVantageData(symbol, interval) {
  const apiKey = API_KEYS[DATA_SOURCES.ALPHA_VANTAGE];
  if (!apiKey) throw new Error('Alpha Vantage API key not configured');
  
  // Convert interval format
  const avInterval = convertIntervalToAlphaVantage(interval);
  
  const response = await axios.get('https://www.alphavantage.co/query', {
    params: {
      function: 'TIME_SERIES_INTRADAY',
      symbol,
      interval: avInterval,
      apikey: apiKey,
      outputsize: 'compact'
    }
  });
  
  return transformAlphaVantageData(response.data);
}

async function fetchAlphaVantageHistorical(symbol, interval, limit) {
  const apiKey = API_KEYS[DATA_SOURCES.ALPHA_VANTAGE];
  if (!apiKey) throw new Error('Alpha Vantage API key not configured');
  
  // Different endpoint based on interval
  let endpoint = 'TIME_SERIES_DAILY';
  if (interval === '1wk') endpoint = 'TIME_SERIES_WEEKLY';
  if (interval === '1mo') endpoint = 'TIME_SERIES_MONTHLY';
  
  const response = await axios.get('https://www.alphavantage.co/query', {
    params: {
      function: endpoint,
      symbol,
      apikey: apiKey,
      outputsize: 'full'
    }
  });
  
  return transformAlphaVantageData(response.data, limit);
}

// Twelve Data API integration
async function fetchTwelveData(symbol, interval) {
  const apiKey = API_KEYS[DATA_SOURCES.TWELVE_DATA];
  if (!apiKey) throw new Error('Twelve Data API key not configured');
  
  const response = await axios.get('https://api.twelvedata.com/time_series', {
    params: {
      symbol,
      interval: convertIntervalToTwelveData(interval),
      apikey: apiKey,
      outputsize: 1
    }
  });
  
  return transformTwelveData(response.data);
}

async function fetchTwelveDataHistorical(symbol, interval, limit) {
  const apiKey = API_KEYS[DATA_SOURCES.TWELVE_DATA];
  if (!apiKey) throw new Error('Twelve Data API key not configured');
  
  const response = await axios.get('https://api.twelvedata.com/time_series', {
    params: {
      symbol,
      interval: convertIntervalToTwelveData(interval),
      apikey: apiKey,
      outputsize: Math.min(limit, 5000) // API limit
    }
  });
  
  return transformTwelveData(response.data);
}

// Load from local CSV files (for offline or bulk data)
async function loadHistoricalCsvData(symbol, interval, limit = 1000) {
  try {
    // In a browser environment, fetch the CSV from the public folder
    if (typeof window !== 'undefined') {
      const response = await fetch(`/data/${symbol}_${interval}.csv`);
      const text = await response.text();
      return parseCSV(text, limit);
    } 
    // In a Node.js environment, read from the filesystem
    else {
      const fs = await import('fs');
      const path = await import('path');
      const csvPath = path.join(process.cwd(), 'public', 'data', `${symbol}_${interval}.csv`);
      
      if (!fs.existsSync(csvPath)) {
        throw new Error(`CSV file not found: ${csvPath}`);
      }
      
      const text = fs.readFileSync(csvPath, 'utf8');
      return parseCSV(text, limit);
    }
  } catch (error) {
    console.error(`Error loading CSV data for ${symbol}:`, error);
    throw error;
  }
}

// Helper functions
function convertIntervalToAlphaVantage(interval) {
  const map = {
    '1m': '1min',
    '5m': '5min',
    '15m': '15min',
    '30m': '30min',
    '1h': '60min',
    '1d': 'daily',
    '1wk': 'weekly',
    '1mo': 'monthly'
  };
  return map[interval] || '60min';
}

function convertIntervalToTwelveData(interval) {
  const map = {
    '1m': '1min',
    '5m': '5min',
    '15m': '15min',
    '30m': '30min',
    '1h': '1h',
    '4h': '4h',
    '1d': '1day',
    '1wk': '1week',
    '1mo': '1month'
  };
  return map[interval] || '1h';
}

function transformAlphaVantageData(data, limit = 100) {
  // Extract the time series data
  const timeSeriesKey = Object.keys(data).find(key => key.includes('Time Series'));
  if (!timeSeriesKey || !data[timeSeriesKey]) {
    throw new Error('Invalid Alpha Vantage data format');
  }
  
  const timeSeries = data[timeSeriesKey];
  
  // Convert to our standard format (same as Binance klines)
  return Object.entries(timeSeries)
    .map(([timestamp, values]) => {
      return [
        new Date(timestamp).getTime(), // Open time
        values['1. open'],             // Open
        values['2. high'],             // High
        values['3. low'],              // Low
        values['4. close'],            // Close
        values['5. volume'] || '0',    // Volume
        0,                             // Close time (not provided)
        0,                             // Quote asset volume (not provided)
        0,                             // Number of trades (not provided)
        0,                             // Taker buy base volume (not provided)
        0,                             // Taker buy quote volume (not provided)
        0                              // Ignore (not provided)
      ];
    })
    .sort((a, b) => b[0] - a[0]) // Sort by timestamp, newest first
    .slice(0, limit);             // Limit the number of candles
}

function transformTwelveData(data) {
  if (!data.values) {
    throw new Error('Invalid Twelve Data format');
  }
  
  // Convert to our standard format (same as Binance klines)
  return data.values.map(candle => {
    return [
      new Date(candle.datetime).getTime(), // Open time
      candle.open,                         // Open
      candle.high,                         // High
      candle.low,                          // Low
      candle.close,                        // Close
      candle.volume || '0',                // Volume
      0,                                   // Close time (not provided)
      0,                                   // Quote asset volume (not provided)
      0,                                   // Number of trades (not provided)
      0,                                   // Taker buy base volume (not provided)
      0,                                   // Taker buy quote volume (not provided)
      0                                    // Ignore (not provided)
    ];
  });
}

function parseCSV(text, limit = 1000) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  
  // Map headers to indices
  const headerMap = {
    timestamp: headers.indexOf('timestamp'),
    open: headers.indexOf('open'),
    high: headers.indexOf('high'),
    low: headers.indexOf('low'),
    close: headers.indexOf('close'),
    volume: headers.indexOf('volume')
  };
  
  // Convert each line to our standard format
  return lines
    .slice(1) // Skip header
    .map(line => {
      const values = line.split(',');
      
      return [
        parseInt(values[headerMap.timestamp]),       // Open time
        parseFloat(values[headerMap.open]),          // Open
        parseFloat(values[headerMap.high]),          // High
        parseFloat(values[headerMap.low]),           // Low
        parseFloat(values[headerMap.close]),         // Close
        parseFloat(values[headerMap.volume] || '0'), // Volume
        0,                                           // Close time (not provided)
        0,                                           // Quote asset volume (not provided)
        0,                                           // Number of trades (not provided)
        0,                                           // Taker buy base volume (not provided)
        0,                                           // Taker buy quote volume (not provided)
        0                                            // Ignore (not provided)
      ];
    })
    .slice(0, limit); // Limit the number of candles
}
