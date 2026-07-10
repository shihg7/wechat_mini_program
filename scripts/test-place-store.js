const assert = require("assert");

const memory = {};
global.wx = {
  getStorageSync(key) { return memory[key]; },
  setStorageSync(key, value) { memory[key] = JSON.parse(JSON.stringify(value)); },
  removeStorageSync(key) { delete memory[key]; }
};

const recordsApi = require("../miniprogram/utils/hotelReviewStore");
const placesApi = require("../miniprogram/utils/placeStore");

function reset() {
  Object.keys(memory).forEach((key) => delete memory[key]);
}

function record(id, status = "completed", extra = {}) {
  return {
    id,
    recordType: "hotel",
    hotelName: "浦东丽思卡尔顿",
    placeName: "浦东丽思卡尔顿",
    city: "上海",
    stayDate: id === "r1" ? "2026-01-01" : "2026-02-01",
    status,
    overallScore: id === "r1" ? 8 : 9,
    ...extra
  };
}

function testMigrationDoesNotMergeAndIsIdempotent() {
  reset();
  recordsApi.setRecords([record("r1"), record("r2")]);
  const first = placesApi.getPlaces();
  const firstRecords = recordsApi.getRecords();
  assert.strictEqual(first.length, 2);
  assert.notStrictEqual(firstRecords[0].placeId, firstRecords[1].placeId);
  const snapshot = JSON.stringify(memory);
  placesApi.getPlaces();
  assert.strictEqual(JSON.stringify(memory), snapshot);
  const suggestions = placesApi.findPlaceSuggestions({ type: "hotel", name: "浦东丽思卡尔顿酒店", city: "上海" });
  assert.strictEqual(suggestions.length, 2);
  assert.strictEqual(JSON.stringify(memory), snapshot, "suggestions must not mutate data");
}

function testStatsMergeAndDeleteProtection() {
  reset();
  recordsApi.setRecords([record("r1"), record("r2", "draft")]);
  const places = placesApi.getPlaces();
  const target = places[0];
  const source = places[1];
  const records = recordsApi.getRecords().map((item) => item.id === "r2" ? { ...item, placeId: source.id } : { ...item, placeId: target.id });
  recordsApi.setRecords(records);
  const stats = placesApi.getPlaceStats(target.id);
  assert.strictEqual(stats.visitCount, 1);
  assert.strictEqual(stats.ratedCount, 1);
  assert.throws(() => placesApi.deleteEmptyPlace(target.id), /仍有关联记录/);

  placesApi.mergePlaces(source.id, target.id);
  assert.strictEqual(placesApi.getPlaces().length, 1);
  assert(recordsApi.getRecords().every((item) => item.placeId === target.id));
  assert(placesApi.getPlaceById(target.id).aliases.includes(source.name));
}

testMigrationDoesNotMergeAndIsIdempotent();
testStatsMergeAndDeleteProtection();
console.log("place store tests passed");
