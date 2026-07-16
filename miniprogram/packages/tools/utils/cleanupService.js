const recordRepository = require("../../../utils/repositories/recordRepository");
const placeRepository = require("../../../utils/repositories/placeRepository");
const wishlistRepository = require("../../../utils/repositories/wishlistRepository");
const { fileExists, getOrphanPhotoPaths, removeSavedPhotos } = require("../../../utils/mediaStore");

const IGNORE_KEY = "cleanup_ignored_duplicates";

function pairKey(a, b) {
  return [String(a), String(b)].sort().join(":");
}

function getIgnoredPairs() {
  const raw = wx.getStorageSync(IGNORE_KEY);
  return Array.isArray(raw) ? raw : [];
}

function ignoreDuplicate(sourceId, targetId) {
  const next = Array.from(new Set(getIgnoredPairs().concat(pairKey(sourceId, targetId))));
  wx.setStorageSync(IGNORE_KEY, next);
  return next;
}

function getCleanupReport(now = Date.now()) {
  const records = recordRepository.getRecords();
  const places = placeRepository.getPlaces();
  const wishlist = wishlistRepository.getWishlist();
  const ignored = new Set(getIgnoredPairs());
  const duplicates = [];
  places.forEach((place) => {
    placeRepository.findPlaceSuggestions({ type: place.type, name: place.name, city: place.city }).forEach((candidate) => {
      const key = pairKey(place.id, candidate.id);
      if (place.id !== candidate.id && !ignored.has(key) && !duplicates.some((item) => item.key === key)) duplicates.push({ key, source: place, target: candidate });
    });
  });
  const placeIds = new Set(places.map((place) => place.id));
  const invalidPhotos = [];
  records.forEach((record) => {
    const photos = (record.photos || []).filter((photo) => !fileExists(photo.filePath));
    if (photos.length) invalidPhotos.push({ key: record.id, record, photos });
  });
  const wishlistDuplicates = wishlist.map((item) => {
    if (item.placeId) return null;
    const suggestions = placeRepository.findPlaceSuggestions({ type: item.type, name: item.name, city: item.city });
    return suggestions.length ? { key: item.id, item, suggestions } : null;
  }).filter(Boolean);
  const staleBefore = now - 30 * 24 * 60 * 60 * 1000;
  const report = {
    duplicates,
    incompletePlaces: places.filter((place) => !place.city || !place.address),
    orphanRecords: records.filter((record) => !record.placeId || !placeIds.has(record.placeId)),
    unratedRecords: records.filter((record) => record.status !== "draft" && !record.isRated),
    staleDrafts: records.filter((record) => record.status === "draft" && new Date(record.updatedAt || record.createdAt).getTime() < staleBefore),
    invalidPhotos,
    orphanPhotoPaths: getOrphanPhotoPaths(recordRepository.getRecords({ includeDeleted: true })),
    wishlistDuplicates
  };
  report.total = Object.keys(report).filter((key) => Array.isArray(report[key])).reduce((sum, key) => sum + report[key].length, 0);
  return report;
}

function removeInvalidPhotoMetadata(recordId) {
  const record = recordRepository.getRecordById(recordId);
  if (!record) return null;
  const removed = (record.photos || []).filter((photo) => !fileExists(photo.filePath));
  const photos = (record.photos || []).filter((photo) => fileExists(photo.filePath));
  const coverPhotoId = photos.some((photo) => photo.id === record.coverPhotoId) ? record.coverPhotoId : (photos[0] ? photos[0].id : "");
  const updated = recordRepository.updateRecord(recordId, { photos, coverPhotoId });
  removeSavedPhotos(removed.map((photo) => photo.filePath));
  return updated;
}

function cleanOrphanPhotoFiles() {
  const paths = getOrphanPhotoPaths(recordRepository.getRecords({ includeDeleted: true }));
  removeSavedPhotos(paths);
  return paths.length;
}

module.exports = { IGNORE_KEY, cleanOrphanPhotoFiles, getCleanupReport, ignoreDuplicate, removeInvalidPhotoMetadata };
