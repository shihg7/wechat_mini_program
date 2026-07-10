const { STORAGE_KEY: RECORDS_KEY, normalizeRecord } = require("./hotelReviewStore");
const { STORAGE_KEY: LEDGERS_KEY, normalizeLedger } = require("./tripLedgerStore");

const APP_ID = "experience-review-miniprogram";
const SCHEMA_VERSION = 2;

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
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}必须是对象`);
  }
}

function assertItems(items, label) {
  if (!Array.isArray(items)) throw new Error(`${label}必须是数组`);
  items.forEach((item, index) => {
    assertObject(item, `${label}[${index}]`);
    if (item.id === undefined || item.id === null || String(item.id).trim() === "") {
      throw new Error(`${label}[${index}]缺少 id`);
    }
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
  if (version !== 1 && version !== SCHEMA_VERSION) throw new Error("仅支持 schemaVersion 1 或 2");
  if (data.app && data.app !== APP_ID) throw new Error("备份来源应用不匹配");
  assertItems(data.records, "records");
  if (version === SCHEMA_VERSION) assertItems(data.ledgers, "ledgers");
  if (version === 1 && data.ledgers !== undefined) throw new Error("version 1 备份不应包含 ledgers");

  const recordIds = {};
  data.records.forEach((record, index) => {
    if (!record.hotelName && !record.restaurantName) throw new Error(`records[${index}]缺少体验名称`);
    const id = String(record.id);
    if (recordIds[id]) throw new Error(`records 存在重复 id: ${id}`);
    recordIds[id] = true;
  });
  const ledgerIds = {};
  (data.ledgers || []).forEach((ledger, ledgerIndex) => {
    const ledgerId = String(ledger.id);
    if (ledgerIds[ledgerId]) throw new Error(`ledgers 存在重复 id: ${ledgerId}`);
    ledgerIds[ledgerId] = true;
    if (!Array.isArray(ledger.members) || !Array.isArray(ledger.expenses)) {
      throw new Error(`ledgers[${ledgerIndex}]的 members/expenses 必须是数组`);
    }
    const expenseIds = {};
    ledger.expenses.forEach((expense, expenseIndex) => {
      assertObject(expense, `ledgers[${ledgerIndex}].expenses[${expenseIndex}]`);
      if (expense.id === undefined || String(expense.id).trim() === "") {
        throw new Error(`ledgers[${ledgerIndex}].expenses[${expenseIndex}]缺少 id`);
      }
      const id = String(expense.id);
      if (expenseIds[id]) throw new Error(`账本 ${ledger.id} 存在重复支出 id: ${id}`);
      expenseIds[id] = true;
    });
  });

  const normalized = {
    schemaVersion: version,
    app: data.app || APP_ID,
    exportedAt: data.exportedAt || "",
    importToken: hashText(stableStringify(data)),
    records: data.records.map(normalizeRecord),
    ledgers: version === SCHEMA_VERSION ? data.ledgers.map(normalizeLedger) : null
  };
  const expenseCount = (normalized.ledgers || []).reduce((sum, ledger) => sum + ledger.expenses.length, 0);
  return {
    data: normalized,
    summary: {
      schemaVersion: version,
      exportedAt: normalized.exportedAt,
      recordCount: normalized.records.length,
      ledgerCount: normalized.ledgers ? normalized.ledgers.length : 0,
      expenseCount,
      ledgersIncluded: normalized.ledgers !== null
    }
  };
}

function createBackup(records, ledgers) {
  const normalizedRecords = (records || []).map(normalizeRecord);
  const normalizedLedgers = (ledgers || []).map(normalizeLedger);
  return {
    schemaVersion: SCHEMA_VERSION,
    version: SCHEMA_VERSION,
    app: APP_ID,
    exportedAt: new Date().toISOString(),
    summary: {
      recordCount: normalizedRecords.length,
      ledgerCount: normalizedLedgers.length,
      expenseCount: normalizedLedgers.reduce((sum, ledger) => sum + ledger.expenses.length, 0)
    },
    records: normalizedRecords,
    ledgers: normalizedLedgers
  };
}

function exportFullBackup(records, ledgers) {
  const backup = createBackup(records === undefined ? wx.getStorageSync(RECORDS_KEY) || [] : records,
    ledgers === undefined ? wx.getStorageSync(LEDGERS_KEY) || [] : ledgers);
  const filePath = `${wx.env.USER_DATA_PATH}/experience-review-full-backup-v2.json`;
  wx.getFileSystemManager().writeFileSync(filePath, JSON.stringify(backup, null, 2), "utf8");
  return { filePath, backup, summary: backup.summary };
}

function comparable(item) {
  function stripRuntimeFields(value) {
    if (Array.isArray(value)) return value.map(stripRuntimeFields);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).reduce((result, key) => {
      if (key !== "id" && key !== "createdAt" && key !== "updatedAt") {
        result[key] = stripRuntimeFields(value[key]);
      }
      return result;
    }, {});
  }
  return stableStringify(stripRuntimeFields(item));
}

function planCollection(existing, incoming, kind, backupToken) {
  const byId = existing.reduce((map, item) => {
    map[String(item.id)] = item;
    return map;
  }, {});
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

function buildMerge(existingRecords, existingLedgers, backup) {
  const backupToken = backup.importToken || hashText(stableStringify(backup));
  const recordsPlan = planCollection(existingRecords, backup.records, "record", backupToken);
  const remappedLedgers = (backup.ledgers || []).map((ledger) => ({
    ...ledger,
    expenses: ledger.expenses.map((expense) => ({
      ...expense,
      relatedRecordId: recordsPlan.idMap[String(expense.relatedRecordId)] || expense.relatedRecordId
    }))
  }));
  const ledgersPlan = planCollection(existingLedgers, remappedLedgers, "ledger", backupToken);
  return { recordsPlan, ledgersPlan };
}

function restoreStorage(key, snapshot) {
  if (snapshot.exists) wx.setStorageSync(key, clone(snapshot.value));
  else if (wx.removeStorageSync) wx.removeStorageSync(key);
  else wx.setStorageSync(key, undefined);
}

function applyBackup(preflightOrPayload, mode = "merge") {
  if (mode !== "merge" && mode !== "replace" && mode !== "overwrite") {
    throw new Error("导入模式必须是 merge 或 replace");
  }
  const checked = preflightOrPayload && preflightOrPayload.data && preflightOrPayload.summary
    ? preflightOrPayload
    : preflightBackup(preflightOrPayload);
  const backup = checked.data;
  const rawRecords = wx.getStorageSync(RECORDS_KEY);
  const rawLedgers = wx.getStorageSync(LEDGERS_KEY);
  const recordSnapshot = { exists: rawRecords !== undefined && rawRecords !== "", value: clone(rawRecords) };
  const ledgerSnapshot = { exists: rawLedgers !== undefined && rawLedgers !== "", value: clone(rawLedgers) };
  const existingRecords = Array.isArray(rawRecords) ? rawRecords.map(normalizeRecord) : [];
  const existingLedgers = Array.isArray(rawLedgers) ? rawLedgers.map(normalizeLedger) : [];
  let nextRecords;
  let nextLedgers;
  let result;

  if (mode === "replace" || mode === "overwrite") {
    nextRecords = backup.records;
    nextLedgers = backup.ledgers === null ? existingLedgers : backup.ledgers;
    result = {
      mode: "replace",
      recordsAdded: nextRecords.length,
      ledgersAdded: backup.ledgers === null ? 0 : nextLedgers.length,
      recordsSkipped: 0,
      ledgersSkipped: 0
    };
  } else {
    const plan = buildMerge(existingRecords, existingLedgers, backup);
    nextRecords = plan.recordsPlan.result;
    nextLedgers = backup.ledgers === null ? existingLedgers : plan.ledgersPlan.result;
    result = {
      mode: "merge",
      recordsAdded: plan.recordsPlan.additions.length,
      ledgersAdded: backup.ledgers === null ? 0 : plan.ledgersPlan.additions.length,
      recordsSkipped: plan.recordsPlan.skipped,
      ledgersSkipped: backup.ledgers === null ? 0 : plan.ledgersPlan.skipped,
      recordIdMap: plan.recordsPlan.idMap,
      ledgerIdMap: plan.ledgersPlan.idMap
    };
  }

  try {
    wx.setStorageSync(RECORDS_KEY, nextRecords.map(normalizeRecord));
    wx.setStorageSync(LEDGERS_KEY, nextLedgers.map(normalizeLedger));
  } catch (error) {
    const rollbackErrors = [];
    try { restoreStorage(RECORDS_KEY, recordSnapshot); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    try { restoreStorage(LEDGERS_KEY, ledgerSnapshot); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    const message = rollbackErrors.length ? "导入失败，且回滚未完整完成" : "导入失败，已自动回滚";
    const wrapped = new Error(`${message}: ${error.message || error}`);
    wrapped.cause = error;
    wrapped.rollbackErrors = rollbackErrors;
    throw wrapped;
  }
  return { ...result, recordCount: nextRecords.length, ledgerCount: nextLedgers.length };
}

module.exports = {
  APP_ID,
  LEDGERS_KEY,
  RECORDS_KEY,
  SCHEMA_VERSION,
  applyBackup,
  createBackup,
  exportFullBackup,
  preflightBackup
};
