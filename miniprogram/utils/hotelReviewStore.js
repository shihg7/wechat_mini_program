const {
  buildScores,
  buildSelectedTags,
  getRecordTitle,
  getTypeConfig,
  getOverallScore,
  getVerdict,
  roundScore
} = require("./hotelScore");

const STORAGE_KEY = "hotel_review_records";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeRecord(input = {}) {
  const recordType = input.recordType || "hotel";
  const typeConfig = getTypeConfig(recordType);
  const scores = input.scores || buildScores(recordType);
  const overallScore = roundScore(input.overallScore || getOverallScore(scores, recordType));
  const hotelName = String(input.hotelName || "").trim();
  const restaurantName = String(input.restaurantName || "").trim();
  return {
    id: String(input.id || Date.now()),
    recordType,
    typeLabel: typeConfig.label,
    hotelName,
    restaurantName,
    displayName: getRecordTitle({ recordType, hotelName, restaurantName }),
    city: String(input.city || "").trim(),
    stayDate: String(input.stayDate || "").trim(),
    roomType: String(input.roomType || "").trim(),
    memberLevel: String(input.memberLevel || "").trim(),
    cuisine: String(input.cuisine || "").trim(),
    michelinLevel: String(input.michelinLevel || "").trim(),
    mealPeriod: String(input.mealPeriod || "").trim(),
    priceRange: String(input.priceRange || "").trim(),
    overallScore,
    verdict: input.verdict || getVerdict(overallScore, recordType),
    scores: clone(scores),
    selectedTags: clone(input.selectedTags || buildSelectedTags(recordType)),
    note: String(input.note || "").trim(),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || "",
    sourceRecordId: input.sourceRecordId ? String(input.sourceRecordId) : ""
  };
}

function getRecords() {
  const rawRecords = wx.getStorageSync(STORAGE_KEY);
  if (!Array.isArray(rawRecords)) return [];
  return rawRecords
    .filter((record) => record && (record.hotelName || record.restaurantName))
    .map(normalizeRecord)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function setRecords(records) {
  const normalized = records.map(normalizeRecord);
  wx.setStorageSync(STORAGE_KEY, normalized);
  return normalized;
}

function addRecord(record) {
  const records = getRecords();
  const now = new Date().toISOString();
  const nextRecord = normalizeRecord({
    ...record,
    id: Date.now(),
    createdAt: now,
    updatedAt: now
  });
  setRecords([nextRecord].concat(records));
  return nextRecord;
}

function updateRecord(id, patch) {
  const records = getRecords();
  let updatedRecord = null;
  const nextRecords = records.map((record) => {
    if (String(record.id) !== String(id)) return record;
    updatedRecord = normalizeRecord({
      ...record,
      ...patch,
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: new Date().toISOString()
    });
    return updatedRecord;
  });
  setRecords(nextRecords);
  return updatedRecord;
}

function duplicateRecord(id) {
  const source = getRecordById(id);
  if (!source) return null;
  return addRecord({
    ...source,
    sourceRecordId: source.id,
    note: source.note
  });
}

function deleteRecord(id) {
  const records = getRecords().filter((record) => String(record.id) !== String(id));
  setRecords(records);
  return records;
}

function getRecordById(id) {
  return getRecords().find((record) => String(record.id) === String(id)) || null;
}

function getSummary(records = getRecords()) {
  if (!records.length) {
    return {
      total: 0,
      hotelTotal: 0,
      restaurantTotal: 0,
      averageScore: 0,
      bestHotelName: "",
      latestHotelName: "",
      bestRecordName: "",
      latestRecordName: ""
    };
  }

  const totalScore = records.reduce((sum, record) => sum + Number(record.overallScore || 0), 0);
  const bestRecord = records.reduce((best, record) => (
    Number(record.overallScore || 0) > Number(best.overallScore || 0) ? record : best
  ), records[0]);

  return {
    total: records.length,
    hotelTotal: records.filter((record) => record.recordType !== "restaurant").length,
    restaurantTotal: records.filter((record) => record.recordType === "restaurant").length,
    averageScore: roundScore(totalScore / records.length),
    bestHotelName: bestRecord.displayName,
    latestHotelName: records[0].displayName,
    bestRecordName: bestRecord.displayName,
    latestRecordName: records[0].displayName
  };
}

function getSearchText(record) {
  return [
    record.displayName,
    record.hotelName,
    record.restaurantName,
    record.city,
    record.stayDate,
    record.roomType,
    record.memberLevel,
    record.cuisine,
    record.michelinLevel,
    record.mealPeriod,
    record.priceRange,
    record.verdict,
    record.note,
    Object.keys(record.selectedTags || {}).map((key) => (record.selectedTags[key] || []).join(" ")).join(" ")
  ].join(" ").toLowerCase();
}

function searchAndSortRecords(records, filters = {}) {
  const keyword = String(filters.keyword || "").trim().toLowerCase();
  const activeType = filters.activeType || "all";
  const sortMode = filters.sortMode || "created_desc";
  let result = records.slice();

  if (activeType === "hotel") {
    result = result.filter((record) => record.recordType !== "restaurant");
  } else if (activeType === "restaurant") {
    result = result.filter((record) => record.recordType === "restaurant");
  }

  if (keyword) {
    result = result.filter((record) => getSearchText(record).indexOf(keyword) >= 0);
  }

  const score = (record) => Number(record.overallScore || 0);
  const date = (record) => String(record.stayDate || "");
  const created = (record) => String(record.createdAt || "");
  result.sort((a, b) => {
    if (sortMode === "stay_desc") return date(b).localeCompare(date(a)) || created(b).localeCompare(created(a));
    if (sortMode === "score_desc") return score(b) - score(a) || created(b).localeCompare(created(a));
    if (sortMode === "score_asc") return score(a) - score(b) || created(b).localeCompare(created(a));
    return created(b).localeCompare(created(a));
  });

  return result;
}

function exportBackup(records = getRecords()) {
  const backup = {
    version: 1,
    app: "experience-review-miniprogram",
    exportedAt: new Date().toISOString(),
    records: records.map(normalizeRecord)
  };
  const filePath = `${wx.env.USER_DATA_PATH}/experience-review-backup.json`;
  wx.getFileSystemManager().writeFileSync(filePath, JSON.stringify(backup, null, 2), "utf8");
  return filePath;
}

function parseBackupPayload(payload) {
  const data = typeof payload === "string" ? JSON.parse(payload) : payload;
  const records = Array.isArray(data) ? data : data && data.records;
  if (!Array.isArray(records)) {
    throw new Error("Invalid backup format");
  }
  return records
    .map(normalizeRecord)
    .filter((record) => record.displayName && record.displayName.indexOf("未命名") !== 0);
}

function importBackup(records, mode = "merge") {
  const normalized = parseBackupPayload({ records });
  if (mode === "overwrite") {
    return setRecords(normalized);
  }

  const existing = getRecords();
  const existingIds = existing.reduce((map, record) => {
    map[record.id] = true;
    return map;
  }, {});
  const incoming = normalized.map((record) => {
    if (!existingIds[record.id]) return record;
    return normalizeRecord({
      ...record,
      id: Date.now() + Math.floor(Math.random() * 100000),
      sourceRecordId: record.sourceRecordId || record.id
    });
  });
  return setRecords(incoming.concat(existing));
}

module.exports = {
  STORAGE_KEY,
  addRecord,
  deleteRecord,
  duplicateRecord,
  exportBackup,
  getRecordById,
  getRecords,
  getSummary,
  importBackup,
  normalizeRecord,
  parseBackupPayload,
  searchAndSortRecords,
  setRecords,
  updateRecord
};
