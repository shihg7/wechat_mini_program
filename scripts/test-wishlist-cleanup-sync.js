const assert = require("assert");

const memory = {};
const files = new Set();
global.wx = {
  getStorageSync(key) { return memory[key]; },
  setStorageSync(key, value) { memory[key] = JSON.parse(JSON.stringify(value)); },
  removeStorageSync(key) { delete memory[key]; },
  getFileSystemManager() {
    return {
      accessSync(path) { if (!files.has(path)) throw new Error("missing"); },
      unlinkSync(path) { files.delete(path); }
    };
  }
};

const records = require("../miniprogram/utils/repositories/recordRepository");
const places = require("../miniprogram/utils/repositories/placeRepository");
const wishlist = require("../miniprogram/utils/repositories/wishlistRepository");
const cleanup = require("../miniprogram/utils/cleanupService");
const media = require("../miniprogram/utils/mediaStore");

function reset() {
  Object.keys(memory).forEach((key) => delete memory[key]);
  files.clear();
}

function testSyncMetadataAndSoftDelete() {
  reset();
  const place = places.createPlace({ type: "hotel", name: "同步酒店", city: "上海" });
  assert.strictEqual(place.syncStatus, "dirty");
  assert.strictEqual(place.revision, 1);
  assert(place.deviceId);
  const updatedPlace = places.updatePlace(place.id, { area: "浦东" });
  assert.strictEqual(updatedPlace.revision, 2);
  assert.strictEqual(places.getPendingSync().length, 1);
  const syncedPlace = places.markSynced(place.id, { id: "cloud-place", revision: 4 });
  assert.strictEqual(syncedPlace.syncStatus, "synced");
  assert.strictEqual(syncedPlace.revision, 4);
  assert.strictEqual(places.getPendingSync().length, 0);
  const conflictPlace = places.markConflict(place.id, { revision: 5, name: "远端名称" });
  assert.strictEqual(conflictPlace.syncStatus, "conflict");
  assert.strictEqual(conflictPlace.conflictSnapshot.name, "远端名称");

  const record = records.addRecord({ recordType: "hotel", hotelName: "同步酒店", placeId: place.id, placeName: place.name });
  assert.strictEqual(record.syncStatus, "dirty");
  records.deleteRecord(record.id);
  assert.strictEqual(records.getRecords().length, 0);
  assert(records.getRecords({ includeDeleted: true })[0].deletedAt);
  assert.strictEqual(records.getPendingSync()[0].deletedAt.length > 0, true);

  places.deleteEmptyPlace(place.id);
  assert.strictEqual(places.getPlaces().length, 0);
  assert(places.getPlaces({ includeDeleted: true })[0].deletedAt);
}

function testWishlistLifecycleAndPublicDtos() {
  reset();
  const place = places.createPlace({ type: "restaurant", name: "云间餐厅", city: "杭州", address: "精确地址", latitude: 30, longitude: 120 });
  let item = wishlist.addWishlistItem({ type: "restaurant", name: "云间餐厅", placeId: place.id, priority: "high", bookingReference: "SECRET" });
  assert.strictEqual(item.status, "wishlist");
  item = wishlist.updateWishlistItem(item.id, { status: "booked" });
  assert.strictEqual(item.revision, 2);
  item = wishlist.markWishlistVisited(item.id, place.id);
  assert.strictEqual(item.status, "visited");
  assert.strictEqual(wishlist.getPendingSync().length, 1);
  item = wishlist.markSynced(item.id, { id: "cloud-wish", revision: 6 });
  assert.strictEqual(item.syncStatus, "synced");
  assert.strictEqual(wishlist.getPendingSync().length, 0);

  const publicPlace = places.toPublicPlaceDto(place);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(publicPlace, "address"), false);
  const review = records.normalizeRecord({ recordType: "restaurant", restaurantName: "云间餐厅", placeId: place.id, city: "杭州", address: "精确地址", deviceId: "device-secret", privateNote: "秘密", publicNote: "公开", photos: [{ id: "photo-private", filePath: "/private.jpg" }] });
  const publicReview = records.toPublicReviewDto(review);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(publicReview, "address"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(publicReview, "deviceId"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(publicReview, "privateNote"), false);
  assert.deepStrictEqual(publicReview.photos, []);
}

function testCleanupOnlyRemovesOwnedOrphans() {
  reset();
  files.add("/saved/valid.jpg");
  files.add("/saved/orphan.jpg");
  files.add("/saved/not-owned.pdf");
  const place = places.createPlace({ type: "hotel", name: "照片酒店", city: "上海", address: "地址" });
  const record = records.addRecord({ recordType: "hotel", hotelName: "照片酒店", placeId: place.id, placeName: place.name, photos: [{ id: "valid", filePath: "/saved/valid.jpg" }, { id: "lost", filePath: "/saved/lost.jpg" }], coverPhotoId: "valid" });
  media.registerMediaPaths(["/saved/valid.jpg", "/saved/lost.jpg", "/saved/orphan.jpg"]);
  let report = cleanup.getCleanupReport();
  assert.strictEqual(report.invalidPhotos.length, 1);
  assert.deepStrictEqual(report.orphanPhotoPaths, ["/saved/orphan.jpg"]);
  cleanup.removeInvalidPhotoMetadata(record.id);
  assert.deepStrictEqual(records.getRecordById(record.id).photos.map((photo) => photo.id), ["valid"]);
  assert.strictEqual(cleanup.cleanOrphanPhotoFiles(), 1);
  assert.strictEqual(files.has("/saved/orphan.jpg"), false);
  assert.strictEqual(files.has("/saved/not-owned.pdf"), true);
}

testSyncMetadataAndSoftDelete();
testWishlistLifecycleAndPublicDtos();
testCleanupOnlyRemovesOwnedOrphans();
console.log("wishlist, cleanup and sync tests passed");
