const {
  ENDINGS,
  EVENTS,
  STAGES,
  STAT_KEYS,
  STAT_META,
  getEndingById,
  getEventById
} = require("./careerGameContent");
const careerMeta = require("./careerGameMeta");

const RUN_SCHEMA_VERSION = 2;
const EVENTS_PER_STAGE = 6;
const POOL_EVENTS_PER_STAGE = 2;
const TOTAL_EVENTS = STAGES.length * EVENTS_PER_STAGE;
const INITIAL_STATS = {
  tech: 45,
  communication: 45,
  energy: 65,
  savings: 30,
  influence: 35
};

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeStats(input = {}) {
  return STAT_KEYS.reduce((stats, key) => {
    const fallback = Number(INITIAL_STATS[key] || 0);
    const value = Number(input[key]);
    stats[key] = clamp(Number.isFinite(value) ? Math.round(value) : fallback, 0, 100);
    return stats;
  }, {});
}

function normalizeFlags(input) {
  if (Array.isArray(input)) {
    return input.reduce((flags, key) => {
      const name = String(key || "").trim();
      if (name) flags[name] = true;
      return flags;
    }, {});
  }
  if (!input || typeof input !== "object") return {};
  return Object.keys(input).reduce((flags, key) => {
    if (input[key]) flags[String(key)] = true;
    return flags;
  }, {});
}

function hashSeed(value) {
  const source = String(value == null ? "" : value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function seededShuffle(items, seed) {
  const result = items.slice();
  const random = createRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    const current = result[index];
    result[index] = result[target];
    result[target] = current;
  }
  return result;
}

function historyCount(history, key) {
  return (Array.isArray(history) ? history : []).filter((entry) => (
    String(entry.eventId || "") === String(key)
    || String(entry.choiceId || "") === String(key)
  )).length;
}

function compareRequirement(actual, requirement) {
  const operator = requirement.op || "truthy";
  const expected = requirement.value;
  if (operator === "gte") return Number(actual) >= Number(expected);
  if (operator === "lte") return Number(actual) <= Number(expected);
  if (operator === "gt") return Number(actual) > Number(expected);
  if (operator === "lt") return Number(actual) < Number(expected);
  if (operator === "eq") return actual === expected;
  if (operator === "neq") return actual !== expected;
  if (operator === "falsy") return !actual;
  return !!actual;
}

function matchesRequirements(requirements, state = {}) {
  return (Array.isArray(requirements) ? requirements : []).every((requirement) => {
    if (!requirement || typeof requirement !== "object") return true;
    let actual;
    if (requirement.type === "stat") {
      actual = Number(state.stats && state.stats[requirement.key] || 0);
    } else if (requirement.type === "flag") {
      actual = !!(state.flags && state.flags[requirement.key]);
    } else if (requirement.type === "history") {
      actual = historyCount(state.history, requirement.key);
    } else {
      return false;
    }
    return compareRequirement(actual, requirement);
  });
}

function applyEffects(stats, effects = {}) {
  const next = normalizeStats(stats);
  const deltas = {};
  STAT_KEYS.forEach((key) => {
    const requested = Number(effects[key] || 0);
    if (!Number.isFinite(requested) || requested === 0) return;
    const previous = next[key];
    next[key] = clamp(previous + Math.round(requested), 0, 100);
    const actual = next[key] - previous;
    if (actual) deltas[key] = actual;
  });
  return { stats: next, deltas };
}

function applyFlagChanges(flags, addFlags, removeFlags) {
  const next = normalizeFlags(flags);
  (Array.isArray(addFlags) ? addFlags : []).forEach((key) => {
    const name = String(key || "").trim();
    if (name) next[name] = true;
  });
  (Array.isArray(removeFlags) ? removeFlags : []).forEach((key) => {
    delete next[String(key || "")];
  });
  return next;
}

function getAvailableChoices(event, state) {
  if (!event) return [];
  return (Array.isArray(event.choices) ? event.choices : [])
    .filter((choice) => matchesRequirements(choice.requirements, state))
    .map(clone);
}

function selectPoolEventIds(stage, run) {
  const candidates = (stage.poolEventIds || [])
    .map(getEventById)
    .filter(Boolean);
  const eligible = candidates.filter((event) => matchesRequirements(event.requirements, run));
  const fallback = candidates.filter((event) => !eligible.some((item) => item.id === event.id));
  const sortByPriority = (items, suffix) => seededShuffle(
    items,
    `${run.seed}:${stage.id}:${run.history.length}:${suffix}`
  ).sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
  return sortByPriority(eligible, "eligible")
    .concat(sortByPriority(fallback, "fallback"))
    .slice(0, POOL_EVENTS_PER_STAGE)
    .map((event) => event.id);
}

function buildStageEventIds(stageIndex, run) {
  const stage = STAGES[stageIndex];
  if (!stage) return [];
  const core = (stage.coreEventIds || []).slice(0, EVENTS_PER_STAGE - POOL_EVENTS_PER_STAGE);
  return core.concat(selectPoolEventIds(stage, run)).slice(0, EVENTS_PER_STAGE);
}

function ensureStageSequence(run) {
  const next = clone(run);
  next.schemaVersion = RUN_SCHEMA_VERSION;
  next.mode = careerMeta.normalizeMode(next.mode);
  next.challengeDate = next.mode === careerMeta.MODE_DAILY
    ? careerMeta.localDateKey(next.challengeDate || next.startedAt)
    : "";
  next.stageStartStats = normalizeStats(next.stageStartStats || next.stats);
  const stage = STAGES[next.stageIndex];
  const validIds = (next.stageEventIds || []).filter((eventId) => {
    const event = getEventById(eventId);
    return event && stage && event.stageId === stage.id;
  });
  next.stageEventIds = validIds.length === EVENTS_PER_STAGE
    ? validIds
    : buildStageEventIds(next.stageIndex, next);
  next.eventCursor = clamp(Number(next.eventCursor) || 0, 0, Math.max(next.stageEventIds.length - 1, 0));
  if (next.status === "active" && next.phase !== "ending") {
    next.currentSceneId = next.stageEventIds[next.eventCursor] || "";
  }
  return next;
}

function createInitialRun({
  id,
  playerName,
  seed,
  timestamp,
  mode = careerMeta.MODE_FREE,
  challengeDate = ""
}) {
  const startedAt = String(timestamp || new Date().toISOString());
  const normalizedMode = careerMeta.normalizeMode(mode);
  const run = {
    schemaVersion: RUN_SCHEMA_VERSION,
    id: String(id),
    playerName: String(playerName),
    seed: String(seed),
    mode: normalizedMode,
    challengeDate: normalizedMode === careerMeta.MODE_DAILY
      ? careerMeta.localDateKey(challengeDate || startedAt)
      : "",
    status: "active",
    stageIndex: 0,
    stageEventIds: [],
    eventCursor: 0,
    currentSceneId: "",
    phase: "scene",
    stats: normalizeStats(INITIAL_STATS),
    stageStartStats: normalizeStats(INITIAL_STATS),
    flags: {},
    pendingEffects: [],
    history: [],
    lastOutcome: null,
    chapterSummary: null,
    endingId: "",
    startedAt,
    updatedAt: startedAt,
    completedAt: ""
  };
  return ensureStageSequence(run);
}

function schedulePendingEffects(run, effects) {
  const currentChoiceCount = run.history.length;
  const additions = (Array.isArray(effects) ? effects : []).map((effect, index) => ({
    id: String(effect.id || `pending_${run.currentSceneId}_${currentChoiceCount}_${index}`),
    triggerChoiceCount: currentChoiceCount + Math.max(0, Number(effect.delay) || 0),
    effects: clone(effect.effects || {}),
    addFlags: (effect.addFlags || []).map(String),
    removeFlags: (effect.removeFlags || []).map(String),
    narrative: String(effect.narrative || "过去的选择产生了新的影响。")
  }));
  return (run.pendingEffects || []).concat(additions);
}

function applyDuePendingEffects(run) {
  const due = [];
  const waiting = [];
  (run.pendingEffects || []).forEach((effect) => {
    if (Number(effect.triggerChoiceCount) <= run.history.length) due.push(effect);
    else waiting.push(effect);
  });
  const echoes = [];
  due.forEach((effect) => {
    const applied = applyEffects(run.stats, effect.effects);
    run.stats = applied.stats;
    run.flags = applyFlagChanges(run.flags, effect.addFlags, effect.removeFlags);
    echoes.push({
      id: effect.id,
      text: effect.narrative,
      deltas: applied.deltas
    });
  });
  run.pendingEffects = waiting;
  return echoes;
}

function completeWithEnding(run, endingId, timestamp) {
  const ending = getEndingById(endingId);
  if (!ending) throw new Error(`未知职业答案：${endingId}`);
  run.status = "completed";
  run.phase = "ending";
  run.endingId = ending.id;
  run.currentSceneId = "";
  run.completedAt = timestamp;
  run.updatedAt = timestamp;
  return run;
}

function resolveChoice(sourceRun, sceneId, choiceId, timestamp = new Date().toISOString()) {
  const run = ensureStageSequence(sourceRun);
  if (run.status !== "active" || run.phase !== "scene") throw new Error("当前不能进行选择");
  if (String(run.currentSceneId) !== String(sceneId)) throw new Error("剧情已推进，请刷新后重试");
  const event = getEventById(sceneId);
  if (!event) throw new Error("找不到当前剧情");
  const choice = getAvailableChoices(event, run).find((item) => String(item.id) === String(choiceId));
  if (!choice) throw new Error("这个选择当前不可用");

  const immediate = applyEffects(run.stats, choice.effects);
  run.stats = immediate.stats;
  run.flags = applyFlagChanges(run.flags, choice.addFlags, choice.removeFlags);
  run.history.push({
    eventId: event.id,
    eventTitle: event.title,
    choiceId: choice.id,
    choiceText: choice.text,
    stageId: event.stageId,
    tags: (choice.tags || []).map(String),
    outcome: String(choice.outcome || ""),
    deltas: immediate.deltas,
    chosenAt: timestamp
  });
  run.pendingEffects = schedulePendingEffects(run, choice.pendingEffects);
  const echoes = applyDuePendingEffects(run);
  run.lastOutcome = {
    eventId: event.id,
    choiceId: choice.id,
    text: String(choice.outcome || ""),
    deltas: immediate.deltas,
    echoes
  };
  run.chapterSummary = null;
  run.updatedAt = timestamp;
  if (choice.endingId) return completeWithEnding(run, choice.endingId, timestamp);
  run.phase = "outcome";
  return run;
}

function resolveEnding(run) {
  const sorted = ENDINGS.slice().sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
  return sorted.find((ending) => matchesRequirements(ending.requirements, run)) || sorted[sorted.length - 1];
}

function continueRun(sourceRun, timestamp = new Date().toISOString()) {
  const run = ensureStageSequence(sourceRun);
  if (run.status !== "active") return run;
  if (run.phase === "outcome") {
    const nextCursor = run.eventCursor + 1;
    if (nextCursor < run.stageEventIds.length) {
      run.eventCursor = nextCursor;
      run.currentSceneId = run.stageEventIds[nextCursor];
      run.phase = "scene";
    } else if (run.stageIndex >= STAGES.length - 1) {
      const ending = resolveEnding(run);
      return completeWithEnding(run, ending.id, timestamp);
    } else {
      run.phase = "chapter";
      run.currentSceneId = "";
      run.chapterSummary = careerMeta.getStageReport(run, run.stageIndex);
    }
  } else if (run.phase === "chapter") {
    run.stageIndex += 1;
    run.stageEventIds = buildStageEventIds(run.stageIndex, run);
    run.eventCursor = 0;
    run.currentSceneId = run.stageEventIds[0] || "";
    run.phase = "scene";
    run.stageStartStats = normalizeStats(run.stats);
    run.chapterSummary = null;
    run.lastOutcome = null;
  }
  run.updatedAt = timestamp;
  return ensureStageSequence(run);
}

function statView(stats) {
  return STAT_KEYS.map((key) => ({
    key,
    label: STAT_META[key] && STAT_META[key].label || key,
    value: Number(stats[key] || 0),
    tone: STAT_META[key] && STAT_META[key].tone || "blue",
    warning: Number(stats[key] || 0) <= 15
  }));
}

function deltaView(deltas) {
  return STAT_KEYS.filter((key) => Number(deltas && deltas[key])).map((key) => ({
    key,
    label: STAT_META[key] && STAT_META[key].label || key,
    value: Number(deltas[key]),
    tone: Number(deltas[key]) > 0 ? "green" : "accent"
  }));
}

function buildView(sourceRun) {
  if (!sourceRun) return null;
  const run = ensureStageSequence(sourceRun);
  const stage = STAGES[run.stageIndex] || STAGES[STAGES.length - 1];
  const event = run.phase === "scene" ? getEventById(run.currentSceneId) : null;
  const ending = run.endingId ? getEndingById(run.endingId) : null;
  const choiceCount = run.history.length;
  const persona = careerMeta.getPersona(run);
  const signal = careerMeta.getCareerSignal(run);
  return {
    runId: run.id,
    playerName: run.playerName,
    status: run.status,
    phase: run.phase,
    mode: careerMeta.getModeInfo(run),
    persona,
    signal,
    keywords: careerMeta.getTopKeywords(run, 3),
    foreshadowCount: (run.pendingEffects || []).length,
    foreshadowText: (run.pendingEffects || []).length
      ? `${run.pendingEffects.length} 个选择仍在发酵`
      : "当前没有未结算的远期后果",
    stage: stage ? {
      id: stage.id,
      index: stage.index,
      title: stage.title,
      rank: stage.rank,
      subtitle: stage.subtitle,
      illustration: stage.illustration
    } : null,
    stats: statView(run.stats),
    progress: {
      current: Math.min(choiceCount + (run.phase === "scene" ? 1 : 0), TOTAL_EVENTS),
      total: TOTAL_EVENTS,
      chapterCurrent: run.phase === "chapter"
        ? EVENTS_PER_STAGE
        : Math.min(run.eventCursor + 1, EVENTS_PER_STAGE),
      chapterTotal: EVENTS_PER_STAGE
    },
    scene: event ? {
      id: event.id,
      kind: event.kind,
      kindLabel: event.kind === "pool" ? "命运支线" : "职业主线",
      title: event.title,
      body: event.body,
      choices: getAvailableChoices(event, run).map((choice) => ({
        id: choice.id,
        text: choice.text,
        tags: (choice.tags || []).map(String)
      }))
    } : null,
    outcome: run.lastOutcome ? {
      text: run.lastOutcome.text,
      deltas: deltaView(run.lastOutcome.deltas),
      echoes: (run.lastOutcome.echoes || []).map((echo) => ({
        id: echo.id,
        text: echo.text,
        deltas: deltaView(echo.deltas)
      }))
    } : null,
    chapter: run.chapterSummary ? clone(run.chapterSummary) : null,
    ending: ending ? {
      id: ending.id,
      title: ending.title,
      summary: ending.summary,
      hint: ending.hint
    } : null
  };
}

module.exports = {
  EVENTS_PER_STAGE,
  INITIAL_STATS,
  POOL_EVENTS_PER_STAGE,
  RUN_SCHEMA_VERSION,
  TOTAL_EVENTS,
  applyEffects,
  buildStageEventIds,
  buildView,
  continueRun,
  createInitialRun,
  createRandom,
  ensureStageSequence,
  getAvailableChoices,
  matchesRequirements,
  normalizeFlags,
  normalizeStats,
  resolveChoice,
  resolveEnding,
  seededShuffle
};
