const assert = require("assert");

global.wx = { getStorageSync() { return []; }, setStorageSync() {} };
const { buildScores } = require("../miniprogram/utils/hotelScore");
const { buildTravelInsights, getAvailableYears } = require("../miniprogram/utils/travelInsights");

function record(id, name, type, date, score, placeId, extra = {}) {
  const scores = buildScores(type, score);
  return {
    id, displayName: name, hotelName: type === "hotel" ? name : "", restaurantName: type === "restaurant" ? name : "",
    recordType: type, stayDate: date, createdAt: `${date}T00:00:00.000Z`, overallScore: score, isRated: true,
    status: "completed", placeId, city: extra.city || "上海", scores, selectedTags: extra.selectedTags || {}, customTags: extra.customTags || []
  };
}

const records = [
  record("h1", "外滩酒店", "hotel", "2025-01-10", 8, "p1", { customTags: ["景观"] }),
  record("h2", "外滩酒店", "hotel", "2025-06-10", 9, "p1", { customTags: ["景观"] }),
  record("r1", "云间餐厅", "restaurant", "2025-06-11", 9.5, "p2", { city: "杭州" }),
  { ...record("draft", "草稿", "hotel", "2025-07-01", 10, "p3"), status: "draft", isRated: false },
  record("old", "旧酒店", "hotel", "2024-02-01", 7, "p4")
];

assert.deepStrictEqual(getAvailableYears(records), ["all", "2025", "2024"]);
const result = buildTravelInsights(records, "2025");
assert.strictEqual(result.total, 3);
assert.strictEqual(result.ratedTotal, 3);
assert.strictEqual(result.cityTotal, 2);
assert.strictEqual(result.revisitPlaceTotal, 1);
assert.strictEqual(result.best.hotel.name, "外滩酒店");
assert.strictEqual(result.best.restaurant.name, "云间餐厅");
assert.strictEqual(result.revisitTrends[0].delta, 1);
assert.strictEqual(result.monthTrend.find((item) => item.key === "2025-06").count, 2);
assert.deepStrictEqual(result.tagRanking[0], { name: "景观", count: 2, percent: 100 });
console.log("travel insights tests passed");
