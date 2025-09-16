import { emit, EVENTS } from './eventBus';

const state = {
  maxPositionUSD: 500,        // per trade cap
  dailyLossLimitUSD: 300,     // simple placeholder
  accumulatedLoss: 0,
  killSwitch: false,
};

export function setKillSwitch(on) {
  state.killSwitch = on;
  emit(EVENTS.KILL_SWITCH, { active: on });
}

export function getRiskState() {
  return { ...state };
}

export function evaluateRisk({ estPositionValueUSD, signal }) {
  if (state.killSwitch) {
    emit(EVENTS.RISK_BLOCK, { reason: 'KILL_SWITCH', signal });
    return { allow: false, reason: 'KILL_SWITCH' };
  }
  if (estPositionValueUSD > state.maxPositionUSD) {
    emit(EVENTS.RISK_BLOCK, { reason: 'SIZE_LIMIT', signal });
    return { allow: false, reason: 'SIZE_LIMIT' };
  }
  if (state.accumulatedLoss <= -state.dailyLossLimitUSD) {
    setKillSwitch(true);
    return { allow: false, reason: 'DAILY_LOSS_LIMIT' };
  }
  return { allow: true };
}

export function registerFillPnl(pnlUSD) {
  state.accumulatedLoss += pnlUSD;
  if (state.accumulatedLoss <= -state.dailyLossLimitUSD) setKillSwitch(true);
}
