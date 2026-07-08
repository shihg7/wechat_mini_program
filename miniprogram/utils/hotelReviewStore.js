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
  const status = input.status === "draft" ? "draft" : "completed";
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
    customTags: Array.isArray(input.customTags)
      ? input.customTags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
    note: String(input.note || "").trim(),
    status,
    statusLabel: status === "draft" ? "草稿" : "已完成",
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
      draftTotal: 0,
      cityTotal: 0,
      averageScore: 0,
      bestHotelName: "",
      latestHotelName: "",
      bestRecordName: "",
      latestRecordName: ""
    };
  }

  const completedRecords = records.filter((record) => record.status !== "draft");
  const scoredRecords = completedRecords.length ? completedRecords : [];
  const totalScore = scoredRecords.reduce((sum, record) => sum + Number(record.overallScore || 0), 0);
  const bestRecord = scoredRecords.length
    ? scoredRecords.reduce((best, record) => (
      Number(record.overallScore || 0) > Number(best.overallScore || 0) ? record : best
    ), scoredRecords[0])
    : records[0];

  return {
    total: records.length,
    hotelTotal: records.filter((record) => record.recordType !== "restaurant").length,
    restaurantTotal: records.filter((record) => record.recordType === "restaurant").length,
    draftTotal: records.filter((record) => record.status === "draft").length,
    cityTotal: getUniqueCities(records).length,
    averageScore: scoredRecords.length ? roundScore(totalScore / scoredRecords.length) : 0,
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
    record.statusLabel,
    record.note,
    (record.customTags || []).join(" "),
    Object.keys(record.selectedTags || {}).map((key) => (record.selectedTags[key] || []).join(" ")).join(" ")
  ].join(" ").toLowerCase();
}

function searchAndSortRecords(records, filters = {}) {
  const keyword = String(filters.keyword || "").trim().toLowerCase();
  const activeType = filters.activeType || "all";
  const activeStatus = filters.activeStatus || "all";
  const activeTag = String(filters.activeTag || "").trim();
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

  if (activeStatus === "draft") {
    result = result.filter((record) => record.status === "draft");
  } else if (activeStatus === "completed") {
    result = result.filter((record) => record.status !== "draft");
  }

  if (activeTag) {
    result = result.filter((record) => getAllRecordTags(record).indexOf(activeTag) >= 0);
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

function getUniqueCities(records) {
  return records.reduce((cities, record) => {
    if (record.city && cities.indexOf(record.city) < 0) cities.push(record.city);
    return cities;
  }, []);
}

function getAllRecordTags(record) {
  const systemTags = Object.keys(record.selectedTags || {}).reduce((tags, key) => {
    return tags.concat(record.selectedTags[key] || []);
  }, []);
  return systemTags.concat(record.customTags || []).filter(Boolean);
}

function getTimelineGroups(records = getRecords()) {
  const sorted = records.slice().sort((a, b) => {
    const dateA = a.stayDate || "0000-00-00";
    const dateB = b.stayDate || "0000-00-00";
    return dateB.localeCompare(dateA) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  const groups = [];
  const groupMap = {};
  sorted.forEach((record) => {
    const groupKey = record.stayDate ? record.stayDate.slice(0, 7) : "undated";
    const title = record.stayDate ? groupKey.replace("-", "年") + "月" : "未标日期";
    if (!groupMap[groupKey]) {
      groupMap[groupKey] = { key: groupKey, title, records: [] };
      groups.push(groupMap[groupKey]);
    }
    groupMap[groupKey].records.push(record);
  });
  return groups;
}

function getCityStats(records = getRecords()) {
  const cityMap = {};
  records.forEach((record) => {
    const city = record.city || "未填写城市";
    if (!cityMap[city]) {
      cityMap[city] = {
        city,
        total: 0,
        hotelTotal: 0,
        restaurantTotal: 0,
        averageScore: 0,
        bestRecordName: "",
        bestRecordScore: 0,
        records: [],
        totalScore: 0
      };
    }
    const item = cityMap[city];
    item.total += 1;
    item.hotelTotal += record.recordType === "restaurant" ? 0 : 1;
    item.restaurantTotal += record.recordType === "restaurant" ? 1 : 0;
    if (record.status !== "draft") item.totalScore += Number(record.overallScore || 0);
    item.records.push(record);
    if (Number(record.overallScore || 0) >= item.bestRecordScore) {
      item.bestRecordName = record.displayName;
      item.bestRecordScore = Number(record.overallScore || 0);
    }
  });
  return Object.keys(cityMap).map((city) => {
    const item = cityMap[city];
    const completedTotal = item.records.filter((record) => record.status !== "draft").length;
    item.averageScore = completedTotal ? roundScore(item.totalScore / completedTotal) : 0;
    delete item.totalScore;
    return item;
  }).sort((a, b) => b.total - a.total || b.averageScore - a.averageScore);
}

function getTagStats(records = getRecords()) {
  const tagMap = {};
  records.forEach((record) => {
    getAllRecordTags(record).forEach((tag) => {
      if (!tagMap[tag]) {
        tagMap[tag] = {
          tag,
          total: 0,
          systemTotal: 0,
          customTotal: 0,
          completedTotal: 0,
          averageScore: 0,
          totalScore: 0
        };
      }
      tagMap[tag].total += 1;
      if (record.status !== "draft") {
        tagMap[tag].completedTotal += 1;
        tagMap[tag].totalScore += Number(record.overallScore || 0);
      }
      if ((record.customTags || []).indexOf(tag) >= 0) {
        tagMap[tag].customTotal += 1;
      } else {
        tagMap[tag].systemTotal += 1;
      }
    });
  });
  return Object.keys(tagMap).map((tag) => {
    const item = tagMap[tag];
    item.averageScore = item.completedTotal ? roundScore(item.totalScore / item.completedTotal) : 0;
    delete item.totalScore;
    return item;
  }).sort((a, b) => b.total - a.total || b.averageScore - a.averageScore);
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
  getAllRecordTags,
  getCityStats,
  getRecordById,
  getRecords,
  getSummary,
  getTagStats,
  getTimelineGroups,
  importBackup,
  normalizeRecord,
  parseBackupPayload,
  searchAndSortRecords,
  setRecords,
  updateRecord
};
