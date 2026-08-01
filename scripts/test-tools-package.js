const assert = require("assert");
const fs = require("fs");
const path = require("path");

global.wx = {
  env: { USER_DATA_PATH: "/tmp" },
  getStorageSync() { return undefined; },
  setStorageSync() {},
  removeStorageSync() {},
  getStorageInfoSync() { return { currentSize: 0, limitSize: 10240 }; },
  getSystemInfoSync() { return { pixelRatio: 2 }; }
};

const root = path.join(__dirname, "..", "miniprogram", "packages", "tools");
const toolPages = [
  "date-calculator/index",
  "unit-converter/index",
  "qr-generator/index",
  "screenshot-redactor/index",
  "data/index",
  "help/index",
  "wheel/index",
  "career/index",
  "career/play",
  "career/archive",
  "huawei-sim/index"
];
const removedPages = ["cleanup", "demo", "insights", "story", "travel-map", "yearbook"];

toolPages.forEach((pagePath) => {
  let definition;
  global.Page = (config) => { definition = config; };
  const modulePath = path.join(root, `${pagePath}.js`);
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  assert(definition && definition.data, `${pagePath} tool page should load`);
});

removedPages.forEach((pageName) => {
  assert(!fs.existsSync(path.join(root, pageName, "index.js")), `${pageName} should not remain in the tools package`);
});

const careerMeta = require(path.join(root, "utils", "careerGameMeta.js"));
assert.strictEqual(careerMeta.getAchievementProgress([]).total, 12);
assert.strictEqual(careerMeta.getDailyChallenge("2026-07-24").date, "2026-07-24");

console.log(`tool package module smoke tests passed (${toolPages.length} pages)`);
