import RiskManager from '../risk/RiskManager';

/**
 * PortfolioManager - Manages the entire portfolio across multiple assets
 * Handles position allocation, tracks performance, and balances risk
 */
class PortfolioManager {
  constructor() {
    this.portfolio = {
      totalValue: 0,
      quoteBalance: 0,
      positions: {}, // symbol -> position details
      performance: {
        startingValue: 0,
        totalPnl: 0,
        totalTrades: 0,
        winningTrades: 0,
        maxDrawdown: 0
      },
      riskAllocation: {},
      history: []
    };
  }

  /**
   * Initialize the portfolio with starting balances
   */
  initialize(quoteBalance) {
    this.portfolio.quoteBalance = quoteBalance;
    this.portfolio.totalValue = quoteBalance;
    this.portfolio.performance.startingValue = quoteBalance;
    
    // Record the starting point in history
    this.recordHistory('initialize', {
      quoteBalance,
      totalValue: quoteBalance
    });
    
    return this.portfolio;
  }

  /**
   * Update portfolio with latest balances from exchange
   */
  updatePortfolio(balances, marketData) {
    // Update quote balance
    const quoteAsset = 'USDT'; // Assuming USDT is the quote asset
    const quoteBalance = balances.find(b => b.asset === quoteAsset)?.free || 0;
    this.portfolio.quoteBalance = parseFloat(quoteBalance);
    
    // Update position values
    let totalValue = this.portfolio.quoteBalance;
    
    for (const symbol in this.portfolio.positions) {
      const position = this.portfolio.positions[symbol];
      const asset = symbol.replace('USDT', '');
      const assetBalance = balances.find(b => b.asset === asset)?.free || 0;
      
      if (parseFloat(assetBalance) > 0) {
        const currentPrice = marketData[symbol]?.price || position.lastPrice;
        const currentValue = parseFloat(assetBalance) * parseFloat(currentPrice);
        
        // Update position
        this.portfolio.positions[symbol] = {
          ...position,
          quantity: parseFloat(assetBalance),
          currentPrice: parseFloat(currentPrice),
          currentValue,
          pnl: ((currentPrice / position.entryPrice) - 1) * 100,
          lastUpdated: Date.now()
        };
        
        totalValue += currentValue;
      } else if (position.quantity > 0) {
        // Position was closed
        this.portfolio.positions[symbol] = {
          ...position,
          quantity: 0,
          currentValue: 0,
          lastUpdated: Date.now()
        };
      }
    }
    
    // Update total portfolio value
    this.portfolio.totalValue = totalValue;
    
    // Calculate performance metrics
    this.updatePerformanceMetrics();
    
    // Record portfolio update in history
    this.recordHistory('update', {
      quoteBalance: this.portfolio.quoteBalance,
      totalValue: this.portfolio.totalValue,
      positions: { ...this.portfolio.positions }
    });
    
    return this.portfolio;
  }

  /**
   * Open a new position
   */
  openPosition(symbol, quantity, price, type = 'swing') {
    const value = quantity * price;
    const entryTime = Date.now();
    
    // Create or update position
    this.portfolio.positions[symbol] = {
      symbol,
      quantity,
      entryPrice: price,
      entryValue: value,
      currentPrice: price,
      currentValue: value,
      entryTime,
      type,
      pnl: 0,
      lastUpdated: entryTime
    };
    
    // Update quote balance
    this.portfolio.quoteBalance -= value;
    
    // Record trade in history
    this.recordHistory('open', {
      symbol,
      quantity,
      price,
      value,
      type
    });
    
    return this.portfolio.positions[symbol];
  }

  /**
   * Close a position
   */
  closePosition(symbol, price, reason = '') {
    if (!this.portfolio.positions[symbol]) {
      return null;
    }
    
    const position = this.portfolio.positions[symbol];
    const exitValue = position.quantity * price;
    const pnl = exitValue - position.entryValue;
    const pnlPercent = (pnl / position.entryValue) * 100;
    
    // Update performance statistics
    this.portfolio.performance.totalTrades++;
    if (pnl > 0) {
      this.portfolio.performance.winningTrades++;
    }
    this.portfolio.performance.totalPnl += pnl;
    
    // Update quote balance
    this.portfolio.quoteBalance += exitValue;
    
    // Record trade in history
    this.recordHistory('close', {
      symbol,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      exitPrice: price,
      pnl,
      pnlPercent,
      reason
    });
    
    // Clear position
    this.portfolio.positions[symbol] = {
      ...position,
      quantity: 0,
      currentValue: 0,
      exitPrice: price,
      exitTime: Date.now(),
      pnl: pnlPercent,
      lastUpdated: Date.now()
    };
    
    return {
      symbol,
      pnl,
      pnlPercent
    };
  }

  /**
   * Calculate position size based on risk management rules
   */
  calculatePositionSize(symbol, price, marketData, accountSize = null) {
    // If accountSize not provided, use current portfolio value
    const portfolioValue = accountSize || this.portfolio.totalValue;
    
    // Get active positions count to adjust allocation
    const activePositions = Object.values(this.portfolio.positions)
      .filter(p => p.quantity > 0).length;
    
    // Calculate position size based on risk management
    const risk = RiskManager.calculatePositionSize(
      portfolioValue,
      symbol,
      marketData,
      'swing' // Default to swing trade type
    );
    
    // Check if we've reached maximum number of positions
    if (activePositions >= risk.maxPositions) {
      return {
        positionSize: 0,
        riskAmount: 0,
        reason: `Maximum number of positions (${risk.maxPositions}) reached`
      };
    }
    
    // Calculate coin quantity based on risk amount
    const coinQuantity = risk.riskAmount / price;
    
    return {
      positionSize: coinQuantity,
      quoteAmount: risk.riskAmount,
      riskPercent: risk.riskPercent,
      maxPositions: risk.maxPositions,
      currentPositions: activePositions
    };
  }

  /**
   * Update portfolio performance metrics
   */
  updatePerformanceMetrics() {
    // Calculate current P&L compared to starting value
    const totalPnl = this.portfolio.totalValue - this.portfolio.performance.startingValue;
    const totalPnlPercent = (totalPnl / this.portfolio.performance.startingValue) * 100;
    
    // Calculate win rate
    const winRate = this.portfolio.performance.totalTrades > 0
      ? (this.portfolio.performance.winningTrades / this.portfolio.performance.totalTrades) * 100
      : 0;
    
    // Update performance metrics
    this.portfolio.performance = {
      ...this.portfolio.performance,
      totalPnl,
      totalPnlPercent,
      winRate,
      currentValue: this.portfolio.totalValue
    };
    
    return this.portfolio.performance;
  }

  /**
   * Record entry in portfolio history
   */
  recordHistory(action, data) {
    this.portfolio.history.push({
      timestamp: Date.now(),
      action,
      data
    });
    
    // Keep history at a reasonable size
    if (this.portfolio.history.length > 1000) {
      this.portfolio.history = this.portfolio.history.slice(-1000);
    }
  }

  /**
   * Get portfolio summary
   */
  getPortfolioSummary() {
    return {
      totalValue: this.portfolio.totalValue,
      quoteBalance: this.portfolio.quoteBalance,
      activePositions: Object.values(this.portfolio.positions)
        .filter(p => p.quantity > 0).length,
      pnl: this.portfolio.performance.totalPnl,
      pnlPercent: this.portfolio.performance.totalPnlPercent,
      winRate: this.portfolio.performance.winRate
    };
  }

  /**
   * Save portfolio state to storage
   */
  async savePortfolio() {
    try {
      localStorage.setItem('portfolio', JSON.stringify(this.portfolio));
      return true;
    } catch (error) {
      console.error('Failed to save portfolio:', error);
      return false;
    }
  }

  /**
   * Load portfolio state from storage
   */
  async loadPortfolio() {
    try {
      const saved = localStorage.getItem('portfolio');
      if (saved) {
        this.portfolio = JSON.parse(saved);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load portfolio:', error);
      return false;
    }
  }
}

export default new PortfolioManager();
