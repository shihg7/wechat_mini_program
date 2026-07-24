const assert = require("assert");

const memory = {};
global.wx = {
  getStorageSync(key) {
    return memory[key];
  },
  setStorageSync(key, value) {
    memory[key] = JSON.parse(JSON.stringify(value));
  }
};

const content = require("../miniprogram/packages/tools/utils/careerGameContent");
const engine = require("../miniprogram/packages/tools/utils/careerGameEngine");
const store = require("../miniprogram/packages/tools/utils/careerGameStore");

assert.strictEqual(content.STAGES.length, 6);
assert.strictEqual(content.ENDINGS.length, 12);
assert.deepStrictEqual(Object.keys(engine.INITIAL_STATS).sort(), content.STAT_KEYS.slice().sort());
content.STAT_KEYS.forEach((key) => {
  assert.strictEqual(engine.applyEffects({ ...engine.INITIAL_STATS, [key]: 98 }, { [key]: 10 }).stats[key], 100);
  assert.strictEqual(engine.applyEffects({ ...engine.INITIAL_STATS, [key]: 2 }, { [key]: -10 }).stats[key], 0);
});

const shuffledA = engine.seededShuffle(["a", "b", "c", "d"], "same-seed");
const shuffledB = engine.seededShuffle(["a", "b", "c", "d"], "same-seed");
assert.deepStrictEqual(shuffledA, shuffledB, "seeded event selection must be reproducible");
assert(engine.matchesRequirements([
  { type: "stat", key: "tech", op: "gte", value: 40 },
  { type: "flag", key: "trusted", op: "truthy" }
], { stats: { tech: 50 }, flags: { trusted: true }, history: [] }));

const runA = engine.createInitialRun({
  id: "run_a",
  playerName: "小码",
  seed: "fixed-seed",
  timestamp: "2026-07-24T00:00:00.000Z"
});
const runB = engine.createInitialRun({
  id: "run_b",
  playerName: "小码",
  seed: "fixed-seed",
  timestamp: "2026-07-24T00:00:00.000Z"
});
assert.deepStrictEqual(runA.stageEventIds, runB.stageEventIds);
assert.strictEqual(runA.stageEventIds.length, engine.EVENTS_PER_STAGE);
assert.strictEqual(runA.schemaVersion, 2);
assert.strictEqual(runA.mode, "free");
assert.deepStrictEqual(runA.stageStartStats, engine.INITIAL_STATS);
assert.deepStrictEqual(
  engine.ensureStageSequence({ ...runA, stageEventIds: runA.stageEventIds }).stageEventIds,
  runA.stageEventIds,
  "expanded pools must not rewrite an active v2 stage sequence"
);
content.STAGES.forEach((stage, stageIndex) => {
  const baselineState = {
    stats: engine.INITIAL_STATS,
    flags: {},
    history: []
  };
  const baselineEligible = stage.poolEventIds.filter((eventId) => (
    engine.matchesRequirements(content.getEventById(eventId).requirements, baselineState)
  ));
  const seen = new Set();
  for (let seedIndex = 0; seedIndex < 400; seedIndex += 1) {
    engine.buildStageEventIds(stageIndex, {
      ...baselineState,
      seed: `coverage-${stageIndex}-${seedIndex}`
    }).slice(4).forEach((eventId) => seen.add(eventId));
  }
  baselineEligible.forEach((eventId) => {
    assert(seen.has(eventId), `${eventId} should be reachable through seeded pool selection`);
  });
});

const dailyRunA = engine.createInitialRun({
  id: "daily_a",
  playerName: "小码",
  seed: "career-daily-v1:2026-07-24",
  mode: "daily",
  challengeDate: "2026-07-24",
  timestamp: "2026-07-24T00:00:00.000Z"
});
const dailyRunB = engine.createInitialRun({
  id: "daily_b",
  playerName: "小码",
  seed: "career-daily-v1:2026-07-24",
  mode: "daily",
  challengeDate: "2026-07-24",
  timestamp: "2026-07-24T08:00:00.000Z"
});
assert.deepStrictEqual(dailyRunA.stageEventIds, dailyRunB.stageEventIds);
assert.strictEqual(dailyRunA.challengeDate, "2026-07-24");
const stageTwoWithoutDocs = engine.buildStageEventIds(1, {
  ...runA,
  stageIndex: 1,
  flags: {},
  history: []
});
const stageTwoWithDocs = engine.buildStageEventIds(1, {
  ...runA,
  stageIndex: 1,
  flags: { documentation: true },
  history: []
});
assert(!stageTwoWithoutDocs.includes("s2_p1_docs"));
assert(stageTwoWithDocs.includes("s2_p1_docs"), "an earlier documentation choice should unlock its future event");
const stageTwoWithAiHistory = engine.buildStageEventIds(1, {
  ...runA,
  stageIndex: 1,
  flags: {},
  history: [{ eventId: "s1_x1_ai_pair", choiceId: "s1_x1_ai_pair_a" }]
});
assert(stageTwoWithAiHistory.includes("s2_x1_ai_bug"), "verified AI use should unlock its later incident");
const stageTwoWithoutAiHistory = engine.buildStageEventIds(1, {
  ...runA,
  stageIndex: 1,
  flags: {},
  history: []
});
assert(!stageTwoWithoutAiHistory.includes("s2_x1_ai_bug"), "AI echo must stay hidden without its earlier choice");
const themedRun = {
  ...runA,
  stageEventIds: content.STAGES[0].coreEventIds.concat(["s1_x1_ai_pair", "s1_x3_accessibility"]),
  eventCursor: 4,
  currentSceneId: "s1_x1_ai_pair"
};
assert.strictEqual(engine.buildView(themedRun).scene.kindLabel, "AI 时代");
const lowEnergyStage = engine.buildStageEventIds(4, {
  ...runA,
  stageIndex: 4,
  stats: { ...runA.stats, energy: 15 },
  history: []
});
assert(lowEnergyStage.includes("s5_p5_family"), "low energy should prioritize the recovery event");
content.ENDINGS.forEach((ending) => {
  const targetState = {
    stats: { ...engine.INITIAL_STATS },
    flags: {},
    history: []
  };
  ending.requirements.forEach((requirement) => {
    if (requirement.type === "flag") targetState.flags[requirement.key] = requirement.value;
    if (requirement.type === "stat") {
      targetState.stats[requirement.key] = requirement.op === "lte"
        ? requirement.value
        : requirement.value;
    }
  });
  assert.strictEqual(
    engine.resolveEnding(targetState).id,
    ending.id,
    `ending should be reachable with its curated condition set: ${ending.title}`
  );
});

const upgradedLegacyRun = store.normalizeRun((() => {
  const legacy = { ...runA, schemaVersion: 1 };
  delete legacy.mode;
  delete legacy.challengeDate;
  delete legacy.stageStartStats;
  return legacy;
})());
assert.strictEqual(upgradedLegacyRun.schemaVersion, 2);
assert.strictEqual(upgradedLegacyRun.mode, "free");
assert.deepStrictEqual(upgradedLegacyRun.stageStartStats, upgradedLegacyRun.stats);

store.setRuns([]);
const dailyStoredA = store.startRun("今日小码", { mode: "daily", challengeDate: "2026-07-24" });
const dailyStoredB = store.restartRun("今日小码", { mode: "daily", challengeDate: "2026-07-24" });
assert.strictEqual(dailyStoredA.mode, "daily");
assert.strictEqual(dailyStoredB.seed, dailyStoredA.seed);
assert.deepStrictEqual(dailyStoredB.stageEventIds, dailyStoredA.stageEventIds);
store.setRuns([]);
assert.throws(() => store.startRun("   ", "seed"), /昵称/);
const started = store.startRun("  小码  ", "stable-seed");
assert.strictEqual(started.playerName, "小码");
assert.strictEqual(store.getActiveRun().id, started.id);
let view = store.getCurrentView();
assert.strictEqual(view.phase, "scene");
assert.strictEqual(view.scene.choices.length >= 2, true);
assert.strictEqual(store.getContentStats().eventCount, 120);
assert.strictEqual(store.getContentStats().choicesPerRun, 36);
assert.strictEqual(store.getEventDiscoveryProgress().total, 120);
assert.strictEqual(view.persona.id, "uncompiled");
assert.strictEqual(view.achievements.total, 12);

const firstChoice = view.scene.choices[0];
store.applyChoice(view.runId, view.scene.id, firstChoice.id);
assert.strictEqual(store.getEventDiscoveryProgress().unlocked, 1);
view = store.getCurrentView();
assert.strictEqual(view.phase, "outcome");
assert.throws(
  () => store.applyChoice(view.runId, view.outcome.eventId, firstChoice.id),
  /不能进行选择/,
  "the same choice must not settle twice"
);
store.continueRun(view.runId);
assert.strictEqual(store.getCurrentView().phase, "scene");

const interrupted = store.getActiveRun();
const restarted = store.restartRun("重开的人", "second-seed");
assert.notStrictEqual(restarted.id, interrupted.id);
assert.strictEqual(store.getRunById(interrupted.id).status, "interrupted");
assert(store.getCareerArchive().some((run) => run.id === interrupted.id));

let safety = 0;
let chapterReportSeen = false;
while (store.getActiveRun() && safety < 120) {
  const current = store.getCurrentView();
  if (current.phase === "scene") {
    const choice = current.scene.choices.find((item) => {
      const sourceEvent = content.getEventById(current.scene.id);
      const sourceChoice = sourceEvent.choices.find((entry) => entry.id === item.id);
      return !sourceChoice.endingId;
    }) || current.scene.choices[0];
    store.applyChoice(current.runId, current.scene.id, choice.id);
  } else {
    if (current.phase === "chapter") {
      chapterReportSeen = true;
      assert(current.chapter.style.title);
      assert.strictEqual(current.chapter.deltas.length, 5);
      assert(current.chapter.nextTitle);
    }
    store.continueRun(current.runId);
  }
  safety += 1;
}
assert(safety < 120, "a complete career should terminate");
assert(chapterReportSeen, "a full run should expose chapter reports");
const completed = store.getRuns().find((run) => run.status === "completed");
assert(completed && completed.endingId);
assert.strictEqual(completed.history.length, engine.TOTAL_EVENTS);
assert(store.getEventDiscoveryProgress().unlocked >= engine.TOTAL_EVENTS);
assert.strictEqual(store.getEndingProgress().unlocked, 1);
assert(store.getAchievementProgress().unlocked >= 3);
const careerSummary = store.buildCareerSummary(completed.id);
assert(careerSummary.includes(completed.playerName));
assert(careerSummary.includes("职业画像"));

store.setRuns([
  { ...started, id: "older_active", updatedAt: "2026-07-24T00:00:00.000Z", status: "active" },
  { ...restarted, id: "newer_active", updatedAt: "2026-07-25T00:00:00.000Z", status: "active" }
]);
assert.strictEqual(store.getActiveRun().id, "newer_active");
assert.strictEqual(store.getRunById("older_active").status, "interrupted");

assert.throws(() => store.setRuns([
  { ...started, id: "duplicate" },
  { ...started, id: "duplicate" }
]), /重复/);

console.log("career game engine and store tests passed");
