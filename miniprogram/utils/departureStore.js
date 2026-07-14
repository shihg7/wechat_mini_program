const { createId } = require("./id");
const { getDeviceId, normalizeSyncMetadata } = require("./syncMetadata");

const BOOKINGS_KEY = "experience_bookings";
const CHECKLIST_KEY = "experience_checklist_items";

const BOOKING_TYPES = [
  { key: "hotel", label: "住宿", category: "住宿" },
  { key: "restaurant", label: "餐厅", category: "餐饮" },
  { key: "transport", label: "交通", category: "交通" },
  { key: "ticket", label: "门票", category: "门票" },
  { key: "other", label: "其他", category: "其他" }
];

const PAYMENT_STATUSES = [
  { key: "unpaid", label: "未付款" },
  { key: "partial", label: "已付订金" },
  { key: "paid", label: "已付款" }
];

const BOOKING_STATUSES = [
  { key: "upcoming", label: "待出发" },
  { key: "completed", label: "已完成" },
  { key: "cancelled", label: "已取消" }
];

const CHECKLIST_TEMPLATES = [
  { templateKey: "identity", category: "证件", title: "检查身份证件与有效期" },
  { templateKey: "tickets", category: "预订", title: "确认交通、住宿和门票凭证" },
  { templateKey: "network", category: "通讯", title: "准备手机网络或境外漫游" },
  { templateKey: "insurance", category: "保障", title: "确认旅行保险和紧急联系人" },
  { templateKey: "medicine", category: "健康", title: "准备常用药品" },
  { templateKey: "charging", category: "装备", title: "准备充电器、充电宝和转换插头" }
];

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function option(list, key) { return list.find((item) => item.key === key) || list[0]; }

function parseMoneyToCents(value) {
  const text = String(value == null ? "" : value).trim().replace(/[¥￥,，\s]/g, "");
  if (!text) return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(text)) return NaN;
  const parts = text.split(".");
  const cents = Number(parts[0]) * 100 + Number((parts[1] || "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : NaN;
}

function formatMoney(cents) {
  const value = Math.max(0, Number(cents || 0));
  return `¥${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function utcDayNumber(dateText) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateText || ""));
  return match ? Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000) : NaN;
}

function daysUntil(dateText, now = new Date()) {
  const target = utcDayNumber(dateText);
  const current = utcDayNumber(localDateKey(now));
  return Number.isFinite(target) && Number.isFinite(current) ? target - current : null;
}

function dateTimeValue(dateText, timeText, endOfDay = false) {
  if (!dateText) return NaN;
  const time = /^\d{2}:\d{2}$/.test(String(timeText || "")) ? timeText : (endOfDay ? "23:59" : "00:00");
  return new Date(`${dateText}T${time}:00`).getTime();
}

function normalizeBooking(input = {}) {
  const type = option(BOOKING_TYPES, input.type).key;
  const paymentStatus = option(PAYMENT_STATUSES, input.paymentStatus).key;
  const status = option(BOOKING_STATUSES, input.status).key;
  const parsedAmount = input.amountCents == null ? parseMoneyToCents(input.amountText) : Number(input.amountCents);
  const amountCents = Number.isSafeInteger(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;
  const typeOption = option(BOOKING_TYPES, type);
  return {
    ...normalizeSyncMetadata(input),
    id: String(input.id || createId("booking")),
    cloudBookingId: String(input.cloudBookingId || ""),
    type,
    typeLabel: typeOption.label,
    category: typeOption.category,
    name: String(input.name || "").trim(),
    city: String(input.city || "").trim(),
    address: String(input.address || "").trim(),
    startDate: String(input.startDate || input.targetDate || ""),
    endDate: String(input.endDate || ""),
    startTime: String(input.startTime || ""),
    endTime: String(input.endTime || ""),
    peopleCount: Math.max(1, Math.floor(Number(input.peopleCount || 1))),
    amountCents,
    amountText: amountCents ? formatMoney(amountCents) : "未填写金额",
    paymentStatus,
    paymentStatusLabel: option(PAYMENT_STATUSES, paymentStatus).label,
    bookingReference: String(input.bookingReference || "").trim(),
    cancellationDate: String(input.cancellationDate || ""),
    cancellationTime: String(input.cancellationTime || ""),
    contact: String(input.contact || "").trim(),
    note: String(input.note || "").trim(),
    status,
    statusLabel: option(BOOKING_STATUSES, status).label,
    tripId: String(input.tripId || ""),
    wishlistId: String(input.wishlistId || ""),
    placeId: String(input.placeId || ""),
    itineraryItemId: String(input.itineraryItemId || ""),
    budgetExpenseId: String(input.budgetExpenseId || ""),
    ledgerId: String(input.ledgerId || ""),
    ledgerExpenseId: String(input.ledgerExpenseId || ""),
    recordId: String(input.recordId || ""),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || "",
    conflictSnapshot: input.conflictSnapshot && typeof input.conflictSnapshot === "object" ? clone(input.conflictSnapshot) : null
  };
}

function validateBooking(input) {
  const booking = normalizeBooking(input);
  if (!booking.name) throw new Error("预订名称不能为空");
  if (!booking.startDate) throw new Error("请选择开始日期");
  if (booking.endDate && booking.endDate < booking.startDate) throw new Error("结束日期不能早于开始日期");
  if (booking.cancellationDate && booking.cancellationDate > booking.startDate) throw new Error("取消期限不能晚于开始日期");
  return booking;
}

function getBookings(options = {}) {
  const raw = wx.getStorageSync(BOOKINGS_KEY);
  return (Array.isArray(raw) ? raw : []).map(normalizeBooking)
    .filter((item) => options.includeDeleted || !item.deletedAt)
    .sort((a, b) => {
      const ranks = { upcoming: 0, completed: 1, cancelled: 2 };
      return ranks[a.status] - ranks[b.status]
        || String(a.startDate || "9999-12-31").localeCompare(String(b.startDate || "9999-12-31"))
        || String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt));
    });
}

function setBookings(items) {
  const normalized = (items || []).map(normalizeBooking);
  wx.setStorageSync(BOOKINGS_KEY, normalized);
  return normalized;
}

function getBookingById(id) { return getBookings().find((item) => item.id === String(id)) || null; }

function addBooking(input) {
  const now = new Date().toISOString();
  const booking = validateBooking({ ...input, id: createId("booking"), createdAt: now, updatedAt: now, revision: 1, syncStatus: "dirty", deviceId: getDeviceId(), deletedAt: "" });
  setBookings([booking].concat(getBookings({ includeDeleted: true })));
  return booking;
}

function updateBooking(id, patch) {
  let updated = null;
  const items = getBookings({ includeDeleted: true }).map((item) => {
    if (item.id !== String(id)) return item;
    updated = validateBooking({ ...item, ...patch, id: item.id, createdAt: item.createdAt, updatedAt: new Date().toISOString(), revision: Number(item.revision || 1) + 1, syncStatus: "dirty", deviceId: getDeviceId() });
    return updated;
  });
  if (!updated) return null;
  setBookings(items);
  return updated;
}

function deleteBooking(id) {
  const now = new Date().toISOString();
  setBookings(getBookings({ includeDeleted: true }).map((item) => item.id === String(id) ? normalizeBooking({ ...item, deletedAt: now, updatedAt: now, revision: Number(item.revision || 1) + 1, syncStatus: "dirty" }) : item));
  return true;
}

function createBookingFromWishlist(item = {}) {
  const current = getBookings().find((booking) => booking.wishlistId && booking.wishlistId === String(item.id || ""));
  const input = {
    type: item.type,
    name: item.name,
    city: item.city,
    address: item.address,
    startDate: item.targetDate,
    amountText: item.budgetText,
    bookingReference: item.bookingReference,
    tripId: item.tripId,
    wishlistId: item.id,
    placeId: item.placeId,
    itineraryItemId: item.itineraryItemId,
    note: item.note,
    status: "upcoming"
  };
  return current ? updateBooking(current.id, input) : addBooking(input);
}

function markBookingCompleted(id, recordId = "") { return updateBooking(id, { status: "completed", recordId }); }

function getBookingView(input, now = new Date()) {
  const booking = normalizeBooking(input);
  const startDays = daysUntil(booking.startDate, now);
  let timingLabel = booking.startDate || "日期未填写";
  let urgencyTone = "muted";
  let urgencyRank = 5;
  if (booking.status === "completed") { timingLabel = "已完成"; urgencyTone = "green"; urgencyRank = 8; }
  else if (booking.status === "cancelled") { timingLabel = "已取消"; urgencyTone = "muted"; urgencyRank = 9; }
  else if (startDays === 0) { timingLabel = "今天"; urgencyTone = "accent"; urgencyRank = 0; }
  else if (startDays === 1) { timingLabel = "明天"; urgencyTone = "amber"; urgencyRank = 1; }
  else if (startDays !== null && startDays > 1 && startDays <= 7) { timingLabel = `${startDays} 天后`; urgencyTone = "blue"; urgencyRank = 3; }
  else if (startDays !== null && startDays < 0) { timingLabel = "日期已过"; urgencyTone = "accent"; urgencyRank = 2; }

  let cancellationLabel = "";
  let cancellationExpired = false;
  if (booking.status === "upcoming" && booking.cancellationDate) {
    const deadline = dateTimeValue(booking.cancellationDate, booking.cancellationTime, true);
    const remaining = deadline - new Date(now).getTime();
    if (Number.isFinite(deadline) && remaining <= 0) {
      cancellationLabel = "免费取消期限已过";
      cancellationExpired = true;
    } else if (remaining <= 24 * 3600000) {
      cancellationLabel = `取消期限剩 ${Math.max(1, Math.ceil(remaining / 3600000))} 小时`;
      urgencyTone = "accent";
      urgencyRank = Math.min(urgencyRank, 0);
    } else if (remaining <= 72 * 3600000) {
      cancellationLabel = `取消期限剩 ${Math.ceil(remaining / 86400000)} 天`;
      urgencyTone = "amber";
      urgencyRank = Math.min(urgencyRank, 1);
    } else {
      cancellationLabel = `${booking.cancellationDate} 前可取消`;
    }
  }
  return { ...booking, timingLabel, urgencyTone, urgencyRank, cancellationLabel, cancellationExpired, startDays };
}

function getDepartureOverview(bookings = getBookings(), checklistItems = getChecklistItems(), now = new Date()) {
  const views = bookings.map((item) => getBookingView(item, now)).sort((a, b) => a.urgencyRank - b.urgencyRank || String(a.startDate).localeCompare(String(b.startDate)));
  const upcoming = views.filter((item) => item.status === "upcoming");
  const checklist = getChecklistSummary(checklistItems);
  return {
    views,
    upcomingCount: upcoming.length,
    urgentCount: upcoming.filter((item) => item.urgencyTone === "accent" || item.urgencyTone === "amber").length,
    completedCount: views.filter((item) => item.status === "completed").length,
    nextBooking: upcoming[0] || null,
    checklist
  };
}

function normalizeChecklistItem(input = {}) {
  return {
    ...normalizeSyncMetadata(input),
    id: String(input.id || createId("check")),
    cloudChecklistId: String(input.cloudChecklistId || ""),
    tripId: String(input.tripId || "general"),
    templateKey: String(input.templateKey || ""),
    category: String(input.category || "其他").trim() || "其他",
    title: String(input.title || "").trim(),
    owner: String(input.owner || "").trim(),
    done: !!input.done,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || ""
  };
}

function getChecklistItems(options = {}) {
  const raw = wx.getStorageSync(CHECKLIST_KEY);
  return (Array.isArray(raw) ? raw : []).map(normalizeChecklistItem)
    .filter((item) => options.includeDeleted || !item.deletedAt)
    .filter((item) => !options.tripId || item.tripId === String(options.tripId))
    .sort((a, b) => Number(a.done) - Number(b.done) || String(a.createdAt).localeCompare(String(b.createdAt)));
}

function setChecklistItems(items) {
  const normalized = (items || []).map(normalizeChecklistItem);
  wx.setStorageSync(CHECKLIST_KEY, normalized);
  return normalized;
}

function addChecklistItem(input) {
  const now = new Date().toISOString();
  const item = normalizeChecklistItem({ ...input, id: createId("check"), createdAt: now, updatedAt: now, revision: 1, syncStatus: "dirty", deviceId: getDeviceId(), deletedAt: "" });
  if (!item.title) throw new Error("清单内容不能为空");
  setChecklistItems([item].concat(getChecklistItems({ includeDeleted: true })));
  return item;
}

function updateChecklistItem(id, patch) {
  let updated = null;
  const items = getChecklistItems({ includeDeleted: true }).map((item) => {
    if (item.id !== String(id)) return item;
    updated = normalizeChecklistItem({ ...item, ...patch, id: item.id, createdAt: item.createdAt, updatedAt: new Date().toISOString(), revision: Number(item.revision || 1) + 1, syncStatus: "dirty", deviceId: getDeviceId() });
    if (!updated.title) throw new Error("清单内容不能为空");
    return updated;
  });
  if (!updated) return null;
  setChecklistItems(items);
  return updated;
}

function toggleChecklistItem(id) {
  const item = getChecklistItems().find((entry) => entry.id === String(id));
  return item ? updateChecklistItem(id, { done: !item.done }) : null;
}

function deleteChecklistItem(id) {
  const now = new Date().toISOString();
  setChecklistItems(getChecklistItems({ includeDeleted: true }).map((item) => item.id === String(id) ? normalizeChecklistItem({ ...item, deletedAt: now, updatedAt: now, revision: Number(item.revision || 1) + 1, syncStatus: "dirty" }) : item));
  return true;
}

function seedChecklist(tripId = "general") {
  const current = getChecklistItems({ tripId });
  const keys = new Set(current.map((item) => item.templateKey).filter(Boolean));
  const additions = CHECKLIST_TEMPLATES.filter((item) => !keys.has(item.templateKey)).map((item) => addChecklistItem({ ...item, tripId }));
  return additions.concat(current);
}

function getChecklistSummary(items = getChecklistItems()) {
  const total = items.length;
  const completed = items.filter((item) => item.done).length;
  return { total, completed, remaining: total - completed, percent: total ? Math.round(completed / total * 100) : 0 };
}

module.exports = {
  BOOKINGS_KEY,
  CHECKLIST_KEY,
  BOOKING_STATUSES,
  BOOKING_TYPES,
  CHECKLIST_TEMPLATES,
  PAYMENT_STATUSES,
  addBooking,
  addChecklistItem,
  createBookingFromWishlist,
  daysUntil,
  deleteBooking,
  deleteChecklistItem,
  formatMoney,
  getBookingById,
  getBookingView,
  getBookings,
  getChecklistItems,
  getChecklistSummary,
  getDepartureOverview,
  localDateKey,
  markBookingCompleted,
  normalizeBooking,
  normalizeChecklistItem,
  parseMoneyToCents,
  seedChecklist,
  setBookings,
  setChecklistItems,
  toggleChecklistItem,
  updateBooking,
  updateChecklistItem,
  validateBooking
};
