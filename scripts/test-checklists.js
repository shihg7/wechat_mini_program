const assert = require("assert");
const fs = require("fs");
const path = require("path");

const memory = {};
const ui = { actionSheets: [], modals: [], toasts: [] };

global.wx = {
  getStorageSync(key) {
    return memory[key];
  },
  setStorageSync(key, value) {
    memory[key] = JSON.parse(JSON.stringify(value));
  },
  showActionSheet(options) {
    ui.actionSheets.push(options);
  },
  showModal(options) {
    ui.modals.push(options);
  },
  showToast(options) {
    ui.toasts.push(options);
  }
};

const store = require("../miniprogram/utils/checklistStore");

function storedSnapshot() {
  return JSON.stringify(memory[store.STORAGE_KEY]);
}

function assertPersistedShape(checklist) {
  assert.deepStrictEqual(
    Object.keys(checklist).sort(),
    ["createdAt", "id", "items", "templateKey", "title", "updatedAt"].sort()
  );
  checklist.items.forEach((item, index) => {
    assert.deepStrictEqual(Object.keys(item).sort(), ["done", "id", "order", "text"].sort());
    assert.strictEqual(item.order, index);
  });
}

assert.strictEqual(store.STORAGE_KEY, "toolbox_checklists");
assert.deepStrictEqual(store.getChecklists(), []);
assert.deepStrictEqual(store.getTemplates().map((template) => template.key), ["blank", "travel"]);

const blank = store.createChecklist({ title: "周末采购", templateKey: "blank" });
assert.strictEqual(blank.templateKey, "blank");
assert.strictEqual(blank.items.length, 0);
assertPersistedShape(blank);

const travel = store.createChecklist({ title: "东京行李", templateKey: "travel" });
assert.strictEqual(travel.templateKey, "travel");
assert.strictEqual(travel.items.length, store.TEMPLATES.travel.items.length);
assert.strictEqual(store.getChecklists().length, 2, "multiple checklists should coexist");
assertPersistedShape(travel);

const travelBeforeRepeat = storedSnapshot();
store.applyTemplate(travel.id, "travel");
assert.strictEqual(storedSnapshot(), travelBeforeRepeat, "reapplying a template must be a storage no-op");

store.applyTemplate(blank.id, "travel-packing");
const templatedBlank = store.getChecklistById(blank.id);
assert.strictEqual(templatedBlank.templateKey, "travel");
assert.strictEqual(templatedBlank.items.length, store.TEMPLATES.travel.items.length);
const appliedOnce = storedSnapshot();
store.applyTemplate(blank.id, "travel");
assert.strictEqual(storedSnapshot(), appliedOnce, "template items must not duplicate");

const errands = store.createChecklist("出门办事", "blank");
store.addItem(errands.id, "取快递");
store.addItem(errands.id, "买咖啡");
store.addItem(errands.id, "寄文件");
let current = store.getChecklistById(errands.id);
assert.deepStrictEqual(current.items.map((item) => item.text), ["取快递", "买咖啡", "寄文件"]);

const parcelId = current.items[0].id;
const coffeeId = current.items[1].id;
const mailId = current.items[2].id;
store.editItem(errands.id, parcelId, "取两个快递");
store.toggleItem(errands.id, coffeeId);
assert.strictEqual(store.getChecklistById(errands.id).items[0].text, "取两个快递");
assert.strictEqual(store.getChecklistById(errands.id).items[1].done, true);
assert.deepStrictEqual(store.getProgress(errands.id), {
  total: 3,
  completed: 1,
  remaining: 2,
  percent: 33
});

store.moveItem(errands.id, parcelId, "down");
current = store.getChecklistById(errands.id);
assert.deepStrictEqual(current.items.map((item) => item.id), [coffeeId, parcelId, mailId]);
store.reorderItems(errands.id, [mailId, coffeeId, parcelId]);
current = store.getChecklistById(errands.id);
assert.deepStrictEqual(current.items.map((item) => item.id), [mailId, coffeeId, parcelId]);
assert.deepStrictEqual(current.items.map((item) => item.order), [0, 1, 2]);

store.clearCompleted(errands.id);
current = store.getChecklistById(errands.id);
assert.deepStrictEqual(current.items.map((item) => item.id), [mailId, parcelId]);
store.deleteItem(errands.id, mailId);
assert.deepStrictEqual(store.getChecklistById(errands.id).items.map((item) => item.id), [parcelId]);
store.renameChecklist(errands.id, "今日跑腿");
assert.strictEqual(store.getChecklistById(errands.id).title, "今日跑腿");
assert.throws(() => store.renameChecklist(errands.id, "   "), /不能为空/);
assert.throws(() => store.addItem(errands.id, ""), /不能为空/);

store.deleteChecklist(travel.id);
assert.strictEqual(store.getChecklistById(travel.id), null);

const normalized = store.normalizeChecklist({
  id: "backup_list",
  title: "  恢复清单  ",
  templateKey: "packing",
  items: [
    { id: "later", text: " 后一项 ", done: 1, order: 9 },
    { id: "first", text: " 第一项 ", done: true, order: 2 }
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z"
});
assert.strictEqual(normalized.title, "恢复清单");
assert.strictEqual(normalized.templateKey, "travel");
assert.deepStrictEqual(normalized.items.map((item) => item.id), ["first", "later"]);
assert.deepStrictEqual(normalized.items.map((item) => item.done), [true, false]);
assertPersistedShape(normalized);
store.setChecklists([normalized]);
assert.deepStrictEqual(store.getChecklists(), [normalized], "backup set/get contract should round-trip");

function setPath(target, dataPath, value) {
  const parts = dataPath.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    if (!cursor[part]) cursor[part] = {};
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
    Object.keys(patch).forEach((dataPath) => setPath(this.data, dataPath, patch[dataPath]));
    if (callback) callback();
  };
  return page;
}

const page = loadPage("../miniprogram/pages/checklist/index.js");
page.onLoad({ id: normalized.id });
assert.strictEqual(page.data.checklist.id, normalized.id);
page.onNewItemInput({ detail: { value: "护照复印件" } });
page.addItem();
assert.strictEqual(page.data.newItemText, "");
assert(page.data.checklist.items.some((item) => item.text === "护照复印件"));

const added = page.data.checklist.items.find((item) => item.text === "护照复印件");
page.toggleItem({ currentTarget: { dataset: { id: added.id } } });
assert.strictEqual(store.getChecklistById(normalized.id).items.find((item) => item.id === added.id).done, true);
page.clearCompleted();
assert.strictEqual(ui.modals.at(-1).title, "清除已完成项目？");
ui.modals.at(-1).success({ confirm: false });
assert(store.getChecklistById(normalized.id).items.some((item) => item.id === added.id));
page.clearCompleted();
ui.modals.at(-1).success({ confirm: true });
assert(!store.getChecklistById(normalized.id).items.some((item) => item.id === added.id));

const pageRoot = path.join(__dirname, "../miniprogram/pages/checklist");
const json = JSON.parse(fs.readFileSync(path.join(pageRoot, "index.json"), "utf8"));
const wxml = fs.readFileSync(path.join(pageRoot, "index.wxml"), "utf8");
const wxss = fs.readFileSync(path.join(pageRoot, "index.wxss"), "utf8");
const pageSource = fs.readFileSync(path.join(pageRoot, "index.js"), "utf8");
assert.strictEqual(json.usingComponents["ui-icon"], "/components/ui-icon/index");
assert(wxml.includes("<ui-icon"), "checklist page should use the shared icon component");
assert(wxml.includes('role="checkbox"') && wxml.includes("aria-label"), "item controls should be accessible");
assert(wxml.includes('class="empty-all"') && wxml.includes('class="empty-list"'), "both empty states should render");
assert(wxss.includes("position: fixed") && wxss.includes(".add-bar"), "add control should stay fixed");
assert(pageSource.includes('title: "清除已完成项目？"'), "clear completed must ask for confirmation");
assert(pageSource.includes("moveItem"), "page should expose item reordering");
assert(!pageSource.includes("onShow()"), "checklist should not issue duplicate setData calls during first render");

console.log("multi-checklist store and page tests passed");
