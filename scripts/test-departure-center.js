const assert = require("assert");

const memory = {};
global.wx = {
  getStorageSync(key) { return memory[key]; },
  setStorageSync(key, value) { memory[key] = JSON.parse(JSON.stringify(value)); },
  removeStorageSync(key) { delete memory[key]; }
};

const store = require("../miniprogram/utils/departureStore");

assert.strictEqual(store.parseMoneyToCents("¥1,234.56"), 123456);
assert.strictEqual(store.parseMoneyToCents("8"), 800);
assert.strictEqual(store.parseMoneyToCents("0.09"), 9);
assert(Number.isNaN(store.parseMoneyToCents("12.345")));
assert(Number.isNaN(store.parseMoneyToCents("999999999999999999")));
assert.strictEqual(store.formatMoney(9), "¥0.09");
assert.strictEqual(store.daysUntil("2026-07-16", new Date("2026-07-15T10:00:00+08:00")), 1);

const booking = store.addBooking({
  type: "hotel",
  name: "测试酒店",
  city: "上海",
  startDate: "2026-07-18",
  endDate: "2026-07-20",
  cancellationDate: "2026-07-16",
  cancellationTime: "09:00",
  amountText: "2388.01",
  peopleCount: 3,
  paymentStatus: "paid"
});
assert.strictEqual(booking.amountCents, 238801);
assert.strictEqual(booking.peopleCount, 3);
assert.strictEqual(store.getBookings().length, 1);

const urgent = store.getBookingView(booking, new Date("2026-07-15T10:00:00+08:00"));
assert.strictEqual(urgent.cancellationLabel, "取消期限剩 23 小时");
assert.strictEqual(urgent.urgencyTone, "accent");
assert.strictEqual(urgent.timingLabel, "3 天后");

assert.throws(() => store.addBooking({ name: "", startDate: "2026-07-18" }), /名称/);
assert.throws(() => store.addBooking({ name: "错误日期", startDate: "2026-07-18", endDate: "2026-07-17" }), /结束日期/);
assert.throws(() => store.addBooking({ name: "错误取消", startDate: "2026-07-18", cancellationDate: "2026-07-19" }), /取消期限/);

const updated = store.updateBooking(booking.id, { bookingReference: "ABC-001", status: "completed" });
assert.strictEqual(updated.bookingReference, "ABC-001");
assert.strictEqual(updated.status, "completed");
assert(Number(updated.revision) > Number(booking.revision));

const firstSeed = store.seedChecklist("trip-a");
assert.strictEqual(firstSeed.length, store.CHECKLIST_TEMPLATES.length);
const secondSeed = store.seedChecklist("trip-a");
assert.strictEqual(secondSeed.length, store.CHECKLIST_TEMPLATES.length, "seeding must stay idempotent");
assert.strictEqual(store.getChecklistItems({ tripId: "trip-a" }).length, store.CHECKLIST_TEMPLATES.length);
store.toggleChecklistItem(firstSeed[0].id);
let checklistSummary = store.getChecklistSummary(store.getChecklistItems({ tripId: "trip-a" }));
assert.strictEqual(checklistSummary.completed, 1);
assert.strictEqual(checklistSummary.remaining, store.CHECKLIST_TEMPLATES.length - 1);

const custom = store.addChecklistItem({ tripId: "trip-a", title: "下载离线地图", owner: "我" });
assert.strictEqual(custom.owner, "我");
store.updateChecklistItem(custom.id, { owner: "小林" });
assert.strictEqual(store.getChecklistItems({ tripId: "trip-a" }).find((item) => item.id === custom.id).owner, "小林");
store.deleteChecklistItem(custom.id);
assert.strictEqual(store.getChecklistItems({ tripId: "trip-a" }).some((item) => item.id === custom.id), false);

const upcoming = store.addBooking({ type: "transport", name: "机场快线", startDate: "2026-07-16", amountText: "45" });
const overview = store.getDepartureOverview(store.getBookings(), store.getChecklistItems(), new Date("2026-07-15T10:00:00+08:00"));
assert.strictEqual(overview.upcomingCount, 1);
assert.strictEqual(overview.nextBooking.id, upcoming.id);
assert.strictEqual(overview.checklist.total, store.CHECKLIST_TEMPLATES.length);

store.deleteBooking(upcoming.id);
assert.strictEqual(store.getBookingById(upcoming.id), null);
assert(store.getBookings({ includeDeleted: true }).some((item) => item.id === upcoming.id && item.deletedAt));

console.log("departure center store tests passed");
