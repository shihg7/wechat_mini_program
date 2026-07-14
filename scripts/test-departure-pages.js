const assert = require("assert");

const memory = {};
const ui = { toasts: [], navigations: [], actionItems: [], actionHandler: null, leaveAlerts: 0 };
global.wx = {
  getStorageSync(key) { return memory[key]; },
  setStorageSync(key, value) { memory[key] = JSON.parse(JSON.stringify(value)); },
  removeStorageSync(key) { delete memory[key]; },
  showToast(options) { ui.toasts.push(options.title); },
  showModal(options) { if (options.success) options.success({ confirm: true }); },
  showActionSheet(options) { ui.actionItems = options.itemList || []; ui.actionHandler = options.success || null; },
  navigateTo(options) { ui.navigations.push(options.url); },
  navigateBack() {},
  pageScrollTo() {},
  enableAlertBeforeUnload() { ui.leaveAlerts += 1; },
  disableAlertBeforeUnload() { ui.leaveAlerts = Math.max(0, ui.leaveAlerts - 1); }
};

function setPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach((part) => { if (!cursor[part]) cursor[part] = {}; cursor = cursor[part]; });
  cursor[parts[parts.length - 1]] = value;
}

function loadPage(modulePath) {
  let definition;
  global.Page = (config) => { definition = config; };
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  const page = {};
  Object.keys(definition).forEach((key) => { page[key] = key === "data" ? JSON.parse(JSON.stringify(definition.data)) : definition[key]; });
  page.setData = function setData(patch, callback) { Object.keys(patch).forEach((path) => setPath(this.data, path, patch[path])); if (callback) callback(); };
  return page;
}

const wishlist = require("../miniprogram/utils/wishlistStore");
const trips = require("../miniprogram/utils/tripStore");
const ledgers = require("../miniprogram/utils/tripLedgerStore");
const departure = require("../miniprogram/utils/departureStore");

const trip = trips.addTrip({ title: "杭州周末", cities: "杭州", startDate: "2026-08-08", endDate: "2026-08-10", budgetTotalCents: 500000 });
const ledger = ledgers.addLedger({ title: "杭州三人账本", city: "杭州", members: ["我", "小林", "阿青"] });
const wish = wishlist.addWishlistItem({ type: "hotel", name: "西湖测试酒店", city: "杭州", targetDate: "2026-08-08", budgetText: "2388.01", note: "要安静房" });

const editPage = loadPage("../miniprogram/pages/departure/edit.js");
editPage.onLoad({ wishlistId: wish.id });
assert.strictEqual(editPage.data.form.name, wish.name);
assert.strictEqual(editPage.data.form.amountText, "2388.01");
editPage.save();
const booking = departure.getBookings()[0];
assert(booking);
assert.strictEqual(wishlist.getWishlistItem(wish.id).status, "booked");
assert.strictEqual(wishlist.getWishlistItem(wish.id).bookingId, booking.id);

editPage.addToTrip();
assert.deepStrictEqual(ui.actionItems, [trip.title]);
ui.actionHandler({ tapIndex: 0 });
let linked = departure.getBookingById(booking.id);
assert.strictEqual(linked.tripId, trip.id);
assert(trips.getTripById(trip.id).itineraryItems.some((item) => item.bookingId === booking.id));

editPage.addToBudget();
linked = departure.getBookingById(booking.id);
assert(linked.budgetExpenseId);
assert.strictEqual(trips.getTripById(trip.id).personalExpenses.length, 1);
editPage.addToBudget();
assert.strictEqual(trips.getTripById(trip.id).personalExpenses.length, 1, "repeated budget action must not duplicate expense");
assert(ui.navigations.some((url) => url === `/pages/trip/budget?id=${trip.id}`));

editPage.addToLedger();
assert.deepStrictEqual(ui.actionItems, [ledger.title]);
ui.actionHandler({ tapIndex: 0 });
linked = departure.getBookingById(booking.id);
assert.strictEqual(linked.ledgerId, ledger.id);
assert(ui.navigations.some((url) => url.includes(`bookingId=${booking.id}`)));

const ledgerPage = loadPage("../miniprogram/pages/ledger/detail/detail.js");
ledgerPage.onLoad({ id: ledger.id, bookingId: booking.id });
assert.strictEqual(ledgerPage.data.showExpenseForm, true);
assert.strictEqual(ledgerPage.data.expenseForm.title, booking.name);
assert.strictEqual(ledgerPage.data.expenseForm.amount, "2388.01");
ledgerPage.saveExpense();
linked = departure.getBookingById(booking.id);
assert(linked.ledgerExpenseId);
assert.strictEqual(ledgers.getLedgerById(ledger.id).expenses.length, 1);
assert.strictEqual(ledgers.getLedgerById(ledger.id).expenses[0].amountCents, 238801);

editPage.loadBooking(booking.id);
editPage.recordVisit();
assert(ui.navigations.some((url) => url === `/pages/record/record?type=hotel&bookingId=${booking.id}`));

const indexPage = loadPage("../miniprogram/pages/departure/index.js");
indexPage.onLoad({ tripId: trip.id, tab: "checklist" });
indexPage.onShow();
assert.strictEqual(indexPage.data.activeTab, "checklist");
assert.strictEqual(indexPage.data.selectedTripId, trip.id);
indexPage.seedChecklist();
assert.strictEqual(indexPage.data.checklistItems.length, departure.CHECKLIST_TEMPLATES.length);
const taskId = indexPage.data.checklistItems[0].id;
indexPage.toggleTask({ currentTarget: { dataset: { id: taskId } } });
assert.strictEqual(departure.getChecklistItems({ tripId: trip.id }).find((item) => item.id === taskId).done, true);

console.log("departure center page interaction tests passed");
