const assert = require("assert");
const memory = {};
global.wx = {
  getStorageSync(key) { return memory[key]; },
  setStorageSync(key, value) { memory[key] = JSON.parse(JSON.stringify(value)); },
  removeStorageSync(key) { delete memory[key]; }
};

const records = require("../miniprogram/utils/hotelReviewStore");
const places = require("../miniprogram/utils/placeStore");
const ledgers = require("../miniprogram/utils/tripLedgerStore");
const trips = require("../miniprogram/utils/tripStore");
const demo = require("../miniprogram/utils/demoData");
const demoMode = require("../miniprogram/utils/demoMode");
const wheels = require("../miniprogram/utils/wheelStore");

records.setRecords([records.normalizeRecord({ id: "real_record", hotelName: "真实酒店", stayDate: "2026-01-01" })]);
places.setPlaces([places.normalizePlace({ id: "real_place", name: "真实地点" })]);
const realLedger = ledgers.addLedger({ title: "真实账本", members: ["我"] });
const realTrip = trips.addTrip({ title: "真实行程", startDate: "2026-01-01", endDate: "2026-01-01" });

const first = demo.seedDemoData();
assert.strictEqual(first.recordIds.length, 2);
assert.strictEqual(first.placeIds.length, 2);
assert.strictEqual(first.ledgerIds.length, 1);
assert.strictEqual(first.tripIds.length, 1);
assert.strictEqual(first.wheelIds.length, 1);
assert.strictEqual(wheels.getWheelById(first.wheelIds[0]).options.length, 4);
assert.strictEqual(demo.getTargetId("record"), first.recordIds[0]);
assert.strictEqual(demo.getTargetId("trip"), first.tripIds[0]);
assert.strictEqual(demo.getTargetId("ledger"), first.ledgerIds[0]);
assert.strictEqual(demo.getTargetId("wheel"), first.wheelIds[0]);
assert.strictEqual(demo.getTargetId("unknown"), "");
const demoLedger = ledgers.getLedgerById(first.ledgerIds[0]);
assert.strictEqual(demoLedger.members.length, 3);
assert.strictEqual(demoLedger.expenses[0].amountCents, 30002);
assert.strictEqual(demoLedger.expenses[0].allocations.reduce((sum, item) => sum + item.shareCents, 0), 30002);
assert.deepStrictEqual(demoLedger.expenses[0].allocations.map((item) => item.shareCents), [10001, 10001, 10000]);
const demoTrip = trips.getTripById(first.tripIds[0]);
assert.strictEqual(demoTrip.linkedLedgerIds[0], demoLedger.id);
assert.strictEqual(demoTrip.itineraryItems.length, 2);

const second = demo.seedDemoData();
assert.strictEqual(records.getRecords().filter((item) => second.recordIds.indexOf(item.id) >= 0).length, 2, "reseeding stays idempotent");
demo.clearDemoData();
assert(records.getRecordById("real_record"));
assert(places.getPlaceById("real_place"));
assert(ledgers.getLedgerById(realLedger.id));
assert(trips.getTripById(realTrip.id));
assert.strictEqual(wheels.getWheelById(second.wheelIds[0]), null);
assert.strictEqual(demo.getRegistry().tripIds.length, 0);
assert.strictEqual(records.getRecords().some((item) => second.recordIds.indexOf(item.id) >= 0), false);

const session = demoMode.start();
assert.strictEqual(session.state.active, true);
assert.strictEqual(demoMode.getProgress().percent, 0);
demoMode.markStep("record");
demoMode.markStep("record");
demoMode.markStep("unknown");
assert.deepStrictEqual(demoMode.getState().completedStepIds, ["record"], "demo progress is unique and only accepts known steps");
assert.strictEqual(demoMode.getProgress().percent, 25);
demoMode.resetProgress();
assert.strictEqual(demoMode.getProgress().completed, 0);
demoMode.finish();
assert.strictEqual(demoMode.getState().active, false);
assert(records.getRecordById("real_record"), "finishing demo keeps real records");
assert(ledgers.getLedgerById(realLedger.id), "finishing demo keeps real ledgers");

console.log("development demo data tests passed");
