/**
 * RiskManager - Manages risk based on account size, market volatility,
 * and trade history. Adapts position sizing as your account grows.
 */
class RiskManager {
  constructor() {
    // Risk tiers based on account size
    this.riskTiers = [
      { maxAccountSize: 100, maxRiskPercent: 1, maxPositions: 2 },     // $0-$100
      { maxAccountSize: 500, maxRiskPercent: 1.5, maxPositions: 3 },   // $100-$500
      { maxAccountSize: 1000, maxRiskPercent: 2, maxPositions: 4 },    // $500-$1000
      { maxAccountSize: 5000, maxRiskPercent: 2.5, maxPositions: 5 },  // $1000-$5000
      { maxAccountSize: 10000, maxRiskPercent: 3, maxPositions: 6 },   // $5000-$10000
      { maxAccountSize: Infinity, maxRiskPercent: 2, maxPositions: 8 } // $10000+
    ];
    
    // Market impact thresholds (trade size as % of 24h volume)
    this.marketImpactThresholds = {
      high: 1.0,    // >1% of 24h volume is high impact
      medium: 0.1,  // >0.1% of 24h volume is medium impact
      low: 0.01     // >0.01% of 24h volume is low impact
    };
  }

  /**
   * Calculate optimal position size based on account size and market conditions
   */
  calculatePositionSize(accountSize, symbol, marketData, tradeType = 'swing') {
    // 1. Find the appropriate risk tier
    const riskTier = this.riskTiers.find(tier => accountSize <= tier.maxAccountSize);
    
    // Base risk percentage from tier
    let riskPercent = riskTier.maxRiskPercent;
    
    // 2. Adjust for market conditions
    const volatilityFactor = this.calculateVolatilityFactor(marketData);
    riskPercent = riskPercent * volatilityFactor;
    
    // 3. Adjust for trade type
    if (tradeType === 'scalp') {
      // Scalping trades should use smaller position sizes
      riskPercent = riskPercent * 0.7;
    } else if (tradeType === 'swing') {
      // No adjustment for swing trades
    } else if (tradeType === 'position') {
      // Position trades can use larger sizes due to wider stop losses
      riskPercent = riskPercent * 1.2;
    }
    
    // 4. Calculate dollar amount to risk
    const riskAmount = accountSize * (riskPercent / 100);
    
    // 5. Adjust for market impact (limit position size based on volume)
    const adjustedRiskAmount = this.adjustForMarketImpact(riskAmount, marketData);
    
    return {
      riskPercent,
      riskAmount: adjustedRiskAmount,
      positionSize: adjustedRiskAmount, // This will be converted to actual asset quantity in the trading logic
      maxPositions: riskTier.maxPositions
    };
  }

  /**
   * Calculate a factor representing market volatility (0.5-1.5)
   * Lower volatility allows higher position sizes
   */
  calculateVolatilityFactor(marketData) {
    if (!marketData || !marketData.priceChangePercent) {
      return 1.0; // Default if no data
    }
    
    // Get 24h price change as a measure of volatility
    const volatility = Math.abs(parseFloat(marketData.priceChangePercent));
    
    if (volatility > 10) {
      // Extremely volatile - reduce risk
      return 0.5;
    } else if (volatility > 5) {
      // Highly volatile - somewhat reduce risk
      return 0.75;
    } else if (volatility < 1) {
      // Very stable - can increase risk slightly
      return 1.2;
    } else {
      // Normal volatility
      return 1.0;
    }
  }

  /**
   * Adjust position size based on market impact
   */
  adjustForMarketImpact(riskAmount, marketData) {
    if (!marketData || !marketData.quoteVolume) {
      return riskAmount; // No adjustment if volume data missing
    }
    
    const volumeUSD = parseFloat(marketData.quoteVolume);
    const marketImpactPercent = (riskAmount / volumeUSD) * 100;
    
    if (marketImpactPercent > this.marketImpactThresholds.high) {
      // High impact - drastically reduce position size
      return riskAmount * 0.2;
    } else if (marketImpactPercent > this.marketImpactThresholds.medium) {
      // Medium impact - moderately reduce position size
      return riskAmount * 0.5;
    } else if (marketImpactPercent > this.marketImpactThresholds.low) {
      // Low impact - slightly reduce position size
      return riskAmount * 0.8;
    } else {
      // Negligible impact - no adjustment needed
      return riskAmount;
    }
  }

  /**
   * Calculate appropriate stop loss distance based on volatility
   */
  calculateStopLossPercentage(marketData, tradeType = 'swing') {
    if (!marketData) return 2.0; // Default stop loss
    
    // Calculate ATR (Average True Range) as a measure of volatility
    const atr = this.calculateATR(marketData);
    const price = parseFloat(marketData.price);
    const atrPercent = (atr / price) * 100;
    
    // Base stop loss is 1.5x the ATR
    let stopLossPercent = atrPercent * 1.5;
    
    // Adjust based on trade type
    if (tradeType === 'scalp') {
      // Tight stops for scalping
      stopLossPercent = Math.min(0.2, atrPercent * 0.5);
    } else if (tradeType === 'position') {
      // Wider stops for position trades
      stopLossPercent = atrPercent * 2.5;
    }
    
    // Ensure stop loss is reasonable
    return Math.max(0.1, Math.min(10, stopLossPercent));
  }

  /**
   * Simple ATR calculation
   */
  calculateATR(marketData) {
    if (!marketData || !marketData.historicalData || marketData.historicalData.length < 14) {
      return 0;
    }
    
    const trueRanges = [];
    const data = marketData.historicalData.slice(-14);
    
    for (let i = 1; i < data.length; i++) {
      const high = parseFloat(data[i][2]);
      const low = parseFloat(data[i][3]);
      const prevClose = parseFloat(data[i-1][4]);
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    // Average of true ranges
    return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  }

  /**
   * Calculate take profit target based on stop loss (risk:reward ratio)
   */
  calculateTakeProfitPercentage(stopLossPercent, tradeType = 'swing') {
    // Risk:reward ratios for different trade types
    const riskRewardRatios = {
      scalp: 2,    // 1:2 ratio for scalping (tight targets)
      swing: 2.5,  // 1:2.5 ratio for swing trades
      position: 3  // 1:3 ratio for position trades (larger targets)
    };
    
    const ratio = riskRewardRatios[tradeType] || 2;
    return stopLossPercent * ratio;
  }

  /**
   * Calculate maximum drawdown based on account size
   */
  calculateMaxDrawdown(accountSize) {
    // Smaller accounts should limit maximum drawdown
    if (accountSize < 100) {
      return 15; // 15% max drawdown
    } else if (accountSize < 1000) {
      return 20; // 20% max drawdown
    } else if (accountSize < 10000) {
      return 25; // 25% max drawdown
    } else {
      return 30; // 30% max drawdown
    }
  }
}

export default new RiskManager();
