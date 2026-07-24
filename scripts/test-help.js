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
  const expectedIds = ["quick", "date", "units", "qr", "ledger", "trips", "checklists", "wheel", "career", "huawei", "data", "faq"];
  assert.deepStrictEqual(page.data.sections.map((section) => section.id), expectedIds);
  assert.strictEqual(page.data.sections.length, HELP_SECTIONS.length);
  assert.strictEqual(page.data.visibleSections[0].id, "quick");
  assert.strictEqual(page.data.visibleSections[0].expanded, true, "quick start should open initially");

  const searches = [
    ["闰年", "date"],
    ["KiB", "units"],
    ["Wi-Fi", "qr"],
    ["三人分账", "ledger"],
    ["时间冲突", "trips"],
    ["旅行打包", "checklists"],
    ["手拨", "wheel"],
    ["自动存档", "career"],
    ["虚构复合", "huawei"],
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
    "/packages/tools/date-calculator/index",
    "/packages/tools/unit-converter/index",
    "/packages/tools/qr-generator/index",
    "/pages/ledger/index/index",
    "/pages/trip/index",
    "/pages/checklist/index",
    "/packages/tools/wheel/index",
    "/packages/tools/career/index",
    "/packages/tools/huawei-sim/index",
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
  assert.strictEqual(quickToolsTable.rows.length, 9, "quick start should list all nine tools");
  assert(quickToolsTable.rows.some((row) => row[0] === "程序员生涯模拟"));
  assert(quickToolsTable.rows.some((row) => row[0] === "华子研发模拟"));
  assert(serialized.includes("九个工具"), "help content should describe nine tools");
  assert(serialized.includes("五类数据"), "help content should describe five data collections");
  assert(!serialized.includes("六个工具"), "retired six-tool wording should be removed");
  assert(!serialized.includes("酒店餐厅快评"), "retired quick ratings should not remain in help");
  assert(!serialized.includes("/pages/record/"), "retired quick-rating routes should not remain in help");
  [
    "/pages/place/",
    "/pages/wishlist/",
    "/pages/departure/",
    "/packages/tools/demo/",
    "/packages/tools/insights/",
    "images/user-guide/"
  ].forEach((fragment) => assert(!serialized.includes(fragment), `retired help content found: ${fragment}`));
}

function testHuaweiSimulationHelpContent() {
  const huawei = HELP_SECTIONS.find((section) => section.id === "huawei");
  assert(huawei, "huawei simulation help chapter should exist");
  assert.strictEqual(huawei.url, "/packages/tools/huawei-sim/index");
  assert(huawei.guide && huawei.guide.sections.length >= 4, "huawei simulation should include a complete guide");
  const serialized = JSON.stringify(huawei);
  [
    "非官方",
    "40 个",
    "44 个",
    "12 次选择",
    "虚构复合",
    "不代表任何企业",
    "华为公开材料",
    "行业通用表达",
    "不写入本地缓存",
    "不进入工具箱备份 v3"
  ].forEach((text) => assert(serialized.includes(text), `huawei simulation help should cover ${text}`));
}

function testCareerHelpContent() {
  const career = HELP_SECTIONS.find((section) => section.id === "career");
  assert(career, "career help chapter should exist");
  assert.strictEqual(career.url, "/packages/tools/career/index");
  assert(["play", "zap"].includes(career.icon), "career should use an existing game icon");
  assert(career.guide && career.guide.sections.length >= 5, "career should include a complete guide");

  const careerText = JSON.stringify(career);
  [
    "模拟模式",
    "技术力",
    "沟通力",
    "精力",
    "积蓄",
    "影响力",
    "选择反馈",
    "自动存档",
    "自由模拟",
    "今日情景",
    "职业画像",
    "章节复盘",
    "十二项职业里程碑",
    "复制",
    "生涯档案",
    "十二种职业答案",
    "离线存档与备份",
    "careerRuns"
  ].forEach((text) => assert(careerText.includes(text), `career help should cover ${text}`));

  const endingTable = career.guide.sections
    .flatMap((section) => section.blocks)
    .find((block) => block.type === "table" && block.headers[0] === "职业答案");
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

testHelpSearchAndSections();
testHelpContentSourceAndRoutes();
testCareerHelpContent();
testHuaweiSimulationHelpContent();
testHelpNavigationAndExpansion();
testHelpRegistrationAndHomeActions();
console.log("offline toolbox help tests passed");
