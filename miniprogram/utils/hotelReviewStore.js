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
    createdAt: input.createdAt || new Date().toISOString()
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
  const nextRecord = normalizeRecord({
    ...record,
    id: Date.now(),
    createdAt: new Date().toISOString()
  });
  setRecords([nextRecord].concat(records));
  return nextRecord;
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

module.exports = {
  STORAGE_KEY,
  addRecord,
  deleteRecord,
  getRecordById,
  getRecords,
  getSummary,
  normalizeRecord,
  setRecords
};
