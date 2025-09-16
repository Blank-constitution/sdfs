import { runStrategy } from '../strategyEngine';

const registry = new Map();
// preload existing engine delegation
registry.set('conservativeConfluence', (ctx) => runStrategy('conservativeConfluence', ctx.marketData, ctx.historicalData));
registry.set('movingAverageCrossover', (ctx) => runStrategy('movingAverageCrossover', ctx.marketData, ctx.historicalData));
registry.set('mlPredictor', (ctx) => runStrategy('mlPredictor', ctx.marketData, ctx.historicalData, ctx.geminiAiApiKey));
registry.set('custom', (ctx) => runStrategy('custom', ctx.marketData, ctx.historicalData));

export function registerStrategy(key, fn) {
  registry.set(key, fn);
}

export function getStrategy(key) {
  return registry.get(key) || registry.get('conservativeConfluence');
}

export function listStrategies() {
  return Array.from(registry.keys());
}
