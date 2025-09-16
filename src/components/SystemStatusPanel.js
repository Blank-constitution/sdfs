import React from 'react';
import { useSystem } from '../contexts/SystemContext';

export default function SystemStatusPanel() {
  const { status, setLive, setKill, refreshConfig } = useSystem();
  const hbAge = status.lastHeartbeat ? ((Date.now() - status.lastHeartbeat) / 1000).toFixed(1) : '—';
  
  return (
    <div style={{ padding: 12, border: '1px solid #ccc', marginBottom: 15, borderRadius: 6 }}>
      <h4 style={{ margin: '0 0 8px' }}>System Status</h4>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', fontSize: 12 }}>
        <div>Heartbeat Age: {hbAge}s</div>
        <div>Live: <strong style={{ color: status.liveTrading ? 'green' : 'red' }}>{String(status.liveTrading)}</strong></div>
        <div>Kill Switch: <strong style={{ color: status.risk?.killSwitch ? 'red' : 'green' }}>{String(status.risk?.killSwitch)}</strong></div>
        <div>Strategy: {status.strategy}</div>
        <div>Symbol: {status.symbol}</div>
        <div>Last Signal: {status.lastSignal?.signal || '—'}</div>
        
        {/* Add ML/AI status indicators */}
        <div>AI Analysis: <strong style={{ color: status.useAIAnalysis ? 'green' : 'gray' }}>{status.useAIAnalysis ? 'Active' : 'Disabled'}</strong></div>
        <div>ML Optimization: <strong style={{ color: status.useStrategyOptimization ? 'green' : 'gray' }}>{status.useStrategyOptimization ? 'Active' : 'Disabled'}</strong></div>
      </div>
      
      <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
        {/* ...existing buttons... */}
        <button onClick={() => setLive(!status.liveTrading)}>
          {status.liveTrading ? 'Disable Live' : 'Enable Live'}
        </button>
        <button onClick={() => setKill(!status.risk?.killSwitch)}>
          {status.risk?.killSwitch ? 'Release Kill' : 'Activate Kill'}
        </button>
        
        {/* Add ML/AI control buttons */}
        <button onClick={() => refreshConfig({ useAIAnalysis: !status.useAIAnalysis })}>
          {status.useAIAnalysis ? 'Disable AI' : 'Enable AI'}
        </button>
        <button onClick={() => refreshConfig({ useStrategyOptimization: !status.useStrategyOptimization })}>
          {status.useStrategyOptimization ? 'Disable ML Opt' : 'Enable ML Opt'}
        </button>
        <button onClick={() => refreshConfig({ 
          strategy: status.strategy, 
          symbol: status.symbol, 
          triggerOptimization: true 
        })}>
          Optimize Now
        </button>
      </div>
      
      {/* ...existing error display... */}
      {status.lastError && (
        <div style={{ marginTop: 8, color: 'crimson' }}>
          Last Error: {status.lastError.reason || status.lastError.error?.msg || 'Unknown'}
        </div>
      )}
      
      {/* Add AI insight display */}
      {status.lastAiAnalysis && (
        <div style={{ marginTop: 8, fontSize: 11, padding: 5, backgroundColor: '#f5f5f5', borderRadius: 3 }}>
          <strong>AI Insight:</strong> {status.lastAiAnalysis.analysis?.sentiment || 'No insight available'} 
          (Confidence: {status.lastAiAnalysis.analysis?.confidence || 0}%)
        </div>
      )}
    </div>
  );
}
