const recordStore = require("./hotelReviewStore");
const placeStore = require("./placeStore");
const ledgerStore = require("./tripLedgerStore");
const tripStore = require("./tripStore");
const wheelStore = require("./wheelStore");
const departureStore = require("./departureStore");

const REGISTRY_KEY = "experience_demo_data_registry";

function getRegistry() {
  const value = wx.getStorageSync(REGISTRY_KEY);
  return value && typeof value === "object" ? { recordIds: value.recordIds || [], placeIds: value.placeIds || [], ledgerIds: value.ledgerIds || [], tripIds: value.tripIds || [], wheelIds: value.wheelIds || [], bookingIds: value.bookingIds || [], checklistItemIds: value.checklistItemIds || [] } : { recordIds: [], placeIds: [], ledgerIds: [], tripIds: [], wheelIds: [], bookingIds: [], checklistItemIds: [] };
}

function getTargetId(stepId) {
  const registry = getRegistry();
  const recordId = registry.recordIds[0];
  const tripId = registry.tripIds[0];
  const ledgerId = registry.ledgerIds[0];
  const wheelId = registry.wheelIds[0];
  const bookingId = registry.bookingIds[0];
  const candidates = {
    record: recordId && recordStore.getRecordById(recordId) ? recordId : "",
    trip: tripId && tripStore.getTripById(tripId) ? tripId : "",
    ledger: ledgerId && ledgerStore.getLedgerById(ledgerId) ? ledgerId : "",
    wheel: wheelId && wheelStore.getWheelById(wheelId) ? wheelId : "",
    departure: bookingId && departureStore.getBookingById(bookingId) ? bookingId : ""
  };
  return candidates[stepId] || "";
}

function seedDemoData() {
  clearDemoData();
  const now = new Date().toISOString();
  const hotelPlace = placeStore.normalizePlace({ id: "demo_place_hotel", type: "hotel", name: "云际酒店", city: "上海", area: "浦东新区", address: "世纪大道示例地址", createdAt: now, updatedAt: now });
  const restaurantPlace = placeStore.normalizePlace({ id: "demo_place_restaurant", type: "restaurant", name: "Lumiere 示例餐厅", city: "上海", area: "黄浦区", createdAt: now, updatedAt: now });
  placeStore.setPlaces([hotelPlace, restaurantPlace].concat(placeStore.getPlaces()));

  const records = [
    recordStore.normalizeRecord({ id: "demo_record_hotel", placeId: hotelPlace.id, recordType: "hotel", hotelName: hotelPlace.name, placeName: hotelPlace.name, city: "上海", stayDate: "2026-07-10", roomType: "行政江景房", memberLevel: "金卡", overallScore: 8.8, selectedTags: ["服务稳定", "景观优秀"], note: "开发示例：行政酒廊晚间体验完整。", createdAt: now, updatedAt: now }),
    recordStore.normalizeRecord({ id: "demo_record_restaurant", placeId: restaurantPlace.id, recordType: "restaurant", restaurantName: restaurantPlace.name, placeName: restaurantPlace.name, city: "上海", stayDate: "2026-07-11", cuisine: "现代法餐", michelinLevel: "一星", mealPeriod: "晚餐", overallScore: 9.1, selectedTags: ["值得专程", "服务细致"], note: "开发示例：菜单节奏与酒水搭配。", createdAt: now, updatedAt: now })
  ];
  recordStore.setRecords(records.concat(recordStore.getRecords()));

  const ledger = ledgerStore.addLedger({ title: "上海周末示例账本", city: "上海", members: ["我", "小林", "阿青"] });
  ledgerStore.addExpense(ledger.id, { title: "三人晚餐", amountCents: 30002, payerId: ledger.members[0].id, participantIds: ledger.members.map((member) => member.id), splitMode: "equal", category: "餐饮", paidAt: "2026-07-11" });
  const trip = tripStore.addTrip({ title: "上海周末示例行程", cities: "上海", startDate: "2026-07-10", endDate: "2026-07-12", budgetTotalCents: 300000, linkedLedgerIds: [ledger.id], itineraryItems: [{ title: "入住云际酒店", type: "hotel", date: "2026-07-10", startTime: "15:00", sortOrder: 0 }, { title: "Lumiere 晚餐", type: "restaurant", date: "2026-07-11", startTime: "19:00", sortOrder: 0 }] });
  tripStore.addPersonalExpense(trip.id, { title: "机场快线", amountText: "45", category: "交通", date: "2026-07-10", currency: "CNY", rate: 1 });
  const wheel = wheelStore.createWheel({ title: "今晚吃什么", options: wheelStore.parseOptions("火锅\n日料\n本帮菜\n烧烤").map((text) => ({ text, enabled: true })) });
  const booking = departureStore.addBooking({ type: "hotel", name: hotelPlace.name, city: "上海", address: hotelPlace.address, startDate: trip.startDate, endDate: trip.endDate, startTime: "15:00", peopleCount: 3, amountCents: 238800, paymentStatus: "paid", bookingReference: "DEMO-HOTEL-2026", cancellationDate: trip.startDate, cancellationTime: "12:00", tripId: trip.id, placeId: hotelPlace.id, note: "开发示例：提前确认行政酒廊开放时间。" });
  const checklistItems = departureStore.seedChecklist(trip.id);
  if (checklistItems[0]) departureStore.toggleChecklistItem(checklistItems[0].id);

  const registry = { recordIds: records.map((item) => item.id), placeIds: [hotelPlace.id, restaurantPlace.id], ledgerIds: [ledger.id], tripIds: [trip.id], wheelIds: [wheel.id], bookingIds: [booking.id], checklistItemIds: checklistItems.map((item) => item.id) };
  wx.setStorageSync(REGISTRY_KEY, registry);
  return registry;
}

function clearDemoData() {
  const registry = getRegistry();
  const exclude = (items, ids) => items.filter((item) => ids.indexOf(String(item.id)) < 0);
  recordStore.setRecords(exclude(recordStore.getRecords(), registry.recordIds));
  placeStore.setPlaces(exclude(placeStore.getPlaces(), registry.placeIds));
  ledgerStore.setLedgers(exclude(ledgerStore.getLedgers(), registry.ledgerIds));
  tripStore.setTrips(exclude(tripStore.getTrips(), registry.tripIds));
  wheelStore.setWheels(exclude(wheelStore.getWheels(), registry.wheelIds));
  departureStore.setBookings(exclude(departureStore.getBookings({ includeDeleted: true }), registry.bookingIds));
  departureStore.setChecklistItems(exclude(departureStore.getChecklistItems({ includeDeleted: true }), registry.checklistItemIds));
  wx.setStorageSync(REGISTRY_KEY, { recordIds: [], placeIds: [], ledgerIds: [], tripIds: [], wheelIds: [], bookingIds: [], checklistItemIds: [] });
  return registry;
}

module.exports = { REGISTRY_KEY, clearDemoData, getRegistry, getTargetId, seedDemoData };
