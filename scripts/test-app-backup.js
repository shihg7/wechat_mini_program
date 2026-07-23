const assert = require("assert");

const memory = {};
let failKey = "";
let failCount = 0;
let writtenFile = null;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

global.wx = {
  env: { USER_DATA_PATH: "/tmp" },
  getStorageSync(key) {
    return clone(memory[key]);
  },
  setStorageSync(key, value) {
    if (key === failKey && failCount > 0) {
      failCount -= 1;
      throw new Error("simulated storage failure");
    }
    memory[key] = clone(value);
  },
  removeStorageSync(key) {
    delete memory[key];
  },
  getStorageInfoSync() {
    return { currentSize: 16, limitSize: 10240 };
  },
  getFileSystemManager() {
    return {
      writeFileSync(filePath, content, encoding) {
        writtenFile = { filePath, content, encoding };
      }
    };
  }
};

const quickRecordStore = require("../miniprogram/utils/quickRecordStore");
const tripStore = require("../miniprogram/utils/tripStore");
const checklistStore = require("../miniprogram/utils/checklistStore");
const ledgerStore = require("../miniprogram/utils/tripLedgerStore");
const wheelStore = require("../miniprogram/packages/tools/utils/wheelStore");
const careerGameStore = require("../miniprogram/packages/tools/utils/careerGameStore");
const backupApi = require("../miniprogram/packages/tools/utils/appBackup");

function reset() {
  Object.keys(memory).forEach((key) => delete memory[key]);
  failKey = "";
  failCount = 0;
  writtenFile = null;
}

function seedAll() {
  quickRecordStore.addRecord({
    type: "hotel",
    name: "西湖酒店",
    city: "杭州",
    visitDate: "2026-07-18",
    score: 8.6,
    note: "早餐不错"
  });
  tripStore.addTrip({
    title: "杭州周末",
    destination: "杭州",
    startDate: "2026-07-18",
    endDate: "2026-07-19",
    note: "",
    items: [{
      id: "item-west-lake",
      date: "2026-07-18",
      time: "09:00",
      title: "逛西湖",
      location: "断桥",
      note: "",
      order: 0
    }]
  });
  checklistStore.createChecklist({ title: "周末打包", templateKey: "travel" });
  ledgerStore.addLedger({ title: "杭州 AA", members: ["小林", "小周"], expenses: [] });
  wheelStore.createWheel({
    title: "晚饭吃什么",
    options: [{ id: "option-a", text: "杭帮菜" }, { id: "option-b", text: "面馆" }]
  });
  careerGameStore.setRuns([careerGameStore.normalizeRun({
    id: "career-hangzhou",
    playerName: "小林",
    seed: 20260720,
    status: "active",
    stageIndex: 0,
    currentSceneId: "stage-1-scene-1",
    phase: "scene",
    stats: { tech: 20, communication: 20, energy: 20, savings: 20, influence: 20 },
    flags: {},
    pendingEffects: [],
    history: [],
    lastOutcome: null,
    endingId: "",
    startedAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-20T10:00:00.000Z",
    completedAt: ""
  })]);
}

function comparableBackup(backup) {
  const value = clone(backup);
  delete value.exportedAt;
  return value;
}

function emptyBackup(patch = {}) {
  return {
    schemaVersion: backupApi.SCHEMA_VERSION,
    app: backupApi.APP_ID,
    exportedAt: "2026-07-20T10:00:00.000Z",
    records: [],
    trips: [],
    checklists: [],
    ledgers: [],
    wheels: [],
    careerRuns: [],
    ...patch
  };
}

function v1Backup(patch = {}) {
  const backup = emptyBackup(patch);
  backup.schemaVersion = 1;
  delete backup.careerRuns;
  return backup;
}

function testV1Compatibility() {
  reset();
  const checked = backupApi.preflightBackup(v1Backup());
  assert.strictEqual(checked.backup.schemaVersion, 2);
  assert.deepStrictEqual(checked.backup.careerRuns, []);
  assert.strictEqual(checked.summary.careerCount, 0);
}

function testV2RoundTripAndSummary() {
  reset();
  seedAll();
  const source = backupApi.buildBackup();
  const checked = backupApi.preflightBackup(JSON.stringify(source));
  assert.deepStrictEqual(checked.summary, {
    schemaVersion: 2,
    exportedAt: source.exportedAt,
    recordCount: 1,
    tripCount: 1,
    checklistCount: 1,
    ledgerCount: 1,
    expenseCount: 0,
    wheelCount: 1,
    careerCount: 1
  });

  backupApi.resetAllData();
  assert.strictEqual(backupApi.getLocalDataSummary().recordCount, 0);
  backupApi.applyBackup(checked, "replace");
  assert.deepStrictEqual(
    comparableBackup(backupApi.buildBackup()),
    comparableBackup(source),
    "v2 backup should survive a full replace round trip"
  );
}

function testMergeIsIdempotentAndRenamesConflicts() {
  reset();
  const local = quickRecordStore.addRecord({
    type: "hotel",
    name: "本地酒店",
    visitDate: "2026-07-01"
  });
  const incoming = quickRecordStore.normalizeRecord({
    ...local,
    name: "备份酒店",
    updatedAt: "2026-07-02T00:00:00.000Z"
  });
  const payload = emptyBackup({ records: [incoming] });

  const first = backupApi.applyBackup(payload, "merge");
  assert.strictEqual(first.recordsAdded, 1);
  assert.strictEqual(quickRecordStore.getRecords().length, 2);
  assert(quickRecordStore.getRecords().some((record) => record.id === `${local.id}_import_1`));

  const second = backupApi.applyBackup(payload, "merge");
  assert.strictEqual(second.recordsAdded, 0);
  assert.strictEqual(second.recordsSkipped, 1);
  assert.strictEqual(quickRecordStore.getRecords().length, 2);
}

function testCareerMergeDefersActiveConflictToStore() {
  reset();
  const local = careerGameStore.normalizeRun({
    id: "career-shared",
    playerName: "本地玩家",
    seed: 1,
    status: "active",
    updatedAt: "2026-07-22T10:00:00.000Z"
  });
  const incoming = careerGameStore.normalizeRun({
    ...local,
    playerName: "备份玩家",
    seed: 2,
    status: "active",
    updatedAt: "2026-07-21T10:00:00.000Z"
  });
  careerGameStore.setRuns([local]);

  const result = backupApi.applyBackup(emptyBackup({ careerRuns: [incoming] }), "merge");
  const runs = careerGameStore.getRuns();
  assert.strictEqual(result.careerRunsAdded, 1);
  assert.strictEqual(result.careerRunsCount, 2);
  assert.strictEqual(runs.length, 2);
  assert(runs.some((run) => run.id === "career-shared_import_1"));
  assert.strictEqual(runs.filter((run) => run.status === "active").length, 1, "setRuns should resolve multiple active careers");
  assert.strictEqual(
    runs.find((run) => run.id === "career-shared_import_1").status,
    "interrupted",
    "the store should demote the older imported active career"
  );

  const repeated = backupApi.applyBackup(emptyBackup({ careerRuns: [incoming] }), "merge");
  assert.strictEqual(repeated.careerRunsAdded, 0);
  assert.strictEqual(repeated.careerRunsSkipped, 1);
  assert.strictEqual(careerGameStore.getRuns().length, 2);
}

function testAtomicRollbackAcrossSixStores() {
  reset();
  seedAll();
  const before = clone(memory);
  failKey = careerGameStore.STORAGE_KEY;
  failCount = 1;
  assert.throws(
    () => backupApi.applyBackup(emptyBackup(), "replace"),
    /已自动回滚/
  );
  [
    quickRecordStore.STORAGE_KEY,
    tripStore.STORAGE_KEY,
    checklistStore.STORAGE_KEY,
    ledgerStore.STORAGE_KEY,
    wheelStore.STORAGE_KEY,
    careerGameStore.STORAGE_KEY
  ].forEach((key) => assert.deepStrictEqual(memory[key], before[key], `${key} should be rolled back`));
}

function testValidationExportAndClear() {
  reset();
  assert.throws(() => backupApi.preflightBackup("{"), /有效的工具箱 JSON/);
  assert.throws(() => backupApi.preflightBackup({ ...emptyBackup(), app: "another-app" }), /不是当前工具箱/);
  assert.throws(() => backupApi.preflightBackup({ ...emptyBackup(), schemaVersion: 3 }), /仅支持工具箱备份 v1 或 v2/);
  assert.throws(() => backupApi.preflightBackup({ ...emptyBackup(), wheels: "bad" }), /wheels 必须是数组/);
  assert.throws(() => backupApi.preflightBackup({ ...emptyBackup(), careerRuns: "bad" }), /careerRuns 必须是数组/);
  const duplicate = quickRecordStore.normalizeRecord({
    id: "duplicate",
    type: "restaurant",
    name: "小馆",
    visitDate: "2026-07-20",
    createdAt: "2026-07-20T00:00:00.000Z"
  });
  assert.throws(
    () => backupApi.preflightBackup(emptyBackup({ records: [duplicate, duplicate] })),
    /重复 id/
  );

  seedAll();
  const exported = backupApi.exportFullBackup();
  assert.strictEqual(exported.backup.schemaVersion, 2);
  assert.strictEqual(exported.filePath, "/tmp/toolbox-backup-v2.json");
  assert.strictEqual(writtenFile.filePath, exported.filePath);
  assert.strictEqual(writtenFile.encoding, "utf8");
  assert.strictEqual(JSON.parse(writtenFile.content).app, backupApi.APP_ID);
  assert(memory[backupApi.LAST_BACKUP_KEY]);

  backupApi.resetAllData();
  const summary = backupApi.getLocalDataSummary();
  assert.strictEqual(
    summary.recordCount + summary.tripCount + summary.checklistCount
      + summary.ledgerCount + summary.wheelCount + summary.careerCount,
    0
  );
  assert.deepStrictEqual(careerGameStore.getRuns(), []);
  assert.strictEqual(summary.currentSizeKb, 16);
  assert.strictEqual(summary.limitSizeKb, 10240);
  assert.strictEqual(summary.lastBackupAt, "");
}

testV1Compatibility();
testV2RoundTripAndSummary();
testMergeIsIdempotentAndRenamesConflicts();
testCareerMergeDefersActiveConflictToStore();
testAtomicRollbackAcrossSixStores();
testValidationExportAndClear();
console.log("toolbox backup tests passed");
