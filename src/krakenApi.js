import axios from 'axios';
import CryptoJS from 'crypto-js';
import qs from 'qs';

const KRAKEN_API_URL = 'https://api.kraken.com';
const KRAKEN_BASE_URL = `${KRAKEN_API_URL}/0/public`;
const KRAKEN_PRIVATE_PATH = '/0/private/';

// Kraken uses different pair names (e.g., XBTUSDT for BTCUSDT)
const symbolToKrakenPair = (symbol) => {
  if (symbol === 'BTCUSDT') return 'XBTUSDT';
  if (symbol === 'ETHUSDT') return 'ETHUSDT';
  // Add more mappings as needed
  return symbol;
};

// Helper for Kraken private API signing
const getKrakenSignature = (path, request, secret, nonce) => {
  const secret_buffer = CryptoJS.enc.Base64.parse(secret);
  const hash = CryptoJS.SHA256(nonce + qs.stringify(request));
  const hmac = CryptoJS.HmacSHA512(path + hash.toString(CryptoJS.enc.Latin1), secret_buffer);
  return hmac.toString(CryptoJS.enc.Base64);
};

export async function getKrakenBalances(apiKey, apiSecret) {
  const nonce = Date.now().toString();
  const path = `${KRAKEN_PRIVATE_PATH}Balance`;
  const request = { nonce };
  const signature = getKrakenSignature(path, request, apiSecret, nonce);

  try {
    const res = await axios.post(
      `${KRAKEN_API_URL}${path}`,
      qs.stringify(request),
      { headers: { 'API-Key': apiKey, 'API-Sign': signature } }
    );
    // Return a structure similar to Binance's
    const balances = res.data.result;
    return Object.keys(balances).map(key => ({
      asset: key.replace('XBT', 'BTC').replace('ZUSD', 'USDT'), // Normalize asset names
      free: balances[key],
    }));
  } catch (error) {
    console.error('Failed to get Kraken balances:', error.response.data);
    return [];
  }
}

export async function getKrakenMarketData(symbol) {
  const pair = symbolToKrakenPair(symbol);
  try {
    const res = await axios.get(`${KRAKEN_BASE_URL}/Ticker?pair=${pair}`);
    const data = res.data.result[Object.keys(res.data.result)[0]];
    // Return a structure similar to Binance's for consistency
    return {
      price: data.c[0], // c[0] is the last trade price
    };
  } catch (error) {
    console.error(`Failed to get Kraken data for ${symbol}:`, error);
    return null;
  }
}
