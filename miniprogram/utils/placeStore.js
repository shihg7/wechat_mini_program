const { createId, createStableId } = require("./id");
const { getDeviceId, normalizeSyncMetadata } = require("./syncMetadata");

const STORAGE_KEY = "experience_places";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeName(value) {
  const text = String(value || "").trim().toLowerCase();
  const compatible = text.normalize ? text.normalize("NFKC") : text;
  return compatible.replace(/[\s·・,_，。\.\-—_/\\]+/g, "");
}

function normalizeAliases(values) {
  return (Array.isArray(values) ? values : String(values || "").split(/[，,、\n]/))
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .reduce((result, item) => {
      if (result.indexOf(item) < 0) result.push(item);
      return result;
    }, []);
}

function normalizePlace(input = {}) {
  const type = input.type === "restaurant" ? "restaurant" : "hotel";
  const name = String(input.name || input.placeName || "").trim();
  return {
    ...normalizeSyncMetadata(input),
    id: String(input.id || createId("place")),
    cloudPlaceId: input.cloudPlaceId ? String(input.cloudPlaceId) : "",
    type,
    typeLabel: type === "restaurant" ? "餐厅" : "酒店",
    name,
    normalizedName: normalizeName(name),
    city: String(input.city || "").trim(),
    area: String(input.area || "").trim(),
    address: String(input.address || "").trim(),
    latitude: Number.isFinite(Number(input.latitude)) && input.latitude !== null && input.latitude !== "" ? Number(input.latitude) : null,
    longitude: Number.isFinite(Number(input.longitude)) && input.longitude !== null && input.longitude !== "" ? Number(input.longitude) : null,
    aliases: normalizeAliases(input.aliases),
    conflictSnapshot: input.conflictSnapshot && typeof input.conflictSnapshot === "object" ? clone(input.conflictSnapshot) : null,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || ""
  };
}

function getStoredPlaces() {
  const raw = wx.getStorageSync(STORAGE_KEY);
  return Array.isArray(raw) ? raw.map(normalizePlace) : [];
}

function setPlaces(places) {
  const normalized = places.map(normalizePlace);
  wx.setStorageSync(STORAGE_KEY, normalized);
  return normalized;
}

function recordPlaceInput(record) {
  return {
    id: record.placeId || createStableId("place", `record:${record.id}`),
    type: record.recordType,
    name: record.placeName || record.displayName || record.hotelName || record.restaurantName,
    city: record.city,
    aliases: record.placeAlias ? [record.placeAlias] : [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function ensurePlacesForRecords() {
  const recordStore = require("./hotelReviewStore");
  const records = recordStore.getRecords();
  const places = getStoredPlaces();
  const originalRecords = clone(records);
  const originalPlaces = clone(places);
  const placeMap = places.reduce((map, place) => {
    map[place.id] = place;
    return map;
  }, {});
  let placesChanged = false;
  let recordsChanged = false;
  const nextRecords = records.map((record) => {
    const placeId = record.placeId || createStableId("place", `record:${record.id}`);
    if (!placeMap[placeId]) {
      const place = normalizePlace({ ...recordPlaceInput(record), id: placeId });
      placeMap[placeId] = place;
      places.push(place);
      placesChanged = true;
    }
    if (record.placeId === placeId) return record;
    recordsChanged = true;
    return { ...record, placeId };
  });
  try {
    if (placesChanged) setPlaces(places);
    if (recordsChanged) recordStore.setRecords(nextRecords);
  } catch (error) {
    recordStore.setRecords(originalRecords);
    setPlaces(originalPlaces);
    throw error;
  }
  return places;
}

function getPlaces(options = {}) {
  return ensurePlacesForRecords().filter((place) => options.includeDeleted || !place.deletedAt).sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
}

function getPlaceById(id) {
  return getPlaces().find((place) => String(place.id) === String(id)) || null;
}

function createPlace(input) {
  const places = getStoredPlaces();
  const place = normalizePlace({ ...input, id: input.id || createId("place"), updatedAt: new Date().toISOString(), revision: 1, syncStatus: "dirty", deviceId: getDeviceId(), deletedAt: "" });
  if (!place.name) throw new Error("地点名称不能为空");
  setPlaces([place].concat(places));
  return place;
}

function updatePlace(id, patch) {
  let updated = null;
  const places = getStoredPlaces().map((place) => {
    if (String(place.id) !== String(id)) return place;
    updated = normalizePlace({ ...place, ...patch, id: place.id, createdAt: place.createdAt, updatedAt: new Date().toISOString(), revision: Number(place.revision || 1) + 1, syncStatus: "dirty", deviceId: getDeviceId() });
    if (!updated.name) throw new Error("地点名称不能为空");
    return updated;
  });
  if (!updated) return null;
  setPlaces(places);
  return updated;
}

function findPlaceSuggestions(input = {}) {
  const type = input.type === "restaurant" ? "restaurant" : "hotel";
  const name = normalizeName(input.name);
  const city = String(input.city || "").trim().toLowerCase();
  if (!name) return [];
  return getPlaces().map((place) => {
    if (place.type !== type) return null;
    const names = [place.name].concat(place.aliases || []).map(normalizeName).filter(Boolean);
    const exact = names.some((item) => item === name);
    const contained = names.some((item) => item.indexOf(name) >= 0 || name.indexOf(item) >= 0);
    if (!exact && !contained) return null;
    const cityMatches = !city || !place.city || place.city.toLowerCase() === city;
    return { ...place, matchLevel: exact ? 2 : 1, cityMatches };
  }).filter(Boolean).sort((a, b) => Number(b.cityMatches) - Number(a.cityMatches) || b.matchLevel - a.matchLevel);
}

function getPlaceRecords(placeId, records) {
  const source = records || require("./hotelReviewStore").getRecords();
  return source.filter((record) => String(record.placeId) === String(placeId));
}

function getPlaceStats(placeId, records) {
  const visits = getPlaceRecords(placeId, records).sort((a, b) => String(b.stayDate || b.createdAt).localeCompare(String(a.stayDate || a.createdAt)));
  const rated = visits.filter((record) => record.status !== "draft" && record.isRated);
  const total = rated.reduce((sum, record) => sum + Number(record.overallScore || 0), 0);
  const scores = rated.slice().reverse().map((record) => Number(record.overallScore || 0));
  const latestScore = scores.length ? scores[scores.length - 1] : 0;
  const previousScore = scores.length > 1 ? scores[scores.length - 2] : 0;
  return {
    visitCount: visits.length,
    ratedCount: rated.length,
    averageScore: rated.length ? Math.round((total / rated.length) * 10) / 10 : 0,
    bestScore: rated.length ? Math.max(...rated.map((record) => Number(record.overallScore || 0))) : 0,
    latestScore,
    scoreDelta: scores.length > 1 ? Math.round((latestScore - previousScore) * 10) / 10 : 0,
    latestVisit: visits[0] || null,
    visits
  };
}

function deleteEmptyPlace(id) {
  if (getPlaceRecords(id).length) throw new Error("该地点仍有关联记录，不能删除");
  const now = new Date().toISOString();
  const next = getStoredPlaces().map((place) => String(place.id) === String(id) ? normalizePlace({ ...place, deletedAt: now, updatedAt: now, revision: Number(place.revision || 1) + 1, syncStatus: "dirty" }) : place);
  setPlaces(next);
  return next.filter((place) => !place.deletedAt);
}

function mergePlaces(sourceId, targetId) {
  if (String(sourceId) === String(targetId)) throw new Error("不能合并同一个地点");
  const source = getPlaceById(sourceId);
  const target = getPlaceById(targetId);
  if (!source || !target) throw new Error("地点不存在");
  if (source.type !== target.type) throw new Error("酒店和餐厅不能互相合并");
  const recordStore = require("./hotelReviewStore");
  const records = recordStore.getRecords({ includeDeleted: true }).map((record) => (
    String(record.placeId) === String(sourceId) ? { ...record, placeId: target.id, revision: Number(record.revision || 1) + 1, syncStatus: "dirty", updatedAt: new Date().toISOString() } : record
  ));
  const aliases = normalizeAliases((target.aliases || []).concat(source.aliases || [], source.name));
  const places = getStoredPlaces().map((place) => (
    String(place.id) === String(sourceId)
      ? normalizePlace({ ...place, deletedAt: new Date().toISOString(), revision: Number(place.revision || 1) + 1, syncStatus: "dirty" })
      : String(place.id) === String(targetId) ? normalizePlace({ ...place, aliases, revision: Number(place.revision || 1) + 1, syncStatus: "dirty", updatedAt: new Date().toISOString() }) : place
  ));
  const oldRecords = recordStore.getRecords();
  const oldPlaces = getStoredPlaces();
  try {
    recordStore.setRecords(records);
    setPlaces(places);
  } catch (error) {
    recordStore.setRecords(oldRecords);
    setPlaces(oldPlaces);
    throw error;
  }
  return getPlaceById(targetId);
}

module.exports = {
  STORAGE_KEY,
  createPlace,
  deleteEmptyPlace,
  ensurePlacesForRecords,
  findPlaceSuggestions,
  getPlaceById,
  getPlaceRecords,
  getPlaceStats,
  getPlaces,
  mergePlaces,
  normalizeName,
  normalizePlace,
  setPlaces,
  updatePlace
};
