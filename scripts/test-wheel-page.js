const assert = require("assert");
const memory = {};
const ui = { toasts: [], modals: [] };
global.wx = {
  getStorageSync(key) { return memory[key]; }, setStorageSync(key, value) { memory[key] = JSON.parse(JSON.stringify(value)); },
  showToast(options) { ui.toasts.push(options.title); }, showModal(options) { ui.modals.push(options); }, vibrateShort() {},
  getSystemInfoSync() { return { pixelRatio: 2 }; }, createSelectorQuery() { return { in() { return this; }, select() { return this; }, fields() { return this; }, exec() {} }; }
};
function setPath(target, path, value) { const parts = path.split("."); let cursor = target; parts.slice(0, -1).forEach((part) => { if (!cursor[part]) cursor[part] = {}; cursor = cursor[part]; }); cursor[parts[parts.length - 1]] = value; }
function loadPage(modulePath) { let definition; global.Page = (config) => { definition = config; }; delete require.cache[require.resolve(modulePath)]; require(modulePath); const page = {}; Object.keys(definition).forEach((key) => { page[key] = key === "data" ? JSON.parse(JSON.stringify(definition.data)) : definition[key]; }); page.setData = function setData(patch, callback) { Object.keys(patch).forEach((path) => setPath(this.data, path, patch[path])); if (callback) callback(); }; return page; }

const store = require("../miniprogram/utils/wheelStore");
const engine = require("../miniprogram/utils/wheelEngine");
const page = loadPage("../miniprogram/pages/wheel/index.js");
const demoWheel = store.createWheel({ title: "演示转盘", options: [] });
memory.experience_demo_mode_state = { active: true, startedAt: "2026-07-13T00:00:00.000Z", completedStepIds: [] };
page.onLoad({ id: demoWheel.id, demo: "wheel" });
assert.strictEqual(page.data.demoActive, true);
assert.deepStrictEqual(memory.experience_demo_mode_state.completedStepIds, ["wheel"]);
assert(page.data.wheel);
const drawCalls = [];
page.canvasWidth = 320; page.canvasHeight = 320;
page.ctx = { clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {}, fillText(text) { drawCalls.push(text); }, set fillStyle(value) {}, set strokeStyle(value) {}, set lineWidth(value) {}, set font(value) {}, set textAlign(value) {}, set textBaseline(value) {} };
page.onBatchInput({ detail: { value: "火锅\n日料\n烧烤" } });
page.addBatch();
assert.strictEqual(page.data.enabledCount, 3);
page.draw();
assert(drawCalls.includes("火锅"));
page.rotation = -(1.5 * engine.TAU / 3);
page.finishSpin();
assert.strictEqual(page.data.winner.optionText, "日料");
assert.strictEqual(store.getWheelById(page.data.wheel.id).history.length, 1);
page.removeWinner();
assert.strictEqual(page.data.enabledCount, 2);
page.rotation = -(0.5 * engine.TAU / 2);
page.finishSpin();
assert(page.data.winner);
page.removeWinner();
assert(ui.toasts.includes("至少保留两个启用选项"));
page.clearHistory();
ui.modals.pop().success({ confirm: true });
assert.strictEqual(store.getWheelById(page.data.wheel.id).history.length, 0);
store.updateWheel(page.data.wheel.id, { options: Array.from({ length: 50 }, (_, index) => ({ id: `option_${index}`, text: `很长的旅行选项${index}`, enabled: true })) });
page.loadWheels(page.data.wheel.id);
assert.strictEqual(page.data.enabledCount, 50);
page.draw();
assert(drawCalls.some((text) => text.endsWith("…")));

console.log("wheel page interaction tests passed");
