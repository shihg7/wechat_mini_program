const assert = require("assert");

const memory = {};
const files = {};
global.wx = {
  env: { USER_DATA_PATH: "/data" },
  getStorageSync(key) { return memory[key]; },
  setStorageSync(key, value) { memory[key] = JSON.parse(JSON.stringify(value)); },
  getFileSystemManager() {
    return {
      writeFileSync(path, content) { files[path] = content; },
      readFileSync(path) { return files[path]; }
    };
  }
};

const ledgerStore = require("../miniprogram/utils/tripLedgerStore");
const { EXPORT_SCHEMA_VERSION, REDACTED_MODE, SINGLE_CURRENCY_MODE, exportLedgerJson } = require("../miniprogram/utils/ledgerExport");
const { buildPdf } = require("../miniprogram/utils/pdfBuilder");

const ledger = ledgerStore.addLedger({ title: "隐私测试", members: ["Alice", "Bob", "Carol"], baseCurrency: "GBP" });
ledgerStore.addExpense(ledger.id, {
  title: "晚餐", amountCents: 10001, payerId: ledger.members[0].id, participantIds: ledger.members.map((member) => member.id),
  splitMode: "shares", allocations: ledger.members.map((member, index) => ({ memberId: member.id, inputValue: String(index + 1) })), note: "私人备注"
});
const current = ledgerStore.getLedgerById(ledger.id);
const path = exportLedgerJson(current, REDACTED_MODE);
const payload = JSON.parse(files[path]);
assert.strictEqual(payload.schemaVersion, EXPORT_SCHEMA_VERSION);
assert.strictEqual(payload.currency.mode, SINGLE_CURRENCY_MODE);
assert.strictEqual(payload.currency.baseCurrency, "GBP");
assert.strictEqual(payload.currency.exchangeRateConversion, false);
assert(payload.currency.note.includes("未进行汇率换算"));
assert.strictEqual(payload.ledger.baseCurrency, "GBP");
assert.deepStrictEqual(payload.ledger.members.map((member) => member.name), ["成员1", "成员2", "成员3"]);
assert.strictEqual(payload.ledger.expenses[0].note, "");
assert.strictEqual(payload.ledger.expenses[0].splitMode, "shares");
assert.strictEqual(payload.ledger.expenses[0].allocations.reduce((sum, item) => sum + item.shareCents, 0), 10001);
assert.strictEqual(payload.ledger.expenses[0].amountText, "£100.01");
assert.strictEqual(payload.summary.totalText, "£100.01");
assert(payload.settlements.every((item) => item.amountText.startsWith("£")));
assert.strictEqual(payload.summary.members.reduce((sum, member) => sum + member.balanceCents, 0), 0);

const pdf = buildPdf([new Uint8Array([255, 216, 255, 217])]);
assert.strictEqual(String.fromCharCode(...pdf.slice(0, 8)), "%PDF-1.4");
console.log("ledger export tests passed");
