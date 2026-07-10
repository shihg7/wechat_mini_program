const adapter = require("./localAdapters/wishlistLocalAdapter");

function getPendingSync(limit = 100) { return adapter.getWishlist({ includeDeleted: true }).filter((item) => ["dirty", "error", "conflict"].indexOf(item.syncStatus) >= 0).slice(0, limit); }
function writeSyncState(id, patch) {
  let result = null;
  const items = adapter.getWishlist({ includeDeleted: true }).map((item) => {
    if (String(item.id) !== String(id)) return item;
    result = adapter.normalizeWishlistItem({ ...item, ...patch, id: item.id, createdAt: item.createdAt });
    return result;
  });
  if (result) adapter.setWishlist(items);
  return result;
}
function markSynced(id, remote = {}) { const current = adapter.getWishlist({ includeDeleted: true }).find((item) => String(item.id) === String(id)); return writeSyncState(id, { cloudId: remote.cloudId || remote.id || "", cloudWishlistId: remote.cloudWishlistId || remote.id || "", revision: Math.max(Number(remote.revision || 0), Number(current && current.revision || 1)), syncStatus: "synced", syncedAt: new Date().toISOString(), conflictSnapshot: null }); }
function markConflict(id, remoteSnapshot) { return writeSyncState(id, { syncStatus: "conflict", conflictSnapshot: remoteSnapshot || {} }); }

module.exports = { ...adapter, getPendingSync, markConflict, markSynced };
