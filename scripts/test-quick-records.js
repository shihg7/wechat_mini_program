const assert = require("assert");
const fs = require("fs");
const path = require("path");

const memory = {};
const ui = {
  actionHandler: null,
  leaveAlertEnabled: false,
  modalConfirms: true,
  navigations: [],
  toasts: []
};

global.wx = {
  getStorageSync(key) {
    return memory[key];
  },
  setStorageSync(key, value) {
    memory[key] = JSON.parse(JSON.stringify(value));
  },
  removeStorageSync(key) {
    delete memory[key];
  },
  enableAlertBeforeUnload() {
    ui.leaveAlertEnabled = true;
  },
  disableAlertBeforeUnload() {
    ui.leaveAlertEnabled = false;
  },
  showToast(options) {
    ui.toasts.push(options.title);
  },
  showModal(options) {
    if (options.success) options.success({ confirm: ui.modalConfirms });
  },
  showActionSheet(options) {
    ui.actionHandler = options.success;
  },
  navigateTo(options) {
    ui.navigations.push(options.url);
  },
  navigateBack() {
    ui.navigations.push("back");
  },
  stopPullDownRefresh() {}
};

function setPath(target, dataPath, value) {
  const parts = dataPath.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
}

function loadPage(modulePath) {
  let definition;
  global.Page = (config) => {
    definition = config;
  };
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

function input(field, value) {
  return {
    currentTarget: { dataset: { field } },
    detail: { value }
  };
}

function resetUi() {
  ui.actionHandler = null;
  ui.leaveAlertEnabled = false;
  ui.modalConfirms = true;
  ui.navigations = [];
  ui.toasts = [];
}

const store = require("../miniprogram/utils/quickRecordStore");
const expectedKeys = ["id", "type", "name", "city", "visitDate", "score", "note", "createdAt", "updatedAt"].sort();

assert.strictEqual(store.STORAGE_KEY, "toolbox_quick_records");
const normalizedBackupRecord = store.normalizeRecord({
  id: "backup_record",
  type: "hotel",
  name: "备份酒店",
  visitDate: "2026-07-01",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
  photos: ["ignored"]
});
assert.deepStrictEqual(Object.keys(normalizedBackupRecord).sort(), expectedKeys);
store.setRecords([normalizedBackupRecord]);
assert.strictEqual(store.getRecords()[0].id, "backup_record");
assert.throws(() => store.setRecords([
  normalizedBackupRecord,
  { ...normalizedBackupRecord, id: "broken_record", name: "" }
]), /名称/);
assert.strictEqual(store.getRecords().length, 1, "failed bulk restore must leave storage untouched");
store.setRecords([]);
assert.throws(() => store.addRecord({ name: "   " }), /名称/);
assert.throws(() => store.addRecord({ name: "越界", score: 10.1 }), /1 到 10/);
assert.throws(() => store.addRecord({ name: "精度过高", score: 8.55 }), /一位小数/);

const hotel = store.addRecord({
  type: "hotel",
  name: "  西湖酒店  ",
  city: " 杭州 ",
  score: "",
  note: " 湖景房 ",
  photo: "must-not-survive",
  tags: ["legacy"]
});
assert.deepStrictEqual(Object.keys(hotel).sort(), expectedKeys);
assert.strictEqual(hotel.name, "西湖酒店");
assert.strictEqual(hotel.visitDate, store.getToday());
assert.strictEqual(hotel.score, null);
assert.deepStrictEqual(Object.keys(memory[store.STORAGE_KEY][0]).sort(), expectedKeys);

const restaurant = store.addRecord({
  type: "restaurant",
  name: "山外山",
  city: "杭州",
  visitDate: "2026-07-20",
  score: "8.6",
  note: "清淡"
});
assert.strictEqual(restaurant.score, 8.6);
assert.strictEqual(store.getRecords({ type: "restaurant" }).length, 1);
assert.strictEqual(store.getRecords({ query: "湖景" })[0].id, hotel.id);
assert.strictEqual(store.searchRecords(store.getRecords(), { query: "山外", type: "restaurant" }).length, 1);

const updated = store.updateRecord(hotel.id, {
  name: "西湖酒店新馆",
  score: 9.1,
  share: true
});
assert.strictEqual(updated.id, hotel.id);
assert.strictEqual(updated.createdAt, hotel.createdAt);
assert.strictEqual(updated.score, 9.1);
assert.deepStrictEqual(Object.keys(updated).sort(), expectedKeys);
assert.strictEqual(store.getRecordById("missing"), null);
assert.strictEqual(store.deleteRecord("missing"), false);

resetUi();
let recordPage = loadPage("../miniprogram/pages/record/record.js");
recordPage.onLoad({ type: "restaurant" });
assert.strictEqual(recordPage.data.form.type, "restaurant");
assert.strictEqual(recordPage.data.form.visitDate, store.getToday());
recordPage.onInput(input("name", "湖滨餐厅"));
recordPage.onInput(input("city", "苏州"));
recordPage.onScoreInput({ detail: { value: "9.4" } });
assert.strictEqual(recordPage.data.dirty, true);
assert.strictEqual(ui.leaveAlertEnabled, true);
recordPage.save();
assert.strictEqual(recordPage.data.mode, "detail");
assert.strictEqual(recordPage.data.form.score, 9.4);
assert.strictEqual(ui.leaveAlertEnabled, false);

recordPage.enterEdit();
recordPage.onInput(input("note", "未保存备注"));
assert.strictEqual(recordPage.data.dirty, true);
recordPage.cancelEdit();
assert.strictEqual(recordPage.data.mode, "detail");
assert.strictEqual(recordPage.data.form.note, "");
assert.strictEqual(ui.leaveAlertEnabled, false);

recordPage.enterEdit();
recordPage.clearScore();
recordPage.onInput(input("note", "靠窗位"));
recordPage.save();
assert.strictEqual(recordPage.data.form.score, null);
assert.strictEqual(recordPage.data.form.note, "靠窗位");

const listPage = loadPage("../miniprogram/pages/record/index.js");
listPage.onLoad({});
listPage.onShow();
assert.strictEqual(listPage.data.total, 3);
listPage.onSearchInput({ detail: { value: "苏州" } });
assert.strictEqual(listPage.data.visibleTotal, 1);
listPage.clearSearch();
listPage.onFilterTap({ currentTarget: { dataset: { type: "hotel" } } });
assert.strictEqual(listPage.data.visibleTotal, 1);
listPage.createRecord();
ui.actionHandler({ tapIndex: 1 });
assert(ui.navigations.includes("/pages/record/record?type=restaurant"));
listPage.openRecord({ currentTarget: { dataset: { id: restaurant.id } } });
assert(ui.navigations.includes(`/pages/record/record?id=${restaurant.id}`));

recordPage.remove();
assert.strictEqual(store.getRecordById(recordPage.data.recordId), null);
assert(ui.navigations.includes("back"));

const root = path.resolve(__dirname, "..");
const recordRoot = path.join(root, "miniprogram", "pages", "record");
["record", "index"].forEach((pageName) => {
  ["js", "json", "wxml", "wxss"].forEach((extension) => {
    assert(fs.existsSync(path.join(recordRoot, `${pageName}.${extension}`)));
  });
  const config = JSON.parse(fs.readFileSync(path.join(recordRoot, `${pageName}.json`), "utf8"));
  assert.strictEqual(config.usingComponents["ui-icon"], "/components/ui-icon/index");
});

const recordWxml = fs.readFileSync(path.join(recordRoot, "record.wxml"), "utf8");
const scrollEnd = recordWxml.indexOf("</scroll-view>");
const fixedBar = recordWxml.indexOf('class="fixed-save-bar"');
assert(scrollEnd >= 0 && fixedBar > scrollEnd, "save bar must sit outside the scrolling form");
assert(recordWxml.includes("<ui-icon"));
assert(!/(照片|标签|分享|草稿|同步)/.test(recordWxml));

console.log("quick record store and page tests passed");
