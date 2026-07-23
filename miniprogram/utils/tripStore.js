const { createId } = require("./id");

const STORAGE_KEY = "toolbox_trips";
const MAX_RANGE_DAYS = 370;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value == null ? "" : value);
}

function isValidDate(value) {
  const candidate = text(value);
  if (!DATE_PATTERN.test(candidate)) return false;
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate;
}

function dateRange(startDate, endDate) {
  const days = [];
  if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) return days;
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const last = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= last && days.length < MAX_RANGE_DAYS) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function normalizeOrder(value, fallback) {
  const order = Number(value);
  return Number.isInteger(order) && order >= 0 ? order : fallback;
}

function normalizeItem(input = {}, fallbackOrder = 0) {
  return {
    id: text(input.id || createId("item")),
    date: text(input.date),
    time: text(input.time),
    title: text(input.title).trim(),
    location: text(input.location).trim(),
    note: text(input.note).trim(),
    order: normalizeOrder(input.order, fallbackOrder)
  };
}

function compareItems(a, b) {
  return a.date.localeCompare(b.date)
    || a.order - b.order
    || a.time.localeCompare(b.time)
    || a.id.localeCompare(b.id);
}

function normalizeItems(items) {
  const usedIds = new Set();
  const normalized = (Array.isArray(items) ? items : []).map((item, index) => {
    const result = normalizeItem(item, index);
    if (usedIds.has(result.id)) result.id = createId("item");
    usedIds.add(result.id);
    return result;
  }).sort(compareItems);
  const dayCounts = {};
  return normalized.map((item) => {
    const order = dayCounts[item.date] || 0;
    dayCounts[item.date] = order + 1;
    return { ...item, order };
  });
}

function normalizeTrip(input = {}) {
  const createdAt = text(input.createdAt || new Date().toISOString());
  return {
    id: text(input.id || createId("trip")),
    title: text(input.title).trim(),
    destination: text(input.destination).trim(),
    startDate: text(input.startDate),
    endDate: text(input.endDate),
    note: text(input.note).trim(),
    items: normalizeItems(input.items),
    createdAt,
    updatedAt: text(input.updatedAt || createdAt)
  };
}

function validateTrip(input) {
  const trip = normalizeTrip(input);
  if (!trip.title) throw new Error("行程名称不能为空");
  if (!isValidDate(trip.startDate) || !isValidDate(trip.endDate)) throw new Error("请选择有效的行程日期");
  if (trip.startDate > trip.endDate) throw new Error("结束日期不能早于开始日期");
  trip.items.forEach((item) => {
    if (!item.title) throw new Error("日程名称不能为空");
    if (!isValidDate(item.date)) throw new Error("请选择有效的日程日期");
    if (item.date < trip.startDate || item.date > trip.endDate) throw new Error("日程日期超出行程范围");
    if (item.time && !TIME_PATTERN.test(item.time)) throw new Error("日程时间格式无效");
  });
  return trip;
}

function sortTrips(trips) {
  return trips.slice().sort((a, b) => {
    return b.updatedAt.localeCompare(a.updatedAt)
      || b.createdAt.localeCompare(a.createdAt)
      || a.id.localeCompare(b.id);
  });
}

function getTrips() {
  const stored = wx.getStorageSync(STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  const trips = [];
  stored.forEach((input) => {
    try {
      trips.push(validateTrip(input));
    } catch (error) {
      // Ignore malformed storage entries so one damaged trip cannot block the planner.
    }
  });
  return sortTrips(trips);
}

function setTrips(items) {
  const trips = sortTrips((Array.isArray(items) ? items : []).map(validateTrip));
  wx.setStorageSync(STORAGE_KEY, trips);
  return clone(trips);
}

function getTripById(id) {
  const trip = getTrips().find((item) => item.id === text(id));
  return trip || null;
}

function addTrip(input) {
  const timestamp = new Date().toISOString();
  const trip = validateTrip({
    ...input,
    id: createId("trip"),
    createdAt: timestamp,
    updatedAt: timestamp
  });
  setTrips([trip].concat(getTrips()));
  return clone(trip);
}

function updateTrip(id, patch = {}) {
  const tripId = text(id);
  let updated = null;
  const trips = getTrips().map((trip) => {
    if (trip.id !== tripId) return trip;
    updated = validateTrip({
      ...trip,
      ...patch,
      id: trip.id,
      createdAt: trip.createdAt,
      updatedAt: new Date().toISOString()
    });
    return updated;
  });
  if (!updated) return null;
  setTrips(trips);
  return clone(updated);
}

function deleteTrip(id) {
  const tripId = text(id);
  const trips = getTrips();
  if (!trips.some((trip) => trip.id === tripId)) return false;
  setTrips(trips.filter((trip) => trip.id !== tripId));
  return true;
}

function duplicateTrip(id) {
  const source = getTripById(id);
  if (!source) return null;
  return addTrip({
    title: `${source.title} 副本`,
    destination: source.destination,
    startDate: source.startDate,
    endDate: source.endDate,
    note: source.note,
    items: source.items.map((item) => ({ ...item, id: createId("item") }))
  });
}

function nextOrder(items, date) {
  return items.filter((item) => item.date === date).length;
}

function addItem(id, input = {}) {
  const trip = getTripById(id);
  if (!trip) return null;
  const item = normalizeItem({
    ...input,
    id: createId("item"),
    order: nextOrder(trip.items, text(input.date))
  });
  return updateTrip(id, { items: trip.items.concat(item) });
}

function updateItem(id, itemId, patch = {}) {
  const trip = getTripById(id);
  if (!trip) return null;
  const targetId = text(itemId);
  const current = trip.items.find((item) => item.id === targetId);
  if (!current) return null;
  const nextDate = Object.prototype.hasOwnProperty.call(patch, "date") ? text(patch.date) : current.date;
  const changedDay = nextDate !== current.date;
  const updated = normalizeItem({
    ...current,
    ...patch,
    id: current.id,
    order: changedDay ? nextOrder(trip.items.filter((item) => item.id !== current.id), nextDate) : current.order
  });
  return updateTrip(id, {
    items: trip.items.map((item) => item.id === current.id ? updated : item)
  });
}

function deleteItem(id, itemId) {
  const trip = getTripById(id);
  if (!trip) return null;
  const targetId = text(itemId);
  if (!trip.items.some((item) => item.id === targetId)) return null;
  return updateTrip(id, { items: trip.items.filter((item) => item.id !== targetId) });
}

function duplicateItem(id, itemId) {
  const trip = getTripById(id);
  if (!trip) return null;
  const source = trip.items.find((item) => item.id === text(itemId));
  if (!source) return null;
  const shifted = trip.items.map((item) => {
    if (item.date !== source.date || item.order <= source.order) return item;
    return { ...item, order: item.order + 1 };
  });
  const copy = normalizeItem({
    ...source,
    id: createId("item"),
    title: `${source.title} 副本`,
    order: source.order + 1
  });
  return updateTrip(id, { items: shifted.concat(copy) });
}

function moveItem(id, itemId, direction) {
  const trip = getTripById(id);
  if (!trip) return null;
  const target = trip.items.find((item) => item.id === text(itemId));
  if (!target) return null;
  const dayItems = trip.items.filter((item) => item.date === target.date).sort(compareItems);
  const currentIndex = dayItems.findIndex((item) => item.id === target.id);
  let targetIndex = currentIndex;
  if (direction === "up") targetIndex -= 1;
  if (direction === "down") targetIndex += 1;
  if (Number.isInteger(direction)) targetIndex = direction;
  targetIndex = Math.max(0, Math.min(dayItems.length - 1, targetIndex));
  if (targetIndex === currentIndex) return clone(trip);
  const reordered = dayItems.slice();
  const moved = reordered.splice(currentIndex, 1)[0];
  reordered.splice(targetIndex, 0, moved);
  const orders = new Map(reordered.map((item, index) => [item.id, index]));
  return updateTrip(id, {
    items: trip.items.map((item) => item.date === target.date ? { ...item, order: orders.get(item.id) } : item)
  });
}

function findConflicts(items) {
  const groups = {};
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item.date || !item.time) return;
    const key = `${item.date} ${item.time}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item.id);
  });
  const conflicts = [];
  Object.keys(groups).sort().forEach((key) => {
    const ids = groups[key];
    for (let index = 1; index < ids.length; index += 1) {
      conflicts.push([ids[index - 1], ids[index]]);
    }
  });
  return conflicts;
}

module.exports = {
  STORAGE_KEY,
  addItem,
  addItineraryItem: addItem,
  addTrip,
  dateRange,
  deleteItem,
  removeItineraryItem: deleteItem,
  deleteTrip,
  duplicateItem,
  duplicateItineraryItem: duplicateItem,
  duplicateTrip,
  findConflicts,
  getTripById,
  getTrips,
  isValidDate,
  moveItem,
  moveItineraryItem: moveItem,
  normalizeItem,
  normalizeTrip,
  reorderItem: moveItem,
  setTrips,
  updateItem,
  updateItineraryItem: updateItem,
  updateTrip,
  validateTrip
};
