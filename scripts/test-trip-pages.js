const assert = require("assert");
const fs = require("fs");
const path = require("path");

const memory = {};
const ui = {
  toasts: [],
  navigations: [],
  modalContent: "",
  actionItems: [],
  actionHandler: null,
  backCount: 0,
  leaveAlertCount: 0
};

global.wx = {
  getStorageSync(key) {
    return memory[key];
  },
  setStorageSync(key, value) {
    memory[key] = JSON.parse(JSON.stringify(value));
  },
  showToast(options) {
    ui.toasts.push(options.title);
  },
  showModal(options) {
    ui.modalContent = options.content || "";
    if (options.success) options.success({ confirm: true });
  },
  navigateTo(options) {
    ui.navigations.push(options.url);
  },
  redirectTo(options) {
    ui.navigations.push(options.url);
  },
  navigateBack() {
    ui.backCount += 1;
  },
  showActionSheet(options) {
    ui.actionItems = options.itemList || [];
    ui.actionHandler = options.success || null;
  },
  enableAlertBeforeUnload() {
    ui.leaveAlertCount += 1;
  },
  disableAlertBeforeUnload() {
    ui.leaveAlertCount = Math.max(0, ui.leaveAlertCount - 1);
  }
};

function setPath(target, pathText, value) {
  const parts = pathText.split(".");
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
    page[key] = key === "data"
      ? JSON.parse(JSON.stringify(definition.data))
      : definition[key];
  });
  page.setData = function setData(patch, callback) {
    Object.keys(patch).forEach((pathText) => setPath(this.data, pathText, patch[pathText]));
    if (callback) callback();
  };
  return page;
}

const tripStore = require("../miniprogram/utils/tripStore");
const trip = tripStore.addTrip({
  title: "上海周末",
  destination: "上海",
  note: "周年旅行",
  startDate: "2026-08-01",
  endDate: "2026-08-02"
});
tripStore.addItem(trip.id, {
  title: "咖啡",
  date: "2026-08-01",
  time: "09:00",
  location: "外滩"
});
tripStore.addItem(trip.id, {
  title: "博物馆",
  date: "2026-08-01",
  time: "09:00",
  location: "人民广场"
});

const indexPage = loadPage("../miniprogram/pages/trip/index.js");
indexPage.onShow();
assert.strictEqual(indexPage.data.trips.length, 1);
assert.strictEqual(indexPage.data.trips[0].destinationText, "上海");
assert.strictEqual(indexPage.data.trips[0].itemCount, 2);
indexPage.search({ detail: { value: "外滩" } });
assert.strictEqual(indexPage.data.trips.length, 1, "search includes item locations");
indexPage.search({ detail: { value: "北京" } });
assert.strictEqual(indexPage.data.trips.length, 0);
assert.strictEqual(indexPage.data.allTripCount, 1);
assert.strictEqual(indexPage.data.hasActiveSearch, true);
indexPage.clearSearch();
assert.strictEqual(indexPage.data.keyword, "");
assert.strictEqual(indexPage.data.trips.length, 1);
indexPage.createTrip();
indexPage.openTrip({ currentTarget: { dataset: { id: trip.id } } });
assert(ui.navigations.includes("/pages/trip/edit"));
assert(ui.navigations.includes(`/pages/trip/detail?id=${trip.id}`));

const editPage = loadPage("../miniprogram/pages/trip/edit.js");
editPage.onLoad({ id: trip.id });
assert.strictEqual(editPage.data.form.destination, "上海");
editPage.input({
  currentTarget: { dataset: { field: "destination" } },
  detail: { value: "上海、苏州" }
});
assert.strictEqual(editPage.data.dirty, true);
assert.strictEqual(ui.leaveAlertCount, 1);
editPage.save();
assert.strictEqual(tripStore.getTripById(trip.id).destination, "上海、苏州");
assert(ui.navigations.includes(`/pages/trip/detail?id=${trip.id}`));

const invalidEditPage = loadPage("../miniprogram/pages/trip/edit.js");
invalidEditPage.onLoad({ id: trip.id });
invalidEditPage.setData({ "form.startDate": "2026-08-03", "form.endDate": "2026-08-01" });
invalidEditPage.save();
assert(ui.toasts.some((title) => title.includes("结束日期")));
assert.strictEqual(invalidEditPage.data.saving, false);

const createPage = loadPage("../miniprogram/pages/trip/edit.js");
createPage.onLoad({});
createPage.input({
  currentTarget: { dataset: { field: "title" } },
  detail: { value: "杭州一日" }
});
createPage.input({
  currentTarget: { dataset: { field: "destination" } },
  detail: { value: "杭州" }
});
createPage.setData({ "form.startDate": "2026-09-01", "form.endDate": "2026-09-01" });
createPage.save();
const createdTrip = tripStore.getTrips().find((item) => item.title === "杭州一日");
assert(createdTrip);
assert.deepStrictEqual(createdTrip.items, []);

const detailPage = loadPage("../miniprogram/pages/trip/detail.js");
detailPage.onLoad({ id: trip.id });
detailPage.onShow();
assert.strictEqual(detailPage.data.days.length, 2);
assert.strictEqual(detailPage.data.days[0].items.length, 2);
assert.strictEqual(detailPage.data.conflicts.length, 1);

const museumId = detailPage.data.trip.items.find((item) => item.title === "博物馆").id;
detailPage.showItemActions({ currentTarget: { dataset: { id: museumId } } });
assert.deepStrictEqual(ui.actionItems, ["上移日程", "复制日程", "删除日程"]);
ui.actionHandler({ tapIndex: 0 });
assert.strictEqual(detailPage.data.days[0].items[0].id, museumId);

detailPage.copyItem({ currentTarget: { dataset: { id: museumId } } });
assert.strictEqual(detailPage.data.trip.items.length, 3);
assert(ui.toasts.includes("日程已复制"));

detailPage.editItem({ currentTarget: { dataset: { id: museumId } } });
detailPage.input({
  currentTarget: { dataset: { field: "title" } },
  detail: { value: "上海博物馆" }
});
detailPage.input({
  currentTarget: { dataset: { field: "location" } },
  detail: { value: "人民广场馆" }
});
detailPage.saveItem();
const editedItem = tripStore.getTripById(trip.id).items.find((item) => item.id === museumId);
assert.strictEqual(editedItem.title, "上海博物馆");
assert.strictEqual(editedItem.location, "人民广场馆");
assert(ui.toasts.includes("日程已更新"));

detailPage.openNewItem();
detailPage.setData({
  itemForm: {
    title: "晚餐",
    date: "2026-08-02",
    time: "18:30",
    location: "静安寺",
    note: ""
  }
});
detailPage.saveItem();
assert(tripStore.getTripById(trip.id).items.some((item) => item.title === "晚餐"));
assert(ui.toasts.includes("日程已添加"));

detailPage.openNewItem();
detailPage.setData({
  itemForm: {
    title: "越界日程",
    date: "2026-08-03",
    time: "",
    location: "",
    note: ""
  }
});
const countBeforeInvalid = tripStore.getTripById(trip.id).items.length;
detailPage.saveItem();
assert.strictEqual(tripStore.getTripById(trip.id).items.length, countBeforeInvalid);
assert.strictEqual(detailPage.data.showForm, true);
assert(ui.toasts.some((title) => title.includes("超出行程范围")));
detailPage.cancelForm();

const copiedItem = tripStore.getTripById(trip.id).items.find((item) => item.title.endsWith("副本"));
detailPage.removeItem({ currentTarget: { dataset: { id: copiedItem.id } } });
assert.strictEqual(tripStore.getTripById(trip.id).items.some((item) => item.id === copiedItem.id), false);

detailPage.showTripActions();
assert.deepStrictEqual(ui.actionItems, ["复制行程", "删除行程"]);
detailPage.duplicate();
assert(tripStore.getTrips().some((item) => item.title === "上海周末 副本"));
assert(ui.navigations.some((url) => url.startsWith("/pages/trip/detail?id=")));

const removable = tripStore.addTrip({
  title: "可删除行程",
  destination: "南京",
  startDate: "2026-10-01",
  endDate: "2026-10-01"
});
tripStore.addItem(removable.id, {
  title: "城墙",
  date: "2026-10-01",
  time: "",
  location: ""
});
const removablePage = loadPage("../miniprogram/pages/trip/detail.js");
removablePage.onLoad({ id: removable.id });
removablePage.onShow();
removablePage.removeTrip();
assert.strictEqual(tripStore.getTripById(removable.id), null, "trip deletion includes its items");
assert(ui.modalContent.includes("全部日程"));

const missingDetailPage = loadPage("../miniprogram/pages/trip/detail.js");
missingDetailPage.onLoad({ id: "missing-trip" });
missingDetailPage.onShow();
assert.strictEqual(missingDetailPage.data.missing, true);
missingDetailPage.goBack();

const missingEditPage = loadPage("../miniprogram/pages/trip/edit.js");
missingEditPage.onLoad({ id: "missing-trip" });
assert.strictEqual(missingEditPage.data.missing, true);
assert.strictEqual(missingEditPage.data.mode, "create");
assert(ui.backCount >= 1);

const root = path.resolve(__dirname, "..");
const runtimeFiles = [
  "miniprogram/utils/tripStore.js",
  "miniprogram/pages/trip/index.js",
  "miniprogram/pages/trip/index.wxml",
  "miniprogram/pages/trip/edit.js",
  "miniprogram/pages/trip/edit.wxml",
  "miniprogram/pages/trip/detail.js",
  "miniprogram/pages/trip/detail.wxml",
  "miniprogram/pages/trip/detail.json"
];
const runtimeSource = runtimeFiles.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
[
  "baseCurrency",
  "budgetTotalCents",
  "personalExpenses",
  "linkedLedgerIds",
  "itineraryItems",
  "placeId",
  "wishlistId",
  "bookingId",
  "demoMode",
  "demo-guide"
].forEach((removedTerm) => {
  assert.strictEqual(runtimeSource.includes(removedTerm), false, `${removedTerm} is removed from trip runtime files`);
});

["index", "edit", "detail"].forEach((pageName) => {
  const json = JSON.parse(fs.readFileSync(path.join(root, `miniprogram/pages/trip/${pageName}.json`), "utf8"));
  assert.strictEqual(json.usingComponents["ui-icon"], "/components/ui-icon/index");
  const wxml = fs.readFileSync(path.join(root, `miniprogram/pages/trip/${pageName}.wxml`), "utf8");
  assert(wxml.includes("<ui-icon"), `${pageName} uses ui-icon`);
});
["edit", "detail"].forEach((pageName) => {
  const wxml = fs.readFileSync(path.join(root, `miniprogram/pages/trip/${pageName}.wxml`), "utf8");
  const wxss = fs.readFileSync(path.join(root, `miniprogram/pages/trip/${pageName}.wxss`), "utf8");
  assert(wxml.includes('class="save-bar'), `${pageName} has a save bar`);
  assert(/\.save-bar\s*\{[\s\S]*?position:\s*fixed/.test(wxss), `${pageName} save bar is fixed`);
});

console.log("itinerary-only trip page interaction tests passed");
