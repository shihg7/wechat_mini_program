const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const miniprogramRoot = path.join(root, "miniprogram");
const { HELP_SECTIONS } = require(path.join(miniprogramRoot, "packages/tools/help/helpContent"));
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
  const modulePath = path.join(miniprogramRoot, "packages/tools/help/index.js");
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
  assert.strictEqual(page.data.sections.length, HELP_SECTIONS.length, "page chapters should come from HELP_SECTIONS");
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

function testHelpContentSource() {
  const page = loadHelpPage();
  const pageSource = fs.readFileSync(path.join(miniprogramRoot, "packages/tools/help/index.js"), "utf8");
  assert(pageSource.includes('require("./helpContent")'), "help page should import the shared content source");
  assert(!pageSource.includes("const HELP_SECTIONS = ["), "help page should not keep a second inline content source");
  assert.deepStrictEqual(page.data.sections.map((section) => section.id), HELP_SECTIONS.map((section) => section.id));
  assert(page.data.sections.every((section) => !section.guide && !section.entry), "guide-only fields should stay out of page data");

  const expectedUrls = [
    "/packages/tools/demo/index",
    "/pages/record/record?type=hotel",
    "/pages/wishlist/edit?type=hotel",
    "/pages/departure/index",
    "/pages/trip/index",
    "/pages/ledger/index/index",
    "/packages/tools/wheel/index",
    "/packages/tools/insights/index",
    "/packages/tools/data/index"
  ];
  assert.deepStrictEqual(HELP_SECTIONS.filter((section) => section.url).map((section) => section.url), expectedUrls, "existing help URLs should remain unchanged");
  assert(HELP_SECTIONS.every((section) => section.guide && section.guide.sections.length), "every help chapter should provide full guide content");
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

  page.openFeature({ currentTarget: { dataset: { url: "/packages/tools/data/index", tab: false } } });
  page.openFeature({ currentTarget: { dataset: { url: "/pages/trip/index", tab: true } } });
  assert.deepStrictEqual(navigations, ["/packages/tools/data/index"]);
  assert.deepStrictEqual(tabNavigations, ["/pages/trip/index"]);
}

function testHelpRegistrationAndRecordActionLayout() {
  const appConfig = JSON.parse(fs.readFileSync(path.join(miniprogramRoot, "app.json"), "utf8"));
  const toolsPackage = appConfig.subPackages.find((item) => item.root === "packages/tools");
  assert(toolsPackage && toolsPackage.pages.includes("help/index"), "help page should be registered in the tools subpackage");

  const homeWxml = fs.readFileSync(path.join(miniprogramRoot, "pages/index/index.wxml"), "utf8");
  const homeJs = fs.readFileSync(path.join(miniprogramRoot, "pages/index/index.js"), "utf8");
  assert(homeWxml.includes('class="top-help-button icon-action"'), "home should expose a persistent help button");
  assert(homeWxml.includes('bindtap="goHelp"'));
  assert(homeJs.includes('goHelp() { wx.navigateTo({ url: "/packages/tools/help/index" }); }'));

  const recordWxml = fs.readFileSync(path.join(miniprogramRoot, "pages/record/record.wxml"), "utf8");
  const recordWxss = fs.readFileSync(path.join(miniprogramRoot, "pages/record/record.wxss"), "utf8");
  const scrollEnd = recordWxml.indexOf("</scroll-view>");
  const fixedActions = recordWxml.indexOf('class="fixed-actions"');
  assert(scrollEnd >= 0 && fixedActions > scrollEnd, "record save actions must live outside the scrolling content");
  assert(recordWxml.includes("page-with-action-bar"), "editing content should reserve room for the fixed bar");
  assert(recordWxml.includes('data-status="completed"') && recordWxml.includes('data-status="draft"'));
  assert(recordWxml.includes('wx:if="{{isQuick}}" bindtap="expandQuickRecord"'), "quick mode should offer full scoring instead of completing hidden defaults");
  assert(recordWxml.includes("当前不会发布到网络"), "sharing controls must state that the local build does not publish");
  assert(!recordWxml.includes("链接可见</view>"), "local-only builds must not present a fake unlisted publishing option");
  assert(recordWxml.includes("可手工填写，地图不是必选项"), "address entry must remain available without map permission");
  assert(recordWxss.includes(".fixed-actions {"));
  assert(recordWxss.includes("position: fixed;"));
  assert(recordWxss.includes("bottom: 0;"));
  assert(recordWxss.includes("env(safe-area-inset-bottom)"), "fixed actions should respect the device safe area");
}

testHelpSearchAndSections();
testHelpContentSource();
testHelpNavigationAndExpansion();
testHelpRegistrationAndRecordActionLayout();
console.log("help center and fixed record action tests passed");
