const adapter = require("./localAdapters/placeLocalAdapter");
const { toPublicPlaceDto } = require("../syncDtos");

function getPendingSync(limit = 100) { return adapter.getPlaces({ includeDeleted: true }).filter((item) => ["dirty", "error", "conflict"].indexOf(item.syncStatus) >= 0).slice(0, limit); }
function writeSyncState(id, patch) {
  let result = null;
  const items = adapter.getPlaces({ includeDeleted: true }).map((item) => {
    if (String(item.id) !== String(id)) return item;
    result = adapter.normalizePlace({ ...item, ...patch, id: item.id, createdAt: item.createdAt });
    return result;
  });
  if (result) adapter.setPlaces(items);
  return result;
}
function markSynced(id, remote = {}) { const current = adapter.getPlaces({ includeDeleted: true }).find((item) => String(item.id) === String(id)); return writeSyncState(id, { cloudId: remote.cloudId || remote.id || "", cloudPlaceId: remote.cloudPlaceId || remote.id || "", revision: Math.max(Number(remote.revision || 0), Number(current && current.revision || 1)), syncStatus: "synced", syncedAt: new Date().toISOString(), conflictSnapshot: null }); }
function markConflict(id, remoteSnapshot) { return writeSyncState(id, { syncStatus: "conflict", conflictSnapshot: remoteSnapshot || {} }); }

module.exports = { ...adapter, getPendingSync, markConflict, markSynced, toPublicPlaceDto };
