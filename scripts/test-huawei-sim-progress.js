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

const { EVENTS } = require("../miniprogram/packages/tools/utils/huaweiSimContent");
const store = require("../miniprogram/packages/tools/utils/huaweiSimProgressStore");

function reset() {
  Object.keys(memory).forEach((key) => delete memory[key]);
}

function testDefaultsAndNormalization() {
  reset();
  assert.deepStrictEqual(store.getProgress(), {
    schemaVersion: 1,
    completedRuns: 0,
    completedRunKeys: [],
    seenEventIds: [],
    eventUsage: {},
    recentEventIds: [],
    updatedAt: ""
  });

  const knownId = EVENTS[0].id;
  const normalized = store.normalizeProgress({
    completedRuns: -3,
    completedRunKeys: ["run-a", "run-a", ""],
    seenEventIds: [knownId, "missing-event", knownId],
    eventUsage: { [knownId]: 3.8, "missing-event": 99 },
    recentEventIds: ["missing-event", knownId, knownId]
  });
  assert.strictEqual(normalized.completedRuns, 1);
  assert.deepStrictEqual(normalized.completedRunKeys, ["run-a"]);
  assert.deepStrictEqual(normalized.seenEventIds, [knownId]);
  assert.deepStrictEqual(normalized.eventUsage, { [knownId]: 3 });
  assert.deepStrictEqual(normalized.recentEventIds, [knownId]);
}

function testSeenEventsAndCompletionAreTrackedSafely() {
  reset();
  const firstId = EVENTS[0].id;
  const secondId = EVENTS[1].id;
  store.markEventSeen(firstId);
  store.markEventSeen(secondId);
  store.markEventSeen(firstId);
  const progress = store.getProgress();
  assert.deepStrictEqual(progress.seenEventIds, [firstId, secondId]);
  assert.strictEqual(progress.eventUsage[firstId], 1, "repeat display writes in one run must be idempotent");
  assert.strictEqual(progress.eventUsage[secondId], 1);
  assert.deepStrictEqual(progress.recentEventIds.slice(0, 2), [secondId, firstId]);

  store.recordRunCompleted("run-one");
  store.recordRunCompleted("run-one");
  store.recordRunCompleted("run-two");
  const completed = store.getProgress();
  assert.strictEqual(completed.completedRuns, 2, "same run key must not increment twice");
  assert.deepStrictEqual(completed.completedRunKeys, ["run-two", "run-one"]);
  const selection = store.getSelectionProfile(completed);
  assert.strictEqual(selection.runNumber, 3);
  assert.strictEqual(selection.eventUsage[firstId], 1);
  assert.deepStrictEqual(selection.recentEventIds.slice(0, 2), [secondId, firstId]);
}

function testClearProgress() {
  reset();
  store.markEventSeen(EVENTS[0].id);
  assert(memory.toolbox_simulation_stats);
  assert.strictEqual(memory[store.STORAGE_KEY], undefined);
  store.clearProgress();
  assert.strictEqual(memory[store.STORAGE_KEY], undefined);
  assert.strictEqual(
    memory.toolbox_simulation_stats.simulators.huawei,
    undefined,
    "the compatibility adapter should clear the shared Huawei domain"
  );
  assert.strictEqual(store.getProgress().seenEventIds.length, 0);
}

testDefaultsAndNormalization();
testSeenEventsAndCompletionAreTrackedSafely();
testClearProgress();
console.log("huawei simulation exploration progress tests passed");
