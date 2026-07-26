const STORAGE_KEY = "toolbox_simulation_stats";
const SCHEMA_VERSION = 1;
const MAX_SIMULATORS = 20;
const MAX_RUN_COUNT = 100000;
const MAX_EVENT_COUNT = 1000000;
const MAX_RUN_KEYS = 500;
const MAX_RECENT_EVENTS = 100;
const MAX_RECENT_RUNS = 30;
const MAX_EVENTS_PER_RUN = 256;
const MAX_ID_LENGTH = 128;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function cleanId(value) {
  return String(value == null ? "" : value).trim().slice(0, MAX_ID_LENGTH);
}

function requireId(value, label) {
  const id = cleanId(value);
  if (!id) throw new Error(`${label} 不能为空`);
  return id;
}

function boundedInteger(value, max = MAX_EVENT_COUNT) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, Math.min(max, number)) : 0;
}

function uniqueIds(items, limit, validIds) {
  const result = [];
  const seen = new Set();
  (Array.isArray(items) ? items : []).forEach((value) => {
    const id = cleanId(value);
    if (!id || seen.has(id) || (validIds && !validIds.has(id)) || result.length >= limit) return;
    seen.add(id);
    result.push(id);
  });
  return result;
}

function validIdSet(values) {
  if (!Array.isArray(values) && !(values instanceof Set)) return null;
  return new Set(Array.from(values).map(cleanId).filter(Boolean));
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

function normalizeEventStats(input = {}) {
  let shownCount = boundedInteger(input.shownCount);
  const answeredCount = boundedInteger(input.answeredCount);
  shownCount = Math.max(shownCount, answeredCount);
  if (!shownCount) return null;
  let firstShownRun = Math.max(1, boundedInteger(input.firstShownRun, MAX_RUN_COUNT) || 1);
  let lastShownRun = Math.max(firstShownRun, boundedInteger(input.lastShownRun, MAX_RUN_COUNT) || firstShownRun);
  firstShownRun = Math.min(firstShownRun, MAX_RUN_COUNT);
  lastShownRun = Math.min(lastShownRun, MAX_RUN_COUNT);
  return {
    shownCount,
    answeredCount: Math.min(answeredCount, shownCount),
    firstShownRun,
    lastShownRun
  };
}

function normalizeRun(input = {}, validIds, completedKeys) {
  const runKey = cleanId(input.runKey);
  if (!runKey) return null;
  const shownEventIds = uniqueIds(input.shownEventIds, MAX_EVENTS_PER_RUN, validIds);
  const shownSet = new Set(shownEventIds);
  const newEventIds = uniqueIds(input.newEventIds, MAX_EVENTS_PER_RUN, shownSet);
  const newSet = new Set(newEventIds);
  const repeatEventIds = uniqueIds(input.repeatEventIds, MAX_EVENTS_PER_RUN, shownSet)
    .filter((id) => !newSet.has(id));
  const classified = new Set(newEventIds.concat(repeatEventIds));
  shownEventIds.forEach((id) => {
    if (!classified.has(id)) repeatEventIds.push(id);
  });
  const answeredEventIds = uniqueIds(input.answeredEventIds, MAX_EVENTS_PER_RUN, shownSet);
  const isCompleted = completedKeys.has(runKey) || input.status === "completed";
  return {
    runKey,
    runNumber: Math.max(1, boundedInteger(input.runNumber, MAX_RUN_COUNT) || 1),
    status: isCompleted ? "completed" : "started",
    shownEventIds,
    newEventIds,
    repeatEventIds: repeatEventIds.slice(0, MAX_EVENTS_PER_RUN),
    answeredEventIds,
    startedAt: String(input.startedAt || ""),
    completedAt: isCompleted ? String(input.completedAt || "") : ""
  };
}

function normalizeSimulator(input = {}, validIdsInput) {
  const validIds = validIdSet(validIdsInput);
  const sourceEvents = input.events && typeof input.events === "object" && !Array.isArray(input.events)
    ? input.events
    : {};
  const events = {};
  Object.keys(sourceEvents).slice(0, MAX_EVENT_COUNT).forEach((rawId) => {
    const id = cleanId(rawId);
    if (!id || (validIds && !validIds.has(id)) || Object.prototype.hasOwnProperty.call(events, id)) return;
    const stats = normalizeEventStats(sourceEvents[rawId]);
    if (stats) events[id] = stats;
  });

  const knownEventIds = new Set(Object.keys(events));
  const startedRunKeys = uniqueIds(input.startedRunKeys, MAX_RUN_KEYS);
  const completedRunKeys = uniqueIds(input.completedRunKeys, MAX_RUN_KEYS);
  const completedKeySet = new Set(completedRunKeys);
  const recentRuns = [];
  const seenRunKeys = new Set();
  (Array.isArray(input.recentRuns) ? input.recentRuns : []).some((item) => {
    const run = normalizeRun(item, knownEventIds, completedKeySet);
    if (!run || seenRunKeys.has(run.runKey)) return false;
    seenRunKeys.add(run.runKey);
    recentRuns.push(run);
    return recentRuns.length >= MAX_RECENT_RUNS;
  });

  const highestRunNumber = recentRuns.reduce(
    (highest, run) => Math.max(highest, run.runNumber),
    0
  );
  const highestEventRun = Object.keys(events).reduce(
    (highest, eventId) => Math.max(highest, events[eventId].lastShownRun),
    0
  );
  const completedRecentCount = recentRuns.filter((run) => run.status === "completed").length;
  const completedRuns = Math.max(
    completedRunKeys.length,
    completedRecentCount,
    boundedInteger(input.completedRuns, MAX_RUN_COUNT)
  );
  return {
    startedRuns: Math.max(
      startedRunKeys.length,
      highestRunNumber,
      highestEventRun,
      completedRuns,
      boundedInteger(input.startedRuns, MAX_RUN_COUNT)
    ),
    completedRuns,
    startedRunKeys,
    completedRunKeys,
    events,
    recentEventIds: uniqueIds(input.recentEventIds, MAX_RECENT_EVENTS, knownEventIds),
    recentRuns
  };
}

function normalizeRoot(input = {}, validEventIdsBySimulator) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const sourceSimulators = source.simulators
    && typeof source.simulators === "object"
    && !Array.isArray(source.simulators)
    ? source.simulators
    : {};
  const validMap = validEventIdsBySimulator
    && typeof validEventIdsBySimulator === "object"
    && !Array.isArray(validEventIdsBySimulator)
    ? validEventIdsBySimulator
    : {};
  const simulators = {};
  Object.keys(sourceSimulators).some((rawId) => {
    const simulatorId = cleanId(rawId);
    if (!simulatorId || Object.prototype.hasOwnProperty.call(simulators, simulatorId)) return false;
    simulators[simulatorId] = normalizeSimulator(
      sourceSimulators[rawId],
      Object.prototype.hasOwnProperty.call(validMap, simulatorId) ? validMap[simulatorId] : null
    );
    return Object.keys(simulators).length >= MAX_SIMULATORS;
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    simulators,
    updatedAt: String(source.updatedAt || "")
  };
}

function getRoot(validEventIdsBySimulator) {
  let stored;
  try {
    stored = wx.getStorageSync(STORAGE_KEY);
  } catch (error) {
    stored = {};
  }
  return normalizeRoot(stored, validEventIdsBySimulator);
}

function setRoot(input) {
  const root = normalizeRoot(input);
  root.updatedAt = nowIso();
  wx.setStorageSync(STORAGE_KEY, clone(root));
  return root;
}

function getSimulator(root, simulatorId) {
  if (!root.simulators[simulatorId]) root.simulators[simulatorId] = emptySimulator();
  return root.simulators[simulatorId];
}

function moveToFront(items, value, limit) {
  return [value].concat(items.filter((item) => item !== value)).slice(0, limit);
}

function findRun(simulator, runKey) {
  return simulator.recentRuns.find((run) => run.runKey === runKey) || null;
}

function startRun(simulator, runKey) {
  let run = findRun(simulator, runKey);
  if (run) return run;
  if (simulator.startedRunKeys.includes(runKey)) return null;
  simulator.startedRuns = Math.min(MAX_RUN_COUNT, simulator.startedRuns + 1);
  simulator.startedRunKeys = moveToFront(simulator.startedRunKeys, runKey, MAX_RUN_KEYS);
  run = {
    runKey,
    runNumber: Math.max(1, simulator.startedRuns),
    status: "started",
    shownEventIds: [],
    newEventIds: [],
    repeatEventIds: [],
    answeredEventIds: [],
    startedAt: nowIso(),
    completedAt: ""
  };
  simulator.recentRuns = [run].concat(simulator.recentRuns).slice(0, MAX_RECENT_RUNS);
  return run;
}

function showEvent(simulator, run, eventId) {
  if (!run || run.status === "completed" || run.shownEventIds.includes(eventId)) return;
  const previous = simulator.events[eventId];
  const wasSeen = Boolean(previous && previous.shownCount);
  const stats = previous || {
    shownCount: 0,
    answeredCount: 0,
    firstShownRun: run.runNumber,
    lastShownRun: run.runNumber
  };
  stats.shownCount = Math.min(MAX_EVENT_COUNT, stats.shownCount + 1);
  stats.firstShownRun = Math.min(stats.firstShownRun || run.runNumber, run.runNumber);
  stats.lastShownRun = run.runNumber;
  simulator.events[eventId] = stats;
  run.shownEventIds.push(eventId);
  (wasSeen ? run.repeatEventIds : run.newEventIds).push(eventId);
  simulator.recentEventIds = moveToFront(
    simulator.recentEventIds,
    eventId,
    MAX_RECENT_EVENTS
  );
}

function runView(run) {
  if (!run) return null;
  return {
    ...clone(run),
    shownCount: run.shownEventIds.length,
    newCount: run.newEventIds.length,
    repeatCount: run.repeatEventIds.length,
    answeredCount: run.answeredEventIds.length
  };
}

function mutateSimulator(simulatorIdInput, mutator) {
  const simulatorId = requireId(simulatorIdInput, "simulatorId");
  const root = getRoot();
  const simulator = getSimulator(root, simulatorId);
  const result = mutator(simulator);
  root.simulators[simulatorId] = normalizeSimulator(simulator);
  const saved = setRoot(root);
  const savedSimulator = saved.simulators[simulatorId];
  return typeof result === "string" ? runView(findRun(savedSimulator, result)) : result;
}

function recordRunStarted(simulatorId, runKeyInput) {
  const runKey = requireId(runKeyInput, "runKey");
  return mutateSimulator(simulatorId, (simulator) => {
    startRun(simulator, runKey);
    return runKey;
  });
}

function recordEventShown(simulatorId, runKeyInput, eventIdInput) {
  const runKey = requireId(runKeyInput, "runKey");
  const eventId = requireId(eventIdInput, "eventId");
  return mutateSimulator(simulatorId, (simulator) => {
    const run = startRun(simulator, runKey);
    showEvent(simulator, run, eventId);
    return runKey;
  });
}

function recordEventAnswered(simulatorId, runKeyInput, eventIdInput) {
  const runKey = requireId(runKeyInput, "runKey");
  const eventId = requireId(eventIdInput, "eventId");
  return mutateSimulator(simulatorId, (simulator) => {
    const run = startRun(simulator, runKey);
    if (!run || run.status === "completed") return runKey;
    showEvent(simulator, run, eventId);
    if (run.answeredEventIds.includes(eventId)) return runKey;
    run.answeredEventIds.push(eventId);
    const stats = simulator.events[eventId];
    stats.answeredCount = Math.min(MAX_EVENT_COUNT, stats.answeredCount + 1);
    return runKey;
  });
}

function recordRunCompleted(simulatorId, runKeyInput) {
  const runKey = requireId(runKeyInput, "runKey");
  return mutateSimulator(simulatorId, (simulator) => {
    if (simulator.completedRunKeys.includes(runKey)) return runKey;
    const run = startRun(simulator, runKey);
    simulator.completedRuns = Math.min(MAX_RUN_COUNT, simulator.completedRuns + 1);
    simulator.completedRunKeys = moveToFront(
      simulator.completedRunKeys,
      runKey,
      MAX_RUN_KEYS
    );
    if (run) {
      run.status = "completed";
      run.completedAt = nowIso();
    }
    return runKey;
  });
}

function getSelectionProfile(simulatorIdInput, validEventIds) {
  const simulatorId = requireId(simulatorIdInput, "simulatorId");
  const validIds = Array.isArray(validEventIds) || validEventIds instanceof Set
    ? Array.from(validEventIds)
    : null;
  const root = getRoot(validIds ? { [simulatorId]: validIds } : null);
  const simulator = root.simulators[simulatorId] || emptySimulator();
  const seenEventIds = Object.keys(simulator.events).sort((left, right) => (
    simulator.events[left].firstShownRun - simulator.events[right].firstShownRun
      || left.localeCompare(right)
  ));
  const eventUsage = {};
  const lastShownRuns = {};
  seenEventIds.forEach((eventId) => {
    eventUsage[eventId] = simulator.events[eventId].shownCount;
    lastShownRuns[eventId] = simulator.events[eventId].lastShownRun;
  });
  return {
    runNumber: Math.min(MAX_RUN_COUNT, simulator.completedRuns + 1),
    startedRuns: simulator.startedRuns,
    completedRuns: simulator.completedRuns,
    seenEventIds,
    eventUsage,
    lastShownRuns,
    eventStats: clone(simulator.events),
    recentEventIds: simulator.recentEventIds.slice(),
    totalEventCount: validIds ? new Set(validIds.map(cleanId).filter(Boolean)).size : null
  };
}

function getExplorationSummary(simulatorIdInput, validEventIds) {
  const simulatorId = requireId(simulatorIdInput, "simulatorId");
  const profile = getSelectionProfile(simulatorId, validEventIds);
  const root = getRoot(
    validEventIds ? { [simulatorId]: Array.from(validEventIds) } : null
  );
  const simulator = root.simulators[simulatorId] || emptySimulator();
  const shownCount = Object.keys(simulator.events)
    .reduce((total, eventId) => total + simulator.events[eventId].shownCount, 0);
  const answeredCount = Object.keys(simulator.events)
    .reduce((total, eventId) => total + simulator.events[eventId].answeredCount, 0);
  return {
    startedRuns: simulator.startedRuns,
    completedRuns: simulator.completedRuns,
    seenEventCount: profile.seenEventIds.length,
    totalEventCount: profile.totalEventCount,
    shownCount,
    answeredCount,
    recentEventIds: simulator.recentEventIds.slice(),
    latestRun: runView(simulator.recentRuns[0] || null)
  };
}

function getRunSummary(simulatorIdInput, runKeyInput) {
  const simulatorId = requireId(simulatorIdInput, "simulatorId");
  const runKey = requireId(runKeyInput, "runKey");
  const root = getRoot();
  const simulator = root.simulators[simulatorId];
  return runView(simulator ? findRun(simulator, runKey) : null);
}

function clearSimulatorStats(simulatorIdInput) {
  const simulatorId = requireId(simulatorIdInput, "simulatorId");
  const root = getRoot();
  delete root.simulators[simulatorId];
  return setRoot(root);
}

function clearAllStats() {
  if (wx.removeStorageSync) wx.removeStorageSync(STORAGE_KEY);
  else wx.setStorageSync(STORAGE_KEY, undefined);
  return normalizeRoot();
}

module.exports = {
  MAX_EVENT_COUNT,
  MAX_EVENTS_PER_RUN,
  MAX_RECENT_EVENTS,
  MAX_RECENT_RUNS,
  MAX_RUN_COUNT,
  MAX_RUN_KEYS,
  SCHEMA_VERSION,
  STORAGE_KEY,
  clearAllStats,
  clearSimulatorStats,
  getExplorationSummary,
  getRoot,
  getRunSummary,
  getSelectionProfile,
  normalizeRoot,
  recordEventAnswered,
  recordEventShown,
  recordRunCompleted,
  recordRunStarted
};
