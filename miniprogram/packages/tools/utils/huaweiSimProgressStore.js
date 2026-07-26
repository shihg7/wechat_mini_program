const { EVENTS } = require("./huaweiSimContent");

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
  return normalizeProgress(wx.getStorageSync(STORAGE_KEY));
}

function setProgress(input) {
  const progress = normalizeProgress(input);
  progress.updatedAt = new Date().toISOString();
  wx.setStorageSync(STORAGE_KEY, clone(progress));
  return progress;
}

function markEventSeen(eventId) {
  const id = String(eventId || "");
  const progress = getProgress();
  if (!EVENT_IDS.has(id)) return progress;
  progress.eventUsage[id] = Number(progress.eventUsage[id] || 0) + 1;
  if (!progress.seenEventIds.includes(id)) progress.seenEventIds.push(id);
  progress.recentEventIds = [id]
    .concat(progress.recentEventIds.filter((item) => item !== id))
    .slice(0, MAX_RECENT_EVENTS);
  return setProgress(progress);
}

function recordRunCompleted(runKey) {
  const key = String(runKey || "").trim();
  const progress = getProgress();
  if (key && progress.completedRunKeys.includes(key)) return progress;
  progress.completedRuns += 1;
  if (key) {
    progress.completedRunKeys = [key]
      .concat(progress.completedRunKeys)
      .slice(0, MAX_COMPLETED_RUN_KEYS);
  }
  return setProgress(progress);
}

function getSelectionProfile(input) {
  const progress = normalizeProgress(input);
  return {
    runNumber: progress.completedRuns + 1,
    seenEventIds: progress.seenEventIds.slice(),
    eventUsage: clone(progress.eventUsage),
    recentEventIds: progress.recentEventIds.slice()
  };
}

function clearProgress() {
  if (wx.removeStorageSync) wx.removeStorageSync(STORAGE_KEY);
  else wx.setStorageSync(STORAGE_KEY, undefined);
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
