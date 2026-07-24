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

function assertIcon(iconName) {
  const iconPath = path.join(iconRoot, `${iconName}.svg`);
  assert(fs.existsSync(iconPath), `missing icon asset: ${iconName}`);
  const svg = fs.readFileSync(iconPath, "utf8");
  assert(svg.includes('viewBox="0 0 24 24"'), `${iconName} must use the shared 24px viewBox`);
  assert(svg.includes('stroke="#172033"'), `${iconName} must use the shared base stroke`);
}

const appConfig = JSON.parse(fs.readFileSync(path.join(miniprogramRoot, "app.json"), "utf8"));
assert(!appConfig.usingComponents || !appConfig.usingComponents["ui-icon"], "ui-icon should remain page-local");
assert.strictEqual(appConfig.tabBar, undefined, "offline toolbox should not use a tab bar");

const appStyles = fs.readFileSync(path.join(miniprogramRoot, "app.wxss"), "utf8");
assert(appStyles.includes(".square-icon-button"), "global square icon-button guard should exist");
assert(appStyles.includes("flex: 0 0 72rpx !important"), "square icon buttons should not stretch");

["index.js", "index.json", "index.wxml", "index.wxss"].forEach((fileName) => {
  assert(fs.existsSync(path.join(miniprogramRoot, "components", "ui-icon", fileName)), `missing ui-icon ${fileName}`);
});

const referencedIcons = new Set();
collectFiles(miniprogramRoot, ".wxml").forEach((filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  if (source.includes("<ui-icon")) {
    const pageConfig = JSON.parse(fs.readFileSync(filePath.replace(/\.wxml$/, ".json"), "utf8"));
    assert.strictEqual(
      pageConfig.usingComponents && pageConfig.usingComponents["ui-icon"],
      "/components/ui-icon/index",
      `${path.relative(miniprogramRoot, filePath)} must register ui-icon locally`
    );
  }
  const iconPattern = /<ui-icon\b[^>]*\bname="([a-z0-9-]+)"/g;
  let match;
  while ((match = iconPattern.exec(source))) referencedIcons.add(match[1]);
});

assert(referencedIcons.size >= 15, "core pages should use a meaningful semantic icon set");
referencedIcons.forEach(assertIcon);

const homeScript = fs.readFileSync(path.join(miniprogramRoot, "pages/index/index.js"), "utf8");
["receipt", "calendar", "clipboard", "wheel", "code", "book", "database"].forEach((iconName) => {
  assert(homeScript.includes(`icon: "${iconName}"`), `home should declare the ${iconName} icon`);
  assertIcon(iconName);
});

const pageExpectations = {
  "pages/trip/index.wxml": ["route", "calendar", "clock"],
  "pages/checklist/index.wxml": ["clipboard", "edit", "more"],
  "pages/ledger/index/index.wxml": ["receipt", "users", "check"],
  "packages/tools/data/index.wxml": ["shield", "download", "upload", "trash"],
  "packages/tools/wheel/index.wxml": ["wheel", "sliders", "refresh"],
  "packages/tools/help/index.wxml": ["search", "alert", "shield"],
  "packages/tools/career/index.wxml": ["play"],
  "packages/tools/career/play.wxml": ["chevron-right"],
  "packages/tools/career/archive.wxml": ["book"]
};

Object.entries(pageExpectations).forEach(([relativePath, names]) => {
  const source = fs.readFileSync(path.join(miniprogramRoot, relativePath), "utf8");
  names.forEach((name) => {
    assert(source.includes(`name="${name}"`), `${relativePath} should include ${name}`);
  });
});

const tripEditor = fs.readFileSync(path.join(miniprogramRoot, "pages/trip/edit.wxml"), "utf8");
const wheelSource = fs.readFileSync(path.join(miniprogramRoot, "packages/tools/wheel/index.wxml"), "utf8");
assert(tripEditor.includes('class="save-bar"'), "trip save action should stay fixed");
assert(
  fs.readFileSync(path.join(miniprogramRoot, "packages/tools/wheel/index.js"), "utf8").includes("drawFixedPointer(ctx, radius)"),
  "wheel should draw a fixed high-contrast pointer after the rotating sectors"
);

console.log(`ui icon integration tests passed (${referencedIcons.size} static icons referenced)`);
