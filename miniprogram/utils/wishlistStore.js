const { createId } = require("./id");
const { getDeviceId, normalizeSyncMetadata } = require("./syncMetadata");

const STORAGE_KEY = "experience_wishlist";
const STATUSES = [
  { key: "wishlist", label: "想去" },
  { key: "booked", label: "已预订" },
  { key: "visited", label: "已到访" }
];
const PRIORITIES = [
  { key: "high", label: "优先" },
  { key: "medium", label: "普通" },
  { key: "low", label: "以后再去" }
];

function normalizeWishlistItem(input = {}) {
  const type = input.type === "restaurant" ? "restaurant" : "hotel";
  const status = STATUSES.some((item) => item.key === input.status) ? input.status : "wishlist";
  const priority = PRIORITIES.some((item) => item.key === input.priority) ? input.priority : "medium";
  return {
    ...normalizeSyncMetadata(input),
    id: String(input.id || createId("wish")),
    cloudWishlistId: String(input.cloudWishlistId || ""),
    type,
    typeLabel: type === "restaurant" ? "餐厅" : "酒店",
    name: String(input.name || "").trim(),
    city: String(input.city || "").trim(),
    area: String(input.area || "").trim(),
    address: String(input.address || "").trim(),
    latitude: Number.isFinite(Number(input.latitude)) && input.latitude !== null && input.latitude !== "" ? Number(input.latitude) : null,
    longitude: Number.isFinite(Number(input.longitude)) && input.longitude !== null && input.longitude !== "" ? Number(input.longitude) : null,
    placeId: String(input.placeId || ""),
    status,
    statusLabel: (STATUSES.find((item) => item.key === status) || STATUSES[0]).label,
    priority,
    priorityLabel: (PRIORITIES.find((item) => item.key === priority) || PRIORITIES[1]).label,
    targetDate: String(input.targetDate || ""),
    budgetText: String(input.budgetText || "").trim(),
    bookingReference: String(input.bookingReference || "").trim(),
    companions: String(input.companions || "").trim(),
    note: String(input.note || "").trim(),
    conflictSnapshot: input.conflictSnapshot && typeof input.conflictSnapshot === "object" ? JSON.parse(JSON.stringify(input.conflictSnapshot)) : null,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || ""
  };
}

function getWishlist(options = {}) {
  const raw = wx.getStorageSync(STORAGE_KEY);
  return (Array.isArray(raw) ? raw : []).map(normalizeWishlistItem)
    .filter((item) => options.includeDeleted || !item.deletedAt)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
}

function setWishlist(items) {
  const normalized = items.map(normalizeWishlistItem);
  wx.setStorageSync(STORAGE_KEY, normalized);
  return normalized;
}

function getWishlistItem(id) {
  return getWishlist().find((item) => String(item.id) === String(id)) || null;
}

function addWishlistItem(input) {
  const now = new Date().toISOString();
  const item = normalizeWishlistItem({ ...input, id: createId("wish"), createdAt: now, updatedAt: now, revision: 1, syncStatus: "dirty", deviceId: getDeviceId(), deletedAt: "" });
  if (!item.name) throw new Error("名称不能为空");
  setWishlist([item].concat(getWishlist({ includeDeleted: true })));
  return item;
}

function updateWishlistItem(id, patch) {
  let updated = null;
  const items = getWishlist({ includeDeleted: true }).map((item) => {
    if (String(item.id) !== String(id)) return item;
    updated = normalizeWishlistItem({ ...item, ...patch, id: item.id, createdAt: item.createdAt, updatedAt: new Date().toISOString(), revision: Number(item.revision || 1) + 1, syncStatus: "dirty", deviceId: getDeviceId() });
    if (!updated.name) throw new Error("名称不能为空");
    return updated;
  });
  if (!updated) return null;
  setWishlist(items);
  return updated;
}

function deleteWishlistItem(id) {
  const now = new Date().toISOString();
  const items = getWishlist({ includeDeleted: true }).map((item) => String(item.id) === String(id) ? normalizeWishlistItem({ ...item, deletedAt: now, updatedAt: now, revision: Number(item.revision || 1) + 1, syncStatus: "dirty" }) : item);
  setWishlist(items);
  return items.filter((item) => !item.deletedAt);
}

function markWishlistVisited(id, placeId) {
  return updateWishlistItem(id, { status: "visited", placeId: placeId || getWishlistItem(id).placeId });
}

function searchWishlist(items, filters = {}) {
  const keyword = String(filters.keyword || "").trim().toLowerCase();
  const status = filters.status || "all";
  const type = filters.type || "all";
  return items.filter((item) => {
    if (status !== "all" && item.status !== status) return false;
    if (type !== "all" && item.type !== type) return false;
    if (!keyword) return true;
    return [item.name, item.city, item.area, item.address, item.note, item.companions].join(" ").toLowerCase().indexOf(keyword) >= 0;
  }).sort((a, b) => {
    const priorities = { high: 3, medium: 2, low: 1 };
    return priorities[b.priority] - priorities[a.priority] || String(a.targetDate || "9999").localeCompare(String(b.targetDate || "9999"));
  });
}

module.exports = { PRIORITIES, STATUSES, STORAGE_KEY, addWishlistItem, deleteWishlistItem, getWishlist, getWishlistItem, markWishlistVisited, normalizeWishlistItem, searchWishlist, setWishlist, updateWishlistItem };
