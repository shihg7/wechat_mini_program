const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const pageRoot = path.join(projectRoot, "miniprogram", "pages", "index");
const pageScriptPath = path.join(pageRoot, "index.js");
const expectedTools = [
  { label: "AA分账", url: "/pages/ledger/index/index" },
  { label: "行程安排", url: "/pages/trip/index" },
  { label: "通用清单", url: "/pages/checklist/index" },
  { label: "决策转盘", url: "/packages/tools/wheel/index" },
  { label: "酒店餐厅快评", url: "/pages/record/index" },
  { label: "程序员升级之路", url: "/packages/tools/career/index" }
];
const expectedHeaderActions = [
  { label: "帮助", url: "/packages/tools/help/index" },
  { label: "数据设置", url: "/packages/tools/data/index" }
];

let pageDefinition;
const navigatedUrls = [];
global.Page = (definition) => {
  pageDefinition = definition;
};
global.wx = {
  navigateTo({ url }) {
    navigatedUrls.push(url);
  }
};

delete require.cache[require.resolve(pageScriptPath)];
require(pageScriptPath);

assert(pageDefinition, "toolbox home should register a Page");
assert.deepStrictEqual(
  pageDefinition.data.tools.map(({ label, url }) => ({ label, url })),
  expectedTools,
  "tool list should contain the six requested destinations in order"
);
assert.deepStrictEqual(
  pageDefinition.data.headerActions.map(({ label, url }) => ({ label, url })),
  expectedHeaderActions,
  "header should expose help and data settings"
);

[...expectedTools, ...expectedHeaderActions].forEach(({ url }) => {
  pageDefinition.openRoute({ currentTarget: { dataset: { url } } });
});
assert.deepStrictEqual(
  navigatedUrls,
  [...expectedTools, ...expectedHeaderActions].map(({ url }) => url),
  "every home action should route with navigateTo"
);

const jsSource = fs.readFileSync(pageScriptPath, "utf8");
const wxmlSource = fs.readFileSync(path.join(pageRoot, "index.wxml"), "utf8");
const wxssSource = fs.readFileSync(path.join(pageRoot, "index.wxss"), "utf8");
const pageConfig = JSON.parse(fs.readFileSync(path.join(pageRoot, "index.json"), "utf8"));

assert(!/\brequire\s*\(/.test(jsSource), "home should not import domain stores");
assert(!jsSource.includes("switchTab"), "home should not assume tab-bar routing");
assert(wxmlSource.includes('<view class="title">工具箱</view>'), "page should show the 工具箱 title");
assert(wxmlSource.includes("<ui-icon"), "page actions should use ui-icon");
assert(wxmlSource.includes('wx:for="{{tools}}"'), "tools should render from the static list");
assert(/grid-template-columns:\s*1fr\s+1fr/.test(wxssSource), "tool grid should keep two columns");
assert(/grid-auto-rows:\s*184rpx/.test(wxssSource), "tool rows should have stable dimensions");
assert(/\.tool-card\s*\{[\s\S]*?border-radius:\s*8rpx/.test(wxssSource), "tool cards should use an 8rpx radius");
assert.strictEqual(pageConfig.navigationBarTitleText, "工具箱");
assert.strictEqual(pageConfig.usingComponents["ui-icon"], "/components/ui-icon/index");

["旅行档案", "搜索", "演示模式", "旅行洞察", "最近体验"].forEach((legacyText) => {
  assert(!wxmlSource.includes(legacyText), `legacy dashboard content should not include ${legacyText}`);
});

console.log("toolbox home tests passed (6 tools, 2 header actions)");
