const assert = require("assert");

const memory = {};
let failKey = "";
let failCount = 0;

global.wx = {
  env: { USER_DATA_PATH: "/tmp" },
  getStorageSync(key) {
    return memory[key];
  },
  setStorageSync(key, value) {
    if (key === failKey && failCount > 0) {
      failCount -= 1;
      throw new Error("simulated storage failure");
    }
    memory[key] = JSON.parse(JSON.stringify(value));
  },
  removeStorageSync(key) {
    delete memory[key];
  }
};

const backupApi = require("../miniprogram/utils/appBackup");
const { createPrivacyCopy, REDACTED_MODE } = require("../miniprogram/utils/privacyPolicy");

function record(id, name, extra = {}) {
  return {
    id,
    hotelName: name,
    recordType: "hotel",
    stayDate: "2026-07-10",
    visitMonth: "2026-07",
    memberLevel: "钻石",
    priceRange: "¥2000",
    privateNote: "只给自己看",
    note: "只给自己看",
    cloudRecordId: "cloud-secret",
    publicReviewId: "review-secret",
    placeId: extra.placeId || `place-${id}`,
    address: "私密地址",
    latitude: 31.2,
    longitude: 121.5,
    ...extra
  };
}

function place(id, name, extra = {}) {
  return { id, type: "hotel", name, city: "上海", address: "私密地址", latitude: 31.2, longitude: 121.5, ...extra };
}

function ledger(id, relatedRecordId, extra = {}) {
  return {
    id,
    title: "东京旅行",
    members: ["小明", "小红"],
    expenses: [{
      id: `expense-${id}`,
      title: "酒店",
      amountCents: 20000,
      payer: "小明",
      participants: ["小明", "小红"],
      note: "周年纪念",
      relatedRecordId
    }],
    ...extra
  };
}

function reset() {
  Object.keys(memory).forEach((key) => delete memory[key]);
  failKey = "";
  failCount = 0;
}

function v2(records, ledgers) {
  return {
    schemaVersion: 2,
    app: backupApi.APP_ID,
    exportedAt: "2026-07-10T10:00:00.000Z",
    records,
    ledgers
  };
}

function v3(records, places, ledgers) {
  return { schemaVersion: 3, app: backupApi.APP_ID, exportedAt: "2026-07-10T10:00:00.000Z", records, places, ledgers };
}

function v4(records, places, ledgers) {
  return { schemaVersion: 4, app: backupApi.APP_ID, exportedAt: "2026-07-10T10:00:00.000Z", media: { binariesIncluded: false }, records, places, ledgers };
}

function v5(records, places, ledgers, wishlist) {
  return { schemaVersion: 5, app: backupApi.APP_ID, exportedAt: "2026-07-10T10:00:00.000Z", records, places, ledgers, wishlist };
}

function testPreflight() {
  const checked = backupApi.preflightBackup(JSON.stringify(v2([record("r1", "A")], [ledger("l1", "r1")])));
  assert.deepStrictEqual(checked.summary, {
    schemaVersion: 2,
    exportedAt: "2026-07-10T10:00:00.000Z",
    recordCount: 1,
    placeCount: 1,
    ledgerCount: 1,
    expenseCount: 1,
    wishlistCount: 0,
    ledgersIncluded: true,
    wishlistIncluded: false
  });
  assert.throws(() => backupApi.preflightBackup("{"), /有效的 JSON/);
  assert.throws(() => backupApi.preflightBackup({ schemaVersion: 2, records: [], ledgers: "bad" }), /ledgers必须是数组/);
  assert.throws(() => backupApi.preflightBackup(v2([record("same", "A"), record("same", "B")], [])), /重复 id/);
  assert.throws(() => backupApi.preflightBackup(v2([], [ledger("same", ""), ledger("same", "")])), /重复 id/);
  assert.throws(() => backupApi.preflightBackup(v3([record("r1", "A", { placeId: "missing" })], [place("p1", "A")], [])), /placeId 无效/);
  assert.strictEqual(backupApi.preflightBackup(v4([record("r4", "D", { placeId: "p4" })], [place("p4", "D")], [])).summary.schemaVersion, 4);
  const checkedV5 = backupApi.preflightBackup(v5([record("r5", "E", { placeId: "p5" })], [place("p5", "E")], [], [{ id: "w5", type: "hotel", name: "E", placeId: "p5" }]));
  assert.strictEqual(checkedV5.summary.wishlistCount, 1);
  assert.strictEqual(checkedV5.summary.wishlistIncluded, true);
}

function testMergeConflictMappingAndIdempotence() {
  reset();
  memory[backupApi.RECORDS_KEY] = [record("r1", "本地酒店")];
  memory[backupApi.LEDGERS_KEY] = [];
  memory[backupApi.PLACES_KEY] = [];
  const payload = v2([record("r1", "备份酒店")], [ledger("l1", "r1")]);
  const first = backupApi.applyBackup(payload, "merge");
  assert.strictEqual(first.recordsAdded, 1);
  assert.strictEqual(first.ledgersAdded, 1);
  assert.notStrictEqual(first.recordIdMap.r1, "r1");
  const importedLedger = memory[backupApi.LEDGERS_KEY].find((item) => item.id === "l1");
  assert.strictEqual(importedLedger.expenses[0].relatedRecordId, first.recordIdMap.r1);

  const firstRecordCount = memory[backupApi.RECORDS_KEY].length;
  const firstPlaceCount = memory[backupApi.PLACES_KEY].length;
  const firstLedgerCount = memory[backupApi.LEDGERS_KEY].length;
  const second = backupApi.applyBackup(payload, "merge");
  assert.strictEqual(memory[backupApi.RECORDS_KEY].length, firstRecordCount);
  assert.strictEqual(memory[backupApi.LEDGERS_KEY].length, firstLedgerCount);
  assert.strictEqual(memory[backupApi.PLACES_KEY].length, firstPlaceCount);
  assert.strictEqual(second.recordsAdded, 0);
  assert.strictEqual(second.ledgersAdded, 0);
}

function testLegacyReplacePreservesLedgers() {
  reset();
  memory[backupApi.RECORDS_KEY] = [record("old", "旧记录")];
  memory[backupApi.LEDGERS_KEY] = [ledger("keep", "old")];
  memory[backupApi.PLACES_KEY] = [place("old-place", "旧地点")];
  const checked = backupApi.preflightBackup({
    version: 1,
    app: backupApi.APP_ID,
    records: [record("new", "新版记录")]
  });
  assert.strictEqual(checked.summary.ledgersIncluded, false);
  backupApi.applyBackup(checked, "replace");
  assert.deepStrictEqual(memory[backupApi.RECORDS_KEY].map((item) => item.id), ["new"]);
  assert.deepStrictEqual(memory[backupApi.LEDGERS_KEY].map((item) => item.id), ["keep"]);
  assert.strictEqual(memory[backupApi.PLACES_KEY].length, 1);
}

function testAtomicRollback() {
  reset();
  const originalRecords = [record("old", "原记录")];
  const originalLedgers = [ledger("old-ledger", "old")];
  const originalPlaces = [place("old-place", "原地点")];
  memory[backupApi.RECORDS_KEY] = JSON.parse(JSON.stringify(originalRecords));
  memory[backupApi.LEDGERS_KEY] = JSON.parse(JSON.stringify(originalLedgers));
  memory[backupApi.PLACES_KEY] = JSON.parse(JSON.stringify(originalPlaces));
  memory[backupApi.WISHLIST_KEY] = [{ id: "wish-old", type: "hotel", name: "原计划" }];
  failKey = backupApi.LEDGERS_KEY;
  failCount = 1;
  assert.throws(
    () => backupApi.applyBackup(v2([record("new", "新记录")], [ledger("new-ledger", "new")]), "replace"),
    /已自动回滚/
  );
  assert.deepStrictEqual(memory[backupApi.RECORDS_KEY], originalRecords);
  assert.deepStrictEqual(memory[backupApi.LEDGERS_KEY], originalLedgers);
  assert.deepStrictEqual(memory[backupApi.PLACES_KEY], originalPlaces);
  assert.deepStrictEqual(memory[backupApi.WISHLIST_KEY], [{ id: "wish-old", type: "hotel", name: "原计划" }]);
}

function testV5WishlistMappingAndFourthWriteRollback() {
  reset();
  memory[backupApi.RECORDS_KEY] = [];
  memory[backupApi.PLACES_KEY] = [];
  memory[backupApi.LEDGERS_KEY] = [];
  memory[backupApi.WISHLIST_KEY] = [];
  const payload = v5(
    [record("r5", "计划酒店", { placeId: "p5" })],
    [place("p5", "计划酒店")],
    [],
    [{ id: "w5", type: "hotel", name: "计划酒店", placeId: "p5" }]
  );
  const merged = backupApi.applyBackup(payload, "merge");
  assert.strictEqual(merged.wishlistAdded, 1);
  assert.strictEqual(memory[backupApi.WISHLIST_KEY][0].placeId, memory[backupApi.PLACES_KEY][0].id);

  const before = JSON.parse(JSON.stringify(memory));
  failKey = backupApi.WISHLIST_KEY;
  failCount = 1;
  assert.throws(() => backupApi.applyBackup(v5(
    [record("next", "下一家", { placeId: "next-place" })],
    [place("next-place", "下一家")],
    [],
    [{ id: "next-wish", type: "hotel", name: "下一家", placeId: "next-place" }]
  ), "replace"), /已自动回滚/);
  [backupApi.RECORDS_KEY, backupApi.PLACES_KEY, backupApi.LEDGERS_KEY, backupApi.WISHLIST_KEY].forEach((key) => assert.deepStrictEqual(memory[key], before[key]));
}

function testPrivacyCopy() {
  const source = { records: [record("r1", "私密酒店")], places: [place("place-r1", "私密酒店")], ledgers: [ledger("l1", "r1")] };
  const snapshot = JSON.parse(JSON.stringify(source));
  const privateCopy = createPrivacyCopy(source, "private");
  assert.notStrictEqual(privateCopy.records[0], source.records[0]);
  assert.deepStrictEqual(privateCopy, source);

  const redacted = createPrivacyCopy(source, REDACTED_MODE);
  assert.strictEqual(redacted.records[0].stayDate, "2026-07");
  ["memberLevel", "priceRange", "privateNote", "note", "cloudRecordId", "publicReviewId", "placeId", "address"].forEach((key) => {
    assert.strictEqual(redacted.records[0][key], "", `${key} should be removed`);
  });
  assert.deepStrictEqual(redacted.ledgers[0].members, ["成员1", "成员2"]);
  assert.strictEqual(redacted.ledgers[0].expenses[0].payer, "成员1");
  assert.deepStrictEqual(redacted.ledgers[0].expenses[0].participants, ["成员1", "成员2"]);
  assert.strictEqual(redacted.ledgers[0].expenses[0].note, "");
  assert.strictEqual(redacted.places[0].address, "");
  assert.strictEqual(redacted.places[0].latitude, null);
  assert.deepStrictEqual(source, snapshot, "privacy policy must not mutate source data");
}

function testExportMigratesRecordsBeforeBuildingV5() {
  reset();
  memory[backupApi.RECORDS_KEY] = [record("legacy", "旧酒店", { placeId: "" })];
  memory[backupApi.LEDGERS_KEY] = [];
  global.wx.getFileSystemManager = () => ({ writeFileSync() {} });
  const exported = backupApi.exportFullBackup();
  assert.strictEqual(exported.backup.schemaVersion, 5);
  assert.strictEqual(exported.backup.media.binariesIncluded, false);
  assert.strictEqual(exported.backup.places.length, 1);
  assert.strictEqual(exported.backup.records[0].placeId, exported.backup.places[0].id);
  assert.deepStrictEqual(exported.backup.wishlist, []);
}

function run() {
  testPreflight();
  testMergeConflictMappingAndIdempotence();
  testLegacyReplacePreservesLedgers();
  testAtomicRollback();
  testV5WishlistMappingAndFourthWriteRollback();
  testPrivacyCopy();
  testExportMigratesRecordsBeforeBuildingV5();
  console.log("app backup tests passed");
}

run();
