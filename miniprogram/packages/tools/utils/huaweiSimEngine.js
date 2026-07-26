const {
  EVENTS,
  GLOSSARY,
  PERSONAS,
  STAGES,
  STAT_KEYS,
  STAT_META
} = require("./huaweiSimContent");

const EVENTS_PER_STAGE = 3;
const TOTAL_EVENTS = STAGES.length * EVENTS_PER_STAGE;
const INITIAL_STATS = {
  delivery: 52,
  tech: 52,
  energy: 72,
  influence: 48
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
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

function normalizeStats(input = {}) {
  return STAT_KEYS.reduce((result, key) => {
    const value = Number(input[key]);
    result[key] = clamp(Number.isFinite(value) ? Math.round(value) : INITIAL_STATS[key], 0, 100);
    return result;
  }, {});
}

function normalizeSelectionProfile(options = {}) {
  const seenEventIds = new Set(
    (Array.isArray(options.seenEventIds) ? options.seenEventIds : [])
      .map((item) => String(item || ""))
  );
  const sourceUsage = options.eventUsage && typeof options.eventUsage === "object"
    ? options.eventUsage
    : {};
  const eventUsage = {};
  EVENTS.forEach((item) => {
    const count = Math.max(0, Math.floor(Number(sourceUsage[item.id]) || 0));
    if (count > 0) eventUsage[item.id] = count;
    else if (seenEventIds.has(item.id)) eventUsage[item.id] = 1;
  });
  return {
    runNumber: Math.max(1, Math.floor(Number(options.runNumber) || 1)),
    eventUsage,
    recentEventIds: new Set(
      (Array.isArray(options.recentEventIds) ? options.recentEventIds : [])
        .map((item) => String(item || ""))
    )
  };
}

function eventUsage(profile, eventId) {
  return Number(profile.eventUsage[eventId] || 0);
}

function orderUsedEvents(items, seed, profile) {
  return items
    .map((item) => ({
      item,
      usage: eventUsage(profile, item.id),
      tieBreaker: hashSeed(`${seed}:${item.id}`)
    }))
    .sort((left, right) => left.usage - right.usage || left.tieBreaker - right.tieBreaker)
    .map((entry) => entry.item);
}

function orderStageCandidates(candidates, seed, profile) {
  const newlyUnlocked = [];
  const unseen = [];
  const used = [];
  const recentlyUsed = [];
  candidates.forEach((item) => {
    const usage = eventUsage(profile, item.id);
    if (usage === 0 && profile.runNumber > 1 && Number(item.unlockRun || 1) === profile.runNumber) {
      newlyUnlocked.push(item);
    } else if (usage === 0) {
      unseen.push(item);
    } else if (profile.recentEventIds.has(item.id)) {
      recentlyUsed.push(item);
    } else {
      used.push(item);
    }
  });
  return []
    .concat(seededShuffle(newlyUnlocked, `${seed}:newly-unlocked`))
    .concat(seededShuffle(unseen, `${seed}:unseen`))
    .concat(orderUsedEvents(used, `${seed}:used`, profile))
    .concat(orderUsedEvents(recentlyUsed, `${seed}:recent`, profile));
}

function buildEventIds(seed, options = {}) {
  const profile = normalizeSelectionProfile(options);
  return STAGES.flatMap((stage) => {
    const candidates = EVENTS.filter((item) => (
      item.stageId === stage.id
      && Number(item.unlockRun || 1) <= profile.runNumber
    ));
    return orderStageCandidates(candidates, `${seed}:${stage.id}`, profile)
      .slice(0, EVENTS_PER_STAGE)
      .map((item) => item.id);
  });
}

function getEventById(id) {
  return EVENTS.find((item) => item.id === String(id || "")) || null;
}

function getGlossaryById(id) {
  return GLOSSARY.find((item) => item.id === String(id || "")) || null;
}

function getStageById(id) {
  return STAGES.find((item) => item.id === String(id || "")) || null;
}

function createRun(options = {}) {
  const timestamp = String(options.timestamp || new Date().toISOString());
  const seed = String(options.seed || timestamp);
  const profile = normalizeSelectionProfile(options);
  const eventIds = buildEventIds(seed, options);
  return {
    schemaVersion: 1,
    seed,
    runNumber: profile.runNumber,
    status: "active",
    phase: "scene",
    eventIds,
    newEventIds: eventIds.filter((id) => eventUsage(profile, id) === 0),
    replayEventIds: eventIds.filter((id) => Number(getEventById(id).unlockRun || 1) > 1),
    availableEventCount: EVENTS.filter((item) => Number(item.unlockRun || 1) <= profile.runNumber).length,
    eventIndex: 0,
    stats: normalizeStats(INITIAL_STATS),
    history: [],
    lastOutcome: null,
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: ""
  };
}

function getCurrentEvent(run) {
  if (!run || run.status !== "active") return null;
  return getEventById(run.eventIds[run.eventIndex]);
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

function resolveChoice(sourceRun, eventId, choiceId, timestamp = new Date().toISOString()) {
  const run = clone(sourceRun);
  if (!run || run.status !== "active" || run.phase !== "scene") {
    throw new Error("当前不能重复选择");
  }
  const current = getCurrentEvent(run);
  if (!current || current.id !== String(eventId || "")) {
    throw new Error("情景已经变化，请重新确认");
  }
  const selected = current.choices.find((item) => item.id === String(choiceId || ""));
  if (!selected) throw new Error("找不到这个选项");

  const applied = applyEffects(run.stats, selected.effects);
  run.stats = applied.stats;
  run.phase = "feedback";
  run.lastOutcome = {
    eventId: current.id,
    eventTitle: current.title,
    stageId: current.stageId,
    termId: current.termId,
    choiceId: selected.id,
    choiceText: selected.text,
    outcome: selected.outcome,
    tags: selected.tags.slice(),
    deltas: applied.deltas
  };
  run.history.push(clone(run.lastOutcome));
  run.updatedAt = String(timestamp);
  return run;
}

function continueRun(sourceRun, timestamp = new Date().toISOString()) {
  const run = clone(sourceRun);
  if (!run || run.status !== "active" || run.phase !== "feedback") {
    throw new Error("请先完成当前选择");
  }
  if (run.eventIndex >= run.eventIds.length - 1) {
    run.status = "completed";
    run.phase = "result";
    run.completedAt = String(timestamp);
  } else {
    run.eventIndex += 1;
    run.phase = "scene";
  }
  run.lastOutcome = null;
  run.updatedAt = String(timestamp);
  return run;
}

function selectPersona(stats) {
  const normalized = normalizeStats(stats);
  const values = STAT_KEYS.map((key) => normalized[key]);
  const spread = Math.max(...values) - Math.min(...values);
  let id = "grain-deliverer";

  if (normalized.energy <= 25) id = "burnout-warning";
  else if (spread <= 14 && Math.min(...values) >= 55) id = "e2e-generalist";
  else if (normalized.tech >= 72 && normalized.delivery >= 62) id = "tr-guardian";
  else if (normalized.tech >= 72) id = "black-soil-builder";
  else if (normalized.influence >= 72 && normalized.delivery >= 62) id = "frontline-caller";
  else if (normalized.influence >= 68) id = "process-translator";
  else if (normalized.energy >= 76) id = "sustainable-striver";

  return PERSONAS.find((item) => item.id === id) || PERSONAS[0];
}

function buildResult(run) {
  if (!run) throw new Error("缺少模拟数据");
  const stats = normalizeStats(run.stats);
  const persona = selectPersona(stats);
  const tagCounts = {};
  (run.history || []).forEach((entry) => {
    (entry.tags || []).forEach((tag) => {
      tagCounts[tag] = Number(tagCounts[tag] || 0) + 1;
    });
  });
  const keywords = Object.keys(tagCounts)
    .sort((left, right) => tagCounts[right] - tagCounts[left] || left.localeCompare(right))
    .slice(0, 4);
  return {
    persona: clone(persona),
    stats,
    keywords,
    choiceCount: (run.history || []).length,
    history: clone(run.history || [])
  };
}

function formatSummary(run) {
  const result = buildResult(run);
  const statText = STAT_KEYS.map((key) => `${STAT_META[key].label} ${result.stats[key]}`).join("｜");
  const keywordText = result.keywords.length ? `\n路线关键词：${result.keywords.join("、")}` : "";
  return [
    `我的华子研发情景模拟结果：${result.persona.title}`,
    result.persona.subtitle,
    statText,
    `${result.choiceCount} 次选择全部在本地完成。${keywordText}`,
    "非官方情景模拟，术语来自公开资料；网络职场叙事已单独标记，情景为虚构复合创作。"
  ].join("\n");
}

function searchGlossary(query, category = "all") {
  const keyword = String(query || "").trim().toLocaleLowerCase();
  return GLOSSARY.filter((item) => {
    if (category && category !== "all" && item.category !== category) return false;
    if (!keyword) return true;
    return [item.term, item.plain, item.usage, item.sourceLabel]
      .join(" ")
      .toLocaleLowerCase()
      .includes(keyword);
  }).map(clone);
}

module.exports = {
  EVENTS_PER_STAGE,
  INITIAL_STATS,
  TOTAL_EVENTS,
  applyEffects,
  buildEventIds,
  buildResult,
  continueRun,
  createRun,
  formatSummary,
  getCurrentEvent,
  getEventById,
  getGlossaryById,
  getStageById,
  normalizeStats,
  normalizeSelectionProfile,
  resolveChoice,
  searchGlossary,
  selectPersona
};
