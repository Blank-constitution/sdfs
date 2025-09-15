import axios from 'axios';

const GEMINI_BASE_URL = 'https://api.gemini.com/v1';

// Gemini uses different pair names (e.g., btcusd)
const symbolToGeminiPair = (symbol) => {
  return symbol.toLowerCase();
};

export async function getGeminiMarketData(symbol) {
  const pair = symbolToGeminiPair(symbol);
  try {
    const res = await axios.get(`${GEMINI_BASE_URL}/pubticker/${pair}`);
    // Return a structure similar to Binance's for consistency
    return {
      price: res.data.last,
    };
  } catch (error) {
    console.error(`Failed to get Gemini data for ${symbol}:`, error);
    return null;
  }
}
