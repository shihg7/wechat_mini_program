const assert = require("assert");
const memory = {};
const ui = { toasts: [], navigations: [], modalContent: "" };
global.wx = {
  getStorageSync(key) { return memory[key]; },
  setStorageSync(key, value) { memory[key] = JSON.parse(JSON.stringify(value)); },
  showToast(options) { ui.toasts.push(options.title); },
  showModal(options) { ui.modalContent = options.content || ""; if (options.success) options.success({ confirm: true }); },
  navigateTo(options) { ui.navigations.push(options.url); },
  navigateBack() {}
};

function setPath(target, path, value) { const parts = path.split("."); let cursor = target; parts.slice(0, -1).forEach((part) => { if (!cursor[part]) cursor[part] = {}; cursor = cursor[part]; }); cursor[parts[parts.length - 1]] = value; }
function loadPage(modulePath) { let definition; global.Page = (config) => { definition = config; }; delete require.cache[require.resolve(modulePath)]; require(modulePath); const page = {}; Object.keys(definition).forEach((key) => { page[key] = key === "data" ? JSON.parse(JSON.stringify(definition.data)) : definition[key]; }); page.setData = function setData(patch, callback) { Object.keys(patch).forEach((path) => setPath(this.data, path, patch[path])); if (callback) callback(); }; return page; }

const tripStore = require("../miniprogram/utils/tripStore");
const trip = tripStore.addTrip({ title: "上海周末", cities: "上海", note: "周年旅行", startDate: "2026-08-01", endDate: "2026-08-02" });
tripStore.addItineraryItem(trip.id, { title: "入住", date: "2026-08-01", startTime: "15:00" });
tripStore.addItineraryItem(trip.id, { title: "晚餐", date: "2026-08-01", startTime: "19:00" });

const indexPage = loadPage("../miniprogram/pages/trip/index.js");
indexPage.onShow();
assert.strictEqual(indexPage.data.trips.length, 1);
indexPage.search({ detail: { value: "周年" } });
assert.strictEqual(indexPage.data.trips.length, 1);
indexPage.search({ detail: { value: "北京" } });
assert.strictEqual(indexPage.data.trips.length, 0);
indexPage.search({ detail: { value: "" } });
indexPage.filterStatus({ currentTarget: { dataset: { status: "active" } } });
assert.strictEqual(indexPage.data.trips.length, 0);

const detailPage = loadPage("../miniprogram/pages/trip/detail.js");
detailPage.onLoad({ id: trip.id });
detailPage.onShow();
const dinnerId = detailPage.data.trip.itineraryItems.find((item) => item.title === "晚餐").id;
detailPage.moveItem({ currentTarget: { dataset: { id: dinnerId, direction: "up" } } });
assert.strictEqual(detailPage.data.days[0].items[0].id, dinnerId);
detailPage.copyItem({ currentTarget: { dataset: { id: dinnerId } } });
assert.strictEqual(detailPage.data.days[0].items.length, 3);
assert(ui.toasts.includes("已复制日程"));
detailPage.copyDay({ currentTarget: { dataset: { date: "2026-08-01" } } });
assert.strictEqual(detailPage.data.days[0].items.length, 6);
detailPage.removeTrip();
assert(ui.modalContent.includes("6 项日程"));
assert(tripStore.getTripById(trip.id));

tripStore.addPersonalExpense(trip.id, { title: "地铁", amountText: "10", rate: 1, date: "2026-08-01", category: "交通" });
const budgetPage = loadPage("../miniprogram/pages/trip/budget.js");
budgetPage.onLoad({ id: trip.id });
budgetPage.onShow();
const expenseId = budgetPage.data.trip.personalExpenses[0].id;
budgetPage.editExpense({ currentTarget: { dataset: { id: expenseId } } });
budgetPage.setData({ "expense.amountText": "12.50" });
budgetPage.addExpense();
assert.strictEqual(tripStore.getTripById(trip.id).personalExpenses[0].amountCents, 1250);
assert(ui.toasts.includes("支出已更新"));
budgetPage.removeExpense({ currentTarget: { dataset: { id: expenseId } } });
assert.strictEqual(tripStore.getTripById(trip.id).personalExpenses.length, 0);

console.log("trip page interaction tests passed");
