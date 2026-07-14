const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const miniprogramRoot = path.join(root, "miniprogram");
const navigations = [];
const tabNavigations = [];

global.wx = {
  navigateTo(options) { navigations.push(options.url); },
  switchTab(options) { tabNavigations.push(options.url); }
};

function setPath(target, pathText, value) {
  const parts = pathText.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
}

function loadHelpPage() {
  let definition;
  global.Page = (config) => { definition = config; };
  const modulePath = path.join(miniprogramRoot, "pages/help/index.js");
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  const page = {};
  Object.keys(definition).forEach((key) => {
    page[key] = key === "data" ? JSON.parse(JSON.stringify(definition.data)) : definition[key];
  });
  page.setData = function setData(patch, callback) {
    Object.keys(patch).forEach((key) => setPath(this.data, key, patch[key]));
    if (callback) callback();
  };
  return page;
}

function eventWithId(id) {
  return { currentTarget: { dataset: { id } } };
}

function testHelpSearchAndSections() {
  const page = loadHelpPage();
  assert.strictEqual(page.data.sections.length, 10, "help center should cover all ten feature chapters");
  assert.strictEqual(page.data.visibleSections.length, 10);
  assert.strictEqual(page.data.visibleSections[0].id, "quick");
  assert.strictEqual(page.data.visibleSections[0].expanded, true, "quick start should be open initially");

  page.onSearchInput({ detail: { value: "三人分账" } });
  assert(page.data.visibleSections.some((section) => section.id === "ledger"), "AA search should find the ledger chapter");
  assert(page.data.visibleSections.every((section) => section.expanded), "search results should open their matching chapters");

  page.onSearchInput({ detail: { value: "照片二进制" } });
  assert(page.data.visibleSections.some((section) => section.id === "data"), "photo backup search should find the data chapter");

  page.onSearchInput({ detail: { value: "完全不存在的关键词" } });
  assert.strictEqual(page.data.visibleSections.length, 0);
  page.clearSearch();
  assert.strictEqual(page.data.visibleSections.length, 10);
}

function testHelpNavigationAndExpansion() {
  const page = loadHelpPage();
  page.toggleSection(eventWithId("quick"));
  assert.strictEqual(page.data.visibleSections.find((section) => section.id === "quick").expanded, false);

  page.jumpToSection(eventWithId("ledger"));
  assert.strictEqual(page.data.scrollTarget, "help-ledger");
  assert.strictEqual(page.data.visibleSections.find((section) => section.id === "ledger").expanded, true);

  page.toggleAll();
  assert(page.data.visibleSections.every((section) => section.expanded), "expand all should open every visible chapter");
  page.toggleAll();
  assert(page.data.visibleSections.every((section) => !section.expanded), "collapse all should close every visible chapter");

  page.openFeature({ currentTarget: { dataset: { url: "/pages/data/index", tab: false } } });
  page.openFeature({ currentTarget: { dataset: { url: "/pages/trip/index", tab: true } } });
  assert.deepStrictEqual(navigations, ["/pages/data/index"]);
  assert.deepStrictEqual(tabNavigations, ["/pages/trip/index"]);
}

function testHelpRegistrationAndRecordActionLayout() {
  const appConfig = JSON.parse(fs.readFileSync(path.join(miniprogramRoot, "app.json"), "utf8"));
  assert(appConfig.pages.includes("pages/help/index"), "help page should be registered in app.json");

  const homeWxml = fs.readFileSync(path.join(miniprogramRoot, "pages/index/index.wxml"), "utf8");
  const homeJs = fs.readFileSync(path.join(miniprogramRoot, "pages/index/index.js"), "utf8");
  assert(homeWxml.includes('class="top-help-button icon-action"'), "home should expose a persistent help button");
  assert(homeWxml.includes('bindtap="goHelp"'));
  assert(homeJs.includes('goHelp() { wx.navigateTo({ url: "/pages/help/index" }); }'));

  const recordWxml = fs.readFileSync(path.join(miniprogramRoot, "pages/record/record.wxml"), "utf8");
  const recordWxss = fs.readFileSync(path.join(miniprogramRoot, "pages/record/record.wxss"), "utf8");
  const scrollEnd = recordWxml.indexOf("</scroll-view>");
  const fixedActions = recordWxml.indexOf('class="fixed-actions"');
  assert(scrollEnd >= 0 && fixedActions > scrollEnd, "record save actions must live outside the scrolling content");
  assert(recordWxml.includes("page-with-action-bar"), "editing content should reserve room for the fixed bar");
  assert(recordWxml.includes('data-status="completed"') && recordWxml.includes('data-status="draft"'));
  assert(recordWxss.includes(".fixed-actions {"));
  assert(recordWxss.includes("position: fixed;"));
  assert(recordWxss.includes("bottom: 0;"));
  assert(recordWxss.includes("env(safe-area-inset-bottom)"), "fixed actions should respect the device safe area");
}

testHelpSearchAndSections();
testHelpNavigationAndExpansion();
testHelpRegistrationAndRecordActionLayout();
console.log("help center and fixed record action tests passed");
