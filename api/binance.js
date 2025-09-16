const axios = require('axios');
const CryptoJS = require('crypto-js');

const BASE_URL = 'https://api.binance.com';

// Helper function to sign requests
function sign(queryString, secret) {
  return CryptoJS.HmacSHA256(queryString, secret).toString(CryptoJS.enc.Hex);
}

export default async function handler(req, res) {
  // SECURITY: Use standard environment variable names for server-side components
  const apiKey = process.env.BINANCE_API_KEY || process.env.REACT_APP_BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET || process.env.REACT_APP_BINANCE_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'API keys are not configured on the server.' });
  }

  // The 'endpoint' and 'params' will be sent from the frontend
  const { endpoint, params } = req.body;
  const timestamp = Date.now();
  
  const queryString = new URLSearchParams({ ...params, timestamp }).toString();
  const signature = sign(queryString, apiSecret);

  const url = `${BASE_URL}${endpoint}?${queryString}&signature=${signature}`;

  try {
    const response = await axios.get(url, {
      headers: { 'X-MBX-APIKEY': apiKey },
    });
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Binance API proxy error:', error.response?.data);
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'An unknown error occurred' });
  }
}
