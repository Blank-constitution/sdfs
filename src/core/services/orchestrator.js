import { emit, EVENTS } from '../../core/eventBus';
import { getBinanceMarketData, getHistoricalData, placeOrder } from '../../binanceApi';
import { fetchRealMarketData, fetchHistoricalData } from '../../marketDataService';
import { evaluateRisk } from '../riskManager';
import { getStrategy } from '../strategyRegistry';
import { analyzeMarketWithAI } from '../aiMarketAnalysis';
import { optimizeStrategy, getOptimizedStrategies } from './strategyOptimizer';

const orchestratorState = {
  running: false,
  liveTrading: false,
  symbol: 'BTCUSDT',
  strategy: 'conservativeConfluence',
  lastSignal: null,
  lastLoopTs: 0,
  loopMs: 20000,
  binanceApiKey: '',
  binanceApiSecret: '',
  geminiAiApiKey: '',
  dataSource: 'binance', // 'binance', 'kraken', 'real-market', 'historical'
  useTestnet: true,      // Use testnet for order execution
  useAIAnalysis: true,
  useStrategyOptimization: true,
  optimizationInterval: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  lastOptimizationTime: 0,
  preferOptimizedStrategies: true,
  aiAnalysisCache: new Map(),
  // Other fields...
};

let loopTimer = null;

export function configureOrchestrator(patch) {
  Object.assign(orchestratorState, patch);
}

export function getOrchestratorState() {
  return { ...orchestratorState };
}

async function loop() {
  orchestratorState.lastLoopTs = Date.now();
  try {
    // Get market data from selected source
    let marketData, historicalData;
    
    switch (orchestratorState.dataSource) {
      case 'real-market':
        // Use commercial data providers for more accurate price data
        marketData = await fetchRealMarketData(
          orchestratorState.symbol, 
          '1m', 
          'twelve-data'  // Default provider
        );
        historicalData = await fetchHistoricalData(
          orchestratorState.symbol, 
          '1h', 
          120, 
          'twelve-data'
        );
        break;
        
      case 'historical':
        // Use locally stored CSV data
        marketData = await fetchRealMarketData(
          orchestratorState.symbol, 
          '1m', 
          'historical-csv'
        );
        historicalData = await fetchHistoricalData(
          orchestratorState.symbol, 
          '1h', 
          120, 
          'historical-csv'
        );
        break;
        
      case 'binance':
      default:
        // Use Binance API (default)
        marketData = await getBinanceMarketData(orchestratorState.symbol);
        historicalData = await getHistoricalData(orchestratorState.symbol, '1h', 120);
        break;
    }
    
    emit(EVENTS.MARKET_SNAPSHOT, { marketData });

    // Get AI-powered market analysis if enabled
    let aiAnalysis = null;
    if (orchestratorState.useAIAnalysis && orchestratorState.geminiAiApiKey) {
      const cachedAnalysis = orchestratorState.aiAnalysisCache.get(orchestratorState.symbol);
      
      // Only get fresh analysis every 6 hours
      if (!cachedAnalysis || (Date.now() - cachedAnalysis.timestamp > 6 * 60 * 60 * 1000)) {
        aiAnalysis = await analyzeMarketWithAI(
          orchestratorState.symbol,
          marketData,
          historicalData,
          orchestratorState.geminiAiApiKey
        );
        
        if (aiAnalysis.success) {
          orchestratorState.aiAnalysisCache.set(orchestratorState.symbol, aiAnalysis);
          emit(EVENTS.AI_ANALYSIS_UPDATED, { symbol: orchestratorState.symbol, analysis: aiAnalysis });
        }
      } else {
        aiAnalysis = cachedAnalysis;
      }
    }

    // Check if it's time to optimize strategies
    if (
      orchestratorState.useStrategyOptimization && 
      Date.now() - orchestratorState.lastOptimizationTime > orchestratorState.optimizationInterval
    ) {
      // Optimize the current strategy
      const optimizedKey = await optimizeStrategy(
        orchestratorState.strategy,
        historicalData,
        orchestratorState.geminiAiApiKey
      );
      
      // Use the optimized strategy if available and enabled
      if (optimizedKey && orchestratorState.preferOptimizedStrategies) {
        orchestratorState.strategy = optimizedKey;
        emit(EVENTS.STRATEGY_CHANGED, { strategy: optimizedKey, reason: 'optimization' });
      }
      
      orchestratorState.lastOptimizationTime = Date.now();
    }

    // Get optimized strategy if enabled, or fall back to selected strategy
    let strategyToUse = orchestratorState.strategy;
    if (orchestratorState.preferOptimizedStrategies) {
      const optimizedStrategies = getOptimizedStrategies();
      const matchingOptimized = optimizedStrategies.find(s => 
        s.baseStrategy === orchestratorState.strategy
      );
      
      if (matchingOptimized) {
        strategyToUse = matchingOptimized.key;
      }
    }

    // Use the strategy registry to get the selected strategy function
    const stratFn = getStrategy(strategyToUse);
    const signalObj = await stratFn({
      marketData,
      historicalData,
      geminiAiApiKey: orchestratorState.geminiAiApiKey,
      aiAnalysis, // Pass AI analysis to the strategy
      // Add useful context for strategies
      context: {
        orchestrator: { ...orchestratorState },
        lastSignal: orchestratorState.lastSignal
      }
    });

    emit(EVENTS.STRATEGY_SIGNAL, signalObj);
    orchestratorState.lastSignal = signalObj;

    // Execute order if live trading enabled
    if (orchestratorState.liveTrading &&
        signalObj.signal &&
        signalObj.signal !== 'HOLD') {

      // Simple fixed USD sizing (improve with balances)
      const price = parseFloat(marketData.lastPrice || marketData.price || 0);
      const usdToAllocate = 100; // placeholder
      const qty = price > 0 ? (usdToAllocate / price).toFixed(5) : 0;

      const risk = evaluateRisk({ estPositionValueUSD: usdToAllocate, signal: signalObj.signal });
      if (!risk.allow) {
        emit(EVENTS.ORDER_ERROR, { reason: risk.reason, signal: signalObj.signal });
      } else {
        try {
          // Use testnet if enabled
          const order = await placeOrder(
            orchestratorState.binanceApiKey,
            orchestratorState.binanceApiSecret,
            orchestratorState.symbol,
            signalObj.signal,
            qty,
            orchestratorState.useTestnet // Pass testnet flag to the API call
          );
          emit(EVENTS.ORDER_EXECUTED, { order, qty, side: signalObj.signal });
        } catch (e) {
          emit(EVENTS.ORDER_ERROR, { error: e });
        }
      }
    }

    // Broadcast current system status
    emit(EVENTS.SYSTEM_STATUS, { 
      heartbeatTs: Date.now(), 
      live: orchestratorState.liveTrading,
      dataSource: orchestratorState.dataSource,
      strategy: strategyToUse,
      useAIAnalysis: orchestratorState.useAIAnalysis,
      useStrategyOptimization: orchestratorState.useStrategyOptimization,
      lastOptimization: orchestratorState.lastOptimizationTime
    });

  } catch (err) {
    emit(EVENTS.ORDER_ERROR, { error: err });
  } finally {
    emit(EVENTS.HEARTBEAT, { ts: Date.now() });
    if (orchestratorState.running) {
      loopTimer = setTimeout(loop, orchestratorState.loopMs);
    }
  }
}

export function startOrchestrator() {
  if (orchestratorState.running) return;
  orchestratorState.running = true;
  loop();
}

export function stopOrchestrator() {
  orchestratorState.running = false;
  if (loopTimer) clearTimeout(loopTimer);
}

export function toggleLive(on) {
  orchestratorState.liveTrading = on;
  emit(EVENTS.SYSTEM_STATUS, { liveTrading: on });
}

// Add new methods to control AI and ML features
export function setAIAnalysisEnabled(enabled) {
  orchestratorState.useAIAnalysis = enabled;
  emit(EVENTS.SYSTEM_STATUS, { useAIAnalysis: enabled });
}

export function setStrategyOptimizationEnabled(enabled) {
  orchestratorState.useStrategyOptimization = enabled;
  emit(EVENTS.SYSTEM_STATUS, { useStrategyOptimization: enabled });
}

export function setPreferOptimizedStrategies(prefer) {
  orchestratorState.preferOptimizedStrategies = prefer;
  emit(EVENTS.SYSTEM_STATUS, { preferOptimizedStrategies: prefer });
}

export function triggerStrategyOptimization() {
  orchestratorState.lastOptimizationTime = 0; // Force optimization on next loop
  emit(EVENTS.SYSTEM_STATUS, { optimizationScheduled: true });
}
