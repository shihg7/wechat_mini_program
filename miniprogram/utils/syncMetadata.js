const { createId } = require("./id");

const DEVICE_ID_KEY = "experience_device_id";
const SYNC_STATUSES = ["local", "dirty", "synced", "conflict", "error"];

function getDeviceId() {
  const current = wx.getStorageSync(DEVICE_ID_KEY);
  if (current) return String(current);
  const deviceId = createId("device");
  wx.setStorageSync(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

function normalizeSyncMetadata(input = {}) {
  return {
    revision: Number.isSafeInteger(Number(input.revision)) && Number(input.revision) > 0 ? Number(input.revision) : 1,
    syncStatus: SYNC_STATUSES.indexOf(input.syncStatus) >= 0 ? input.syncStatus : "local",
    deviceId: String(input.deviceId || getDeviceId()),
    cloudId: String(input.cloudId || ""),
    syncedAt: String(input.syncedAt || ""),
    deletedAt: String(input.deletedAt || "")
  };
}

function markDirty(item, patch = {}) {
  return {
    ...item,
    ...patch,
    revision: Number(item.revision || 1) + 1,
    syncStatus: "dirty",
    deviceId: getDeviceId(),
    updatedAt: new Date().toISOString()
  };
}

module.exports = { DEVICE_ID_KEY, SYNC_STATUSES, getDeviceId, markDirty, normalizeSyncMetadata };
