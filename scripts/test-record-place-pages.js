const assert = require("assert");

const memory = {};
const ui = { toasts: [], navigations: [], locationMode: "success" };
global.wx = {
  getStorageSync(key) { return memory[key]; },
  setStorageSync(key, value) { memory[key] = JSON.parse(JSON.stringify(value)); },
  removeStorageSync(key) { delete memory[key]; },
  showToast(options) { ui.toasts.push(options.title); },
  showModal(options) { if (options.success) options.success({ confirm: true }); },
  navigateBack() {},
  navigateTo(options) { ui.navigations.push(options.url); },
  redirectTo(options) { ui.navigations.push(options.url); },
  enableAlertBeforeUnload() {},
  disableAlertBeforeUnload() {},
  chooseLocation(options) {
    if (ui.locationMode === "success") options.success({ name: "地图酒店", address: "上海市浦东新区世纪大道", latitude: 31.2, longitude: 121.5 });
    else options.fail({ errMsg: "chooseLocation:fail auth deny" });
  }
};

function setPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
}

function loadPage(modulePath = "../miniprogram/pages/record/record.js") {
  let definition;
  global.Page = (config) => { definition = config; };
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  const page = {};
  Object.keys(definition).forEach((key) => { page[key] = key === "data" ? JSON.parse(JSON.stringify(definition.data)) : definition[key]; });
  page.setData = function setData(patch, callback) {
    Object.keys(patch).forEach((key) => setPath(this.data, key, patch[key]));
    if (callback) callback();
  };
  return page;
}

function input(field, value) {
  return { currentTarget: { dataset: { field } }, detail: { value } };
}

const recordsApi = require("../miniprogram/utils/hotelReviewStore");
const placesApi = require("../miniprogram/utils/placeStore");

function reset() {
  Object.keys(memory).forEach((key) => delete memory[key]);
  ui.toasts = [];
  ui.navigations = [];
  ui.locationMode = "success";
}

function testSuggestedPlaceAndRepeatedVisit() {
  reset();
  let page = loadPage();
  page.onLoad({ type: "hotel" });
  page.onFieldInput(input("hotelName", "上海浦东丽思卡尔顿"));
  page.onFieldInput(input("city", "上海"));
  page.saveRecord({ currentTarget: { dataset: { status: "completed" } } });
  assert.strictEqual(recordsApi.getRecords().length, 1);
  assert.strictEqual(placesApi.getPlaces().length, 1);

  page = loadPage();
  page.onLoad({ type: "hotel" });
  page.onFieldInput(input("hotelName", "上海浦东丽思卡尔顿酒店"));
  page.onFieldInput(input("city", "上海"));
  assert.strictEqual(page.data.placeSuggestions.length, 1);
  page.selectPlaceSuggestion({ currentTarget: { dataset: { id: page.data.placeSuggestions[0].id } } });
  page.saveRecord({ currentTarget: { dataset: { status: "completed" } } });
  assert.strictEqual(placesApi.getPlaces().length, 1);
  const records = recordsApi.getRecords();
  assert.strictEqual(records.length, 2);
  assert.strictEqual(records[0].placeId, records[1].placeId);
}

function testQuickDraftAndOptionalMap() {
  reset();
  const page = loadPage();
  page.onLoad({ type: "restaurant", quick: "1" });
  page.onFieldInput(input("restaurantName", "测试餐厅"));
  page.chooseLocation();
  assert.strictEqual(page.data.form.address, "上海市浦东新区世纪大道");
  page.saveRecord({ currentTarget: { dataset: { status: "draft" } } });
  const record = recordsApi.getRecords()[0];
  assert.strictEqual(record.status, "draft");
  assert.strictEqual(record.isRated, false);
  assert.strictEqual(record.scoreLabel, "未评分");

  const denied = loadPage();
  denied.onLoad({ type: "hotel" });
  ui.locationMode = "deny";
  denied.chooseLocation();
  assert(ui.toasts.includes("可继续手工填写地点"));
}

function testPlaceDetailMergeAndDeleteProtection() {
  reset();
  recordsApi.setRecords([
    { id: "a", recordType: "hotel", hotelName: "重复酒店", placeName: "重复酒店", city: "上海", status: "completed" },
    { id: "b", recordType: "hotel", hotelName: "重复酒店分店", placeName: "重复酒店分店", city: "上海", status: "completed" }
  ]);
  const places = placesApi.getPlaces();
  const source = places.find((item) => item.name === "重复酒店分店");
  const target = places.find((item) => item.name === "重复酒店");
  const page = loadPage("../miniprogram/pages/place/detail.js");
  page.onLoad({ id: source.id });
  page.onShow();
  assert(page.data.mergeCandidates.some((item) => item.id === target.id));
  page.mergeInto({ currentTarget: { dataset: { id: target.id } } });
  assert.strictEqual(placesApi.getPlaces().length, 1);
  assert(recordsApi.getRecords().every((item) => item.placeId === target.id));

  const protectedPage = loadPage("../miniprogram/pages/place/detail.js");
  protectedPage.onLoad({ id: target.id });
  protectedPage.onShow();
  protectedPage.deletePlace();
  assert.strictEqual(placesApi.getPlaces().length, 1);
}

testSuggestedPlaceAndRepeatedVisit();
testQuickDraftAndOptionalMap();
testPlaceDetailMergeAndDeleteProtection();
console.log("record and place page tests passed");
