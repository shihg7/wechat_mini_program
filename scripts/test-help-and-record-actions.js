const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const miniprogramRoot = path.join(root, "miniprogram");
const helpRoot = path.join(miniprogramRoot, "packages/tools/help");
const { HELP_SECTIONS, USER_GUIDE_META } = require(path.join(helpRoot, "helpContent"));
const navigations = [];

global.wx = {
  navigateTo(options) {
    navigations.push(options.url);
  }
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
  const modulePath = path.join(helpRoot, "index.js");
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

function allGuideBlocks() {
  return HELP_SECTIONS.flatMap((section) => (
    section.guide.sections.flatMap((guideSection) => guideSection.blocks)
  ));
}

function testHelpSearchAndSections() {
  const page = loadHelpPage();
  const expectedIds = ["quick", "ledger", "trips", "checklists", "wheel", "records", "career", "data", "faq"];
  assert.deepStrictEqual(page.data.sections.map((section) => section.id), expectedIds);
  assert.strictEqual(page.data.sections.length, HELP_SECTIONS.length);
  assert.strictEqual(page.data.visibleSections[0].id, "quick");
  assert.strictEqual(page.data.visibleSections[0].expanded, true, "quick start should open initially");

  const searches = [
    ["三人分账", "ledger"],
    ["时间冲突", "trips"],
    ["旅行打包", "checklists"],
    ["手拨", "wheel"],
    ["一句备注", "records"],
    ["自动存档", "career"],
    ["覆盖", "data"]
  ];
  searches.forEach(([keyword, expectedId]) => {
    page.onSearchInput({ detail: { value: keyword } });
    assert(page.data.visibleSections.some((section) => section.id === expectedId), `${keyword} should find ${expectedId}`);
    assert(page.data.visibleSections.every((section) => section.expanded), "search results should open automatically");
  });

  page.onSearchInput({ detail: { value: "完全不存在的关键词" } });
  assert.strictEqual(page.data.visibleSections.length, 0);
  page.clearSearch();
  assert.strictEqual(page.data.visibleSections.length, expectedIds.length);
}

function testHelpContentSourceAndRoutes() {
  const page = loadHelpPage();
  const pageSource = fs.readFileSync(path.join(helpRoot, "index.js"), "utf8");
  const pageTemplate = fs.readFileSync(path.join(helpRoot, "index.wxml"), "utf8");
  assert(pageSource.includes('require("./helpContent")'), "help page should use the shared content source");
  assert(!pageSource.includes("const HELP_SECTIONS = ["), "help page should not duplicate content");
  assert(!pageSource.includes("switchTab"), "help navigation must not depend on a tab bar");
  assert(!pageTemplate.includes("data-tab"), "help buttons should all use normal page navigation");
  assert.deepStrictEqual(page.data.sections.map((section) => section.id), HELP_SECTIONS.map((section) => section.id));
  assert(page.data.sections.every((section) => !section.guide && !section.entry), "guide-only fields should stay out of page data");

  const expectedUrls = [
    "/pages/index/index",
    "/pages/ledger/index/index",
    "/pages/trip/index",
    "/pages/checklist/index",
    "/packages/tools/wheel/index",
    "/pages/record/index",
    "/packages/tools/career/index",
    "/packages/tools/data/index"
  ];
  assert.deepStrictEqual(
    HELP_SECTIONS.filter((section) => section.url).map((section) => section.url),
    expectedUrls
  );
  assert(HELP_SECTIONS.every((section) => !Object.prototype.hasOwnProperty.call(section, "tab")));
  assert(HELP_SECTIONS.every((section) => section.guide && section.guide.sections.length));
  assert.strictEqual(allGuideBlocks().some((block) => block.type === "image"), false, "guide must not reference stale screenshots");
  assert(allGuideBlocks().filter((block) => block.type === "flow").length >= 7, "guide should use maintainable Mermaid diagrams");

  const serialized = JSON.stringify({ HELP_SECTIONS, USER_GUIDE_META });
  const quickSection = HELP_SECTIONS.find((section) => section.id === "quick");
  const quickToolsTable = quickSection.guide.sections
    .flatMap((section) => section.blocks)
    .find((block) => block.type === "table" && block.headers[0] === "工具");
  assert(quickToolsTable, "quick start should include the tools overview");
  assert.strictEqual(quickToolsTable.rows.length, 6, "quick start should list all six tools");
  assert(quickToolsTable.rows.some((row) => row[0] === "程序员升级之路"));
  assert(serialized.includes("六个工具"), "help content should describe six tools");
  assert(!serialized.includes("五个工具"), "legacy five-tool wording should be removed");
  assert(!serialized.includes("五类数据"), "legacy five-data wording should be removed");
  assert(!serialized.includes("五类业务数据"), "legacy five-business-data wording should be removed");
  [
    "/pages/place/",
    "/pages/wishlist/",
    "/pages/departure/",
    "/packages/tools/demo/",
    "/packages/tools/insights/",
    "images/user-guide/"
  ].forEach((fragment) => assert(!serialized.includes(fragment), `retired help content found: ${fragment}`));
}

function testCareerHelpContent() {
  const career = HELP_SECTIONS.find((section) => section.id === "career");
  assert(career, "career help chapter should exist");
  assert.strictEqual(career.url, "/packages/tools/career/index");
  assert(["play", "zap"].includes(career.icon), "career should use an existing game icon");
  assert(career.guide && career.guide.sections.length >= 5, "career should include a complete guide");

  const careerText = JSON.stringify(career);
  [
    "开局",
    "技术力",
    "沟通力",
    "精力",
    "积蓄",
    "影响力",
    "选择反馈",
    "自动存档",
    "自由生涯",
    "今日挑战",
    "职业画像",
    "章节复盘",
    "十二项职业成就",
    "复制",
    "生涯档案",
    "十二种结局",
    "离线存档与备份",
    "careerRuns"
  ].forEach((text) => assert(careerText.includes(text), `career help should cover ${text}`));

  const endingTable = career.guide.sections
    .flatMap((section) => section.blocks)
    .find((block) => block.type === "table" && block.headers[0] === "结局");
  assert(endingTable, "career help should include the ending archive table");
  assert.strictEqual(endingTable.rows.length, 12, "career help should describe all 12 endings");
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

  page.openFeature({ currentTarget: { dataset: { url: "/packages/tools/data/index" } } });
  page.openFeature({ currentTarget: { dataset: { url: "/pages/trip/index" } } });
  assert.deepStrictEqual(navigations, ["/packages/tools/data/index", "/pages/trip/index"]);
}

function testHelpRegistrationAndHomeActions() {
  const appConfig = JSON.parse(fs.readFileSync(path.join(miniprogramRoot, "app.json"), "utf8"));
  const toolsPackage = appConfig.subPackages.find((item) => item.root === "packages/tools");
  assert(toolsPackage && toolsPackage.pages.includes("help/index"), "help page should be registered in the tools subpackage");

  const homeWxml = fs.readFileSync(path.join(miniprogramRoot, "pages/index/index.wxml"), "utf8");
  const homeJs = fs.readFileSync(path.join(miniprogramRoot, "pages/index/index.js"), "utf8");
  assert(homeWxml.includes('wx:for="{{headerActions}}"'), "home should render persistent header actions");
  assert(homeWxml.includes('bindtap="openRoute"'));
  assert(homeJs.includes('url: "/packages/tools/help/index"'));
  assert(homeJs.includes('url: "/packages/tools/data/index"'));
  assert(!homeJs.includes("switchTab"), "home navigation must not depend on a tab bar");
}

function testQuickRecordFixedSaveBar() {
  const recordWxml = fs.readFileSync(path.join(miniprogramRoot, "pages/record/record.wxml"), "utf8");
  const recordWxss = fs.readFileSync(path.join(miniprogramRoot, "pages/record/record.wxss"), "utf8");
  const scrollEnd = recordWxml.indexOf("</scroll-view>");
  const fixedActions = recordWxml.indexOf('class="fixed-save-bar"');
  assert(scrollEnd >= 0 && fixedActions > scrollEnd, "quick rating save bar must stay outside scrolling content");
  assert(recordWxml.includes("page-with-save-bar"), "form content should reserve room for the fixed save bar");
  assert(recordWxml.includes('class="save-button icon-action"'));
  assert(recordWxml.includes('bindtap="save"'));
  assert(recordWxml.includes("保存记录") && recordWxml.includes("保存修改"));
  assert(recordWxml.includes("评分（可选）"));
  assert(recordWxml.includes("未评分"));
  assert(!recordWxml.includes("selectedTags"));
  assert(!recordWxml.includes("placeId"));
  assert(!recordWxml.includes("保存草稿"));
  assert(recordWxss.includes(".fixed-save-bar {"));
  assert(recordWxss.includes("position: fixed;"));
  assert(recordWxss.includes("bottom: 0;"));
  assert(recordWxss.includes("env(safe-area-inset-bottom)"), "fixed save bar should respect the device safe area");
}

testHelpSearchAndSections();
testHelpContentSourceAndRoutes();
testCareerHelpContent();
testHelpNavigationAndExpansion();
testHelpRegistrationAndHomeActions();
testQuickRecordFixedSaveBar();
console.log("offline toolbox help and quick record action tests passed");
