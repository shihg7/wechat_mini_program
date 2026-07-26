const { EVENTS } = require("./huaweiSimContent");
const simulationStatsStore = require("./simulationStatsStore");
const simulationStatsMigration = require("./simulationStatsMigration");

const STORAGE_KEY = "toolbox_huawei_sim_progress";
const SCHEMA_VERSION = 1;
const MAX_RECENT_EVENTS = 30;
const MAX_COMPLETED_RUN_KEYS = 20;
const EVENT_IDS = new Set(EVENTS.map((item) => item.id));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueKnownIds(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).reduce((result, value) => {
    const id = String(value || "");
    if (!EVENT_IDS.has(id) || seen.has(id)) return result;
    seen.add(id);
    result.push(id);
    return result;
  }, []);
}

function normalizeProgress(input = {}) {
  const sourceUsage = input.eventUsage && typeof input.eventUsage === "object"
    ? input.eventUsage
    : {};
  const eventUsage = {};
  Object.keys(sourceUsage).forEach((id) => {
    if (!EVENT_IDS.has(id)) return;
    const count = Math.floor(Number(sourceUsage[id]));
    if (Number.isFinite(count) && count > 0) eventUsage[id] = Math.min(count, 10000);
  });

  const seenEventIds = uniqueKnownIds(
    (Array.isArray(input.seenEventIds) ? input.seenEventIds : []).concat(Object.keys(eventUsage))
  );
  seenEventIds.forEach((id) => {
    if (!eventUsage[id]) eventUsage[id] = 1;
  });

  const completedRunKeys = Array.from(new Set(
    (Array.isArray(input.completedRunKeys) ? input.completedRunKeys : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )).slice(0, MAX_COMPLETED_RUN_KEYS);
  const completedRuns = Math.max(
    completedRunKeys.length,
    Math.min(10000, Math.max(0, Math.floor(Number(input.completedRuns) || 0)))
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    completedRuns,
    completedRunKeys,
    seenEventIds,
    eventUsage,
    recentEventIds: uniqueKnownIds(input.recentEventIds).slice(0, MAX_RECENT_EVENTS),
    updatedAt: String(input.updatedAt || "")
  };
}

function getProgress() {
  simulationStatsMigration.migrateLegacyHuaweiStats();
  const root = simulationStatsStore.getRoot({
    [simulationStatsMigration.HUAWEI_ID]: EVENTS.map((item) => item.id)
  });
  const simulator = root.simulators[simulationStatsMigration.HUAWEI_ID];
  if (!simulator) return normalizeProgress();
  return normalizeProgress({
    completedRuns: simulator.completedRuns,
    completedRunKeys: simulator.completedRunKeys,
    seenEventIds: Object.keys(simulator.events),
    eventUsage: Object.keys(simulator.events).reduce((result, id) => {
      result[id] = simulator.events[id].shownCount;
      return result;
    }, {}),
    recentEventIds: simulator.recentEventIds,
    updatedAt: root.updatedAt
  });
}

function setProgress(input) {
  const progress = normalizeProgress(input);
  simulationStatsStore.clearSimulatorStats(simulationStatsMigration.HUAWEI_ID);
  wx.setStorageSync(STORAGE_KEY, clone(progress));
  simulationStatsMigration.migrateLegacyHuaweiStats();
  return getProgress();
}

function markEventSeen(eventId) {
  const id = String(eventId || "");
  if (!EVENT_IDS.has(id)) return getProgress();
  const profile = simulationStatsStore.getSelectionProfile(
    simulationStatsMigration.HUAWEI_ID,
    EVENTS.map((item) => item.id)
  );
  simulationStatsStore.recordEventShown(
    simulationStatsMigration.HUAWEI_ID,
    `legacy-adapter-run-${profile.completedRuns + 1}`,
    id
  );
  return getProgress();
}

function recordRunCompleted(runKey) {
  const key = String(runKey || "").trim();
  if (!key) return getProgress();
  simulationStatsStore.recordRunCompleted(simulationStatsMigration.HUAWEI_ID, key);
  return getProgress();
}

function getSelectionProfile(input) {
  return simulationStatsStore.getSelectionProfile(
    simulationStatsMigration.HUAWEI_ID,
    EVENTS.map((item) => item.id)
  );
}

function clearProgress() {
  if (wx.removeStorageSync) wx.removeStorageSync(STORAGE_KEY);
  else wx.setStorageSync(STORAGE_KEY, undefined);
  simulationStatsStore.clearSimulatorStats(simulationStatsMigration.HUAWEI_ID);
  return normalizeProgress();
}

module.exports = {
  MAX_COMPLETED_RUN_KEYS,
  MAX_RECENT_EVENTS,
  SCHEMA_VERSION,
  STORAGE_KEY,
  clearProgress,
  getProgress,
  getSelectionProfile,
  markEventSeen,
  normalizeProgress,
  recordRunCompleted,
  setProgress
};
