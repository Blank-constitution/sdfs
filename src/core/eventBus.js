const listeners = {};

export function on(event, handler) {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(handler);
  return () => listeners[event].delete(handler);
}

export function emit(event, payload) {
  if (listeners[event]) {
    listeners[event].forEach(h => {
      try { h(payload); } catch (e) { console.error('[EventBus]', event, e); }
    });
  }
}

export function once(event, handler) {
  const off = on(event, (p) => { handler(p); off(); });
}

export const EVENTS = {
  HEARTBEAT: 'heartbeat',
  MARKET_SNAPSHOT: 'market:snapshot',
  STRATEGY_SIGNAL: 'strategy:signal',
  ORDER_EXECUTED: 'order:executed',
  ORDER_ERROR: 'order:error',
  RISK_BLOCK: 'risk:block',
  SYSTEM_STATUS: 'system:status',
  KILL_SWITCH: 'system:kill',
  AI_ANALYSIS_COMPLETE: 'ai:analysis:complete',
  AI_ANALYSIS_UPDATED: 'ai:analysis:updated',
  STRATEGY_OPTIMIZED: 'strategy:optimized',
  STRATEGY_CHANGED: 'strategy:changed',
  OPTIMIZATION_ERROR: 'optimization:error',
  ML_MODEL_LOADED: 'ml:model:loaded',
  ML_PREDICTION: 'ml:prediction'
};
