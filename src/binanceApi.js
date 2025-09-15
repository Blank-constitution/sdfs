import axios from 'axios';

// This function will now call our own secure API endpoint
async function callApiProxy(endpoint, params = {}) {
  try {
    // The endpoint is now relative to our own domain
    const response = await axios.post('/api/binance', {
      endpoint,
      params,
    });
    return response.data;
  } catch (error) {
    console.error(`API call to ${endpoint} failed:`, error.response?.data);
    throw error.response?.data || new Error('Network error');
  }
}

// All functions are refactored to use the proxy
export async function getBinanceBalances() {
  return callApiProxy('/api/v3/account');
}

export async function getBinanceTrades(symbol) {
  return callApiProxy('/api/v3/myTrades', { symbol });
}

export async function getOpenOrders() {
  return callApiProxy('/api/v3/openOrders');
}

// Public endpoints don't need the proxy, but we can keep them consistent
export async function getBinanceOrderBook(symbol) {
  const res = await axios.get(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=10`);
  return res.data;
}

export async function getBinanceMarketData(symbol) {
  const res = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
  return res.data;
}

export async function getHistoricalData(symbol, interval = '1h', limit = 100) {
  const res = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  return res.data;
}

// Note: Functions like placeOrder and cancelOrder would also need to be proxied
// in a similar way, likely using a POST/DELETE method in the serverless function.
    price, // Take-profit price
    stopPrice, // Stop-loss trigger price
    stopLimitPrice, // Stop-loss execution price
    stopLimitTimeInForce: 'GTC', // Good-Til-Canceled
    timestamp,
  });
  const queryString = params.toString();
  const signature = sign(queryString, apiSecret);

  try {
    const res = await apiClient.post(
      `${BASE_URL}/api/v3/order/oco?${queryString}&signature=${signature}`,
      null,
      {
        headers: { 'X-MBX-APIKEY': apiKey },
      }
    );
    return res.data;
  } catch (error) {
    console.error("OCO Order placement failed:", error.response.data);
    throw error.response.data;
  }
}

// New function to fetch open orders
export async function getOpenOrders(apiKey, apiSecret) {
  const timestamp = getTimestamp();
  const queryString = `timestamp=${timestamp}`;
  const signature = sign(queryString, apiSecret);

  try {
    const res = await apiClient.get(
      `${BASE_URL}/api/v3/openOrders?${queryString}&signature=${signature}`,
      {
        headers: { 'X-MBX-APIKEY': apiKey },
      }
    );
    return res.data;
  } catch (error) {
    console.error("Failed to get open orders:", error.response?.data);
    throw error.response?.data;
  }
}

// New function to cancel an order
export async function cancelOrder(apiKey, apiSecret, symbol, orderId) {
  const timestamp = getTimestamp();
  const params = new URLSearchParams({
    symbol,
    orderId,
    timestamp,
  });
  const queryString = params.toString();
  const signature = sign(queryString, apiSecret);

  try {
    const res = await apiClient.delete(
      `${BASE_URL}/api/v3/order?${queryString}&signature=${signature}`,
      {
        headers: { 'X-MBX-APIKEY': apiKey },
      }
    );
    return res.data;
  } catch (error) {
    console.error("Failed to cancel order:", error.response?.data);
    throw error.response?.data;
  }
}

// Private endpoints (requires API key/secret, simplified for demo)
export async function getBinanceBalances(apiKey, apiSecret) {
  const timestamp = getTimestamp();
  const queryString = `timestamp=${timestamp}`;
  const signature = sign(queryString, apiSecret);

  try {
    const res = await apiClient.post(
      `${BASE_URL}/api/v3/account?${queryString}&signature=${signature}`,
      null,
      {
        headers: { 'X-MBX-APIKEY': apiKey },
      }
    );
    return res.data.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
  } catch (error) {
    console.error("Failed to fetch balances:", error.response.data);
    throw error.response.data;
  }
}

export async function getBinanceTrades(apiKey, apiSecret, symbol = 'BTCUSDT') {
  const timestamp = getTimestamp();
  const queryString = `symbol=${symbol}&timestamp=${timestamp}`;
  const signature = sign(queryString, apiSecret);
  const res = await apiClient.get(
    `${BASE_URL}/api/v3/myTrades?${queryString}&signature=${signature}`,
    {
      headers: { 'X-MBX-APIKEY': apiKey },
    }
  );
  return res.data;
}

export async function getBinanceOrderBook(symbol) {
  const res = await apiClient.get(`${BASE_URL}/api/v3/depth?symbol=${symbol}&limit=10`);
  return res.data;
}

export async function getBinanceMarketData(symbol) {
  const res = await apiClient.get(`${BASE_URL}/api/v3/ticker/24hr?symbol=${symbol}`);
  return res.data;
}

export async function getHistoricalData(symbol, interval = '1h', limit = 100) {
  const res = await apiClient.get(`${BASE_URL}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  return res.data;
}
