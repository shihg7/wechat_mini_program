const assert = require("assert");

const memory = {};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

global.wx = {
  getStorageSync(key) {
    return clone(memory[key]);
  },
  setStorageSync(key, value) {
    memory[key] = clone(value);
  },
  removeStorageSync(key) {
    delete memory[key];
  }
};

const store = require("../miniprogram/packages/tools/utils/simulationStatsStore");

function reset() {
  Object.keys(memory).forEach((key) => delete memory[key]);
}

function testDefaultsAndNormalization() {
  reset();
  assert.deepStrictEqual(store.getRoot(), {
    schemaVersion: 1,
    simulators: {},
    updatedAt: ""
  });

  const normalized = store.normalizeRoot({
    schemaVersion: 99,
    simulators: {
      career: {
        startedRuns: -1,
        completedRuns: 999999999,
        startedRunKeys: ["run-1", "run-1", ""],
        completedRunKeys: ["run-1", "run-1"],
        events: {
          known: {
            shownCount: 3.8,
            answeredCount: 9,
            firstShownRun: 4,
            lastShownRun: 2
          },
          unknown: {
            shownCount: 7,
            answeredCount: 1,
            firstShownRun: 1,
            lastShownRun: 2
          },
          empty: { shownCount: 0, answeredCount: 0 }
        },
        recentEventIds: ["unknown", "known", "known"],
        recentRuns: [{
          runKey: "run-1",
          runNumber: 4,
          status: "started",
          shownEventIds: ["known", "unknown", "known"],
          newEventIds: ["known", "unknown"],
          repeatEventIds: ["known"],
          answeredEventIds: ["known", "unknown"]
        }]
      }
    }
  }, { career: ["known"] });

  assert.strictEqual(normalized.schemaVersion, 1);
  const career = normalized.simulators.career;
  assert.strictEqual(career.startedRuns, store.MAX_RUN_COUNT);
  assert.strictEqual(career.completedRuns, store.MAX_RUN_COUNT);
  assert.deepStrictEqual(career.startedRunKeys, ["run-1"]);
  assert.deepStrictEqual(career.completedRunKeys, ["run-1"]);
  assert.deepStrictEqual(Object.keys(career.events), ["known"]);
  assert.deepStrictEqual(career.events.known, {
    shownCount: 9,
    answeredCount: 9,
    firstShownRun: 4,
    lastShownRun: 4
  });
  assert.deepStrictEqual(career.recentEventIds, ["known"]);
  assert.deepStrictEqual(career.recentRuns[0].shownEventIds, ["known"]);
  assert.deepStrictEqual(career.recentRuns[0].newEventIds, ["known"]);
  assert.deepStrictEqual(career.recentRuns[0].repeatEventIds, []);
  assert.deepStrictEqual(career.recentRuns[0].answeredEventIds, ["known"]);
  assert.strictEqual(career.recentRuns[0].status, "completed");
}

function testIdempotentRunAndEventWrites() {
  reset();
  store.recordRunStarted("career", "run-a");
  store.recordRunStarted("career", "run-a");
  store.recordEventShown("career", "run-a", "event-1");
  store.recordEventShown("career", "run-a", "event-1");
  store.recordEventAnswered("career", "run-a", "event-1");
  store.recordEventAnswered("career", "run-a", "event-1");
  store.recordEventAnswered("career", "run-a", "event-2");
  store.recordRunCompleted("career", "run-a");
  store.recordRunCompleted("career", "run-a");

  const root = store.getRoot();
  const career = root.simulators.career;
  assert.strictEqual(career.startedRuns, 1);
  assert.strictEqual(career.completedRuns, 1);
  assert.strictEqual(career.events["event-1"].shownCount, 1);
  assert.strictEqual(career.events["event-1"].answeredCount, 1);
  assert.strictEqual(career.events["event-2"].shownCount, 1);
  assert.strictEqual(career.events["event-2"].answeredCount, 1);

  const summary = store.getRunSummary("career", "run-a");
  assert.strictEqual(summary.status, "completed");
  assert.strictEqual(summary.shownCount, 2);
  assert.strictEqual(summary.newCount, 2);
  assert.strictEqual(summary.repeatCount, 0);
  assert.strictEqual(summary.answeredCount, 2);

  store.recordEventShown("career", "run-b", "event-1");
  const repeated = store.getRunSummary("career", "run-b");
  assert.deepStrictEqual(repeated.newEventIds, []);
  assert.deepStrictEqual(repeated.repeatEventIds, ["event-1"]);
  const repeatedStats = store.getRoot().simulators.career.events["event-1"];
  assert.strictEqual(repeatedStats.shownCount, 2);
  assert.strictEqual(repeatedStats.firstShownRun, 1);
  assert.strictEqual(repeatedStats.lastShownRun, 2);
  assert.deepStrictEqual(
    store.getSelectionProfile("career", ["event-1", "event-2"]).lastShownRuns,
    { "event-1": 2, "event-2": 1 }
  );
}

function testProfilesSummariesAndIsolation() {
  reset();
  store.recordEventAnswered("career", "career-1", "career-event");
  store.recordRunCompleted("career", "career-1");
  store.recordEventShown("huawei", "huawei-1", "huawei-event");

  const profile = store.getSelectionProfile("career", ["career-event", "unseen-event"]);
  assert.deepStrictEqual(profile.seenEventIds, ["career-event"]);
  assert.strictEqual(profile.eventUsage["career-event"], 1);
  assert.deepStrictEqual(profile.lastShownRuns, { "career-event": 1 });
  assert.strictEqual(profile.runNumber, 2);
  assert.strictEqual(profile.totalEventCount, 2);

  const summary = store.getExplorationSummary("career", ["career-event", "unseen-event"]);
  assert.strictEqual(summary.startedRuns, 1);
  assert.strictEqual(summary.completedRuns, 1);
  assert.strictEqual(summary.seenEventCount, 1);
  assert.strictEqual(summary.totalEventCount, 2);
  assert.strictEqual(summary.shownCount, 1);
  assert.strictEqual(summary.answeredCount, 1);
  assert.strictEqual(summary.latestRun.status, "completed");

  const root = store.getRoot();
  assert(root.simulators.career);
  assert(root.simulators.huawei);
  assert.strictEqual(root.simulators.huawei.events["huawei-event"].shownCount, 1);
  assert.strictEqual(
    JSON.stringify(memory[store.STORAGE_KEY]).includes("choice"),
    false,
    "the statistics store must not persist choice content"
  );
}

function testRecentHistoryAndArrayLimits() {
  reset();
  for (let index = 0; index < 35; index += 1) {
    const runKey = `run-${index}`;
    store.recordEventShown("career", runKey, `event-${index}`);
    store.recordRunCompleted("career", runKey);
  }
  const career = store.getRoot().simulators.career;
  assert.strictEqual(career.startedRuns, 35);
  assert.strictEqual(career.completedRuns, 35);
  assert.strictEqual(career.recentRuns.length, store.MAX_RECENT_RUNS);
  assert.strictEqual(career.recentRuns[0].runKey, "run-34");
  assert.strictEqual(career.recentRuns[29].runKey, "run-5");

  store.recordRunStarted("career", "event-heavy-run");
  for (let index = 0; index < 120; index += 1) {
    store.recordEventShown("career", "event-heavy-run", `recent-event-${index}`);
  }
  const limited = store.getRoot().simulators.career;
  assert.strictEqual(limited.recentEventIds.length, store.MAX_RECENT_EVENTS);
  assert.strictEqual(limited.recentEventIds[0], "recent-event-119");
  assert.strictEqual(limited.recentEventIds[99], "recent-event-20");

  const manyKeys = Array.from(
    { length: store.MAX_RUN_KEYS + 20 },
    (_, index) => `bounded-run-${index}`
  );
  const normalized = store.normalizeRoot({
    simulators: {
      bounded: {
        startedRunKeys: manyKeys,
        completedRunKeys: manyKeys
      }
    }
  });
  assert.strictEqual(normalized.simulators.bounded.startedRunKeys.length, store.MAX_RUN_KEYS);
  assert.strictEqual(normalized.simulators.bounded.completedRunKeys.length, store.MAX_RUN_KEYS);
}

function testValidEventCleanupAndClear() {
  reset();
  store.recordEventShown("career", "run-1", "keep");
  store.recordEventShown("career", "run-1", "remove");
  store.recordEventShown("huawei", "run-1", "huawei-keep");

  const cleaned = store.getRoot({ career: ["keep"] });
  assert.deepStrictEqual(Object.keys(cleaned.simulators.career.events), ["keep"]);
  assert.deepStrictEqual(cleaned.simulators.career.recentEventIds, ["keep"]);
  assert.deepStrictEqual(cleaned.simulators.career.recentRuns[0].shownEventIds, ["keep"]);
  assert(
    cleaned.simulators.huawei.events["huawei-keep"],
    "cleaning one simulator must not affect another simulator"
  );

  store.clearSimulatorStats("career");
  const isolated = store.getRoot();
  assert.strictEqual(isolated.simulators.career, undefined);
  assert(isolated.simulators.huawei);

  store.clearAllStats();
  assert.strictEqual(memory[store.STORAGE_KEY], undefined);
  assert.deepStrictEqual(store.getRoot().simulators, {});
}

testDefaultsAndNormalization();
testIdempotentRunAndEventWrites();
testProfilesSummariesAndIsolation();
testRecentHistoryAndArrayLimits();
testValidEventCleanupAndClear();
console.log("shared simulation statistics store tests passed");
