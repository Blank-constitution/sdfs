import * as tf from '@tensorflow/tfjs';
import { runMlStrategy } from '../mlStrategy';
import { runStrategy } from '../strategyEngine';

/**
 * StrategyChef - A meta-learning system that:
 * 1. Creates multiple competing ML strategies
 * 2. Evaluates their performance
 * 3. Evolves the best strategies
 * 4. Creates new hybrid strategies from the best performers
 */
class StrategyChef {
  constructor() {
    this.strategies = [];
    this.strategyPerformance = {};
    this.currentBestStrategy = null;
    this.generationCount = 0;
    this.evolutionInProgress = false;
  }
  
  /**
   * Initialize the Strategy Chef with a set of base strategies
   */
  async initialize() {
    // Create initial strategy population
    this.strategies = [
      { 
        id: 'base_scalper',
        type: 'ml',
        params: {
          lookbackPeriod: 14,
          targetProfit: 0.2,
          stopLoss: 0.1,
          confidenceThreshold: 0.7
        },
        model: null,
        trainingStatus: 'pending'
      },
      { 
        id: 'swing_trader',
        type: 'ml',
        params: {
          lookbackPeriod: 30,
          targetProfit: 1.5,
          stopLoss: 0.8,
          confidenceThreshold: 0.6
        },
        model: null,
        trainingStatus: 'pending'
      },
      { 
        id: 'trend_follower',
        type: 'ml',
        params: {
          lookbackPeriod: 50,
          targetProfit: 3.0,
          stopLoss: 1.5,
          confidenceThreshold: 0.5
        },
        model: null,
        trainingStatus: 'pending'
      },
      {
        id: 'conservative_confluence',
        type: 'rule',
        params: {}
      },
      {
        id: 'ma_crossover',
        type: 'rule',
        params: {}
      }
    ];
    
    console.log(`StrategyChef: Initialized with ${this.strategies.length} strategies`);
    return this.strategies;
  }
  
  /**
   * Train all ML strategies with historical data
   */
  async trainStrategies(historicalData) {
    console.log('StrategyChef: Training strategies...');
    
    for (const strategy of this.strategies) {
      if (strategy.type === 'ml') {
        strategy.trainingStatus = 'training';
        
        try {
          // Create custom model with strategy-specific parameters
          const model = await this.createCustomModel(strategy, historicalData);
          strategy.model = model;
          strategy.trainingStatus = 'trained';
          console.log(`StrategyChef: Strategy ${strategy.id} trained successfully`);
        } catch (error) {
          console.error(`StrategyChef: Failed to train ${strategy.id}:`, error);
          strategy.trainingStatus = 'failed';
        }
      }
    }
    
    return this.strategies.filter(s => s.trainingStatus === 'trained').length;
  }
  
  /**
   * Create a custom ML model for a specific strategy
   */
  async createCustomModel(strategy, historicalData) {
    // Extract features based on strategy parameters
    const lookback = strategy.params.lookbackPeriod;
    
    // Prepare data for training
    const { features, labels } = this.prepareTrainingData(historicalData, lookback);
    
    // Create model architecture
    const model = tf.sequential();
    
    // Input layer size depends on features
    const inputShape = [lookback, features[0][0].length];
    
    // Add layers based on strategy type
    if (strategy.id.includes('scalper')) {
      // Smaller, faster model for scalping
      model.add(tf.layers.lstm({
        units: 32,
        returnSequences: false,
        inputShape
      }));
      model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
      model.add(tf.layers.dense({ units: 1 }));
    } else {
      // Deeper model for swing trading
      model.add(tf.layers.lstm({
        units: 64,
        returnSequences: true,
        inputShape
      }));
      model.add(tf.layers.dropout({ rate: 0.2 }));
      model.add(tf.layers.lstm({ units: 32 }));
      model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
      model.add(tf.layers.dense({ units: 1 }));
    }
    
    // Compile model
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });
    
    // Train model
    const xs = tf.tensor3d(features);
    const ys = tf.tensor2d(labels.map(l => [l]));
    
    await model.fit(xs, ys, {
      epochs: strategy.id.includes('scalper') ? 15 : 25, // Fewer epochs for scalping
      batchSize: 32,
      shuffle: true,
      validationSplit: 0.1
    });
    
    return model;
  }
  
  /**
   * Prepare training data for a model
   */
  prepareTrainingData(historicalData, lookback) {
    // This is a simplified version - the actual implementation would be more complex
    const features = [];
    const labels = [];
    
    // Extract price data
    const closes = historicalData.map(d => parseFloat(d[4]));
    
    // Calculate price changes (what we want to predict)
    const priceChanges = [];
    for (let i = 1; i < closes.length; i++) {
      priceChanges.push((closes[i] - closes[i-1]) / closes[i-1] * 100);
    }
    
    // Create sequences of lookback periods
    for (let i = lookback; i < historicalData.length - 1; i++) {
      const sequence = [];
      
      // For each point in the lookback window
      for (let j = i - lookback; j < i; j++) {
        // Add features for this point (OHLCV + derived)
        const featurePoint = [
          parseFloat(historicalData[j][1]), // Open
          parseFloat(historicalData[j][2]), // High
          parseFloat(historicalData[j][3]), // Low
          parseFloat(historicalData[j][4]), // Close
          parseFloat(historicalData[j][5])  // Volume
        ];
        
        sequence.push(featurePoint);
      }
      
      features.push(sequence);
      labels.push(priceChanges[i]);
    }
    
    return { features, labels };
  }
  
  /**
   * Evaluate all strategies on a test dataset
   */
  async evaluateStrategies(testData) {
    console.log('StrategyChef: Evaluating strategies...');
    
    const results = {};
    const marketData = { price: testData[testData.length - 1][4] };
    
    // Evaluate each strategy
    for (const strategy of this.strategies) {
      let signal;
      
      if (strategy.type === 'ml' && strategy.trainingStatus === 'trained') {
        // Use the custom ML strategy for this specific model
        signal = await this.runCustomMlStrategy(strategy, marketData, testData);
      } else if (strategy.type === 'rule') {
        // Use the rule-based strategy from strategyEngine
        signal = await runStrategy(strategy.id.replace('_', ''), marketData, testData);
      } else {
        continue; // Skip untrained ML models
      }
      
      // Store results
      results[strategy.id] = {
        signal: signal.signal,
        confidence: signal.confidence || 0.5,
        reason: signal.reason,
        tradeType: signal.tradeType || 'standard'
      };
    }
    
    // Update strategy performance tracking
    this.updatePerformance(results);
    
    return results;
  }
  
  /**
   * Run a custom ML strategy using a specific model
   */
  async runCustomMlStrategy(strategy, marketData, historicalData) {
    // If the strategy has special parameters, use them
    if (strategy.id.includes('scalper')) {
      // Override some parameters for scalping strategies
      return await runMlStrategy(marketData, historicalData, {
        confidenceThreshold: strategy.params.confidenceThreshold,
        targetProfit: strategy.params.targetProfit,
        stopLoss: strategy.params.stopLoss
      });
    } else {
      // Use default parameters
      return await runMlStrategy(marketData, historicalData);
    }
  }
  
  /**
   * Update performance metrics for all strategies
   */
  updatePerformance(results) {
    for (const [strategyId, result] of Object.entries(results)) {
      if (!this.strategyPerformance[strategyId]) {
        this.strategyPerformance[strategyId] = {
          totalSignals: 0,
          correctSignals: 0,
          profitLoss: 0,
          winRate: 0,
          averageProfit: 0,
          score: 0
        };
      }
      
      // In a real system, you would compare with actual market outcomes
      // For now, we'll just accumulate signals
      this.strategyPerformance[strategyId].totalSignals++;
      
      // The rest would be updated after we know if the trade was successful
    }
  }
  
  /**
   * Record the outcome of a trade for performance tracking
   */
  recordTradeOutcome(strategyId, entryPrice, exitPrice, side) {
    if (!this.strategyPerformance[strategyId]) return;
    
    const perf = this.strategyPerformance[strategyId];
    
    // Calculate profit/loss
    let profitLoss = 0;
    if (side === 'BUY') {
      profitLoss = (exitPrice - entryPrice) / entryPrice * 100;
    } else if (side === 'SELL') {
      profitLoss = (entryPrice - exitPrice) / entryPrice * 100;
    }
    
    // Update performance metrics
    perf.profitLoss += profitLoss;
    
    const isWin = profitLoss > 0;
    if (isWin) {
      perf.correctSignals++;
    }
    
    perf.winRate = (perf.correctSignals / perf.totalSignals) * 100;
    perf.averageProfit = perf.profitLoss / perf.totalSignals;
    
    // Calculate overall score - a weighted combination of metrics
    perf.score = (perf.winRate * 0.4) + (perf.averageProfit * 0.6);
    
    // Update the best strategy
    this.updateBestStrategy();
  }
  
  /**
   * Update the current best strategy based on performance
   */
  updateBestStrategy() {
    let bestScore = -Infinity;
    let bestStrategyId = null;
    
    for (const [strategyId, perf] of Object.entries(this.strategyPerformance)) {
      // Only consider strategies with enough trades
      if (perf.totalSignals >= 10 && perf.score > bestScore) {
        bestScore = perf.score;
        bestStrategyId = strategyId;
      }
    }
    
    if (bestStrategyId && bestStrategyId !== this.currentBestStrategy) {
      console.log(`StrategyChef: New best strategy: ${bestStrategyId} with score ${bestScore.toFixed(2)}`);
      this.currentBestStrategy = bestStrategyId;
    }
  }
  
  /**
   * Evolve strategies by creating new ones from the best performers
   */
  async evolveStrategies() {
    if (this.evolutionInProgress) return;
    this.evolutionInProgress = true;
    
    console.log('StrategyChef: Evolving strategies...');
    this.generationCount++;
    
    try {
      // 1. Rank strategies by performance
      const rankedStrategies = Object.entries(this.strategyPerformance)
        .sort((a, b) => b[1].score - a[1].score)
        .map(([id]) => this.strategies.find(s => s.id === id))
        .filter(s => s); // Remove undefined
      
      // Only evolve if we have enough data
      if (rankedStrategies.length < 2) {
        console.log('StrategyChef: Not enough ranked strategies to evolve');
        this.evolutionInProgress = false;
        return;
      }
      
      // 2. Keep the top performers
      const topPerformers = rankedStrategies.slice(0, Math.ceil(rankedStrategies.length / 2));
      
      // 3. Create new hybrid strategies
      const newStrategies = [];
      
      for (let i = 0; i < Math.min(2, topPerformers.length); i++) {
        const parent1 = topPerformers[i];
        const parent2 = topPerformers[(i + 1) % topPerformers.length];
        
        if (parent1.type === 'ml' && parent2.type === 'ml') {
          // Create a hybrid ML strategy
          const hybridStrategy = {
            id: `hybrid_gen${this.generationCount}_${i}`,
            type: 'ml',
            params: this.crossoverParams(parent1.params, parent2.params),
            model: null,
            trainingStatus: 'pending'
          };
          
          newStrategies.push(hybridStrategy);
        }
      }
      
      // 4. Add mutation of the best strategy
      if (topPerformers.length > 0 && topPerformers[0].type === 'ml') {
        const bestStrategy = topPerformers[0];
        const mutatedStrategy = {
          id: `mutated_${bestStrategy.id}_gen${this.generationCount}`,
          type: 'ml',
          params: this.mutateParams(bestStrategy.params),
          model: null,
          trainingStatus: 'pending'
        };
        
        newStrategies.push(mutatedStrategy);
      }
      
      // 5. Update the strategy population
      this.strategies = [
        ...topPerformers,
        ...newStrategies
      ];
      
      console.log(`StrategyChef: Evolution complete. New generation ${this.generationCount} with ${this.strategies.length} strategies`);
    } catch (error) {
      console.error('StrategyChef: Error during evolution:', error);
    } finally {
      this.evolutionInProgress = false;
    }
  }
  
  /**
   * Combine parameters from two parent strategies
   */
  crossoverParams(params1, params2) {
    const newParams = {};
    
    // For each parameter, randomly choose from either parent
    for (const key of new Set([...Object.keys(params1), ...Object.keys(params2)])) {
      if (Math.random() < 0.5 && params1[key] !== undefined) {
        newParams[key] = params1[key];
      } else if (params2[key] !== undefined) {
        newParams[key] = params2[key];
      } else {
        newParams[key] = params1[key];
      }
    }
    
    return newParams;
  }
  
  /**
   * Randomly mutate parameters of a strategy
   */
  mutateParams(params) {
    const newParams = { ...params };
    
    // Choose a random parameter to mutate
    const keys = Object.keys(newParams);
    if (keys.length === 0) return newParams;
    
    const keyToMutate = keys[Math.floor(Math.random() * keys.length)];
    const originalValue = newParams[keyToMutate];
    
    // Mutate it by +/- 10-50%
    if (typeof originalValue === 'number') {
      const mutationFactor = 0.9 + (Math.random() * 0.6); // 0.9 to 1.5
      newParams[keyToMutate] = originalValue * mutationFactor;
    }
    
    return newParams;
  }
  
  /**
   * Get the current best strategy
   */
  getBestStrategy() {
    if (!this.currentBestStrategy) {
      return this.strategies[0]; // Default to first strategy if none is best yet
    }
    
    return this.strategies.find(s => s.id === this.currentBestStrategy);
  }
  
  /**
   * Get performance report for all strategies
   */
  getPerformanceReport() {
    return {
      strategies: this.strategyPerformance,
      bestStrategy: this.currentBestStrategy,
      generation: this.generationCount
    };
  }
}

export default StrategyChef;
