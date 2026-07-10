const assert = require("assert");

const memory = {};
const ui = { toasts: [], navigations: [], locationMode: "success" };
const savedFiles = new Set();
let photoIndex = 0;
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
  },
  chooseMedia(options) { options.success({ tempFiles: [{ tempFilePath: "/tmp/photo.jpg" }] }); },
  saveFile(options) {
    const savedFilePath = `/saved/page-photo-${photoIndex += 1}.jpg`;
    savedFiles.add(savedFilePath);
    options.success({ savedFilePath });
  },
  previewImage() {},
  getFileSystemManager() {
    return {
      accessSync(path) { if (!savedFiles.has(path)) throw new Error("missing"); },
      unlinkSync(path) { savedFiles.delete(path); }
    };
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
const wishlistApi = require("../miniprogram/utils/wishlistStore");

function reset() {
  Object.keys(memory).forEach((key) => delete memory[key]);
  ui.toasts = [];
  ui.navigations = [];
  ui.locationMode = "success";
  savedFiles.clear();
}

async function testPhotoClickFlow() {
  reset();
  let page = loadPage();
  page.onLoad({ type: "hotel" });
  page.onFieldInput(input("hotelName", "照片酒店"));
  await page.addPhotos();
  assert.strictEqual(page.data.form.photos.length, 1);
  const photo = page.data.form.photos[0];
  assert.strictEqual(page.data.form.coverPhotoId, photo.id);
  assert(savedFiles.has(photo.filePath));
  page.onPhotoCaptionInput({ currentTarget: { dataset: { id: photo.id } }, detail: { value: "窗外景观" } });
  page.saveRecord({ currentTarget: { dataset: { status: "completed" } } });
  const saved = recordsApi.getRecords()[0];
  assert.strictEqual(saved.photos[0].caption, "窗外景观");

  page = loadPage();
  page.onLoad({ id: saved.id });
  assert.strictEqual(page.data.form.photos[0].available, true);
  page.enterEdit();
  page.removePhoto({ currentTarget: { dataset: { id: photo.id } } });
  assert(savedFiles.has(photo.filePath), "existing photo is retained until the record save succeeds");
  page.saveRecord({ currentTarget: { dataset: { status: "completed" } } });
  assert.strictEqual(recordsApi.getRecords()[0].photos.length, 0);
  assert.strictEqual(savedFiles.has(photo.filePath), false);
}

function testWishlistConvertsAfterRecordSave() {
  reset();
  const wish = wishlistApi.addWishlistItem({ type: "hotel", name: "计划酒店", city: "东京", targetDate: "2026-10-01" });
  let page = loadPage();
  page.onLoad({ type: "hotel", wishlistId: wish.id });
  page.saveRecord({ currentTarget: { dataset: { status: "draft" } } });
  assert.strictEqual(wishlistApi.getWishlistItem(wish.id).status, "wishlist");

  const completedWish = wishlistApi.addWishlistItem({ type: "hotel", name: "正式计划酒店", city: "东京", targetDate: "2026-10-02" });
  page = loadPage();
  page.onLoad({ type: "hotel", wishlistId: completedWish.id });
  assert.strictEqual(page.data.form.hotelName, "正式计划酒店");
  assert.strictEqual(page.data.form.wishlistId, completedWish.id);
  if (page.data.placeSuggestions.length) page.createAsNewPlace();
  page.saveRecord({ currentTarget: { dataset: { status: "completed" } } });
  const saved = recordsApi.getRecords().find((record) => record.wishlistId === completedWish.id);
  assert(saved);
  assert.strictEqual(saved.wishlistId, completedWish.id);
  assert.strictEqual(wishlistApi.getWishlistItem(completedWish.id).status, "visited");
  assert.strictEqual(wishlistApi.getWishlistItem(completedWish.id).placeId, saved.placeId);
}

function testWishlistPageRequiresExplicitPlaceChoice() {
  reset();
  const place = placesApi.createPlace({ type: "hotel", name: "明确关联酒店", city: "上海", address: "测试地址" });
  const page = loadPage("../miniprogram/pages/wishlist/edit.js");
  page.onLoad({ type: "hotel" });
  page.onInput(input("name", "明确关联酒店"));
  page.onInput(input("city", "上海"));
  assert.strictEqual(page.data.suggestions.length, 1);
  page.save();
  assert(ui.toasts.includes("先确认是否关联已有地点"));
  assert.strictEqual(wishlistApi.getWishlist().length, 0);
  page.selectPlace({ currentTarget: { dataset: { id: place.id } } });
  page.onPriorityTap({ currentTarget: { dataset: { value: "high" } } });
  page.save();
  const saved = wishlistApi.getWishlist()[0];
  assert.strictEqual(saved.placeId, place.id);
  assert.strictEqual(saved.priority, "high");
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

async function run() {
  testSuggestedPlaceAndRepeatedVisit();
  testQuickDraftAndOptionalMap();
  testPlaceDetailMergeAndDeleteProtection();
  testWishlistConvertsAfterRecordSave();
  testWishlistPageRequiresExplicitPlaceChoice();
  await testPhotoClickFlow();
  console.log("record and place page tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
