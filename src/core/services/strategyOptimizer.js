import { emit, EVENTS } from '../eventBus';
import { getStrategy, registerStrategy } from '../strategyRegistry';
import { getHistoricalPerformance } from '../../utils/performanceAnalytics';

// Track strategy performance metrics
const strategyPerformance = new Map();
// Store optimized variants of strategies
const optimizedStrategies = new Map();
// Track learning iterations
let optimizationIteration = 0;

/**
 * ML-based strategy optimizer that continuously improves strategies
 * based on their historical performance and current market conditions
 */
export async function optimizeStrategy(strategyKey, historicalData, aiApiKey = null) {
  try {
    // Get current strategy implementation
    const currentStrategy = getStrategy(strategyKey);
    if (!currentStrategy) {
      throw new Error(`Strategy ${strategyKey} not found`);
    }

    // Get historical performance for this strategy
    const performance = await getHistoricalPerformance(strategyKey);
    strategyPerformance.set(strategyKey, performance);

    // Skip optimization if we don't have enough data yet
    if (!performance || performance.trades < 10) {
      return null;
    }

    // Apply reinforcement learning to improve strategy parameters
    const optimizedStrategy = await applyReinforcementLearning(
      strategyKey,
      currentStrategy,
      performance,
      historicalData,
      aiApiKey
    );

    if (optimizedStrategy) {
      // Register the optimized strategy with a version suffix
      const optimizedKey = `${strategyKey}_optimized_v${optimizationIteration}`;
      registerStrategy(optimizedKey, optimizedStrategy);
      
      // Store the optimized strategy
      optimizedStrategies.set(optimizedKey, {
        baseStrategy: strategyKey,
        iteration: optimizationIteration,
        timestamp: Date.now(),
        expectedImprovement: optimizedStrategy.meta?.expectedImprovement || 0
      });
      
      // Emit event about new optimized strategy
      emit(EVENTS.STRATEGY_OPTIMIZED, {
        original: strategyKey,
        optimized: optimizedKey,
        improvement: optimizedStrategy.meta?.expectedImprovement || 0
      });
      
      optimizationIteration++;
      return optimizedKey;
    }
    
    return null;
  } catch (error) {
    console.error('Strategy optimization error:', error);
    emit(EVENTS.OPTIMIZATION_ERROR, { error: error.message, strategy: strategyKey });
    return null;
  }
}

/**
 * Apply reinforcement learning techniques to improve a strategy
 */
async function applyReinforcementLearning(strategyKey, strategy, performance, historicalData, aiApiKey) {
  // Simple strategy parameter optimization using hill climbing
  // This would be replaced with proper ML in production
  
  // 1. Clone the strategy
  const optimizedFn = async (ctx) => {
    // Execute the original strategy
    const result = await strategy(ctx);
    
    // Apply learned adjustments
    const tweaks = getOptimizationTweaks(strategyKey, ctx);
    
    // Adjust confidence based on ML insights
    const adjustedConfidence = result.confidence * tweaks.confidenceMultiplier;
    
    // Potentially change the signal based on meta-learning
    let signal = result.signal;
    if (tweaks.signalAdjustment && tweaks.signalAdjustmentConfidence > 0.8) {
      signal = tweaks.signalAdjustment;
    }
    
    return {
      ...result,
      signal,
      confidence: Math.min(1, Math.max(0, adjustedConfidence)),
      meta: {
        optimized: true,
        baseSignal: result.signal,
        optimizationIteration,
        tweaks
      }
    };
  };
  
  // Add metadata to the function
  optimizedFn.meta = {
    baseStrategy: strategyKey,
    optimizationIteration,
    expectedImprovement: calculateExpectedImprovement(performance),
    optimizedAt: new Date().toISOString()
  };
  
  return optimizedFn;
}

/**
 * Get optimization tweaks based on learned patterns
 */
function getOptimizationTweaks(strategyKey, ctx) {
  const performance = strategyPerformance.get(strategyKey) || { winRate: 0.5 };
  
  // Adjust confidence multiplier based on performance
  let confidenceMultiplier = 1.0;
  
  // Current market volatility from context
  const volatility = calculateVolatility(ctx.historicalData);
  
  // Adjust confidence based on volatility
  if (volatility > 0.03) { // High volatility
    confidenceMultiplier *= 0.8; // Reduce confidence in volatile markets
  } else if (volatility < 0.01) { // Low volatility
    confidenceMultiplier *= 1.2; // Increase confidence in stable markets
  }
  
  // Adjust based on win rate
  if (performance.winRate > 0.6) {
    confidenceMultiplier *= 1.1; // Boost confidence for well-performing strategies
  } else if (performance.winRate < 0.4) {
    confidenceMultiplier *= 0.9; // Reduce confidence for poorly performing strategies
  }
  
  return {
    confidenceMultiplier,
    signalAdjustment: null, // No signal override by default
    signalAdjustmentConfidence: 0
  };
}

/**
 * Calculate expected improvement from optimization
 */
function calculateExpectedImprovement(performance) {
  // Very simplified estimation
  // In a real system, this would use cross-validation and more rigorous methods
  const baseline = performance.profitFactor || 1.0;
  
  // Estimated improvement - typically 2-5% per iteration
  // This would be based on backtesting in a real system
  return Math.min(0.05, Math.max(0.02, (1 - baseline) * 0.1));
}

/**
 * Calculate price volatility from historical data
 */
function calculateVolatility(historicalData, periods = 14) {
  if (!historicalData || historicalData.length < periods) {
    return 0.02; // Default value
  }
  
  // Get closing prices
  const closes = historicalData.slice(0, periods).map(candle => 
    parseFloat(candle[4]) // Close price is at index 4
  );
  
  // Calculate returns
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i-1]) / closes[i-1]);
  }
  
  // Calculate standard deviation of returns
  const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
  const squaredDiffs = returns.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
  
  return Math.sqrt(variance);
}

/**
 * Get all available optimized strategies
 */
export function getOptimizedStrategies() {
  return Array.from(optimizedStrategies.entries()).map(([key, data]) => ({
    key,
    ...data
  }));
}
