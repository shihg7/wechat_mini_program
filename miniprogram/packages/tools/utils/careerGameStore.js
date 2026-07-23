const { createId } = require("../../../utils/id");
const content = require("./careerGameContent");
const engine = require("./careerGameEngine");

const STORAGE_KEY = "toolbox_career_runs";
const SCHEMA_VERSION = 1;
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

function normalizeRun(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("生涯记录格式无效");
  const id = String(input.id || "").trim();
  if (!id) throw new Error("生涯记录缺少 id");
  const startedAt = String(input.startedAt || input.updatedAt || nowIso());
  const status = STATUSES.indexOf(input.status) >= 0 ? input.status : "interrupted";
  const phase = PHASES.indexOf(input.phase) >= 0
    ? input.phase
    : (status === "completed" ? "ending" : "scene");
  const run = {
    schemaVersion: SCHEMA_VERSION,
    id,
    playerName: cleanName(input.playerName),
    seed: String(input.seed == null ? id : input.seed),
    status,
    stageIndex: Math.max(0, Math.min(content.STAGES.length - 1, Number(input.stageIndex) || 0)),
    stageEventIds: (Array.isArray(input.stageEventIds) ? input.stageEventIds : []).map(String),
    eventCursor: Math.max(0, Number(input.eventCursor) || 0),
    currentSceneId: String(input.currentSceneId || ""),
    phase,
    stats: engine.normalizeStats(input.stats),
    flags: engine.normalizeFlags(input.flags),
    pendingEffects: normalizePendingEffects(input.pendingEffects),
    history: normalizeHistory(input.history),
    lastOutcome: clone(input.lastOutcome || null),
    chapterSummary: clone(input.chapterSummary || null),
    endingId: String(input.endingId || ""),
    startedAt,
    updatedAt: String(input.updatedAt || startedAt),
    completedAt: String(input.completedAt || "")
  };
  if (run.status === "completed") {
    run.phase = "ending";
    run.currentSceneId = "";
    if (!content.getEndingById(run.endingId)) throw new Error("生涯记录结局无效");
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
  return (Array.isArray(raw) ? raw : [])
    .map(normalizeStoredRun)
    .filter(Boolean)
    .sort(compareRuns)
    .map(clone);
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

function startRun(playerName, seed) {
  const runs = getRuns().map((run) => (
    run.status === "active" ? { ...run, status: "interrupted", updatedAt: nowIso() } : run
  ));
  const timestamp = nowIso();
  const run = engine.createInitialRun({
    id: createId("career"),
    playerName: cleanName(playerName),
    seed: seed == null ? createSeed() : seed,
    timestamp
  });
  setRuns([run].concat(runs));
  return getRunById(run.id);
}

function restartRun(playerName, seed) {
  return startRun(playerName, seed);
}

function applyChoice(runId, sceneId, choiceId) {
  const run = getRunById(runId);
  if (!run) throw new Error("找不到这段生涯");
  return updateRun(run.id, engine.resolveChoice(run, sceneId, choiceId, nowIso()));
}

function continueRun(runId) {
  const run = getRunById(runId);
  if (!run) throw new Error("找不到这段生涯");
  return updateRun(run.id, engine.continueRun(run, nowIso()));
}

function getCurrentView(runId) {
  const run = runId ? getRunById(runId) : getActiveRun();
  return run ? engine.buildView(run) : null;
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

module.exports = {
  MAX_NAME_LENGTH,
  PHASES,
  SCHEMA_VERSION,
  STATUSES,
  STORAGE_KEY,
  applyChoice,
  continueRun,
  getActiveRun,
  getCareerArchive,
  getCurrentView,
  getEndingProgress,
  getRunById,
  getRuns,
  normalizeRun,
  restartRun,
  setRuns,
  startRun
};
