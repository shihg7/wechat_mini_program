const STORAGE_KEY = "toolbox_quick_records";
const RECORD_TYPES = ["hotel", "restaurant"];
const SCHEMA_KEYS = [
  "id",
  "type",
  "name",
  "city",
  "visitDate",
  "score",
  "note",
  "createdAt",
  "updatedAt"
];

let lastIdTime = 0;
let idSequence = 0;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getToday(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= monthDays[month - 1];
}

function normalizeType(value) {
  const type = value == null || value === "" ? "hotel" : String(value);
  if (RECORD_TYPES.indexOf(type) < 0) throw new Error("记录类型无效");
  return type;
}

function normalizeName(value) {
  const name = String(value || "").trim();
  if (!name) throw new Error("请填写名称");
  return name;
}

function normalizeVisitDate(value) {
  const visitDate = String(value || "").trim() || getToday();
  if (!isValidDate(visitDate)) throw new Error("到访日期无效");
  return visitDate;
}

function normalizeScore(value) {
  if (value == null || String(value).trim() === "") return null;
  const text = String(value).trim();
  if (!/^(?:10(?:\.0)?|[1-9](?:\.\d)?)$/.test(text)) {
    throw new Error("评分须为 1 到 10，最多一位小数");
  }
  return Number(Number(text).toFixed(1));
}

function makeRecord(input, metadata) {
  return {
    id: String(metadata.id),
    type: normalizeType(input.type),
    name: normalizeName(input.name),
    city: String(input.city || "").trim(),
    visitDate: normalizeVisitDate(input.visitDate),
    score: normalizeScore(input.score),
    note: String(input.note || "").trim(),
    createdAt: String(metadata.createdAt),
    updatedAt: String(metadata.updatedAt)
  };
}

function normalizeRecord(input = {}) {
  const now = new Date();
  const createdAt = String(input.createdAt || now.toISOString());
  const inputId = input.id == null ? "" : String(input.id).trim();
  return makeRecord(input, {
    id: inputId || createId([], now),
    createdAt,
    updatedAt: String(input.updatedAt || createdAt)
  });
}

function normalizeStoredRecord(input) {
  const inputId = input && input.id != null ? String(input.id).trim() : "";
  if (!input || typeof input !== "object" || !inputId) return null;
  try {
    return normalizeRecord(input);
  } catch (error) {
    return null;
  }
}

function compareRecords(left, right) {
  const byDate = String(right.visitDate).localeCompare(String(left.visitDate));
  if (byDate) return byDate;
  const byUpdate = String(right.updatedAt).localeCompare(String(left.updatedAt));
  if (byUpdate) return byUpdate;
  return String(right.createdAt).localeCompare(String(left.createdAt));
}

function readRecords() {
  const stored = wx.getStorageSync(STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.map(normalizeStoredRecord).filter(Boolean);
}

function setRecords(items) {
  const records = (Array.isArray(items) ? items : []).map(normalizeRecord);
  const ids = new Set();
  records.forEach((record) => {
    if (ids.has(record.id)) throw new Error(`记录 id 重复：${record.id}`);
    ids.add(record.id);
  });
  records.sort(compareRecords);
  wx.setStorageSync(STORAGE_KEY, records);
  return clone(records);
}

function filterRecords(records = [], options = {}) {
  const query = String(options.query || options.keyword || "").trim().toLocaleLowerCase();
  const type = RECORD_TYPES.indexOf(options.type) >= 0 ? options.type : "all";
  return (Array.isArray(records) ? records : [])
    .filter((record) => type === "all" || record.type === type)
    .filter((record) => {
      if (!query) return true;
      return [
        record.name,
        record.city,
        record.visitDate,
        record.score == null ? "" : String(record.score),
        record.note
      ].some((value) => String(value || "").toLocaleLowerCase().includes(query));
    })
    .slice()
    .sort(compareRecords)
    .map(clone);
}

function getRecords(options = {}) {
  return filterRecords(readRecords(), options);
}

function getRecordById(id) {
  const record = readRecords().find((item) => String(item.id) === String(id));
  return record ? clone(record) : null;
}

function createId(existingRecords, time) {
  const timeValue = time.getTime();
  if (timeValue === lastIdTime) idSequence += 1;
  else {
    lastIdTime = timeValue;
    idSequence = 0;
  }
  let candidate = `quick_${timeValue}_${idSequence}`;
  const ids = new Set(existingRecords.map((record) => String(record.id)));
  while (ids.has(candidate)) {
    idSequence += 1;
    candidate = `quick_${timeValue}_${idSequence}`;
  }
  return candidate;
}

function addRecord(input = {}) {
  const records = readRecords();
  const now = new Date();
  const timestamp = now.toISOString();
  const record = makeRecord(input, {
    id: createId(records, now),
    createdAt: timestamp,
    updatedAt: timestamp
  });
  setRecords([record].concat(records));
  return clone(record);
}

function nextUpdatedAt(previousValue) {
  const now = Date.now();
  const previous = Date.parse(previousValue);
  return new Date(Number.isFinite(previous) && now <= previous ? previous + 1 : now).toISOString();
}

function updateRecord(id, patch = {}) {
  const records = readRecords();
  const index = records.findIndex((record) => String(record.id) === String(id));
  if (index < 0) return null;
  const current = records[index];
  const updated = makeRecord({ ...current, ...patch }, {
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: nextUpdatedAt(current.updatedAt)
  });
  records[index] = updated;
  setRecords(records);
  return clone(updated);
}

function deleteRecord(id) {
  const records = readRecords();
  const remaining = records.filter((record) => String(record.id) !== String(id));
  if (remaining.length === records.length) return false;
  setRecords(remaining);
  return true;
}

module.exports = {
  STORAGE_KEY,
  RECORD_TYPES,
  SCHEMA_KEYS,
  getToday,
  normalizeScore,
  normalizeRecord,
  filterRecords,
  searchRecords: filterRecords,
  getRecords,
  setRecords,
  getRecordById,
  createRecord: addRecord,
  addRecord,
  updateRecord,
  deleteRecord
};
