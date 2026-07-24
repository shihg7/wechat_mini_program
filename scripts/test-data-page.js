const assert = require("assert");
const fs = require("fs");
const path = require("path");

const memory = {};
const ui = {
  modals: [],
  sharedFiles: [],
  writtenFiles: []
};
let selectedContent = "";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

global.wx = {
  env: { USER_DATA_PATH: "/tmp" },
  getStorageSync(key) {
    return clone(memory[key]);
  },
  setStorageSync(key, value) {
    memory[key] = clone(value);
  },
  removeStorageSync(key) {
    delete memory[key];
  },
  getStorageInfoSync() {
    return { currentSize: 8, limitSize: 10240 };
  },
  getFileSystemManager() {
    return {
      readFileSync() {
        return selectedContent;
      },
      writeFileSync(filePath, content, encoding) {
        ui.writtenFiles.push({ filePath, content, encoding });
      }
    };
  },
  chooseMessageFile(options) {
    options.success({ tempFiles: [{ name: "toolbox.json", path: "/tmp/toolbox.json" }] });
  },
  shareFileMessage(options) {
    ui.sharedFiles.push(options);
  },
  showModal(options) {
    ui.modals.push(options);
  },
  showToast() {}
};

function createPage(modulePath) {
  let definition;
  global.Page = (config) => { definition = config; };
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  const page = {};
  Object.keys(definition).forEach((key) => {
    page[key] = key === "data" ? clone(definition.data) : definition[key];
  });
  page.setData = function setData(patch) {
    Object.keys(patch).forEach((key) => {
      this.data[key] = patch[key];
    });
  };
  return page;
}

const backupApi = require("../miniprogram/packages/tools/utils/appBackup");
const careerGameStore = require("../miniprogram/packages/tools/utils/careerGameStore");
const page = createPage("../miniprogram/packages/tools/data/index.js");

page.onShow();
assert.strictEqual(page.data.localSummary.tripCount, 0);
assert.strictEqual(page.data.localSummary.storageText, "8 KB");

selectedContent = JSON.stringify({
  schemaVersion: 1,
  app: backupApi.APP_ID,
  exportedAt: "2026-07-20T10:00:00.000Z",
  records: [{
    id: "quick-import",
    type: "restaurant",
    name: "巷口小馆",
    city: "杭州",
    visitDate: "2026-07-19",
    score: 8.2,
    note: "适合朋友聚餐",
    createdAt: "2026-07-19T12:00:00.000Z",
    updatedAt: "2026-07-19T12:00:00.000Z"
  }],
  trips: [],
  checklists: [],
  ledgers: [],
  wheels: []
});

page.chooseBackup();
assert.strictEqual(page.data.selectedFileName, "toolbox.json");
assert.strictEqual(Object.prototype.hasOwnProperty.call(page.data.preview, "recordCount"), false);
assert.strictEqual(page.data.preview.careerCount, 0);

page.confirmImport({ currentTarget: { dataset: { mode: "merge" } } });
const mergePrompt = ui.modals.pop();
assert(mergePrompt.content.includes("0 段生涯"));
mergePrompt.success({ confirm: true });
assert.strictEqual(page.data.localSummary.tripCount, 0);
assert(ui.modals.pop().title === "恢复完成");

const career = careerGameStore.normalizeRun({
  id: "career-import",
  playerName: "小周",
  seed: 42,
  status: "active",
  stageIndex: 0,
  currentSceneId: "stage-1-scene-1",
  phase: "scene",
  updatedAt: "2026-07-21T10:00:00.000Z"
});
selectedContent = JSON.stringify({
  schemaVersion: 2,
  app: backupApi.APP_ID,
  exportedAt: "2026-07-21T10:00:00.000Z",
  records: [],
  trips: [],
  checklists: [],
  ledgers: [],
  wheels: [],
  careerRuns: [career]
});
page.chooseBackup();
assert.strictEqual(page.data.preview.careerCount, 1);
page.confirmImport({ currentTarget: { dataset: { mode: "replace" } } });
const replacePrompt = ui.modals.pop();
assert(replacePrompt.content.includes("五类工具数据"));
assert(replacePrompt.content.includes("1 段生涯"));
replacePrompt.success({ confirm: true });
assert.strictEqual(page.data.localSummary.careerCount, 1);
assert.strictEqual(ui.modals.pop().content, "五类工具数据已按备份完整恢复。");

page.exportBackup();
assert.strictEqual(ui.writtenFiles.length, 1);
assert.strictEqual(ui.sharedFiles.length, 1);
assert.strictEqual(ui.sharedFiles[0].fileName, "工具箱-完整备份-v3.json");
assert.notStrictEqual(page.data.localSummary.lastBackupText, "尚未备份");

page.confirmClear();
ui.modals.pop().success({ confirm: true });
assert.strictEqual(page.data.localSummary.tripCount, 0);
assert.strictEqual(page.data.localSummary.checklistCount, 0);
assert.strictEqual(page.data.localSummary.ledgerCount, 0);
assert.strictEqual(page.data.localSummary.wheelCount, 0);
assert.strictEqual(page.data.localSummary.careerCount, 0);

const dataPageDir = path.join(__dirname, "../miniprogram/packages/tools/data");
const wxml = fs.readFileSync(path.join(dataPageDir, "index.wxml"), "utf8");
const wxss = fs.readFileSync(path.join(dataPageDir, "index.wxss"), "utf8");
assert(wxml.includes("包含五类持久工具的全部本地数据"));
assert(wxml.includes("兼容此前生成的 v1、v2 JSON 备份"));
assert(wxml.includes("localSummary.careerCount"));
assert(wxml.includes("preview.careerCount"));
assert(wxml.includes("一次删除五类持久工具的全部内容"));
assert(!wxml.includes("localSummary.recordCount"));
assert(wxss.includes("grid-template-columns: repeat(3, 1fr)"));

console.log("data settings page interaction tests passed");
