const assert = require("assert");

const memory = {};
const ui = { toasts: [], clipboard: "", modalContent: "", modalConfirm: true, navigations: [], actionIndex: 0 };

global.wx = {
  getStorageSync(key) {
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : [];
  },
  setStorageSync(key, value) {
    memory[key] = JSON.parse(JSON.stringify(value));
  },
  showToast(options) {
    ui.toasts.push(options.title);
  },
  showModal(options) {
    ui.modalContent = options.content || "";
    if (options.success) options.success({ confirm: ui.modalConfirm, cancel: !ui.modalConfirm, content: options.content || "" });
  },
  navigateBack() {},
  navigateTo(options) { ui.navigations.push(options.url); },
  showActionSheet(options) { if (options.success) options.success({ tapIndex: ui.actionIndex }); },
  redirectTo() {},
  pageScrollTo() {},
  enableAlertBeforeUnload() {},
  disableAlertBeforeUnload() {},
  setClipboardData(options) {
    ui.clipboard = options.data;
    if (options.success) options.success();
  }
};

function setPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
}

function loadPage(modulePath) {
  let definition;
  global.Page = (config) => { definition = config; };
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  const page = {};
  Object.keys(definition).forEach((key) => {
    page[key] = key === "data" ? JSON.parse(JSON.stringify(definition.data)) : definition[key];
  });
  page.setData = function setData(patch, callback) {
    Object.keys(patch).forEach((path) => setPath(this.data, path, patch[path]));
    if (callback) callback();
  };
  return page;
}

function input(field, value) {
  return { currentTarget: { dataset: { field } }, detail: { value } };
}

const store = require("../miniprogram/utils/tripLedgerStore");

function reset() {
  Object.keys(memory).forEach((key) => delete memory[key]);
  ui.toasts = [];
  ui.clipboard = "";
  ui.modalContent = "";
  ui.modalConfirm = true;
  ui.navigations = [];
  ui.actionIndex = 0;
}

function testCreatePageDateValidationAndSave() {
  reset();
  const page = loadPage("../miniprogram/pages/ledger/edit/edit.js");
  page.onLoad({});
  page.onFieldInput(input("title", "大阪旅行"));
  page.onCurrencyChange({ detail: { value: "2" } });
  assert.strictEqual(page.data.form.baseCurrency, "EUR");
  page.onStartDateChange({ detail: { value: "2026-07-10" } });
  page.onEndDateChange({ detail: { value: "2026-07-01" } });
  page.saveLedger();
  assert(ui.toasts.includes("结束日期不能早于开始日期"));
  assert.strictEqual(store.getLedgers().length, 0);

  page.onEndDateChange({ detail: { value: "2026-07-12" } });
  page.saveLedger();
  assert.strictEqual(store.getLedgers().length, 1);
  assert.strictEqual(store.getLedgers()[0].baseCurrency, "EUR");
}

function testDetailClickFlowAndSettlementHistory() {
  reset();
  const ledger = store.addLedger({ title: "三人旅行", members: ["我", "小陈", "小周"], baseCurrency: "HKD" });
  const page = loadPage("../miniprogram/pages/ledger/detail/detail.js");
  page.onLoad({ id: ledger.id });
  assert.strictEqual(page.data.baseCurrency, "HKD");
  assert.strictEqual(page.data.ledgerTab, "expenses");
  page.onLedgerTab({ currentTarget: { dataset: { tab: "settlement" } } });
  assert.strictEqual(page.data.ledgerTab, "settlement");
  ui.actionIndex = 1;
  page.showLedgerActions();
  assert.strictEqual(page.data.showExportPanel, true);
  page.openExpenseForm();
  assert.strictEqual(page.data.ledgerTab, "expenses");
  page.onExpenseInput(input("title", "酒店"));
  page.onExpenseInput(input("amount", "900.00"));
  page.onSplitModeTap({ currentTarget: { dataset: { mode: "shares" } } });
  page.onAllocationInput({ currentTarget: { dataset: { id: page.data.expenseForm.allocationRows[0].id } }, detail: { value: "2" } });
  page.saveExpense();

  let saved = store.getLedgerById(ledger.id);
  assert.strictEqual(saved.expenses.length, 1);
  assert.strictEqual(saved.expenses[0].splitMode, "shares");
  assert.strictEqual(store.calculateLedgerSummary(saved).totalCents, 90000);
  assert.strictEqual(page.data.settlements.length, 2);
  assert(page.data.expenseViews[0].allocationText.includes("我"));
  assert(page.data.expenseViews[0].allocationText.includes("HK$"));

  page.openTransfer({ currentTarget: { dataset: { index: 0 } } });
  const suggested = page.data.pendingTransfer.amountCents;
  page.onTransferAmountInput({ detail: { value: "100.00" } });
  page.confirmTransfer();
  saved = store.getLedgerById(ledger.id);
  assert.strictEqual(saved.transfers.length, 1);
  assert.strictEqual(saved.transfers[0].amountCents, 10000);
  assert(suggested >= 10000);

  page.copySettlementText();
  assert(ui.clipboard.includes("三人旅行"));
  assert(ui.clipboard.includes("单币种 HKD"));
  assert(ui.clipboard.includes("未进行汇率换算"));
  assert(ui.clipboard.includes("结算历史"));

  page.voidTransfer({ currentTarget: { dataset: { id: saved.transfers[0].id } } });
  saved = store.getLedgerById(ledger.id);
  assert.strictEqual(saved.transfers[0].status, "void");
  assert.strictEqual(store.calculateLedgerSummary(saved).members.reduce((sum, item) => sum + item.balanceCents, 0), 0);
}

function testLedgerListManagementMenu() {
  reset();
  const ledger = store.addLedger({ title: "菜单测试", members: ["我", "小陈"] });
  const page = loadPage("../miniprogram/pages/ledger/index/index.js");
  page.onShow();
  assert.strictEqual(page.data.totalCount, 1);
  assert.strictEqual(page.data.totalSpentText, "¥0.00");
  assert.deepStrictEqual(page.data.currencyTotals.map((item) => item.baseCurrency), ["CNY"]);
  assert.strictEqual(page.data.ledgers[0].status, "empty");
  assert.strictEqual(page.data.ledgers[0].statusText, "未记账");
  assert.strictEqual(page.data.activeCount, 0);
  assert.strictEqual(page.data.settledCount, 0);
  page.manageLedger({ currentTarget: { dataset: { id: ledger.id } } });
  assert(ui.navigations.some((url) => url.indexOf(`/pages/ledger/edit/edit?id=${ledger.id}`) === 0));
  ui.actionIndex = 1;
  page.manageLedger({ currentTarget: { dataset: { id: ledger.id } } });
  assert.strictEqual(store.getLedgers().length, 0);
}

function testEditCurrencyWarningAndNoConversion() {
  reset();
  const ledger = store.addLedger({ title: "改币种", members: ["我"] });
  store.addExpense(ledger.id, {
    title: "车票",
    amountCents: 4567,
    payerId: ledger.members[0].id,
    participantIds: [ledger.members[0].id]
  });
  const page = loadPage("../miniprogram/pages/ledger/edit/edit.js");
  page.onLoad({ id: ledger.id });
  ui.modalConfirm = false;
  page.onCurrencyChange({ detail: { value: "1" } });
  assert.strictEqual(page.data.form.baseCurrency, "CNY");
  ui.modalConfirm = true;
  page.onCurrencyChange({ detail: { value: "1" } });
  assert(ui.modalContent.includes("金额数值不会换算"));
  assert.strictEqual(page.data.form.baseCurrency, "USD");
  page.saveLedger();
  const saved = store.getLedgerById(ledger.id);
  assert.strictEqual(saved.baseCurrency, "USD");
  assert.strictEqual(saved.expenses[0].amountCents, 4567);
  assert.strictEqual(saved.expenses[0].amountText, "US$45.67");
}

function testLedgerListKeepsCurrencyTotalsSeparate() {
  reset();
  const cny = store.addLedger({ title: "人民币", members: ["我"], baseCurrency: "CNY" });
  const usd = store.addLedger({ title: "美元", members: ["我"], baseCurrency: "USD" });
  store.addExpense(cny.id, { title: "早餐", amountCents: 1000, payerId: cny.members[0].id, participantIds: [cny.members[0].id] });
  store.addExpense(usd.id, { title: "午餐", amountCents: 2000, payerId: usd.members[0].id, participantIds: [usd.members[0].id] });
  const page = loadPage("../miniprogram/pages/ledger/index/index.js");
  page.onShow();
  assert.deepStrictEqual(page.data.currencyTotals, [
    { baseCurrency: "CNY", totalCents: 1000, totalText: "¥10.00" },
    { baseCurrency: "USD", totalCents: 2000, totalText: "US$20.00" }
  ]);
  assert.strictEqual(page.data.totalSpentText, "按币种分别统计");
  assert.strictEqual(page.data.ledgers.find((item) => item.id === usd.id).totalText, "US$20.00");
}

testCreatePageDateValidationAndSave();
testDetailClickFlowAndSettlementHistory();
testLedgerListManagementMenu();
testEditCurrencyWarningAndNoConversion();
testLedgerListKeepsCurrencyTotalsSeparate();
console.log("ledger page interaction tests passed");
