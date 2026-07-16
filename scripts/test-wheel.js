const assert = require("assert");
const memory = {};
global.wx = { getStorageSync(key) { return memory[key]; }, setStorageSync(key, value) { memory[key] = JSON.parse(JSON.stringify(value)); } };

const engine = require("../miniprogram/packages/tools/utils/wheelEngine");
const store = require("../miniprogram/utils/wheelStore");

assert.strictEqual(engine.normalizeAngle(-Math.PI / 2), Math.PI * 1.5);
assert(Math.abs(engine.shortestAngleDelta(0.05, engine.TAU - 0.05) - 0.1) < 1e-9);
[2, 3, 10, 50].forEach((count) => {
  const slice = engine.TAU / count;
  for (let index = 0; index < count; index += 1) assert.strictEqual(engine.winnerIndex(-(index + 0.5) * slice, count), index);
});
assert.strictEqual(engine.winnerIndex(0, 8), 0);
assert.strictEqual(engine.winnerIndex(-engine.TAU * 3.25, 4), 1);
assert(engine.targetRotation(1, 4, 0) >= 1 + engine.TAU * 5);
let velocity = 0.3; let frames = 0;
while (velocity && frames < 2000) { const next = engine.stepVelocity(velocity); assert(next >= 0 && next <= velocity); velocity = next; frames += 1; }
assert.strictEqual(velocity, 0);
assert(frames < 2000);

assert.deepStrictEqual(store.parseOptions(" 火锅\n日料，火锅, 烧烤\n"), ["火锅", "日料", "烧烤"]);
const longText = "一二三四五六七八九十一二三四五六七八九十一二三四五六";
assert.strictEqual(store.parseOptions(longText)[0].length, 24);
const wheel = store.createWheel({ title: "晚餐", options: store.parseOptions("火锅\n日料\n烧烤").map((text) => ({ text })) });
store.addOptions(wheel.id, "本帮菜\n火锅");
assert.strictEqual(store.getWheelById(wheel.id).options.length, 4);
const first = store.getWheelById(wheel.id).options[0];
store.updateOption(wheel.id, first.id, "川菜");
assert.strictEqual(store.getWheelById(wheel.id).options[0].text, "川菜");
assert.throws(() => store.updateOption(wheel.id, first.id, "日料"), /重复/);
store.moveOption(wheel.id, first.id, "down");
assert.strictEqual(store.getWheelById(wheel.id).options[1].id, first.id);
store.toggleOption(wheel.id, first.id);
assert.strictEqual(store.getWheelById(wheel.id).options.find((item) => item.id === first.id).enabled, false);
const activeIds = store.getWheelById(wheel.id).options.filter((item) => item.enabled).map((item) => item.id);
store.toggleOption(wheel.id, activeIds[0]);
assert.throws(() => store.toggleOption(wheel.id, activeIds[1]), /至少保留两个/);
for (let index = 0; index < 55; index += 1) store.recordResult(wheel.id, activeIds[1]);
assert.strictEqual(store.getWheelById(wheel.id).history.length, 50);
store.clearHistory(wheel.id);
assert.strictEqual(store.getWheelById(wheel.id).history.length, 0);

console.log("wheel engine and store tests passed");
