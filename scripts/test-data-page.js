const assert = require("assert");

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
const page = createPage("../miniprogram/packages/tools/data/index.js");

page.onShow();
assert.strictEqual(page.data.localSummary.recordCount, 0);
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
assert.strictEqual(page.data.preview.recordCount, 1);

page.confirmImport({ currentTarget: { dataset: { mode: "merge" } } });
ui.modals.pop().success({ confirm: true });
assert.strictEqual(page.data.localSummary.recordCount, 1);
assert(ui.modals.pop().title === "恢复完成");

page.exportBackup();
assert.strictEqual(ui.writtenFiles.length, 1);
assert.strictEqual(ui.sharedFiles.length, 1);
assert.strictEqual(ui.sharedFiles[0].fileName, "工具箱-完整备份-v1.json");
assert.notStrictEqual(page.data.localSummary.lastBackupText, "尚未备份");

page.confirmClear();
ui.modals.pop().success({ confirm: true });
assert.strictEqual(page.data.localSummary.recordCount, 0);
assert.strictEqual(page.data.localSummary.tripCount, 0);
assert.strictEqual(page.data.localSummary.checklistCount, 0);
assert.strictEqual(page.data.localSummary.ledgerCount, 0);
assert.strictEqual(page.data.localSummary.wheelCount, 0);

console.log("data settings page interaction tests passed");
