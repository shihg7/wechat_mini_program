const assert = require("assert");
const path = require("path");

global.wx = {
  env: { USER_DATA_PATH: "/tmp" },
  getStorageSync() { return undefined; },
  setStorageSync() {},
  removeStorageSync() {},
  getSystemInfoSync() { return { pixelRatio: 2 }; }
};

const toolPages = [
  "cleanup",
  "data",
  "insights",
  "story",
  "travel-map",
  "wheel",
  "yearbook"
];

toolPages.forEach((pageName) => {
  let definition;
  global.Page = (config) => { definition = config; };
  const modulePath = path.join(__dirname, "..", "miniprogram", "packages", "tools", pageName, "index.js");
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  assert(definition && definition.data, `${pageName} tool page should load`);
});

console.log(`tool package module smoke tests passed (${toolPages.length} pages)`);
