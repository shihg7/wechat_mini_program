const adapter = require("./localAdapters/recordLocalAdapter");
const { toPrivateSyncDto, toPublicReviewDto } = require("../syncDtos");

function getPendingSync(limit = 100) {
  return adapter.getRecords({ includeDeleted: true }).filter((item) => ["dirty", "error", "conflict"].indexOf(item.syncStatus) >= 0).slice(0, limit).map(toPrivateSyncDto);
}

function writeSyncState(id, patch) {
  let result = null;
  const items = adapter.getRecords({ includeDeleted: true }).map((item) => {
    if (String(item.id) !== String(id)) return item;
    result = adapter.normalizeRecord({ ...item, ...patch, id: item.id, createdAt: item.createdAt });
    return result;
  });
  if (result) adapter.setRecords(items);
  return result;
}

function markSynced(id, remote = {}) {
  const current = adapter.getRecords({ includeDeleted: true }).find((item) => String(item.id) === String(id));
  return writeSyncState(id, { cloudId: remote.cloudId || remote.id || "", cloudRecordId: remote.cloudRecordId || remote.id || "", revision: Math.max(Number(remote.revision || 0), Number(current && current.revision || 1)), syncStatus: "synced", syncedAt: new Date().toISOString(), conflictSnapshot: null });
}

function markConflict(id, remoteSnapshot) {
  return writeSyncState(id, { syncStatus: "conflict", conflictSnapshot: remoteSnapshot || {} });
}

module.exports = { ...adapter, getPendingSync, markConflict, markSynced, toPrivateSyncDto, toPublicReviewDto };
