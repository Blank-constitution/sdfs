import React, { createContext, useContext, useEffect, useState } from 'react';
import { on, EVENTS } from '../core/eventBus';
import { getOrchestratorState, startOrchestrator, stopOrchestrator, configureOrchestrator, toggleLive } from '../core/services/orchestrator';
import { setKillSwitch, getRiskState } from '../core/riskManager';

const SystemContext = createContext();

export function SystemProvider({ children }) {
  const [status, setStatus] = useState({
    ...getOrchestratorState(),
    risk: getRiskState(),
    lastHeartbeat: null,
    lastOrder: null,
    lastError: null,
  });

  useEffect(() => {
    const offs = [
      on(EVENTS.HEARTBEAT, d => setStatus(s => ({ ...s, lastHeartbeat: d.ts }))),
      on(EVENTS.ORDER_EXECUTED, d => setStatus(s => ({ ...s, lastOrder: d }))),
      on(EVENTS.ORDER_ERROR, d => setStatus(s => ({ ...s, lastError: d }))),
      on(EVENTS.STRATEGY_SIGNAL, sig => setStatus(s => ({ ...s, lastSignal: sig }))),
      on(EVENTS.KILL_SWITCH, k => setStatus(s => ({ ...s, risk: { ...s.risk, killSwitch: k.active } }))),
    ];
    startOrchestrator();
    return () => {
      offs.forEach(o => o && o());
      stopOrchestrator();
    };
  }, []);

  const api = {
    status,
    refreshConfig: (cfg) => {
      configureOrchestrator(cfg);
      setStatus(s => ({ ...s, ...cfg }));
    },
    setLive: toggleLive,
    setKill: setKillSwitch,
  };

  return <SystemContext.Provider value={api}>{children}</SystemContext.Provider>;
}

export function useSystem() {
  return useContext(SystemContext);
}
