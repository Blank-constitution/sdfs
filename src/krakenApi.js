import CryptoJS from 'crypto-js';
import axios from 'axios';

const BASE_URL = 'https://api.kraken.com';

// Generate Kraken API signature
function generateKrakenSignature(path, nonce, postData, apiSecret) {
  const message = CryptoJS.enc.Utf8.parse(nonce + postData);
  const hash = CryptoJS.SHA256(message);
  
  const hmacDigest = CryptoJS.HmacSHA512(
    path + CryptoJS.enc.Hex.stringify(hash),
    CryptoJS.enc.Base64.parse(apiSecret)
  );
  
  return CryptoJS.enc.Base64.stringify(hmacDigest);
}

// Get Kraken account balances
export async function getKrakenBalances(apiKey, apiSecret) {
  try {
    const path = '/0/private/Balance';
    const nonce = Date.now().toString();
    const postData = `nonce=${nonce}`;
    
    const signature = generateKrakenSignature(path, nonce, postData, apiSecret);
    
    const response = await axios.post(`${BASE_URL}${path}`, postData, {
      headers: {
        'API-Key': apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (response.data.error && response.data.error.length > 0) {
      throw new Error(response.data.error.join(', '));
    }
    
    return response.data.result;
  } catch (error) {
    console.error('Error fetching Kraken balances:', error);
    throw error;
  }
}

// Get market data for a specific symbol
export async function getKrakenMarketData(symbol) {
  try {
    // Convert symbol to Kraken format (e.g., BTCUSDT -> XBTUSD)
    const krakenSymbol = convertToKrakenSymbol(symbol);
    
    const response = await axios.get(`${BASE_URL}/0/public/Ticker?pair=${krakenSymbol}`);
    
    if (response.data.error && response.data.error.length > 0) {
      throw new Error(response.data.error.join(', '));
    }
    
    const result = response.data.result;
    const symbolData = result[Object.keys(result)[0]];
    
    return {
      symbol: symbol,
      price: symbolData.c[0],  // Last trade closed price
      bid: symbolData.b[0],    // Best bid
      ask: symbolData.a[0],    // Best ask
      volume: symbolData.v[1], // Volume (24h)
      high: symbolData.h[1],   // High (24h)
      low: symbolData.l[1]     // Low (24h)
    };
  } catch (error) {
    console.error('Error fetching Kraken market data:', error);
    throw error;
  }
}

// Get all available tickers from Kraken
export async function getKrakenAllTickers() {
  try {
    const response = await axios.get(`${BASE_URL}/0/public/Ticker`);
    
    if (response.data.error && response.data.error.length > 0) {
      throw new Error(response.data.error.join(', '));
    }
    
    const result = response.data.result;
    const standardizedTickers = {};
    
    // Convert Kraken-specific pairs to standard format
    Object.keys(result).forEach(krakenPair => {
      const standardPair = convertFromKrakenSymbol(krakenPair);
      const tickerData = result[krakenPair];
      
      standardizedTickers[standardPair] = {
        symbol: standardPair,
        price: tickerData.c[0],  // Last trade closed price
        bid: tickerData.b[0],    // Best bid
        ask: tickerData.a[0],    // Best ask
        volume: tickerData.v[1]  // Volume (24h)
      };
    });
    
    return standardizedTickers;
  } catch (error) {
    console.error('Error fetching Kraken tickers:', error);
    throw error;
  }
}

// Convert standard symbol to Kraken format
function convertToKrakenSymbol(symbol) {
  // Handle common conversions
  if (symbol === 'BTCUSDT') return 'XBTUSD';
  if (symbol === 'ETHUSDT') return 'ETHUSD';
  
  // For other symbols, basic conversion
  const base = symbol.substring(0, 3);
  const quote = symbol.substring(3);
  
  return `${base}${quote}`;
}

// Convert Kraken symbol to standard format
function convertFromKrakenSymbol(krakenSymbol) {
  // Handle common conversions
  if (krakenSymbol === 'XXBTZUSD') return 'BTCUSDT';
  if (krakenSymbol === 'XETHZUSD') return 'ETHUSDT';
  
  // Remove X/Z prefixes and strip pair name
  let cleanSymbol = krakenSymbol
    .replace('X', '')
    .replace('Z', '')
    .replace('USD', 'USDT');
    
  return cleanSymbol;
}

// Place an order on Kraken
export async function placeKrakenOrder(apiKey, apiSecret, symbol, side, quantity, price = null) {
  try {
    const path = '/0/private/AddOrder';
    const nonce = Date.now().toString();
    
    // Convert symbol to Kraken format
    const krakenSymbol = convertToKrakenSymbol(symbol);
    
    // Build post data
    let postData = `nonce=${nonce}&pair=${krakenSymbol}&type=${side.toLowerCase()}&ordertype=${price ? 'limit' : 'market'}`;
    
    // Add volume (quantity)
    postData += `&volume=${quantity}`;
    
    // Add price if limit order
    if (price) {
      postData += `&price=${price}`;
    }
    
    const signature = generateKrakenSignature(path, nonce, postData, apiSecret);
    
    const response = await axios.post(`${BASE_URL}${path}`, postData, {
      headers: {
        'API-Key': apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (response.data.error && response.data.error.length > 0) {
      throw new Error(response.data.error.join(', '));
    }
    
    return response.data.result;
  } catch (error) {
    console.error('Error placing Kraken order:', error);
    throw error;
  }
}
