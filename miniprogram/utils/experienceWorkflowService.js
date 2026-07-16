const recordRepository = require("./repositories/recordRepository");
const placeRepository = require("./repositories/placeRepository");
const wishlistRepository = require("./repositories/wishlistRepository");
const tripRepository = require("./repositories/tripRepository");
const departureRepository = require("./repositories/departureRepository");

const STORAGE_KEYS = [
  recordRepository.STORAGE_KEY,
  placeRepository.STORAGE_KEY,
  wishlistRepository.STORAGE_KEY,
  tripRepository.STORAGE_KEY,
  departureRepository.BOOKINGS_KEY
];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function takeSnapshot() {
  return STORAGE_KEYS.reduce((snapshot, key) => {
    const value = wx.getStorageSync(key);
    snapshot[key] = {
      exists: value !== undefined && value !== "",
      value: clone(value)
    };
    return snapshot;
  }, {});
}

function restoreSnapshot(snapshot) {
  const errors = [];
  STORAGE_KEYS.forEach((key) => {
    try {
      if (snapshot[key].exists) wx.setStorageSync(key, clone(snapshot[key].value));
      else if (wx.removeStorageSync) wx.removeStorageSync(key);
      else wx.setStorageSync(key, undefined);
    } catch (error) {
      errors.push(error);
    }
  });
  return errors;
}

function updateRelations(record) {
  if (record.status === "draft") return;

  if (record.wishlistId) {
    const wishlist = wishlistRepository.getWishlistItem(record.wishlistId);
    if (!wishlist) throw new Error("关联的想去项不存在");
    if (!wishlistRepository.markWishlistVisited(record.wishlistId, record.placeId)) {
      throw new Error("想去项状态更新失败");
    }
  }

  if (record.tripId && record.itineraryItemId) {
    const trip = tripRepository.getTripById(record.tripId);
    if (!trip || !(trip.itineraryItems || []).some((item) => String(item.id) === String(record.itineraryItemId))) {
      throw new Error("关联的行程日程不存在");
    }
    if (!tripRepository.updateItineraryItem(record.tripId, record.itineraryItemId, {
      recordId: record.id,
      bookingStatus: "visited"
    })) {
      throw new Error("行程状态更新失败");
    }
  }

  if (record.bookingId) {
    if (!departureRepository.getBookingById(record.bookingId)) throw new Error("关联的预订不存在");
    if (!departureRepository.markBookingCompleted(record.bookingId, record.id)) {
      throw new Error("预订状态更新失败");
    }
  }
}

function saveExperienceRecord(options = {}) {
  const snapshot = takeSnapshot();
  try {
    const input = { ...(options.recordInput || {}) };
    if (!input.placeId) {
      const place = placeRepository.createPlace(options.placeInput || {});
      input.placeId = place.id;
      input.placeName = place.name;
    }

    const record = options.mode === "edit"
      ? recordRepository.updateRecord(options.recordId, input)
      : recordRepository.addRecord(input);
    if (!record) throw new Error(options.mode === "edit" ? "记录不存在" : "记录创建失败");

    updateRelations(record);
    return record;
  } catch (error) {
    const rollbackErrors = restoreSnapshot(snapshot);
    const message = rollbackErrors.length
      ? "保存失败，且数据回滚未完整完成"
      : "保存失败，已恢复原数据";
    const wrapped = new Error(`${message}：${error.message || error}`);
    wrapped.cause = error;
    wrapped.rollbackErrors = rollbackErrors;
    throw wrapped;
  }
}

module.exports = {
  STORAGE_KEYS,
  saveExperienceRecord,
  takeSnapshot
};
