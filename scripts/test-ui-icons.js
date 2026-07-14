const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const miniprogramRoot = path.join(root, "miniprogram");
const iconRoot = path.join(miniprogramRoot, "assets", "icons");

function collectFiles(directory, extension, result = []) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(fullPath, extension, result);
    else if (entry.name.endsWith(extension)) result.push(fullPath);
  });
  return result;
}

const appConfig = JSON.parse(fs.readFileSync(path.join(miniprogramRoot, "app.json"), "utf8"));
assert.strictEqual(appConfig.usingComponents["ui-icon"], "/components/ui-icon/index");
const appStyles = fs.readFileSync(path.join(miniprogramRoot, "app.wxss"), "utf8");
assert(appStyles.includes(".square-icon-button"), "global square icon-button guard should exist");
assert(appStyles.includes("flex: 0 0 72rpx !important"), "square icon buttons should not stretch in flex layouts");

["index.js", "index.json", "index.wxml", "index.wxss"].forEach((fileName) => {
  assert(fs.existsSync(path.join(miniprogramRoot, "components", "ui-icon", fileName)), "missing ui-icon " + fileName);
});

const referencedIcons = new Set();
collectFiles(path.join(miniprogramRoot, "pages"), ".wxml").forEach((filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  const iconPattern = /<ui-icon\b[^>]*\bname="([a-z0-9-]+)"/g;
  let match;
  while ((match = iconPattern.exec(source))) referencedIcons.add(match[1]);
});

assert(referencedIcons.size >= 20, "core pages should use a meaningful semantic icon set");
referencedIcons.forEach((iconName) => {
  const iconPath = path.join(iconRoot, iconName + ".svg");
  assert(fs.existsSync(iconPath), "missing icon asset: " + iconName);
  const svg = fs.readFileSync(iconPath, "utf8");
  assert(svg.includes('viewBox="0 0 24 24"'), iconName + " must use the shared 24px viewBox");
  assert(svg.includes('stroke="#172033"'), iconName + " must use the shared base stroke");
});

const pageExpectations = {
  "pages/index/index.wxml": ["hotel", "utensils", "chart", "database", "search"],
  "pages/trip/index.wxml": ["route", "calendar", "wallet"],
  "pages/ledger/index/index.wxml": ["receipt", "users", "check"],
  "pages/data/index.wxml": ["shield", "download", "upload"],
  "pages/cleanup/index.wxml": ["sparkles", "copy", "image"],
  "pages/wheel/index.wxml": ["wheel", "sliders", "refresh"]
};

Object.entries(pageExpectations).forEach(([relativePath, names]) => {
  const source = fs.readFileSync(path.join(miniprogramRoot, relativePath), "utf8");
  names.forEach((name) => assert(source.includes('name="' + name + '"'), relativePath + " should include " + name));
});

const homeSource = fs.readFileSync(path.join(miniprogramRoot, "pages/index/index.wxml"), "utf8");
const tripSource = fs.readFileSync(path.join(miniprogramRoot, "pages/trip/index.wxml"), "utf8");
const ledgerSource = fs.readFileSync(path.join(miniprogramRoot, "pages/ledger/index/index.wxml"), "utf8");
const wheelSource = fs.readFileSync(path.join(miniprogramRoot, "pages/wheel/index.wxml"), "utf8");
const ledgerDetailSource = fs.readFileSync(path.join(miniprogramRoot, "pages/ledger/detail/detail.wxml"), "utf8");
const tripDetailSource = fs.readFileSync(path.join(miniprogramRoot, "pages/trip/detail.wxml"), "utf8");
assert(!homeSource.includes('aria-label="快速新增">+</button>'));
assert(!tripSource.includes(">＋ 新建</button>"));
assert(!ledgerSource.includes("管理 ···"));
assert(homeSource.includes('class="top-add-button icon-action"'), "home create action should include an explicit label");
assert(homeSource.includes("hasRecentContent"), "home should hide the recent section when it has no useful content");
assert(!homeSource.includes("没有待完成草稿"), "home should not spend space on an empty draft card");
assert((homeSource.match(/wx:if="\{\{toolsExpanded\}\}"/g) || []).length >= 4, "secondary tools should use progressive disclosure");
assert(ledgerSource.includes("square-icon-button"), "ledger create action should stay square");
assert(wheelSource.includes('class="pointer {{spinning'), "wheel pointer should remain visible above the canvas");
assert(ledgerDetailSource.includes('data-tab="expenses"') && ledgerDetailSource.includes('data-tab="settlement"') && ledgerDetailSource.includes('data-tab="members"'), "ledger detail should separate its three core tasks");
assert(tripDetailSource.includes('catchtap="showItemActions"'), "trip item actions should be grouped into one menu");
assert(!tripDetailSource.includes('class="plan-tools"'), "trip items should not show every low-frequency action at once");
assert(tripDetailSource.includes("trip-more-action"), "trip header should keep its more action compact");

console.log("ui icon integration tests passed (" + referencedIcons.size + " icons referenced)");
