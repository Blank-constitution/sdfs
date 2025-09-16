import React from 'react';
import { useSystem } from '../contexts/SystemContext';

export default function SystemStatusPanel() {
  const { status, setLive, setKill, refreshConfig } = useSystem();
  const hbAge = status.lastHeartbeat ? ((Date.now() - status.lastHeartbeat) / 1000).toFixed(1) : '—';
  
  return (
    <div className="system-status-panel">
      <h4>System Status</h4>
      
      <div className="status-grid">
        <div>Heartbeat Age: {hbAge}s</div>
        <div>Live: <strong style={{ color: status.liveTrading ? 'green' : 'red' }}>{String(status.liveTrading)}</strong></div>
        <div>Kill Switch: <strong style={{ color: status.risk?.killSwitch ? 'red' : 'green' }}>{String(status.risk?.killSwitch)}</strong></div>
        <div>Strategy: {status.strategy}</div>
        <div>Symbol: {status.symbol}</div>
        <div>Last Signal: {status.lastSignal?.signal || '—'}</div>
        
        {/* ML/AI status indicators */}
        <div>AI Analysis: <strong style={{ color: status.useAIAnalysis ? 'green' : 'gray' }}>{status.useAIAnalysis ? 'Active' : 'Disabled'}</strong></div>
        <div>ML Optimization: <strong style={{ color: status.useStrategyOptimization ? 'green' : 'gray' }}>{status.useStrategyOptimization ? 'Active' : 'Disabled'}</strong></div>
      </div>
      
      <div className="button-group">
        <button onClick={() => setLive(!status.liveTrading)}>
          {status.liveTrading ? 'Disable Live' : 'Enable Live'}
        </button>
        <button onClick={() => setKill(!status.risk?.killSwitch)}>
          {status.risk?.killSwitch ? 'Release Kill' : 'Activate Kill'}
        </button>
        
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
      
      {status.lastError && (
        <div className="error-message">
          Last Error: {status.lastError.reason || status.lastError.error?.msg || 'Unknown'}
        </div>
      )}
      
      {status.lastAiAnalysis && (
        <div className="ai-insight">
          <strong>AI Insight:</strong> {status.lastAiAnalysis.analysis?.sentiment || 'No insight available'} 
          (Confidence: {status.lastAiAnalysis.analysis?.confidence || 0}%)
        </div>
      )}
    </div>
  );
}
      )}
    </div>
  );
}
