const assert = require("assert");

const memory = {};
const navigation = [];
const modals = [];
const toasts = [];
let backCount = 0;
global.wx = {
  getStorageSync(key) { return memory[key]; },
  setStorageSync(key, value) { memory[key] = JSON.parse(JSON.stringify(value)); },
  removeStorageSync(key) { delete memory[key]; },
  navigateTo(options) { navigation.push(options.url); },
  navigateBack() { backCount += 1; },
  switchTab(options) { navigation.push(options.url); },
  showToast(options) { toasts.push(options.title); },
  showModal(options) { modals.push(options); }
};

function setPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach((part) => { if (!cursor[part]) cursor[part] = {}; cursor = cursor[part]; });
  cursor[parts[parts.length - 1]] = value;
}

function loadPage(modulePath) {
  let definition;
  global.Page = (config) => { definition = config; };
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  const page = {};
  Object.keys(definition).forEach((key) => { page[key] = key === "data" ? JSON.parse(JSON.stringify(definition.data)) : definition[key]; });
  page.setData = function setData(patch) { Object.keys(patch).forEach((path) => setPath(this.data, path, patch[path])); };
  return page;
}

const demoMode = require("../miniprogram/utils/demoMode");
const demoData = require("../miniprogram/utils/demoData");
const page = loadPage("../miniprogram/packages/tools/demo/index.js");

page.onLoad();
page.onShow();
assert.strictEqual(page.data.steps.length, 4);
assert.strictEqual(page.data.completed, 0);

const registry = demoData.getRegistry();
const expectedRoutes = {
  record: `/pages/record/record?id=${registry.recordIds[0]}&demo=record`,
  trip: `/pages/trip/detail?id=${registry.tripIds[0]}&demo=trip`,
  ledger: `/pages/ledger/detail/detail?id=${registry.ledgerIds[0]}&demo=ledger`,
  wheel: `/packages/tools/wheel/index?id=${registry.wheelIds[0]}&demo=wheel`
};

Object.keys(expectedRoutes).forEach((id, index) => {
  page.openStep({ currentTarget: { dataset: { id } } });
  assert.strictEqual(navigation[index], expectedRoutes[id]);
  assert.strictEqual(demoMode.getProgress().completed, index, "opening is not completed until the destination page loads");
  demoMode.markStep(id);
  page.onShow();
});
assert.strictEqual(page.data.completed, 4);
assert.strictEqual(page.data.percent, 100);
assert.strictEqual(page.data.allDone, true);

page.restart();
modals.pop().success({ confirm: true });
assert.strictEqual(page.data.completed, 0);
assert.strictEqual(demoMode.getState().active, true);

const records = require("../miniprogram/utils/hotelReviewStore");
const missingRecordId = demoData.getRegistry().recordIds[0];
records.setRecords(records.getRecords().filter((item) => item.id !== missingRecordId));
assert.strictEqual(demoData.getTargetId("record"), "", "registry ids alone do not make a demo target available");
page.openStep({ currentTarget: { dataset: { id: "record" } } });
assert(navigation[navigation.length - 1].includes("demo=record"), "missing demo data is restored and opened in one tap");
assert(toasts.includes("演示数据已恢复"));

let componentDefinition;
global.Component = (config) => { componentDefinition = config; };
delete require.cache[require.resolve("../miniprogram/components/demo-guide/index.js")];
require("../miniprogram/components/demo-guide/index.js");
componentDefinition.methods.backToDemo();
assert.strictEqual(backCount, 1, "demo guide returns to the walkthrough");

demoMode.finish();
assert.strictEqual(demoData.getRegistry().recordIds.length, 0);

console.log("demo mode page interaction tests passed");
