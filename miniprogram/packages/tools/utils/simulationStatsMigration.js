const careerContent = require("./careerGameContent");
const huaweiContent = require("./huaweiSimContent");
const statsStore = require("./simulationStatsStore");

const LEGACY_HUAWEI_STORAGE_KEY = "toolbox_huawei_sim_progress";
const CAREER_ID = "career";
const HUAWEI_ID = "huawei";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function uniqueKnownIds(items, validIds) {
  const result = [];
  const seen = new Set();
  (Array.isArray(items) ? items : []).forEach((value) => {
    const id = String(value || "");
    if (!validIds.has(id) || seen.has(id)) return;
    seen.add(id);
    result.push(id);
  });
  return result;
}

function writeSimulator(simulatorId, simulator) {
  const validEventIdsBySimulator = {
    [CAREER_ID]: careerContent.EVENTS.map((item) => item.id),
    [HUAWEI_ID]: huaweiContent.EVENTS.map((item) => item.id)
  };
  const root = statsStore.getRoot(validEventIdsBySimulator);
  root.simulators[simulatorId] = simulator;
  root.updatedAt = new Date().toISOString();
  const normalized = statsStore.normalizeRoot(root, validEventIdsBySimulator);
  normalized.updatedAt = root.updatedAt;
  wx.setStorageSync(statsStore.STORAGE_KEY, clone(normalized));
  return normalized.simulators[simulatorId];
}

function emptySimulator() {
  return {
    startedRuns: 0,
    completedRuns: 0,
    startedRunKeys: [],
    completedRunKeys: [],
    events: {},
    recentEventIds: [],
    recentRuns: []
  };
}

function buildCareerSimulator(runs) {
  const validIds = new Set(careerContent.EVENTS.map((item) => item.id));
  const ordered = (Array.isArray(runs) ? runs : [])
    .slice()
    .sort((left, right) => (
      String(left.startedAt || left.updatedAt || "").localeCompare(String(right.startedAt || right.updatedAt || ""))
        || String(left.id || "").localeCompare(String(right.id || ""))
    ));
  const simulator = emptySimulator();
  const seen = new Set();

  ordered.forEach((run, index) => {
    const runKey = String(run && run.id || "").trim();
    if (!runKey) return;
    const runNumber = index + 1;
    const answeredEventIds = uniqueKnownIds(
      (run.history || []).map((entry) => entry && entry.eventId),
      validIds
    );
    const shownEventIds = answeredEventIds.slice();
    const currentSceneId = String(run.currentSceneId || "");
    if (validIds.has(currentSceneId) && !shownEventIds.includes(currentSceneId)) {
      shownEventIds.push(currentSceneId);
    }
    const newEventIds = [];
    const repeatEventIds = [];

    shownEventIds.forEach((eventId) => {
      const isNew = !seen.has(eventId);
      (isNew ? newEventIds : repeatEventIds).push(eventId);
      seen.add(eventId);
      const eventStats = simulator.events[eventId] || {
        shownCount: 0,
        answeredCount: 0,
        firstShownRun: runNumber,
        lastShownRun: runNumber
      };
      eventStats.shownCount += 1;
      eventStats.firstShownRun = Math.min(eventStats.firstShownRun, runNumber);
      eventStats.lastShownRun = runNumber;
      if (answeredEventIds.includes(eventId)) eventStats.answeredCount += 1;
      simulator.events[eventId] = eventStats;
      simulator.recentEventIds = [eventId]
        .concat(simulator.recentEventIds.filter((id) => id !== eventId))
        .slice(0, statsStore.MAX_RECENT_EVENTS);
    });

    simulator.startedRunKeys.unshift(runKey);
    if (run.status === "completed") simulator.completedRunKeys.unshift(runKey);
    simulator.recentRuns.unshift({
      runKey,
      runNumber,
      status: run.status === "completed" ? "completed" : "started",
      shownEventIds,
      newEventIds,
      repeatEventIds,
      answeredEventIds,
      startedAt: String(run.startedAt || ""),
      completedAt: run.status === "completed" ? String(run.completedAt || run.updatedAt || "") : ""
    });
  });

  simulator.startedRuns = ordered.length;
  simulator.completedRuns = ordered.filter((run) => run.status === "completed").length;
  simulator.startedRunKeys = simulator.startedRunKeys.slice(0, statsStore.MAX_RUN_KEYS);
  simulator.completedRunKeys = simulator.completedRunKeys.slice(0, statsStore.MAX_RUN_KEYS);
  simulator.recentRuns = simulator.recentRuns.slice(0, statsStore.MAX_RECENT_RUNS);
  return simulator;
}

function rebuildCareerStats(runs) {
  return writeSimulator(CAREER_ID, buildCareerSimulator(runs));
}

function ensureCareerStats(runs) {
  const root = statsStore.getRoot({ [CAREER_ID]: careerContent.EVENTS.map((item) => item.id) });
  const current = root.simulators[CAREER_ID];
  if (current && (current.startedRuns > 0 || Object.keys(current.events).length > 0)) return current;
  if (!Array.isArray(runs) || !runs.length) return current || null;
  return rebuildCareerStats(runs);
}

function buildLegacyHuaweiSimulator(input) {
  const validIds = new Set(huaweiContent.EVENTS.map((item) => item.id));
  const usage = input && input.eventUsage && typeof input.eventUsage === "object"
    ? input.eventUsage
    : {};
  const seenIds = uniqueKnownIds(
    (input && input.seenEventIds || []).concat(Object.keys(usage)),
    validIds
  );
  const completedRuns = Math.max(0, Math.floor(Number(input && input.completedRuns) || 0));
  const completedRunKeys = Array.from(new Set(
    (input && Array.isArray(input.completedRunKeys) ? input.completedRunKeys : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )).slice(0, statsStore.MAX_RUN_KEYS);
  const events = {};
  seenIds.forEach((eventId) => {
    const shownCount = Math.max(1, Math.min(
      statsStore.MAX_EVENT_COUNT,
      Math.floor(Number(usage[eventId]) || 1)
    ));
    events[eventId] = {
      shownCount,
      answeredCount: 0,
      firstShownRun: 1,
      lastShownRun: Math.max(1, completedRuns)
    };
  });
  return {
    ...emptySimulator(),
    startedRuns: completedRuns,
    completedRuns,
    startedRunKeys: completedRunKeys.slice(),
    completedRunKeys,
    events,
    recentEventIds: uniqueKnownIds(input && input.recentEventIds, validIds)
      .slice(0, statsStore.MAX_RECENT_EVENTS)
  };
}

function migrateLegacyHuaweiStats() {
  const root = statsStore.getRoot({ [HUAWEI_ID]: huaweiContent.EVENTS.map((item) => item.id) });
  const current = root.simulators[HUAWEI_ID];
  const legacy = wx.getStorageSync(LEGACY_HUAWEI_STORAGE_KEY);
  if (!legacy || typeof legacy !== "object") return current || null;
  if (current && (current.startedRuns > 0 || Object.keys(current.events).length > 0)) {
    if (wx.removeStorageSync) wx.removeStorageSync(LEGACY_HUAWEI_STORAGE_KEY);
    return current;
  }
  const migrated = writeSimulator(HUAWEI_ID, buildLegacyHuaweiSimulator(legacy));
  if (wx.removeStorageSync) wx.removeStorageSync(LEGACY_HUAWEI_STORAGE_KEY);
  return migrated;
}

module.exports = {
  CAREER_ID,
  HUAWEI_ID,
  LEGACY_HUAWEI_STORAGE_KEY,
  buildCareerSimulator,
  buildLegacyHuaweiSimulator,
  ensureCareerStats,
  migrateLegacyHuaweiStats,
  rebuildCareerStats
};
