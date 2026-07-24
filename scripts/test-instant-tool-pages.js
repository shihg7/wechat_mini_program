const assert = require("assert");
const fs = require("fs");
const path = require("path");

function loadPage(relativePath, wxMock) {
  const modulePath = path.join(
    __dirname,
    "..",
    "miniprogram",
    "packages",
    "tools",
    relativePath,
    "index.js"
  );
  let definition;
  global.Page = (config) => { definition = config; };
  global.wx = wxMock;
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  assert(definition, `${relativePath} should register a Page`);
  const page = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch) {
      Object.assign(this.data, patch);
    }
  };
  return page;
}

function event(value, dataset = {}) {
  return {
    currentTarget: { dataset },
    detail: { value }
  };
}

const clipboard = [];
const toasts = [];
const commonWx = {
  setClipboardData({ data }) {
    clipboard.push(data);
  },
  showToast(options) {
    toasts.push(options);
  }
};

const datePage = loadPage("date-calculator", commonWx);
datePage.onLoad();
assert.strictEqual(datePage.data.interval.days, 7);
datePage.onStartDateChange(event("2024-02-28"));
datePage.onEndDateChange(event("2024-03-01"));
assert.strictEqual(datePage.data.interval.days, 2);
datePage.swapIntervalDates();
assert.strictEqual(datePage.data.interval.signedDays, -2);
datePage.switchMode(event(undefined, { mode: "offset" }));
datePage.onOffsetBaseChange(event("2026-07-24"));
datePage.onOffsetAmountInput(event("1"));
datePage.setOffsetDirection(event(undefined, { direction: "after" }));
datePage.setOffsetUnit(event(undefined, { unit: "workday" }));
assert.strictEqual(datePage.data.offsetResult, "2026-07-27");
datePage.copyResult();
assert(clipboard.pop().includes("工作日"));
datePage.switchMode(event(undefined, { mode: "countdown" }));
datePage.onCountdownTargetChange(event(datePage.data.today));
assert.strictEqual(datePage.data.countdown.state, "today");

const unitPage = loadPage("unit-converter", commonWx);
unitPage.onLoad();
unitPage.onInput(event("1000"));
assert.strictEqual(unitPage.data.result, "3280.83989501");
unitPage.selectCategory(event(undefined, { category: "temperature" }));
unitPage.onInput(event("-40"));
assert.strictEqual(unitPage.data.result, "-40");
unitPage.swapUnits();
assert.strictEqual(unitPage.data.result, "-40");
unitPage.selectCategory(event(undefined, { category: "data" }));
unitPage.onInput(event("1"));
assert.strictEqual(unitPage.data.result, "0.931322574615");
unitPage.copyResult();
assert(clipboard.pop().includes("GiB"));
unitPage.selectCategory(event(undefined, { category: "length" }));
unitPage.onInput(event("-1"));
assert(unitPage.data.error.includes("不能为负数"));

const toolsRoot = path.join(__dirname, "..", "miniprogram", "packages", "tools");
const unitWxml = fs.readFileSync(path.join(toolsRoot, "unit-converter", "index.wxml"), "utf8");
const unitWxss = fs.readFileSync(path.join(toolsRoot, "unit-converter", "index.wxss"), "utf8");
assert(unitWxml.includes('class="category-grid"'), "unit categories should all be visible in a grid");
assert(!unitWxml.includes("category-scroll"), "unit categories should not hide behind horizontal scrolling");
assert(unitWxml.includes("来源单位") && unitWxml.includes("目标单位"), "unit pickers should use full-width rows");
assert(!unitWxss.includes("text-overflow: ellipsis"), "unit names must not be truncated with ellipsis");
assert(unitWxss.includes("white-space: normal"), "long unit names should wrap");

const qrWxml = fs.readFileSync(path.join(toolsRoot, "qr-generator", "index.wxml"), "utf8");
const qrWxss = fs.readFileSync(path.join(toolsRoot, "qr-generator", "index.wxss"), "utf8");
assert(!qrWxml.includes("wifi-grid"), "Wi-Fi settings should not be squeezed into two columns");
assert(qrWxml.includes("Wi-Fi 不广播名称时开启"), "hidden network explanation should remain complete");
assert(qrWxss.includes(".hidden-title"), "hidden network title should have a stable full-width layout");

function makeCanvas() {
  const operations = [];
  const context = {
    fillStyle: "",
    clearRect(...args) { operations.push(["clearRect", ...args]); },
    fillRect(...args) { operations.push(["fillRect", ...args]); }
  };
  return {
    canvas: {
      getContext() { return context; },
      height: 0,
      width: 0
    },
    context,
    operations
  };
}

async function testQrPage() {
  const fake = makeCanvas();
  let savedPath = "";
  let modalOpened = false;
  const qrWx = {
    ...commonWx,
    canvasToTempFilePath(options) {
      options.success({ tempFilePath: "/tmp/toolbox-qr.png" });
    },
    createSelectorQuery() {
      return {
        exec(callback) {
          callback([{ node: fake.canvas, height: 300, width: 300 }]);
        },
        fields() { return this; },
        in() { return this; },
        select() { return this; }
      };
    },
    saveImageToPhotosAlbum({ filePath, success }) {
      savedPath = filePath;
      success({});
    },
    showModal() {
      modalOpened = true;
    }
  };
  const page = loadPage("qr-generator", qrWx);
  await page.prepareCanvas();
  assert.strictEqual(page.data.canvasReady, true);
  page.onTextInput(event("https://example.com"));
  await page.generateQr();
  assert.strictEqual(page.data.hasQr, true);
  assert(fake.operations.length > 100);
  page.copyContent();
  assert.strictEqual(clipboard.pop(), "https://example.com");
  await page.saveImage();
  assert.strictEqual(savedPath, "/tmp/toolbox-qr.png");

  page.switchMode(event(undefined, { mode: "wifi" }));
  assert.strictEqual(page.data.hasQr, false);
  page.onSsidInput(event("Cafe"));
  page.onPasswordInput(event("secret"));
  await page.generateQr();
  assert(page.lastContent.startsWith("WIFI:T:WPA;S:Cafe;"));

  qrWx.saveImageToPhotosAlbum = ({ fail }) => fail({ errMsg: "saveImageToPhotosAlbum:fail auth deny" });
  await page.saveImage();
  assert.strictEqual(modalOpened, true);
  page.onUnload();
  assert.strictEqual(page.data.password, "");
  assert.strictEqual(page.lastContent, "");
}

testQrPage()
  .then(() => {
    console.log("instant tool page tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
