const { createId } = require("../../../utils/id");
const content = require("./careerGameContent");
const engine = require("./careerGameEngine");
const careerMeta = require("./careerGameMeta");
const simulationStatsStore = require("./simulationStatsStore");
const simulationStatsMigration = require("./simulationStatsMigration");

const STORAGE_KEY = "toolbox_career_runs";
const SCHEMA_VERSION = engine.RUN_SCHEMA_VERSION;
const MAX_NAME_LENGTH = 12;
const STATUSES = ["active", "completed", "interrupted"];
const PHASES = ["scene", "outcome", "chapter", "ending"];

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function cleanName(value) {
  const name = String(value == null ? "" : value).trim().slice(0, MAX_NAME_LENGTH);
  if (!name) throw new Error("请输入角色昵称");
  return name;
}

function normalizePendingEffects(items) {
  return (Array.isArray(items) ? items : []).map((effect, index) => ({
    id: String(effect && effect.id || `pending_${index}`),
    triggerChoiceCount: Math.max(0, Number(effect && effect.triggerChoiceCount) || 0),
    effects: clone(effect && effect.effects || {}),
    addFlags: (effect && effect.addFlags || []).map(String),
    removeFlags: (effect && effect.removeFlags || []).map(String),
    narrative: String(effect && effect.narrative || "过去的选择产生了新的影响。")
  }));
}

function normalizeHistory(items) {
  return (Array.isArray(items) ? items : []).map((entry, index) => ({
    eventId: String(entry && entry.eventId || ""),
    eventTitle: String(entry && entry.eventTitle || ""),
    choiceId: String(entry && entry.choiceId || `choice_${index}`),
    choiceText: String(entry && entry.choiceText || ""),
    stageId: String(entry && entry.stageId || ""),
    tags: (entry && entry.tags || []).map(String),
    outcome: String(entry && entry.outcome || ""),
    deltas: clone(entry && entry.deltas || {}),
    chosenAt: String(entry && entry.chosenAt || "")
  })).filter((entry) => entry.eventId && entry.choiceId);
}

function deriveStageStartStats(input, stats, stageIndex, history) {
  if (input.stageStartStats && typeof input.stageStartStats === "object") {
    return engine.normalizeStats(input.stageStartStats);
  }
  const stage = content.STAGES[stageIndex];
  const approximate = { ...stats };
  (history || []).filter((entry) => stage && entry.stageId === stage.id).forEach((entry) => {
    Object.keys(entry.deltas || {}).forEach((key) => {
      approximate[key] = Number(approximate[key] || 0) - Number(entry.deltas[key] || 0);
    });
  });
  return engine.normalizeStats(approximate);
}

function normalizeRun(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("生涯记录格式无效");
  const id = String(input.id || "").trim();
  if (!id) throw new Error("生涯记录缺少 id");
  const startedAt = String(input.startedAt || input.updatedAt || nowIso());
  const status = STATUSES.indexOf(input.status) >= 0 ? input.status : "interrupted";
  const phase = PHASES.indexOf(input.phase) >= 0
    ? input.phase
    : (status === "completed" ? "ending" : "scene");
  const stageIndex = Math.max(0, Math.min(content.STAGES.length - 1, Number(input.stageIndex) || 0));
  const stats = engine.normalizeStats(input.stats);
  const history = normalizeHistory(input.history);
  const mode = careerMeta.normalizeMode(input.mode);
  const run = {
    schemaVersion: SCHEMA_VERSION,
    id,
    playerName: cleanName(input.playerName),
    seed: String(input.seed == null ? id : input.seed),
    mode,
    challengeDate: mode === careerMeta.MODE_DAILY
      ? careerMeta.localDateKey(input.challengeDate || startedAt)
      : "",
    runNumber: Math.max(1, Number(input.runNumber) || 1),
    status,
    stageIndex,
    stageEventIds: (Array.isArray(input.stageEventIds) ? input.stageEventIds : []).map(String),
    eventCursor: Math.max(0, Number(input.eventCursor) || 0),
    currentSceneId: String(input.currentSceneId || ""),
    phase,
    stats,
    stageStartStats: deriveStageStartStats(input, stats, stageIndex, history),
    flags: engine.normalizeFlags(input.flags),
    pendingEffects: normalizePendingEffects(input.pendingEffects),
    history,
    lastOutcome: clone(input.lastOutcome || null),
    chapterSummary: clone(input.chapterSummary || null),
    endingId: String(input.endingId || ""),
    startedAt,
    updatedAt: String(input.updatedAt || startedAt),
    completedAt: String(input.completedAt || "")
  };
  if (run.phase === "chapter" && (!run.chapterSummary || !run.chapterSummary.style)) {
    run.chapterSummary = careerMeta.getStageReport(run, run.stageIndex);
  }
  if (run.status === "completed") {
    run.phase = "ending";
    run.currentSceneId = "";
    if (!content.getEndingById(run.endingId)) throw new Error("生涯记录职业答案无效");
  }
  return engine.ensureStageSequence(run);
}

function normalizeStoredRun(input) {
  try {
    return normalizeRun(input);
  } catch (error) {
    return null;
  }
}

function compareRuns(left, right) {
  return String(right.updatedAt).localeCompare(String(left.updatedAt))
    || String(right.startedAt).localeCompare(String(left.startedAt))
    || String(right.id).localeCompare(String(left.id));
}

function getRuns() {
  const raw = wx.getStorageSync(STORAGE_KEY);
  const runs = (Array.isArray(raw) ? raw : [])
    .map(normalizeStoredRun)
    .filter(Boolean)
    .sort(compareRuns)
    .map(clone);
  try {
    simulationStatsMigration.ensureCareerStats(runs);
  } catch (error) {
    // Exploration statistics are optional and must never block local career saves.
  }
  return runs;
}

function setRuns(items) {
  const runs = (Array.isArray(items) ? items : []).map(normalizeRun);
  const ids = new Set();
  runs.forEach((run) => {
    if (ids.has(run.id)) throw new Error(`生涯记录 id 重复：${run.id}`);
    ids.add(run.id);
  });
  const active = runs.filter((run) => run.status === "active").sort(compareRuns);
  if (active.length > 1) {
    const keepId = active[0].id;
    runs.forEach((run) => {
      if (run.status === "active" && run.id !== keepId) run.status = "interrupted";
    });
  }
  runs.sort(compareRuns);
  wx.setStorageSync(STORAGE_KEY, runs);
  return clone(runs);
}

function getRunById(runId) {
  const id = String(runId || "");
  return getRuns().find((run) => run.id === id) || null;
}

function getActiveRun() {
  return getRuns().find((run) => run.status === "active") || null;
}

function updateRun(runId, nextRun) {
  const runs = getRuns();
  const index = runs.findIndex((run) => run.id === String(runId));
  if (index < 0) throw new Error("找不到这段生涯");
  runs[index] = normalizeRun(nextRun);
  setRuns(runs);
  return getRunById(runId);
}

function createSeed() {
  return `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

function normalizeStartOptions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      mode: careerMeta.MODE_FREE,
      challengeDate: "",
      seed: value == null ? createSeed() : value
    };
  }
  const mode = careerMeta.normalizeMode(value.mode);
  if (mode === careerMeta.MODE_DAILY) {
    const challenge = careerMeta.getDailyChallenge(value.challengeDate || new Date());
    return {
      mode,
      challengeDate: challenge.date,
      seed: value.seed == null ? challenge.seed : value.seed
    };
  }
  return {
    mode,
    challengeDate: "",
    seed: value.seed == null ? createSeed() : value.seed
  };
}

function getSelectionProfile() {
  try {
    return simulationStatsStore.getSelectionProfile(
      simulationStatsMigration.CAREER_ID,
      content.EVENTS.map((event) => event.id)
    );
  } catch (error) {
    return {
      runNumber: 1,
      completedRuns: 0,
      eventUsage: {},
      lastShownRuns: {},
      recentEventIds: []
    };
  }
}

function recordShown(run) {
  if (!run || run.status !== "active" || run.phase !== "scene" || !run.currentSceneId) return;
  try {
    simulationStatsStore.recordEventShown(
      simulationStatsMigration.CAREER_ID,
      run.id,
      run.currentSceneId
    );
  } catch (error) {
    // Exploration statistics are optional.
  }
}

function recordCompleted(run) {
  if (!run || run.status !== "completed") return;
  try {
    simulationStatsStore.recordRunCompleted(simulationStatsMigration.CAREER_ID, run.id);
  } catch (error) {
    // Exploration statistics are optional.
  }
}

function startRun(playerName, options) {
  const runs = getRuns().map((run) => (
    run.status === "active" ? { ...run, status: "interrupted", updatedAt: nowIso() } : run
  ));
  const timestamp = nowIso();
  const startOptions = normalizeStartOptions(options);
  const selectionProfile = getSelectionProfile();
  const run = engine.createInitialRun({
    id: createId("career"),
    playerName: cleanName(playerName),
    seed: startOptions.seed,
    mode: startOptions.mode,
    challengeDate: startOptions.challengeDate,
    selectionProfile,
    timestamp
  });
  setRuns([run].concat(runs));
  const saved = getRunById(run.id);
  try {
    simulationStatsStore.recordRunStarted(simulationStatsMigration.CAREER_ID, saved.id);
  } catch (error) {
    // Exploration statistics are optional.
  }
  recordShown(saved);
  return saved;
}

function restartRun(playerName, options) {
  return startRun(playerName, options);
}

function applyChoice(runId, sceneId, choiceId) {
  const run = getRunById(runId);
  if (!run) throw new Error("找不到这段生涯");
  const saved = updateRun(run.id, engine.resolveChoice(run, sceneId, choiceId, nowIso()));
  try {
    simulationStatsStore.recordEventAnswered(
      simulationStatsMigration.CAREER_ID,
      saved.id,
      sceneId
    );
  } catch (error) {
    // Exploration statistics are optional.
  }
  recordCompleted(saved);
  return saved;
}

function continueRun(runId) {
  const run = getRunById(runId);
  if (!run) throw new Error("找不到这段生涯");
  const saved = updateRun(
    run.id,
    engine.continueRun(run, nowIso(), getSelectionProfile())
  );
  recordShown(saved);
  recordCompleted(saved);
  return saved;
}

function getCurrentView(runId) {
  const run = runId ? getRunById(runId) : getActiveRun();
  if (!run) return null;
  recordShown(run);
  const achievements = getAchievementProgress();
  const exploration = getExplorationSummary();
  const runExploration = getRunExploration(run.id);
  return {
    ...engine.buildView(run),
    achievements: {
      total: achievements.total,
      unlocked: achievements.unlocked,
      percent: achievements.percent
    },
    exploration: {
      completedRuns: exploration.completedRuns,
      seenEventCount: exploration.seenEventCount,
      totalEventCount: exploration.totalEventCount,
      percent: Math.round(
        exploration.seenEventCount / Math.max(1, exploration.totalEventCount || content.EVENTS.length) * 100
      )
    },
    runExploration: runExploration ? {
      newCount: runExploration.newCount,
      repeatCount: runExploration.repeatCount,
      shownCount: runExploration.shownCount,
      newRate: Math.round(runExploration.newCount / Math.max(1, runExploration.shownCount) * 100),
      currentIsNew: runExploration.newEventIds.includes(run.currentSceneId)
    } : null
  };
}

function mapFinalStats(run) {
  const view = engine.buildView(run);
  return view ? view.stats : [];
}

function getKeyChoices(run) {
  const history = run.history || [];
  const significant = history.filter((entry) => (
    Object.keys(entry.deltas || {}).some((key) => Math.abs(Number(entry.deltas[key])) >= 7)
    || (entry.tags || []).indexOf("关键") >= 0
  ));
  const selected = significant.length ? significant : history;
  return selected.slice(-5).map((entry) => ({
    eventTitle: entry.eventTitle,
    choiceText: entry.choiceText,
    outcome: entry.outcome
  }));
}

function getCareerArchive() {
  return getRuns()
    .filter((run) => run.status !== "active")
    .map((run) => {
      const ending = content.getEndingById(run.endingId);
      const stage = content.STAGES[run.stageIndex] || content.STAGES[0];
      return {
        id: run.id,
        playerName: run.playerName,
        status: run.status,
        mode: careerMeta.getModeInfo(run),
        persona: careerMeta.getPersona(run),
        keywords: careerMeta.getTopKeywords(run, 3),
        endingId: run.endingId,
        endingTitle: ending ? ending.title : "未完成的生涯",
        stageTitle: stage ? stage.title : "",
        finalStats: mapFinalStats(run),
        choiceCount: run.history.length,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        updatedAt: run.updatedAt,
        keyChoices: getKeyChoices(run)
      };
    })
    .sort(compareRuns);
}

function getEndingProgress() {
  const unlockedIds = new Set(getRuns()
    .filter((run) => run.status === "completed" && run.endingId)
    .map((run) => run.endingId));
  const items = content.ENDINGS.map((ending) => ({
    id: ending.id,
    title: ending.title,
    hint: ending.hint,
    unlocked: unlockedIds.has(ending.id)
  }));
  return {
    total: items.length,
    unlocked: items.filter((item) => item.unlocked).length,
    items
  };
}

function getAchievementProgress() {
  return careerMeta.getAchievementProgress(getRuns());
}

function getEventDiscoveryProgress() {
  getRuns();
  const summary = getExplorationSummary();
  return {
    total: content.EVENTS.length,
    unlocked: summary.seenEventCount,
    percent: Math.round(summary.seenEventCount / Math.max(1, content.EVENTS.length) * 100)
  };
}

function getExplorationSummary() {
  try {
    return simulationStatsStore.getExplorationSummary(
      simulationStatsMigration.CAREER_ID,
      content.EVENTS.map((event) => event.id)
    );
  } catch (error) {
    return {
      startedRuns: 0,
      completedRuns: 0,
      seenEventCount: 0,
      totalEventCount: content.EVENTS.length,
      shownCount: 0,
      answeredCount: 0,
      recentEventIds: [],
      latestRun: null
    };
  }
}

function getRunExploration(runId) {
  try {
    return simulationStatsStore.getRunSummary(
      simulationStatsMigration.CAREER_ID,
      runId
    );
  } catch (error) {
    return null;
  }
}

function getContentStats() {
  return {
    eventCount: content.EVENTS.length,
    choicesPerRun: engine.TOTAL_EVENTS,
    endingCount: content.ENDINGS.length
  };
}

function getCollectionProgress() {
  const endings = getEndingProgress();
  const achievements = getAchievementProgress();
  const total = endings.total + achievements.total;
  const unlocked = endings.unlocked + achievements.unlocked;
  return {
    endings,
    achievements,
    total,
    unlocked,
    percent: Math.round(unlocked / Math.max(1, total) * 100)
  };
}

function buildCareerSummary(runId) {
  const run = getRunById(runId);
  if (!run) throw new Error("找不到这段生涯");
  const ending = content.getEndingById(run.endingId);
  return careerMeta.buildCareerSummary(run, ending && ending.title);
}

module.exports = {
  MAX_NAME_LENGTH,
  PHASES,
  SCHEMA_VERSION,
  STATUSES,
  STORAGE_KEY,
  applyChoice,
  buildCareerSummary,
  continueRun,
  getActiveRun,
  getAchievementProgress,
  getCareerArchive,
  getCollectionProgress,
  getContentStats,
  getCurrentView,
  getDailyChallenge: careerMeta.getDailyChallenge,
  getEndingProgress,
  getEventDiscoveryProgress,
  getExplorationSummary,
  getRunExploration,
  getRunById,
  getRuns,
  normalizeRun,
  restartRun,
  setRuns,
  startRun
};
