const assert = require("assert");

const memory = {};
global.wx = {
  getStorageSync(key) {
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : [];
  },
  setStorageSync(key, value) {
    memory[key] = value;
  }
};

const store = require("../miniprogram/utils/tripLedgerStore");
const { migrateLedger } = require("../miniprogram/utils/ledgerMigration");
const { validateLedger } = require("../miniprogram/utils/ledgerValidation");

function resetMemory() {
  Object.keys(memory).forEach((key) => delete memory[key]);
}

function snapshot() {
  return JSON.parse(JSON.stringify(memory[store.STORAGE_KEY]));
}

function member(ledger, name) {
  return ledger.members.find((item) => item.name === name);
}

function balancesByName(summary) {
  return summary.members.reduce((result, item) => {
    result[item.name] = item.balanceCents;
    return result;
  }, {});
}

function assertConserved(summary) {
  assert.strictEqual(summary.members.reduce((total, item) => total + item.balanceCents, 0), 0);
}

function testLegacyMigrationIsLosslessAndIdempotent() {
  resetMemory();
  memory[store.STORAGE_KEY] = [{
    id: "legacy-ledger",
    title: "旧旅行",
    members: ["我", "张三"],
    expenses: [{
      id: "legacy-expense",
      title: "晚餐",
      amountCents: 10001,
      payer: "我",
      participants: ["我", "张三"],
      category: "餐饮",
      note: "保留备注",
      paidAt: "2026-07-01",
      createdAt: "2026-07-01T12:00:00.000Z"
    }],
    createdAt: "2026-07-01T00:00:00.000Z"
  }];

  const ledger = store.getLedgers()[0];
  assert.strictEqual(ledger.schemaVersion, 2);
  assert.deepStrictEqual(ledger.members.map((item) => item.name), ["我", "张三"]);
  assert(ledger.members.every((item) => item.id && item.status === "active"));
  assert.strictEqual(ledger.expenses[0].payer, "我");
  assert.deepStrictEqual(ledger.expenses[0].participants, ["我", "张三"]);
  assert.strictEqual(ledger.expenses[0].note, "保留备注");

  const firstWrite = snapshot();
  store.getLedgers();
  assert.deepStrictEqual(snapshot(), firstWrite);
  assert(firstWrite[0].expenses[0].payerId);
  assert.deepStrictEqual(firstWrite[0].expenses[0].participantIds.length, 2);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(firstWrite[0].expenses[0], "payer"), false);
}

function testHistoricalUnknownMemberMigration() {
  const migrated = migrateLedger({
    id: "orphan-history",
    members: ["我"],
    expenses: [{ amountCents: 500, payer: "旧成员", participants: ["我", "旧成员"], paidAt: "" }]
  });
  const historical = migrated.members.find((item) => item.name === "旧成员");
  assert(historical);
  assert.strictEqual(historical.status, "archived");
  assert.strictEqual(migrated.expenses[0].payerId, historical.id);
}

function testMigrationFailureDoesNotOverwrite() {
  resetMemory();
  memory[store.STORAGE_KEY] = [{
    id: "broken",
    members: ["我"],
    expenses: [{ amountCents: 100, payer: "我", participants: ["我"], paidAt: "2026-02-30" }]
  }];
  const before = snapshot();
  assert.throws(() => store.getLedgers(), /日期无效/);
  assert.deepStrictEqual(snapshot(), before);
}

function testExpenseMathAndMemberLifecycle() {
  resetMemory();
  const created = store.addLedger({ title: "周末", members: ["A", "B"] });
  const a = member(created, "A");
  const b = member(created, "B");
  store.addExpense(created.id, {
    title: "酒店",
    amountCents: 12001,
    payerId: a.id,
    participantIds: [a.id, b.id],
    category: "酒店",
    paidAt: "2026-07-10"
  });
  let ledger = store.getLedgerById(created.id);
  let summary = store.calculateLedgerSummary(ledger);
  assert.deepStrictEqual(balancesByName(summary), { A: 6000, B: -6000 });
  assertConserved(summary);

  ledger = store.updateLedgerMember(created.id, a.id, { name: "Alice" });
  assert.strictEqual(ledger.expenses[0].payer, "Alice");
  assert.deepStrictEqual(ledger.expenses[0].participants, ["Alice", "B"]);
  assert.strictEqual(ledger.expenses[0].payerId, a.id);

  ledger = store.archiveLedgerMember(created.id, a.id);
  assert.deepStrictEqual(store.getActiveMembers(ledger).map((item) => item.name), ["B"]);
  assert.strictEqual(store.removeLedgerMember(created.id, a.id), null);

  ledger = store.addLedgerMember(created.id, "C");
  const c = member(ledger, "C");
  ledger = store.removeLedgerMember(created.id, c.id);
  assert.strictEqual(member(ledger, "C"), undefined);
}

function testPartialFullAndVoidedTransfers() {
  resetMemory();
  const ledger = store.addLedger({ title: "结算", members: ["A", "B"] });
  const a = member(ledger, "A");
  const b = member(ledger, "B");
  store.addExpense(ledger.id, { title: "门票", amountCents: 12000, payerId: a.id, participantIds: [a.id, b.id], paidAt: "2026-07-10" });

  const partial = store.addTransfer(ledger.id, { fromMemberId: b.id, toMemberId: a.id, amountCents: 2500, transferredAt: "2026-07-10" });
  let current = store.getLedgerById(ledger.id);
  let summary = store.calculateLedgerSummary(current);
  assert.deepStrictEqual(balancesByName(summary), { A: 3500, B: -3500 });
  assert.deepStrictEqual(store.calculateSettlements(current).map((item) => item.amountCents), [3500]);
  assertConserved(summary);

  const finalTransfer = store.addTransfer(ledger.id, { from: "B", to: "A", amountCents: 3500 });
  current = store.getLedgerById(ledger.id);
  summary = store.calculateLedgerSummary(current);
  assert.deepStrictEqual(balancesByName(summary), { A: 0, B: 0 });
  assert.deepStrictEqual(store.calculateSettlements(current), []);

  const voided = store.voidTransfer(ledger.id, finalTransfer.id);
  assert.strictEqual(voided.status, "void");
  current = store.getLedgerById(ledger.id);
  summary = store.calculateLedgerSummary(current);
  assert.deepStrictEqual(balancesByName(summary), { A: 3500, B: -3500 });
  assert.strictEqual(current.transfers.find((item) => item.id === partial.id).status, "confirmed");
  assertConserved(summary);
}

function testInvalidDataNeverPersists() {
  resetMemory();
  const ledger = store.addLedger({ title: "校验", members: ["A", "B"], startDate: "2026-07-01", endDate: "2026-07-10" });
  const a = member(ledger, "A");
  const b = member(ledger, "B");
  let before = snapshot();
  assert.throws(() => store.addExpense(ledger.id, { amountCents: 0, payerId: a.id, participantIds: [b.id] }), /金额/);
  assert.deepStrictEqual(snapshot(), before);

  assert.throws(() => store.addExpense(ledger.id, { amountCents: 100, payerId: "missing", participantIds: [b.id] }), /不存在的成员/);
  assert.deepStrictEqual(snapshot(), before);
  assert.throws(() => store.addExpense(ledger.id, { amountCents: 100, payerId: a.id, participantIds: [b.id], paidAt: "2026-13-01" }), /日期无效/);
  assert.deepStrictEqual(snapshot(), before);
  assert.throws(() => store.addTransfer(ledger.id, { fromMemberId: a.id, toMemberId: a.id, amountCents: 100 }), /不能转给自己/);
  assert.deepStrictEqual(snapshot(), before);
  assert.throws(() => store.addTransfer(ledger.id, { fromMemberId: b.id, toMemberId: a.id, amountCents: 100 }), /没有这笔待结算/);
  assert.deepStrictEqual(snapshot(), before);
  assert.throws(() => store.updateLedger(ledger.id, { endDate: "2026-06-30" }), /不能早于/);
  assert.deepStrictEqual(snapshot(), before);
  assert.throws(() => store.updateLedgerMember(ledger.id, a.id, { status: "paused" }), /状态无效/);
  assert.deepStrictEqual(snapshot(), before);

  const raw = snapshot()[0];
  raw.expenses = [{ amountCents: 1, payerId: "missing", participantIds: [b.id], paidAt: "" }];
  assert(validateLedger(raw).some((error) => error.indexOf("付款人引用无效") >= 0));
}

function testTransferCannotExceedOutstandingAndLastActiveMemberStays() {
  resetMemory();
  let ledger = store.addLedger({ title: "边界保护", members: ["A", "B"] });
  const a = member(ledger, "A");
  const b = member(ledger, "B");
  store.addExpense(ledger.id, {
    title: "晚餐",
    amountCents: 10000,
    payerId: a.id,
    participantIds: [a.id, b.id]
  });
  const beforeTransfer = snapshot();
  assert.throws(() => store.addTransfer(ledger.id, {
    fromMemberId: b.id,
    toMemberId: a.id,
    amountCents: 5001
  }), /不能超过当前待结算金额/);
  assert.deepStrictEqual(snapshot(), beforeTransfer);

  ledger = store.archiveLedgerMember(ledger.id, b.id);
  assert.throws(() => store.removeLedgerMember(ledger.id, a.id), /至少保留一个当前成员/);
  assert(store.getLedgerById(ledger.id).members.some((item) => item.id === a.id));
}

function testParserAndFormattingCompatibility() {
  assert.strictEqual(store.parseAmountToCents("1"), 100);
  assert.strictEqual(store.parseAmountToCents("1.2"), 120);
  assert.strictEqual(store.parseAmountToCents("1.23"), 123);
  assert.strictEqual(store.parseAmountToCents("1.234"), 0);
  assert.strictEqual(store.parseAmountToCents("abc"), 0);
  assert.strictEqual(store.formatCents(-123), "-¥1.23");
}

function run() {
  testLegacyMigrationIsLosslessAndIdempotent();
  testHistoricalUnknownMemberMigration();
  testMigrationFailureDoesNotOverwrite();
  testExpenseMathAndMemberLifecycle();
  testPartialFullAndVoidedTransfers();
  testInvalidDataNeverPersists();
  testTransferCannotExceedOutstandingAndLastActiveMemberStays();
  testParserAndFormattingCompatibility();
  console.log("trip ledger v2 tests passed");
}

run();
