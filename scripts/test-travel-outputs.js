const assert = require("assert");

const memory = {};
const files = new Set(["/photos/a.jpg", "/photos/b.jpg", "/photos/c.jpg"]);
global.wx = {
  getStorageSync(key) { return memory[key]; },
  setStorageSync(key, value) { memory[key] = JSON.parse(JSON.stringify(value)); },
  getFileSystemManager() { return { accessSync(path) { if (!files.has(path)) throw new Error("missing"); } }; }
};

const { buildScores } = require("../miniprogram/utils/hotelScore");
const { buildStoryModel, loadStoryPreferences, saveStoryPreferences } = require("../miniprogram/utils/storyRenderer");
const { buildYearbook, loadYearbookPreferences, saveYearbookPreferences } = require("../miniprogram/utils/yearbookBuilder");
const { buildTravelMapData, filterMapPoints, toMarkers } = require("../miniprogram/utils/travelMap");

function experience(id, name, date, score, placeId, photos = []) {
  return { id, displayName: name, hotelName: name, recordType: "hotel", typeLabel: "酒店", city: "上海", stayDate: date, visitMonth: date.slice(0, 7), createdAt: `${date}T00:00:00Z`, status: "completed", isRated: true, overallScore: score, placeId, scores: buildScores("hotel", score), selectedTags: { lounge: ["景观好"], breakfast: [], pool: [] }, customTags: ["纪念日"], publicNote: "公开摘要", privateNote: "绝密", address: "精确地址", memberLevel: "钻石", photos };
}

const recordA = experience("r1", "外滩酒店", "2026-01-10", 9, "p1", [{ id: "a", filePath: "/photos/a.jpg", category: "房间", caption: "江景" }, { id: "lost", filePath: "/photos/lost.jpg", category: "环境" }]);
const story = buildStoryModel(recordA, { title: "我的公开回顾", photoIds: ["lost", "a"], options: { showCity: true, showMonth: true, showScore: true, showCategories: true, showTags: true, showSummary: true } });
assert.deepStrictEqual(story.photos.map((photo) => photo.id), ["a"]);
assert.strictEqual(story.month, "2026-01");
assert.strictEqual(Object.prototype.hasOwnProperty.call(story, "address"), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(story, "privateNote"), false);
saveStoryPreferences("r1", { title: "保存标题", photoIds: ["a"] });
assert.strictEqual(loadStoryPreferences("r1").title, "保存标题");

const recordB = experience("r2", "浦东酒店", "2026-02-10", 8, "p2", [{ id: "b", filePath: "/photos/b.jpg", category: "早餐" }]);
const draft = { ...experience("draft", "草稿酒店", "2026-03-01", 10, "p3"), status: "draft" };
const yearbook = buildYearbook([recordA, recordB, draft], [{ expenses: [{ paidAt: "2026-02-01", amountCents: 12345 }] }], "2026", { includeAa: true, photoIds: ["a", "b", "lost"] });
assert.strictEqual(yearbook.insights.total, 2);
assert.strictEqual(yearbook.photos.length, 2);
assert.strictEqual(yearbook.months.length, 2);
assert.strictEqual(yearbook.aaSummary.totalCents, 12345);
saveYearbookPreferences("2026", { title: "我的 2026", photoIds: ["a"] });
assert.strictEqual(loadYearbookPreferences("2026").title, "我的 2026");

const places = [{ id: "p1", type: "hotel", name: "外滩酒店", city: "上海", latitude: 31.2, longitude: 121.5 }, { id: "p2", type: "hotel", name: "无坐标酒店", city: "北京", latitude: null, longitude: null }, { id: "p3", type: "hotel", name: "空地点", city: "杭州", latitude: 30.2, longitude: 120.2 }];
const wishlist = [{ id: "w1", type: "hotel", name: "外滩酒店", placeId: "p1", status: "wishlist" }, { id: "w2", type: "restaurant", name: "同坐标餐厅", city: "上海", latitude: 31.2, longitude: 121.5, status: "wishlist" }, { id: "w3", type: "hotel", name: "无坐标酒店", placeId: "p2", status: "wishlist" }];
const mapData = buildTravelMapData(places, [recordA], wishlist);
assert.strictEqual(mapData.located.length, 2);
assert.strictEqual(mapData.missing.length, 1);
assert.strictEqual(mapData.located.some((point) => point.entityId === "p3"), false);
const merged = mapData.located.find((point) => point.entityId === "p1");
assert.strictEqual(merged.visited, true);
assert.strictEqual(merged.wished, true);
assert.notStrictEqual(mapData.located[0].latitude, mapData.located[1].latitude);
assert.strictEqual(filterMapPoints(mapData.located, "restaurant").length, 1);
assert.strictEqual(toMarkers(mapData.located).length, 2);
console.log("travel map, story and yearbook tests passed");
