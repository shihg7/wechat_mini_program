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
    ...patch
  };
}

function testRoundTripAndSummary() {
  reset();
  seedAll();
  const source = backupApi.buildBackup();
  const checked = backupApi.preflightBackup(JSON.stringify(source));
  assert.deepStrictEqual(checked.summary, {
    schemaVersion: 1,
    exportedAt: source.exportedAt,
    recordCount: 1,
    tripCount: 1,
    checklistCount: 1,
    ledgerCount: 1,
    expenseCount: 0,
    wheelCount: 1
  });

  backupApi.resetAllData();
  assert.strictEqual(backupApi.getLocalDataSummary().recordCount, 0);
  backupApi.applyBackup(checked, "replace");
  assert.deepStrictEqual(
    comparableBackup(backupApi.buildBackup()),
    comparableBackup(source),
    "v1 backup should survive a full replace round trip"
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

function testAtomicRollbackAcrossFiveStores() {
  reset();
  seedAll();
  const before = clone(memory);
  failKey = checklistStore.STORAGE_KEY;
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
    wheelStore.STORAGE_KEY
  ].forEach((key) => assert.deepStrictEqual(memory[key], before[key], `${key} should be rolled back`));
}

function testValidationExportAndClear() {
  reset();
  assert.throws(() => backupApi.preflightBackup("{"), /有效的工具箱 JSON/);
  assert.throws(() => backupApi.preflightBackup({ ...emptyBackup(), app: "another-app" }), /不是当前工具箱/);
  assert.throws(() => backupApi.preflightBackup({ ...emptyBackup(), schemaVersion: 2 }), /仅支持工具箱备份 v1/);
  assert.throws(() => backupApi.preflightBackup({ ...emptyBackup(), wheels: "bad" }), /wheels 必须是数组/);
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
  assert.strictEqual(exported.backup.schemaVersion, 1);
  assert.strictEqual(exported.filePath, "/tmp/toolbox-backup-v1.json");
  assert.strictEqual(writtenFile.filePath, exported.filePath);
  assert.strictEqual(writtenFile.encoding, "utf8");
  assert.strictEqual(JSON.parse(writtenFile.content).app, backupApi.APP_ID);
  assert(memory[backupApi.LAST_BACKUP_KEY]);

  backupApi.resetAllData();
  const summary = backupApi.getLocalDataSummary();
  assert.strictEqual(summary.recordCount + summary.tripCount + summary.checklistCount + summary.ledgerCount + summary.wheelCount, 0);
  assert.strictEqual(summary.currentSizeKb, 16);
  assert.strictEqual(summary.limitSizeKb, 10240);
  assert.strictEqual(summary.lastBackupAt, "");
}

testRoundTripAndSummary();
testMergeIsIdempotentAndRenamesConflicts();
testAtomicRollbackAcrossFiveStores();
testValidationExportAndClear();
console.log("toolbox backup tests passed");
