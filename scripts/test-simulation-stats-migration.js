const assert = require("assert");

const memory = {};
let failStatsWrite = false;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

global.wx = {
  getStorageSync(key) {
    return clone(memory[key]);
  },
  setStorageSync(key, value) {
    if (failStatsWrite && key === "toolbox_simulation_stats") {
      throw new Error("simulated statistics write failure");
    }
    memory[key] = clone(value);
  },
  removeStorageSync(key) {
    delete memory[key];
  }
};

const careerContent = require("../miniprogram/packages/tools/utils/careerGameContent");
const huaweiContent = require("../miniprogram/packages/tools/utils/huaweiSimContent");
const migration = require("../miniprogram/packages/tools/utils/simulationStatsMigration");
const statsStore = require("../miniprogram/packages/tools/utils/simulationStatsStore");

const careerEventIds = careerContent.EVENTS.slice(0, 6).map((event) => event.id);
const huaweiEventIds = huaweiContent.EVENTS.slice(0, 4).map((event) => event.id);

function reset() {
  Object.keys(memory).forEach((key) => delete memory[key]);
  failStatsWrite = false;
}

function testCareerRebuildAndIdempotentEnsure() {
  reset();
  const [first, second, third, current] = careerEventIds;
  const runs = [{
    id: "career-old-1",
    status: "completed",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T01:00:00.000Z",
    history: [
      { eventId: first },
      { eventId: second },
      { eventId: "unknown-career-event" }
    ]
  }, {
    id: "career-old-2",
    status: "playing",
    startedAt: "2026-01-02T00:00:00.000Z",
    history: [
      { eventId: first },
      { eventId: third }
    ],
    currentSceneId: current
  }];

  const rebuilt = migration.ensureCareerStats(runs);
  assert.strictEqual(rebuilt.startedRuns, 2);
  assert.strictEqual(rebuilt.completedRuns, 1);
  assert.strictEqual(rebuilt.events[first].shownCount, 2);
  assert.strictEqual(rebuilt.events[first].answeredCount, 2);
  assert.deepStrictEqual(rebuilt.events[second], {
    shownCount: 1,
    answeredCount: 1,
    firstShownRun: 1,
    lastShownRun: 1
  });
  assert.strictEqual(rebuilt.events[current].shownCount, 1);
  assert.strictEqual(
    rebuilt.events[current].answeredCount,
    0,
    "the current unanswered scene should only count as shown"
  );

  const latestRun = rebuilt.recentRuns[0];
  assert.strictEqual(latestRun.runKey, "career-old-2");
  assert.deepStrictEqual(latestRun.shownEventIds, [first, third, current]);
  assert.deepStrictEqual(latestRun.newEventIds, [third, current]);
  assert.deepStrictEqual(latestRun.repeatEventIds, [first]);
  assert.deepStrictEqual(latestRun.answeredEventIds, [first, third]);
  assert.strictEqual(rebuilt.recentRuns[1].status, "completed");

  const savedBeforeEnsure = clone(memory[statsStore.STORAGE_KEY]);
  const ensuredAgain = migration.ensureCareerStats([{
    id: "replacement-run",
    status: "completed",
    history: [{ eventId: careerEventIds[4] }]
  }]);
  assert.deepStrictEqual(
    memory[statsStore.STORAGE_KEY],
    savedBeforeEnsure,
    "ensure must not overwrite statistics that already exist"
  );
  assert.deepStrictEqual(ensuredAgain, rebuilt);
}

function testHuaweiLegacyMigrationAndDeleteTiming() {
  reset();
  const [first, second] = huaweiEventIds;
  memory[migration.LEGACY_HUAWEI_STORAGE_KEY] = {
    completedRuns: 4,
    completedRunKeys: ["legacy-run-4", "legacy-run-3"],
    seenEventIds: [first, second, "unknown-huawei-event"],
    eventUsage: {
      [first]: 5,
      [second]: 2,
      "unknown-huawei-event": 99
    },
    recentEventIds: [second, "unknown-huawei-event", first]
  };

  failStatsWrite = true;
  assert.throws(
    () => migration.migrateLegacyHuaweiStats(),
    /simulated statistics write failure/
  );
  assert(
    memory[migration.LEGACY_HUAWEI_STORAGE_KEY],
    "legacy progress must remain when shared statistics cannot be saved"
  );

  failStatsWrite = false;
  const migrated = migration.migrateLegacyHuaweiStats();
  assert.strictEqual(migrated.completedRuns, 4);
  assert.strictEqual(migrated.startedRuns, 4);
  assert.strictEqual(Object.keys(migrated.events).length, 2);
  assert.strictEqual(migrated.events[first].shownCount, 5);
  assert.strictEqual(migrated.events[second].shownCount, 2);
  assert.deepStrictEqual(migrated.recentEventIds, [second, first]);
  assert.strictEqual(
    memory[migration.LEGACY_HUAWEI_STORAGE_KEY],
    undefined,
    "legacy progress should be removed only after a successful shared write"
  );

  const summary = statsStore.getExplorationSummary("huawei", huaweiContent.EVENTS.map((event) => event.id));
  assert.strictEqual(summary.seenEventCount, 2);
  assert.strictEqual(summary.shownCount, 7);
  assert.strictEqual(summary.completedRuns, 4);
}

function testExistingHuaweiStatsAreNotOverwritten() {
  reset();
  const [existing, legacyOnly] = huaweiEventIds;
  statsStore.recordEventShown("huawei", "shared-run", existing);
  statsStore.recordRunCompleted("huawei", "shared-run");
  const sharedBeforeMigration = clone(memory[statsStore.STORAGE_KEY].simulators.huawei);
  memory[migration.LEGACY_HUAWEI_STORAGE_KEY] = {
    completedRuns: 8,
    seenEventIds: [legacyOnly],
    eventUsage: { [legacyOnly]: 8 }
  };

  const result = migration.migrateLegacyHuaweiStats();
  assert.deepStrictEqual(result, sharedBeforeMigration);
  assert.deepStrictEqual(
    memory[statsStore.STORAGE_KEY].simulators.huawei,
    sharedBeforeMigration,
    "existing shared Huawei statistics must win over legacy progress"
  );
  assert.strictEqual(memory[migration.LEGACY_HUAWEI_STORAGE_KEY], undefined);
}

function testInvalidEventsAreRemovedFromBothMigrations() {
  reset();
  const career = migration.buildCareerSimulator([{
    id: "invalid-cleanup-career",
    status: "playing",
    history: [
      { eventId: careerEventIds[0] },
      { eventId: "not-in-career-content" }
    ],
    currentSceneId: "also-not-in-career-content"
  }]);
  assert.deepStrictEqual(Object.keys(career.events), [careerEventIds[0]]);
  assert.deepStrictEqual(career.recentRuns[0].shownEventIds, [careerEventIds[0]]);

  const huawei = migration.buildLegacyHuaweiSimulator({
    completedRuns: 2,
    seenEventIds: [huaweiEventIds[0], "not-in-huawei-content"],
    eventUsage: {
      [huaweiEventIds[0]]: 3,
      "not-in-huawei-content": 9
    },
    recentEventIds: ["not-in-huawei-content", huaweiEventIds[0]]
  });
  assert.deepStrictEqual(Object.keys(huawei.events), [huaweiEventIds[0]]);
  assert.deepStrictEqual(huawei.recentEventIds, [huaweiEventIds[0]]);
}

testCareerRebuildAndIdempotentEnsure();
testHuaweiLegacyMigrationAndDeleteTiming();
testExistingHuaweiStatsAreNotOverwritten();
testInvalidEventsAreRemovedFromBothMigrations();
console.log("simulation statistics migration tests passed");
