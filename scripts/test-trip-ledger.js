const assert = require("assert");

const memory = {};
const toasts = [];
let lastRedirect = "";
let lastNavigate = "";
let modalHandler = null;

global.wx = {
  getStorageSync(key) {
    return memory[key] || [];
  },
  setStorageSync(key, value) {
    memory[key] = value;
  },
  showToast(options) {
    toasts.push(options.title);
  },
  showModal(options) {
    modalHandler = options;
    if (options.success) options.success({ confirm: true });
  },
  navigateTo(options) {
    lastNavigate = options.url;
  },
  redirectTo(options) {
    lastRedirect = options.url;
  },
  pageScrollTo() {}
};

global.setTimeout = (callback) => {
  callback();
  return 0;
};

function resetMemory() {
  Object.keys(memory).forEach((key) => {
    delete memory[key];
  });
  toasts.length = 0;
  lastRedirect = "";
  lastNavigate = "";
  modalHandler = null;
}

function getByPath(target, path) {
  return path.split(".").reduce((value, key) => (value ? value[key] : undefined), target);
}

function setByPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    if (!cursor[part]) cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
}

function createPageInstance(pageDef) {
  const instance = {
    data: JSON.parse(JSON.stringify(pageDef.data || {})),
    setData(patch, callback) {
      Object.keys(patch).forEach((key) => setByPath(this.data, key, patch[key]));
      if (callback) callback.call(this);
    }
  };
  Object.keys(pageDef).forEach((key) => {
    if (key !== "data" && typeof pageDef[key] === "function") {
      instance[key] = pageDef[key].bind(instance);
    }
  });
  return instance;
}

function loadPage(relativePath) {
  let pageDef = null;
  global.Page = (definition) => {
    pageDef = definition;
  };
  const fullPath = require.resolve(relativePath);
  delete require.cache[fullPath];
  require(relativePath);
  assert(pageDef, `Page not registered: ${relativePath}`);
  return createPageInstance(pageDef);
}

function eventWithField(field, value) {
  return {
    currentTarget: { dataset: { field } },
    detail: { value }
  };
}

function eventWithDataset(dataset, value) {
  return {
    currentTarget: { dataset },
    detail: { value }
  };
}

function assertBalances(summary, expected) {
  const actual = summary.members.reduce((map, member) => {
    map[member.name] = member.balanceCents;
    return map;
  }, {});
  assert.deepStrictEqual(actual, expected);
}

function testPureSettlementMath() {
  resetMemory();
  const store = require("../miniprogram/utils/tripLedgerStore");
  store.setLedgers([]);
  const ledger = store.addLedger({ title: "东京 2026", members: ["我", "张三", "李四"] });
  store.addExpense(ledger.id, {
    title: "酒店",
    amountCents: 300000,
    payer: "我",
    participants: ["我", "张三", "李四"],
    category: "酒店"
  });
  store.addExpense(ledger.id, {
    title: "晚餐",
    amountCents: 120000,
    payer: "张三",
    participants: ["我", "张三"],
    category: "餐饮"
  });
  store.addExpense(ledger.id, {
    title: "打车",
    amountCents: 18000,
    payer: "李四",
    participants: ["我", "张三", "李四"],
    category: "交通"
  });
  const next = store.getLedgerById(ledger.id);
  const summary = store.calculateLedgerSummary(next);
  assert.strictEqual(summary.totalCents, 438000);
  assertBalances(summary, { "我": 134000, "李四": -88000, "张三": -46000 });
  assert.deepStrictEqual(store.calculateSettlements(next).map((item) => item.text), [
    "李四 给 我 ¥880.00",
    "张三 给 我 ¥460.00"
  ]);
}

function testCentRemainderAndAmountParser() {
  resetMemory();
  const store = require("../miniprogram/utils/tripLedgerStore");
  assert.strictEqual(store.parseAmountToCents("1"), 100);
  assert.strictEqual(store.parseAmountToCents("1.2"), 120);
  assert.strictEqual(store.parseAmountToCents("1.23"), 123);
  assert.strictEqual(store.parseAmountToCents("1.234"), 0);
  assert.strictEqual(store.parseAmountToCents("abc"), 0);

  store.setLedgers([]);
  const ledger = store.addLedger({ title: "分分钱", members: ["A", "B", "C"] });
  store.addExpense(ledger.id, {
    title: "水",
    amountCents: 100,
    payer: "A",
    participants: ["A", "B", "C"],
    category: "其他"
  });
  const summary = store.calculateLedgerSummary(store.getLedgerById(ledger.id));
  assertBalances(summary, { A: 66, B: -33, C: -33 });
}

function testAddMemberDoesNotRewriteHistory() {
  resetMemory();
  const store = require("../miniprogram/utils/tripLedgerStore");
  store.setLedgers([]);
  const ledger = store.addLedger({ title: "加人测试", members: ["我", "张三"] });
  store.addExpense(ledger.id, {
    title: "晚餐",
    amountCents: 10000,
    payer: "我",
    participants: ["我", "张三"],
    category: "餐饮"
  });
  store.addLedgerMember(ledger.id, "李四");
  const next = store.getLedgerById(ledger.id);
  assert.deepStrictEqual(next.members, ["我", "张三", "李四"]);
  assert.deepStrictEqual(next.expenses[0].participants, ["我", "张三"]);
}

function testDetailPageClickFlow() {
  resetMemory();
  const store = require("../miniprogram/utils/tripLedgerStore");
  store.setLedgers([]);
  const ledger = store.addLedger({ title: "点击流", members: ["我", "张三"] });
  const page = loadPage("../miniprogram/pages/ledger/detail/detail.js");
  page.onLoad({ id: ledger.id });

  assert.strictEqual(page.data.showExpenseForm, false);
  page.openExpenseForm();
  assert.strictEqual(page.data.showExpenseForm, true);
  page.onExpenseInput(eventWithField("title", "晚餐"));
  page.onExpenseInput(eventWithField("amount", "99.99"));
  page.onPayerChange({ detail: { value: "0" } });
  page.onParticipantsChange({ detail: { value: ["我", "张三"] } });
  page.saveExpense();
  assert.strictEqual(page.data.showExpenseForm, false);
  assert.strictEqual(store.getLedgerById(ledger.id).expenses.length, 1);

  page.setData({ newMemberName: "李四" });
  page.addMember();
  assert.deepStrictEqual(store.getLedgerById(ledger.id).members, ["我", "张三", "李四"]);

  page.openExpenseForm();
  page.onExpenseInput(eventWithField("title", "打车"));
  page.onExpenseInput(eventWithField("amount", "30"));
  page.onPayerChange({ detail: { value: "2" } });
  page.selectAllParticipants();
  page.saveExpense();

  let current = store.getLedgerById(ledger.id);
  assert.strictEqual(current.expenses.length, 2);
  const taxi = current.expenses.find((item) => item.title === "打车");
  page.editExpense(eventWithDataset({ id: taxi.id }));
  assert.strictEqual(page.data.showExpenseForm, true);
  page.onExpenseInput(eventWithField("amount", "60"));
  page.saveExpense();

  current = store.getLedgerById(ledger.id);
  assert.strictEqual(current.expenses.find((item) => item.title === "打车").amountCents, 6000);
  const summary = store.calculateLedgerSummary(current);
  assert.strictEqual(summary.totalCents, 15999);

  page.removeExpense(eventWithDataset({ id: current.expenses[0].id }));
  assert(modalHandler, "delete confirmation should be shown");
  assert.strictEqual(store.getLedgerById(ledger.id).expenses.length, 1);
}

function testEditPageMemberFlow() {
  resetMemory();
  const store = require("../miniprogram/utils/tripLedgerStore");
  store.setLedgers([]);
  const page = loadPage("../miniprogram/pages/ledger/edit/edit.js");
  page.onFieldInput(eventWithField("title", "大阪"));
  page.onNewMemberInput({ detail: { value: "张三" } });
  page.addMember();
  page.onNewMemberInput({ detail: { value: "李四" } });
  page.addMember();
  page.removeMember(eventWithDataset({ name: "张三" }));
  page.saveLedger();
  assert(lastRedirect.indexOf("/pages/ledger/detail/detail?id=") === 0);
  const ledgers = store.getLedgers();
  assert.strictEqual(ledgers.length, 1);
  assert.deepStrictEqual(ledgers[0].members, ["我", "李四"]);
}

function run() {
  testPureSettlementMath();
  testCentRemainderAndAmountParser();
  testAddMemberDoesNotRewriteHistory();
  testDetailPageClickFlow();
  testEditPageMemberFlow();
  console.log("trip ledger tests passed");
}

run();
