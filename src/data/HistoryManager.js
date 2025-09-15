import { localStorage } from './storage';

/**
 * HistoryManager - Stores and retrieves historical market data across all timeframes
 * Maintains a comprehensive database of price action for ML training and backtesting
 */
class HistoryManager {
  constructor() {
    this.timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
    this.maxDataPoints = {
      '1m': 10000,  // About 1 week of 1-minute data
      '5m': 10000,  // About 1 month of 5-minute data
      '15m': 10000, // About 3 months of 15-minute data
      '30m': 10000, // About 6 months of 30-minute data
      '1h': 8760,   // About 1 year of hourly data
      '4h': 8760,   // About 4 years of 4-hour data
      '1d': 3650    // About 10 years of daily data
    };
  }

  /**
   * Store historical data for a specific symbol and timeframe
   */
  async storeHistoricalData(symbol, timeframe, data) {
    if (!this.timeframes.includes(timeframe)) {
      throw new Error(`Invalid timeframe: ${timeframe}`);
    }
    
    const key = `history_${symbol}_${timeframe}`;
    let existingData = await this.getHistoricalData(symbol, timeframe);
    
    if (!existingData) {
      existingData = [];
    }
    
    // Merge new data with existing data
    const mergedData = this.mergeHistoricalData(existingData, data);
    
    // Trim to maximum size
    const trimmedData = mergedData.slice(-this.maxDataPoints[timeframe]);
    
    // Save to storage
    await localStorage.setItem(key, JSON.stringify(trimmedData));
    
    return trimmedData.length;
  }

  /**
   * Retrieve historical data for a specific symbol and timeframe
   */
  async getHistoricalData(symbol, timeframe) {
    if (!this.timeframes.includes(timeframe)) {
      throw new Error(`Invalid timeframe: ${timeframe}`);
    }
    
    const key = `history_${symbol}_${timeframe}`;
    const data = await localStorage.getItem(key);
    
    return data ? JSON.parse(data) : null;
  }

  /**
   * Merge historical data, ensuring no duplicates and proper sorting
   */
  mergeHistoricalData(existingData, newData) {
    // Create a map of timestamps to candle data
    const dataMap = new Map();
    
    // Add existing data to map
    existingData.forEach(candle => {
      const timestamp = candle[0]; // Timestamp is the first element
      dataMap.set(timestamp, candle);
    });
    
    // Add or update with new data
    newData.forEach(candle => {
      const timestamp = candle[0];
      dataMap.set(timestamp, candle);
    });
    
    // Convert back to array and sort by timestamp
    const mergedData = Array.from(dataMap.values());
    mergedData.sort((a, b) => a[0] - b[0]);
    
    return mergedData;
  }

  /**
   * Get data for all available timeframes for a symbol
   */
  async getAllTimeframeData(symbol) {
    const result = {};
    
    for (const timeframe of this.timeframes) {
      const data = await this.getHistoricalData(symbol, timeframe);
      if (data) {
        result[timeframe] = data;
      }
    }
    
    return result;
  }

  /**
   * Get the last timestamp for each timeframe to know what to update
   */
  async getLastTimestamps(symbol) {
    const result = {};
    
    for (const timeframe of this.timeframes) {
      const data = await this.getHistoricalData(symbol, timeframe);
      if (data && data.length > 0) {
        result[timeframe] = data[data.length - 1][0]; // Last candle's timestamp
      } else {
        result[timeframe] = 0; // No data
      }
    }
    
    return result;
  }

  /**
   * Store trade history for a specific symbol
   */
  async storeTrades(symbol, trades) {
    const key = `trades_${symbol}`;
    let existingTrades = await this.getTrades(symbol) || [];
    
    // Create map to avoid duplicates
    const tradesMap = new Map();
    existingTrades.forEach(trade => tradesMap.set(trade.id, trade));
    trades.forEach(trade => tradesMap.set(trade.id, trade));
    
    // Convert back to array and sort by timestamp
    const allTrades = Array.from(tradesMap.values());
    allTrades.sort((a, b) => a.time - b.time);
    
    // Keep only the last 1000 trades to manage storage
    const trimmedTrades = allTrades.slice(-1000);
    
    await localStorage.setItem(key, JSON.stringify(trimmedTrades));
    return trimmedTrades.length;
  }

  /**
   * Get trade history for a specific symbol
   */
  async getTrades(symbol) {
    const key = `trades_${symbol}`;
    const trades = await localStorage.getItem(key);
    return trades ? JSON.parse(trades) : null;
  }

  /**
   * Clear all historical data for a symbol
   */
  async clearHistoricalData(symbol) {
    for (const timeframe of this.timeframes) {
      const key = `history_${symbol}_${timeframe}`;
      await localStorage.removeItem(key);
    }
    
    const tradesKey = `trades_${symbol}`;
    await localStorage.removeItem(tradesKey);
  }
}

export default new HistoryManager();
