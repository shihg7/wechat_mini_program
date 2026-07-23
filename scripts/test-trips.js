const assert = require("assert");

const memory = {};
global.wx = {
  getStorageSync(key) {
    return memory[key];
  },
  setStorageSync(key, value) {
    memory[key] = JSON.parse(JSON.stringify(value));
  }
};

const tripStore = require("../miniprogram/utils/tripStore");

const TRIP_KEYS = [
  "createdAt",
  "destination",
  "endDate",
  "id",
  "items",
  "note",
  "startDate",
  "title",
  "updatedAt"
];
const ITEM_KEYS = ["date", "id", "location", "note", "order", "time", "title"];

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function assertSchema(trip) {
  assert.deepStrictEqual(sortedKeys(trip), TRIP_KEYS, "trip uses the itinerary-only schema");
  trip.items.forEach((item) => {
    assert.deepStrictEqual(sortedKeys(item), ITEM_KEYS, "item uses the itinerary-only schema");
  });
}

assert.strictEqual(tripStore.STORAGE_KEY, "toolbox_trips");
["getTrips", "setTrips", "normalizeTrip"].forEach((name) => {
  assert.strictEqual(typeof tripStore[name], "function", `${name} remains available to backup integration`);
});

// Pure-date handling is timezone-stable and rejects impossible calendar dates.
assert.deepStrictEqual(
  tripStore.dateRange("2026-01-31", "2026-02-02"),
  ["2026-01-31", "2026-02-01", "2026-02-02"]
);
assert.deepStrictEqual(
  tripStore.dateRange("2026-12-31", "2027-01-01"),
  ["2026-12-31", "2027-01-01"]
);
assert.deepStrictEqual(tripStore.dateRange("2026-02-30", "2026-03-01"), []);
assert.deepStrictEqual(tripStore.dateRange("2026-01-02", "2026-01-01"), []);
assert.strictEqual(
  tripStore.dateRange("2026-01-01", "2027-12-31").length,
  370,
  "long timelines remain bounded"
);

const normalized = tripStore.normalizeTrip({
  id: "normalized-trip",
  title: "  轻量行程  ",
  destination: "  杭州  ",
  startDate: "2026-09-01",
  endDate: "2026-09-01",
  note: "  只看日程  ",
  baseCurrency: "CNY",
  budgetTotalCents: 50000,
  linkedLedgerIds: ["ledger-1"],
  personalExpenses: [{ amountCents: 100 }],
  itineraryItems: [{ title: "旧日程" }],
  items: [{
    id: "normalized-item",
    date: "2026-09-01",
    time: "09:00",
    title: "  西湖  ",
    location: "  断桥  ",
    note: "  早点到  ",
    order: 8,
    placeId: "place-1",
    wishlistId: "wish-1",
    bookingId: "booking-1"
  }]
});
assertSchema(normalized);
assert.strictEqual(normalized.title, "轻量行程");
assert.strictEqual(normalized.destination, "杭州");
assert.strictEqual(normalized.items[0].order, 0, "orders are compacted per day");
assert.strictEqual(normalized.items[0].location, "断桥");

assert.throws(
  () => tripStore.addTrip({ title: "", startDate: "2026-08-01", endDate: "2026-08-02" }),
  /行程名称/
);
assert.throws(
  () => tripStore.addTrip({ title: "缺少日期" }),
  /有效的行程日期/
);
assert.throws(
  () => tripStore.addTrip({ title: "错误日期", startDate: "2026-08-03", endDate: "2026-08-01" }),
  /结束日期/
);
assert.throws(
  () => tripStore.addTrip({ title: "无效日期", startDate: "2026-02-30", endDate: "2026-03-01" }),
  /有效的行程日期/
);

const trip = tripStore.addTrip({
  title: "东京周末",
  destination: "东京",
  startDate: "2026-08-01",
  endDate: "2026-08-03",
  note: "夏日旅行",
  currency: "JPY",
  expenses: [{ amount: 100 }]
});
assertSchema(trip);
assert.strictEqual(memory.toolbox_trips.length, 1);
assert.strictEqual(memory.experience_trips, undefined);

const updatedTrip = tripStore.updateTrip(trip.id, {
  destination: "东京、镰仓",
  note: "轻装出发",
  baseCurrency: "USD"
});
assert.strictEqual(updatedTrip.destination, "东京、镰仓");
assert.strictEqual(updatedTrip.note, "轻装出发");
assertSchema(updatedTrip);

tripStore.addItem(trip.id, {
  title: "早餐",
  date: "2026-08-01",
  time: "08:00",
  location: "酒店餐厅"
});
tripStore.addItem(trip.id, {
  title: "出发",
  date: "2026-08-01",
  time: "08:00",
  location: "东京站"
});
let current = tripStore.getTripById(trip.id);
assert.strictEqual(current.items.length, 2);
assertSchema(current);
assert.strictEqual(tripStore.findConflicts(current.items).length, 1);

const breakfast = current.items.find((item) => item.title === "早餐");
const departure = current.items.find((item) => item.title === "出发");
tripStore.updateItem(trip.id, breakfast.id, {
  title: "酒店早餐",
  time: "07:30",
  note: "退房前用餐"
});
const editedBreakfast = tripStore.getTripById(trip.id).items.find((item) => item.id === breakfast.id);
assert.strictEqual(editedBreakfast.title, "酒店早餐");
assert.strictEqual(editedBreakfast.id, breakfast.id);
assert.strictEqual(tripStore.findConflicts(tripStore.getTripById(trip.id).items).length, 0);

const itemCountBeforeInvalid = tripStore.getTripById(trip.id).items.length;
assert.throws(
  () => tripStore.addItem(trip.id, { title: "越界安排", date: "2026-08-04" }),
  /超出行程范围/
);
assert.throws(
  () => tripStore.addItem(trip.id, { title: "错误时间", date: "2026-08-01", time: "25:00" }),
  /时间格式/
);
assert.throws(
  () => tripStore.addItem(trip.id, { title: "", date: "2026-08-01" }),
  /日程名称/
);
assert.strictEqual(
  tripStore.getTripById(trip.id).items.length,
  itemCountBeforeInvalid,
  "invalid item writes are atomic"
);

tripStore.duplicateItem(trip.id, departure.id);
current = tripStore.getTripById(trip.id);
const departureCopy = current.items.find((item) => item.title === "出发 副本");
assert(departureCopy);
assert.notStrictEqual(departureCopy.id, departure.id);
assert.strictEqual(departureCopy.order, departure.order + 1);

tripStore.moveItem(trip.id, departureCopy.id, "up");
current = tripStore.getTripById(trip.id);
const orderedDay = current.items.filter((item) => item.date === "2026-08-01");
assert(orderedDay.findIndex((item) => item.id === departureCopy.id) < orderedDay.findIndex((item) => item.id === departure.id));
assert.deepStrictEqual(orderedDay.map((item) => item.order), [0, 1, 2]);

tripStore.updateItem(trip.id, departureCopy.id, { date: "2026-08-02", time: "10:00" });
current = tripStore.getTripById(trip.id);
assert.strictEqual(current.items.find((item) => item.id === departureCopy.id).order, 0);
tripStore.deleteItem(trip.id, breakfast.id);
assert.strictEqual(tripStore.getTripById(trip.id).items.some((item) => item.id === breakfast.id), false);

const copy = tripStore.duplicateTrip(trip.id);
assert(copy);
assert.notStrictEqual(copy.id, trip.id);
assert.strictEqual(copy.title, "东京周末 副本");
assert.strictEqual(copy.items.length, tripStore.getTripById(trip.id).items.length);
assert(copy.items.every((item) => {
  return !tripStore.getTripById(trip.id).items.some((source) => source.id === item.id);
}));
assertSchema(copy);

assert.strictEqual(tripStore.deleteTrip(trip.id), true, "deleting a trip cascades its items");
assert.strictEqual(tripStore.getTripById(trip.id), null);
assert.strictEqual(tripStore.deleteTrip("missing-trip"), false);

const restored = tripStore.setTrips([{
  id: "backup-trip",
  title: "备份行程",
  destination: "成都",
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  note: "",
  items: [{
    id: "backup-item",
    date: "2026-10-01",
    time: "12:00",
    title: "午餐",
    location: "春熙路",
    note: "",
    order: 9,
    bookingId: "removed"
  }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  budgets: [1],
  ledgerIds: ["removed"]
}]);
assert.strictEqual(restored.length, 1);
assertSchema(restored[0]);
assert.strictEqual(restored[0].items[0].order, 0);
assert.deepStrictEqual(memory.toolbox_trips, restored);
assert.deepStrictEqual(tripStore.getTrips(), restored);

console.log("itinerary-only trip store tests passed");
