const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const pageRoot = path.join(projectRoot, "miniprogram", "pages", "index");
const pageScriptPath = path.join(pageRoot, "index.js");
const expectedTools = [
  { label: "日期计算", url: "/packages/tools/date-calculator/index" },
  { label: "单位换算", url: "/packages/tools/unit-converter/index" },
  { label: "二维码生成", url: "/packages/tools/qr-generator/index" },
  { label: "决策转盘", url: "/packages/tools/wheel/index" },
  { label: "AA分账", url: "/pages/ledger/index/index" },
  { label: "行程安排", url: "/pages/trip/index" },
  { label: "通用清单", url: "/pages/checklist/index" },
  { label: "程序员生涯模拟", url: "/packages/tools/career/index" },
  { label: "华子研发模拟", url: "/packages/tools/huawei-sim/index" }
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
  "tool list should contain the nine requested destinations in order"
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
assert(wxmlSource.includes('aria-role="button"'), "tool cards should retain accessible button semantics");
assert(/grid-template-columns:\s*1fr\s+1fr/.test(wxssSource), "tool grid should keep two columns");
assert(/grid-auto-rows:\s*184rpx/.test(wxssSource), "tool rows should have stable dimensions");
assert.strictEqual(expectedTools.length % 2, 1, "the nine-tool home should leave one intentional wide card");
assert(/\.tool-card:last-child:nth-child\(odd\)\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/.test(wxssSource), "the final odd tool should span both columns");
assert(/\.tool-card\s*\{[\s\S]*?border-radius:\s*8rpx/.test(wxssSource), "tool cards should use an 8rpx radius");
assert.strictEqual(pageConfig.navigationBarTitleText, "工具箱");
assert.strictEqual(pageConfig.usingComponents["ui-icon"], "/components/ui-icon/index");

["旅行档案", "搜索", "演示模式", "旅行洞察", "最近体验"].forEach((legacyText) => {
  assert(!wxmlSource.includes(legacyText), `legacy dashboard content should not include ${legacyText}`);
});

console.log("toolbox home tests passed (9 tools, 2 header actions)");
