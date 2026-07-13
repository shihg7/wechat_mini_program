const demoData = require("./demoData");

const STATE_KEY = "experience_demo_mode_state";
const STEP_IDS = ["record", "trip", "ledger", "wheel"];

function emptyState() {
  return { active: false, startedAt: "", completedStepIds: [] };
}

function getState() {
  const value = wx.getStorageSync(STATE_KEY);
  if (!value || typeof value !== "object" || !value.active) return emptyState();
  return {
    active: true,
    startedAt: String(value.startedAt || ""),
    completedStepIds: (value.completedStepIds || []).filter((id) => STEP_IDS.indexOf(id) >= 0)
  };
}

function saveState(state) {
  wx.setStorageSync(STATE_KEY, state);
  return state;
}

function start() {
  const registry = demoData.seedDemoData();
  const state = saveState({ active: true, startedAt: new Date().toISOString(), completedStepIds: [] });
  return { state, registry };
}

function markStep(stepId) {
  if (STEP_IDS.indexOf(stepId) < 0) return getState();
  const state = getState();
  if (!state.active || state.completedStepIds.indexOf(stepId) >= 0) return state;
  return saveState({ ...state, completedStepIds: state.completedStepIds.concat(stepId) });
}

function resetProgress() {
  const state = getState();
  if (!state.active) return state;
  return saveState({ ...state, completedStepIds: [] });
}

function finish() {
  demoData.clearDemoData();
  wx.removeStorageSync(STATE_KEY);
  return emptyState();
}

function getProgress() {
  const state = getState();
  return {
    ...state,
    completed: state.completedStepIds.length,
    total: STEP_IDS.length,
    percent: Math.round(state.completedStepIds.length / STEP_IDS.length * 100)
  };
}

module.exports = { STATE_KEY, STEP_IDS, finish, getProgress, getState, markStep, resetProgress, start };
