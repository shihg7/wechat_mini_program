const quickRecordStore = require("../../../utils/quickRecordStore");
const tripStore = require("../../../utils/tripStore");
const checklistStore = require("../../../utils/checklistStore");
const ledgerStore = require("../../../utils/tripLedgerStore");
const wheelStore = require("./wheelStore");

const APP_ID = "local-toolbox-miniprogram";
const SCHEMA_VERSION = 1;
const LAST_BACKUP_KEY = "toolbox_last_backup_at";

const COLLECTIONS = [
  { key: "records", label: "快评", storageKey: quickRecordStore.STORAGE_KEY, get: quickRecordStore.getRecords, set: quickRecordStore.setRecords, normalize: quickRecordStore.normalizeRecord },
  { key: "trips", label: "行程", storageKey: tripStore.STORAGE_KEY, get: tripStore.getTrips, set: tripStore.setTrips, normalize: tripStore.normalizeTrip },
  { key: "checklists", label: "清单", storageKey: checklistStore.STORAGE_KEY, get: checklistStore.getChecklists, set: checklistStore.setChecklists, normalize: checklistStore.normalizeChecklist },
  { key: "ledgers", label: "账本", storageKey: ledgerStore.STORAGE_KEY, get: ledgerStore.getLedgers, set: ledgerStore.setLedgers, normalize: ledgerStore.normalizeLedger },
  { key: "wheels", label: "转盘", storageKey: wheelStore.STORAGE_KEY, get: wheelStore.getWheels, set: wheelStore.setWheels, normalize: wheelStore.normalizeWheel }
];

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

function assertUniqueIds(items, label) {
  const seen = new Set();
  items.forEach((item, index) => {
    const id = String(item && item.id || "").trim();
    if (!id) throw new Error(`${label}第 ${index + 1} 项缺少 id`);
    if (seen.has(id)) throw new Error(`${label}包含重复 id：${id}`);
    seen.add(id);
  });
}

function parseSource(source) {
  if (typeof source === "string") {
    try {
      return JSON.parse(source);
    } catch (error) {
      throw new Error("请选择有效的工具箱 JSON 备份");
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("备份内容必须是对象");
  return clone(source);
}

function normalizeBackup(source) {
  const value = parseSource(source);
  if (value.app !== APP_ID) throw new Error("这不是当前工具箱生成的备份");
  if (Number(value.schemaVersion) !== SCHEMA_VERSION) throw new Error(`仅支持工具箱备份 v${SCHEMA_VERSION}`);
  const backup = {
    schemaVersion: SCHEMA_VERSION,
    app: APP_ID,
    exportedAt: String(value.exportedAt || ""),
    records: [],
    trips: [],
    checklists: [],
    ledgers: [],
    wheels: []
  };
  COLLECTIONS.forEach((collection) => {
    if (!Array.isArray(value[collection.key])) throw new Error(`${collection.key} 必须是数组`);
    assertUniqueIds(value[collection.key], collection.label);
    try {
      backup[collection.key] = value[collection.key].map(collection.normalize);
    } catch (error) {
      throw new Error(`${collection.label}数据无效：${error.message || "格式错误"}`);
    }
  });
  return backup;
}

function buildSummary(backup) {
  return {
    schemaVersion: backup.schemaVersion,
    exportedAt: backup.exportedAt,
    recordCount: backup.records.length,
    tripCount: backup.trips.length,
    checklistCount: backup.checklists.length,
    ledgerCount: backup.ledgers.length,
    expenseCount: backup.ledgers.reduce((sum, ledger) => sum + (ledger.expenses || []).length, 0),
    wheelCount: backup.wheels.length
  };
}

function buildBackup() {
  const backup = {
    schemaVersion: SCHEMA_VERSION,
    app: APP_ID,
    exportedAt: new Date().toISOString()
  };
  COLLECTIONS.forEach((collection) => {
    backup[collection.key] = collection.get().map(collection.normalize);
  });
  return backup;
}

function preflightBackup(source) {
  const backup = normalizeBackup(source && source.backup ? source.backup : source);
  return { backup, summary: buildSummary(backup) };
}

function readSnapshot(key) {
  const value = wx.getStorageSync(key);
  return { exists: value !== undefined && value !== "", value: clone(value) };
}

function restoreSnapshot(key, snapshot) {
  if (snapshot.exists) wx.setStorageSync(key, clone(snapshot.value));
  else if (wx.removeStorageSync) wx.removeStorageSync(key);
  else wx.setStorageSync(key, undefined);
}

function makeUniqueId(id, used) {
  let index = 1;
  let candidate = `${id}_import_${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${id}_import_${index}`;
  }
  return candidate;
}

function sameImportedConflict(candidate, incoming) {
  const sourceId = String(incoming.id);
  if (!String(candidate.id).startsWith(`${sourceId}_import_`)) return false;
  return stableStringify({ ...candidate, id: sourceId }) === stableStringify(incoming);
}

function mergeCollection(current, incoming, normalize) {
  const next = current.map(normalize);
  const byId = new Map(next.map((item) => [String(item.id), item]));
  const used = new Set(byId.keys());
  let added = 0;
  let skipped = 0;
  incoming.forEach((source) => {
    const item = normalize(source);
    const existing = byId.get(String(item.id));
    if (existing && stableStringify(existing) === stableStringify(item)) {
      skipped += 1;
      return;
    }
    if (existing) {
      if (next.some((candidate) => sameImportedConflict(candidate, item))) {
        skipped += 1;
        return;
      }
      item.id = makeUniqueId(item.id, used);
    }
    used.add(String(item.id));
    byId.set(String(item.id), item);
    next.push(normalize(item));
    added += 1;
  });
  return { items: next, added, skipped };
}

function applyBackup(source, mode = "merge") {
  if (mode !== "merge" && mode !== "replace") throw new Error("恢复模式必须是 merge 或 replace");
  const checked = source && source.backup && source.summary ? source : preflightBackup(source);
  const backup = checked.backup;
  const snapshots = COLLECTIONS.reduce((result, collection) => {
    result[collection.storageKey] = readSnapshot(collection.storageKey);
    return result;
  }, {});
  const result = {};
  try {
    COLLECTIONS.forEach((collection) => {
      const next = mode === "replace"
        ? { items: backup[collection.key].map(collection.normalize), added: backup[collection.key].length, skipped: 0 }
        : mergeCollection(collection.get(), backup[collection.key], collection.normalize);
      collection.set(next.items);
      result[`${collection.key}Added`] = next.added;
      result[`${collection.key}Skipped`] = next.skipped;
      result[`${collection.key}Count`] = next.items.length;
    });
  } catch (error) {
    COLLECTIONS.forEach((collection) => {
      try {
        restoreSnapshot(collection.storageKey, snapshots[collection.storageKey]);
      } catch (restoreError) {
        // Continue restoring the remaining collections.
      }
    });
    throw new Error(`恢复失败，已自动回滚：${error.message || "本地写入异常"}`);
  }
  return result;
}

function exportFullBackup() {
  const backup = buildBackup();
  const filePath = `${wx.env.USER_DATA_PATH}/toolbox-backup-v1.json`;
  wx.getFileSystemManager().writeFileSync(filePath, JSON.stringify(backup, null, 2), "utf8");
  wx.setStorageSync(LAST_BACKUP_KEY, backup.exportedAt);
  return { backup, filePath, summary: buildSummary(backup) };
}

function resetAllData() {
  COLLECTIONS.forEach((collection) => collection.set([]));
  if (wx.removeStorageSync) wx.removeStorageSync(LAST_BACKUP_KEY);
  else wx.setStorageSync(LAST_BACKUP_KEY, undefined);
}

function getLocalDataSummary() {
  const backup = buildBackup();
  let storage = {};
  try {
    storage = wx.getStorageInfoSync ? wx.getStorageInfoSync() : {};
  } catch (error) {
    storage = {};
  }
  return {
    ...buildSummary(backup),
    currentSizeKb: Number(storage.currentSize || 0),
    limitSizeKb: Number(storage.limitSize || 0),
    lastBackupAt: String(wx.getStorageSync(LAST_BACKUP_KEY) || "")
  };
}

module.exports = {
  APP_ID,
  COLLECTIONS,
  LAST_BACKUP_KEY,
  SCHEMA_VERSION,
  applyBackup,
  buildBackup,
  exportFullBackup,
  getLocalDataSummary,
  preflightBackup,
  resetAllData
};
