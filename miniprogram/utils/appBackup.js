const { STORAGE_KEY: RECORDS_KEY, getRecords, normalizeRecord } = require("./hotelReviewStore");
const { STORAGE_KEY: PLACES_KEY, getPlaces, normalizePlace } = require("./placeStore");
const { STORAGE_KEY: LEDGERS_KEY, getLedgers, normalizeLedger } = require("./tripLedgerStore");
const { STORAGE_KEY: WISHLIST_KEY, getWishlist, normalizeWishlistItem } = require("./wishlistStore");
const { createStableId } = require("./id");
const { STORY_PREFS_KEY } = require("./storyRenderer");
const { YEARBOOK_PREFS_KEY } = require("./yearbookBuilder");

const APP_ID = "experience-review-miniprogram";
const SCHEMA_VERSION = 6;

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}必须是对象`);
}

function assertItems(items, label) {
  if (!Array.isArray(items)) throw new Error(`${label}必须是数组`);
  items.forEach((item, index) => {
    assertObject(item, `${label}[${index}]`);
    if (item.id === undefined || item.id === null || String(item.id).trim() === "") throw new Error(`${label}[${index}]缺少 id`);
  });
}

function placesFromLegacyRecords(records) {
  const placeMap = {};
  const normalizedRecords = records.map(normalizeRecord).map((record) => {
    const placeId = record.placeId || createStableId("place", `backup-record:${record.id}`);
    if (!placeMap[placeId]) {
      placeMap[placeId] = normalizePlace({
        id: placeId,
        type: record.recordType,
        name: record.placeName || record.displayName,
        city: record.city,
        area: record.area,
        address: record.address,
        latitude: record.latitude,
        longitude: record.longitude,
        aliases: record.placeAlias ? [record.placeAlias] : [],
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      });
    }
    return normalizeRecord({ ...record, placeId });
  });
  return { records: normalizedRecords, places: Object.keys(placeMap).map((id) => placeMap[id]) };
}

function validateUniqueIds(items, label) {
  const ids = {};
  items.forEach((item) => {
    const id = String(item.id);
    if (ids[id]) throw new Error(`${label} 存在重复 id: ${id}`);
    ids[id] = true;
  });
}

function preflightBackup(payload) {
  let data;
  try {
    data = typeof payload === "string" ? JSON.parse(payload) : clone(payload);
  } catch (error) {
    throw new Error("备份不是有效的 JSON 文件");
  }
  assertObject(data, "备份");
  const version = Number(data.schemaVersion || data.version);
  if ([1, 2, 3, 4, 5, 6].indexOf(version) < 0) throw new Error("仅支持 schemaVersion 1、2、3、4、5 或 6");
  if (data.app && data.app !== APP_ID) throw new Error("备份来源应用不匹配");
  assertItems(data.records, "records");
  if (version >= 2) assertItems(data.ledgers, "ledgers");
  if (version >= 3) assertItems(data.places, "places");
  if (version >= 5) assertItems(data.wishlist, "wishlist");
  if (version >= 6) assertObject(data.preferences, "preferences");
  validateUniqueIds(data.records, "records");
  validateUniqueIds(data.ledgers || [], "ledgers");
  validateUniqueIds(data.places || [], "places");
  validateUniqueIds(data.wishlist || [], "wishlist");

  data.records.forEach((record, index) => {
    if (!record.hotelName && !record.restaurantName) throw new Error(`records[${index}]缺少体验名称`);
  });
  (data.ledgers || []).forEach((ledger, ledgerIndex) => {
    if (!Array.isArray(ledger.members) || !Array.isArray(ledger.expenses)) throw new Error(`ledgers[${ledgerIndex}]的 members/expenses 必须是数组`);
    validateUniqueIds(ledger.expenses, `账本 ${ledger.id} 的支出`);
  });

  let normalizedRecords;
  let normalizedPlaces;
  if (version >= 3) {
    normalizedPlaces = data.places.map(normalizePlace);
    const placeIds = normalizedPlaces.reduce((map, place) => { map[place.id] = true; return map; }, {});
    normalizedRecords = data.records.map(normalizeRecord);
    normalizedRecords.forEach((record, index) => {
      if (!record.placeId || !placeIds[record.placeId]) throw new Error(`records[${index}]的 placeId 无效`);
    });
  } else {
    const legacy = placesFromLegacyRecords(data.records);
    normalizedRecords = legacy.records;
    normalizedPlaces = legacy.places;
  }

  const placeIds = new Set(normalizedPlaces.map((place) => place.id));
  const normalizedWishlist = version >= 5 ? data.wishlist.map(normalizeWishlistItem) : null;
  (normalizedWishlist || []).forEach((item, index) => {
    if (item.placeId && !placeIds.has(item.placeId)) throw new Error(`wishlist[${index}]的 placeId 无效`);
  });
  const normalizedPreferences = version >= 6 ? { story: clone(data.preferences.story || {}), yearbook: clone(data.preferences.yearbook || {}) } : null;
  const normalized = {
    schemaVersion: version,
    app: data.app || APP_ID,
    exportedAt: data.exportedAt || "",
    importToken: hashText(stableStringify(data)),
    records: normalizedRecords,
    places: normalizedPlaces,
    ledgers: version >= 2 ? data.ledgers.map(normalizeLedger) : null,
    wishlist: normalizedWishlist,
    preferences: normalizedPreferences
  };
  const expenseCount = (normalized.ledgers || []).reduce((sum, ledger) => sum + ledger.expenses.length, 0);
  return {
    data: normalized,
    summary: {
      schemaVersion: version,
      exportedAt: normalized.exportedAt,
      recordCount: normalized.records.length,
      placeCount: normalized.places.length,
      ledgerCount: normalized.ledgers ? normalized.ledgers.length : 0,
      expenseCount,
      wishlistCount: normalized.wishlist ? normalized.wishlist.length : 0,
      ledgersIncluded: normalized.ledgers !== null,
      wishlistIncluded: normalized.wishlist !== null,
      preferencesIncluded: normalized.preferences !== null
    }
  };
}

function createBackup(records, places, ledgers, wishlist, preferences = {}) {
  const normalizedRecords = (records || []).map(normalizeRecord);
  const normalizedPlaces = (places || []).map(normalizePlace);
  const normalizedLedgers = (ledgers || []).map(normalizeLedger);
  const normalizedWishlist = (wishlist || []).map(normalizeWishlistItem);
  return {
    schemaVersion: SCHEMA_VERSION,
    version: SCHEMA_VERSION,
    app: APP_ID,
    exportedAt: new Date().toISOString(),
    summary: {
      recordCount: normalizedRecords.length,
      placeCount: normalizedPlaces.length,
      ledgerCount: normalizedLedgers.length,
      wishlistCount: normalizedWishlist.length,
      expenseCount: normalizedLedgers.reduce((sum, ledger) => sum + ledger.expenses.length, 0),
      photoCount: normalizedRecords.reduce((sum, record) => sum + record.photos.length, 0),
      storyPreferenceCount: Object.keys(preferences.story || {}).length,
      yearbookPreferenceCount: Object.keys(preferences.yearbook || {}).length
    },
    media: {
      binariesIncluded: false,
      note: "照片仅保存本地路径与说明，跨设备恢复不包含图片文件"
    },
    records: normalizedRecords,
    places: normalizedPlaces,
    ledgers: normalizedLedgers,
    wishlist: normalizedWishlist,
    preferences: { story: clone(preferences.story || {}), yearbook: clone(preferences.yearbook || {}) }
  };
}

function exportFullBackup(records, places, ledgers, wishlist, preferences) {
  const sourcePlaces = places === undefined ? getPlaces({ includeDeleted: true }) : places;
  const sourceRecords = records === undefined ? getRecords({ includeDeleted: true }) : records;
  const sourceLedgers = ledgers === undefined ? getLedgers() : ledgers;
  const sourceWishlist = wishlist === undefined ? getWishlist({ includeDeleted: true }) : wishlist;
  const sourcePreferences = preferences === undefined ? { story: wx.getStorageSync(STORY_PREFS_KEY) || {}, yearbook: wx.getStorageSync(YEARBOOK_PREFS_KEY) || {} } : preferences;
  const backup = createBackup(sourceRecords, sourcePlaces, sourceLedgers, sourceWishlist, sourcePreferences);
  const filePath = `${wx.env.USER_DATA_PATH}/experience-review-full-backup-v6.json`;
  wx.getFileSystemManager().writeFileSync(filePath, JSON.stringify(backup, null, 2), "utf8");
  return { filePath, backup, summary: backup.summary };
}

function comparable(item) {
  function stripRuntimeFields(value) {
    if (Array.isArray(value)) return value.map(stripRuntimeFields);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).reduce((result, key) => {
      if (["id", "createdAt", "updatedAt"].indexOf(key) < 0) result[key] = stripRuntimeFields(value[key]);
      return result;
    }, {});
  }
  return stableStringify(stripRuntimeFields(item));
}

function planCollection(existing, incoming, kind, backupToken) {
  const byId = existing.reduce((map, item) => { map[String(item.id)] = item; return map; }, {});
  const idMap = {};
  const additions = [];
  let skipped = 0;
  incoming.forEach((item) => {
    const sourceId = String(item.id);
    const current = byId[sourceId];
    if (!current) {
      idMap[sourceId] = sourceId;
      byId[sourceId] = item;
      additions.push(item);
      return;
    }
    if (comparable(current) === comparable(item)) {
      idMap[sourceId] = sourceId;
      skipped += 1;
      return;
    }
    const remappedId = `import_${kind}_${hashText(`${backupToken}|${kind}|${sourceId}`)}`;
    idMap[sourceId] = remappedId;
    if (byId[remappedId]) {
      skipped += 1;
      return;
    }
    const remapped = { ...item, id: remappedId };
    byId[remappedId] = remapped;
    additions.push(remapped);
  });
  return { result: additions.concat(existing), additions, skipped, idMap };
}

function buildMerge(existingRecords, existingPlaces, existingLedgers, existingWishlist, existingPreferences, backup) {
  const backupToken = backup.importToken || hashText(stableStringify(backup));
  const placesPlan = planCollection(existingPlaces, backup.places, "place", backupToken);
  const remappedRecords = backup.records.map((record) => ({ ...record, placeId: placesPlan.idMap[record.placeId] || record.placeId }));
  const recordsPlan = planCollection(existingRecords, remappedRecords, "record", backupToken);
  const remappedLedgers = (backup.ledgers || []).map((ledger) => ({
    ...ledger,
    expenses: ledger.expenses.map((expense) => ({ ...expense, relatedRecordId: recordsPlan.idMap[String(expense.relatedRecordId)] || expense.relatedRecordId }))
  }));
  const ledgersPlan = planCollection(existingLedgers, remappedLedgers, "ledger", backupToken);
  const remappedWishlist = (backup.wishlist || []).map((item) => ({ ...item, placeId: placesPlan.idMap[item.placeId] || item.placeId }));
  const wishlistPlan = planCollection(existingWishlist, remappedWishlist, "wishlist", backupToken);
  const incomingPreferences = backup.preferences || { story: {}, yearbook: {} };
  const remappedStory = Object.keys(incomingPreferences.story || {}).reduce((result, recordId) => { result[recordsPlan.idMap[recordId] || recordId] = incomingPreferences.story[recordId]; return result; }, {});
  const preferences = {
    story: { ...remappedStory, ...(existingPreferences.story || {}) },
    yearbook: { ...(incomingPreferences.yearbook || {}), ...(existingPreferences.yearbook || {}) }
  };
  return { recordsPlan, placesPlan, ledgersPlan, wishlistPlan, preferences };
}

function snapshotFor(key) {
  const value = wx.getStorageSync(key);
  return { exists: value !== undefined && value !== "", value: clone(value) };
}

function restoreStorage(key, snapshot) {
  if (snapshot.exists) wx.setStorageSync(key, clone(snapshot.value));
  else if (wx.removeStorageSync) wx.removeStorageSync(key);
  else wx.setStorageSync(key, undefined);
}

function applyBackup(preflightOrPayload, mode = "merge") {
  if (["merge", "replace", "overwrite"].indexOf(mode) < 0) throw new Error("导入模式必须是 merge 或 replace");
  const checked = preflightOrPayload && preflightOrPayload.data && preflightOrPayload.summary ? preflightOrPayload : preflightBackup(preflightOrPayload);
  const backup = checked.data;
  const snapshots = {
    records: snapshotFor(RECORDS_KEY),
    places: snapshotFor(PLACES_KEY),
    ledgers: snapshotFor(LEDGERS_KEY),
    wishlist: snapshotFor(WISHLIST_KEY),
    storyPreferences: snapshotFor(STORY_PREFS_KEY),
    yearbookPreferences: snapshotFor(YEARBOOK_PREFS_KEY)
  };
  const rawRecords = snapshots.records.value;
  const rawPlaces = snapshots.places.value;
  const rawLedgers = snapshots.ledgers.value;
  const rawWishlist = snapshots.wishlist.value;
  const existingRecords = Array.isArray(rawRecords) ? rawRecords.map(normalizeRecord) : [];
  const existingPlaces = Array.isArray(rawPlaces) ? rawPlaces.map(normalizePlace) : [];
  const existingLedgers = Array.isArray(rawLedgers) ? rawLedgers.map(normalizeLedger) : [];
  const existingWishlist = Array.isArray(rawWishlist) ? rawWishlist.map(normalizeWishlistItem) : [];
  const existingPreferences = { story: snapshots.storyPreferences.value || {}, yearbook: snapshots.yearbookPreferences.value || {} };
  let nextRecords;
  let nextPlaces;
  let nextLedgers;
  let nextWishlist;
  let nextPreferences;
  let result;

  if (mode === "replace" || mode === "overwrite") {
    nextRecords = backup.records;
    nextPlaces = backup.places;
    nextLedgers = backup.ledgers === null ? existingLedgers : backup.ledgers;
    nextWishlist = backup.wishlist === null ? existingWishlist : backup.wishlist;
    nextPreferences = backup.preferences === null ? existingPreferences : backup.preferences;
    result = { mode: "replace", recordsAdded: nextRecords.length, placesAdded: nextPlaces.length, ledgersAdded: backup.ledgers === null ? 0 : nextLedgers.length, wishlistAdded: backup.wishlist === null ? 0 : nextWishlist.length, recordsSkipped: 0, placesSkipped: 0, ledgersSkipped: 0, wishlistSkipped: 0 };
  } else {
    const plan = buildMerge(existingRecords, existingPlaces, existingLedgers, existingWishlist, existingPreferences, backup);
    nextRecords = plan.recordsPlan.result;
    nextPlaces = plan.placesPlan.result;
    nextLedgers = backup.ledgers === null ? existingLedgers : plan.ledgersPlan.result;
    nextWishlist = backup.wishlist === null ? existingWishlist : plan.wishlistPlan.result;
    nextPreferences = backup.preferences === null ? existingPreferences : plan.preferences;
    result = {
      mode: "merge",
      recordsAdded: plan.recordsPlan.additions.length,
      placesAdded: plan.placesPlan.additions.length,
      ledgersAdded: backup.ledgers === null ? 0 : plan.ledgersPlan.additions.length,
      wishlistAdded: backup.wishlist === null ? 0 : plan.wishlistPlan.additions.length,
      recordsSkipped: plan.recordsPlan.skipped,
      placesSkipped: plan.placesPlan.skipped,
      ledgersSkipped: backup.ledgers === null ? 0 : plan.ledgersPlan.skipped,
      wishlistSkipped: backup.wishlist === null ? 0 : plan.wishlistPlan.skipped,
      recordIdMap: plan.recordsPlan.idMap,
      placeIdMap: plan.placesPlan.idMap,
      ledgerIdMap: plan.ledgersPlan.idMap,
      wishlistIdMap: plan.wishlistPlan.idMap
    };
  }

  try {
    wx.setStorageSync(RECORDS_KEY, nextRecords.map(normalizeRecord));
    wx.setStorageSync(PLACES_KEY, nextPlaces.map(normalizePlace));
    wx.setStorageSync(LEDGERS_KEY, nextLedgers.map(normalizeLedger));
    wx.setStorageSync(WISHLIST_KEY, nextWishlist.map(normalizeWishlistItem));
    wx.setStorageSync(STORY_PREFS_KEY, clone(nextPreferences.story || {}));
    wx.setStorageSync(YEARBOOK_PREFS_KEY, clone(nextPreferences.yearbook || {}));
  } catch (error) {
    const rollbackErrors = [];
    [[RECORDS_KEY, snapshots.records], [PLACES_KEY, snapshots.places], [LEDGERS_KEY, snapshots.ledgers], [WISHLIST_KEY, snapshots.wishlist], [STORY_PREFS_KEY, snapshots.storyPreferences], [YEARBOOK_PREFS_KEY, snapshots.yearbookPreferences]].forEach(([key, snapshot]) => {
      try { restoreStorage(key, snapshot); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    });
    const message = rollbackErrors.length ? "导入失败，且回滚未完整完成" : "导入失败，已自动回滚";
    const wrapped = new Error(`${message}: ${error.message || error}`);
    wrapped.rollbackErrors = rollbackErrors;
    throw wrapped;
  }
  return { ...result, recordCount: nextRecords.length, placeCount: nextPlaces.length, ledgerCount: nextLedgers.length, wishlistCount: nextWishlist.length };
}

module.exports = {
  APP_ID,
  LEDGERS_KEY,
  PLACES_KEY,
  RECORDS_KEY,
  WISHLIST_KEY,
  STORY_PREFS_KEY,
  YEARBOOK_PREFS_KEY,
  SCHEMA_VERSION,
  applyBackup,
  createBackup,
  exportFullBackup,
  preflightBackup
};
