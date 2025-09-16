import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { on, EVENTS } from '../core/eventBus';
import { getOrchestratorState, startOrchestrator, stopOrchestrator, configureOrchestrator, toggleLive } from '../core/services/orchestrator';
import { setKillSwitch, getRiskState } from '../core/riskManager';

const SystemContext = createContext();

// BEST PRACTICE: Create a global reference to track if orchestrator is running
// This prevents duplicate orchestrators when mounting/unmounting components
const globalOrchestratorState = {
  isRunning: false,
  startedBy: null,
  startTime: null
};

export function SystemProvider({ children }) {
  const [status, setStatus] = useState({
    ...getOrchestratorState(),
    risk: getRiskState(),
    lastHeartbeat: null,
    lastOrder: null,
    lastError: null,
  });
  
  // Track component mount status to prevent state updates after unmount
  const isMounted = useRef(true);
  
  useEffect(() => {
    // Register event listeners
    const offs = [
      on(EVENTS.HEARTBEAT, d => {
        if (isMounted.current) {
          setStatus(s => ({ ...s, lastHeartbeat: d.ts }));
        }
      }),
      on(EVENTS.ORDER_EXECUTED, d => {
        if (isMounted.current) {
          setStatus(s => ({ ...s, lastOrder: d }));
        }
      }),
      on(EVENTS.ORDER_ERROR, d => {
        if (isMounted.current) {
          setStatus(s => ({ ...s, lastError: d }));
        }
      }),
      on(EVENTS.STRATEGY_SIGNAL, sig => {
        if (isMounted.current) {
          setStatus(s => ({ ...s, lastSignal: sig }));
        }
      }),
      on(EVENTS.KILL_SWITCH, k => {
        if (isMounted.current) {
          setStatus(s => ({ ...s, risk: { ...s.risk, killSwitch: k.active } }));
        }
      }),
      on(EVENTS.AI_ANALYSIS_UPDATED, d => {
        if (isMounted.current) {
          setStatus(s => ({ ...s, lastAiAnalysis: d.analysis }));
        }
      }),
    ];
    
    // Start orchestrator only if not already running
    if (!globalOrchestratorState.isRunning) {
      startOrchestrator();
      globalOrchestratorState.isRunning = true;
      globalOrchestratorState.startedBy = 'SystemProvider';
      globalOrchestratorState.startTime = Date.now();
      console.log('Orchestrator started by SystemProvider');
    } else {
      console.log('Orchestrator already running (started by ' + 
                  globalOrchestratorState.startedBy + ')');
    }
    
    return () => {
      // Cleanup event listeners
      offs.forEach(o => o && o());
      
      // Only stop orchestrator if we started it
      if (globalOrchestratorState.isRunning && 
          globalOrchestratorState.startedBy === 'SystemProvider') {
        stopOrchestrator();
        globalOrchestratorState.isRunning = false;
        globalOrchestratorState.startedBy = null;
        console.log('Orchestrator stopped by SystemProvider');
      }
      
      // Mark component as unmounted
      isMounted.current = false;
    };
  }, []);

  const api = {
    status,
    refreshConfig: (cfg) => {
      configureOrchestrator(cfg);
      if (isMounted.current) {
        setStatus(s => ({ ...s, ...cfg }));
      }
    },
    setLive: toggleLive,
    setKill: setKillSwitch,
  };

  return <SystemContext.Provider value={api}>{children}</SystemContext.Provider>;
}

export function useSystem() {
  return useContext(SystemContext);
}

// Export a method to control the orchestrator from outside React components
export const OrchestratorControl = {
  start: () => {
    if (!globalOrchestratorState.isRunning) {
      startOrchestrator();
      globalOrchestratorState.isRunning = true;
      globalOrchestratorState.startedBy = 'External';
      globalOrchestratorState.startTime = Date.now();
      return true;
    }
    return false;
  },
  stop: () => {
    if (globalOrchestratorState.isRunning) {
      stopOrchestrator();
      globalOrchestratorState.isRunning = false;
      globalOrchestratorState.startedBy = null;
      return true;
    }
    return false;
  },
  isRunning: () => globalOrchestratorState.isRunning
};
