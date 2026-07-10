const { createId } = require("./id");

const MAX_PHOTOS = 9;
const MEDIA_REGISTRY_KEY = "experience_media_files";
const HOTEL_CATEGORIES = ["房间", "早餐", "酒廊", "泳池", "环境", "其他"];
const RESTAURANT_CATEGORIES = ["菜品", "环境", "酒水", "菜单", "其他"];

function getPhotoCategories(recordType) {
  return recordType === "restaurant" ? RESTAURANT_CATEGORIES : HOTEL_CATEGORIES;
}

function normalizePhoto(photo, recordType) {
  const categories = getPhotoCategories(recordType);
  return {
    id: String(photo.id || createId("photo")),
    filePath: String(photo.filePath || ""),
    category: categories.indexOf(photo.category) >= 0 ? photo.category : categories[0],
    caption: String(photo.caption || "").trim(),
    createdAt: photo.createdAt || new Date().toISOString()
  };
}

function fileExists(filePath) {
  if (!filePath || !wx.getFileSystemManager) return false;
  try {
    wx.getFileSystemManager().accessSync(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

function withAvailability(photos, recordType) {
  return (photos || []).map((photo) => {
    const normalized = normalizePhoto(photo, recordType);
    return { ...normalized, available: fileExists(normalized.filePath) };
  });
}

function saveTempFile(tempFilePath) {
  return new Promise((resolve, reject) => {
    wx.saveFile({
      tempFilePath,
      success: (result) => resolve(result.savedFilePath),
      fail: reject
    });
  });
}

function getMediaRegistry() {
  const raw = wx.getStorageSync(MEDIA_REGISTRY_KEY);
  return Array.isArray(raw) ? raw.map(String) : [];
}

function registerMediaPaths(paths) {
  const next = Array.from(new Set(getMediaRegistry().concat(paths || [])));
  wx.setStorageSync(MEDIA_REGISTRY_KEY, next);
  return next;
}

function unregisterMediaPaths(paths) {
  const removing = new Set(paths || []);
  const next = getMediaRegistry().filter((path) => !removing.has(path));
  wx.setStorageSync(MEDIA_REGISTRY_KEY, next);
  return next;
}

function chooseAndSavePhotos(recordType, currentCount) {
  const availableCount = Math.max(0, MAX_PHOTOS - Number(currentCount || 0));
  if (!availableCount) return Promise.reject(new Error(`每条体验最多 ${MAX_PHOTOS} 张照片`));
  return new Promise((resolve, reject) => {
    if (!wx.chooseMedia || !wx.saveFile) return reject(new Error("当前微信版本不支持选择照片"));
    wx.chooseMedia({
      count: availableCount,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success: resolve,
      fail: reject
    });
  }).then(async (result) => {
    const savedPaths = [];
    try {
      for (const file of result.tempFiles || []) {
        savedPaths.push(await saveTempFile(file.tempFilePath));
      }
      registerMediaPaths(savedPaths);
      return savedPaths.map((filePath) => normalizePhoto({ filePath }, recordType));
    } catch (error) {
      savedPaths.forEach(removeSavedPhoto);
      throw error;
    }
  });
}

function removeSavedPhoto(filePath) {
  if (!filePath || !wx.getFileSystemManager) return;
  try {
    wx.getFileSystemManager().unlinkSync(filePath);
  } catch (error) {
    // The file may already have been reclaimed by WeChat.
  }
}

function removeSavedPhotos(filePaths) {
  const paths = Array.from(new Set(filePaths || []));
  paths.forEach(removeSavedPhoto);
  unregisterMediaPaths(paths);
}

function getOrphanPhotoPaths(records) {
  const referenced = new Set((records || []).reduce((paths, record) => paths.concat((record.photos || []).map((photo) => photo.filePath)), []));
  return getMediaRegistry().filter((path) => !referenced.has(path));
}

module.exports = {
  MAX_PHOTOS,
  MEDIA_REGISTRY_KEY,
  chooseAndSavePhotos,
  fileExists,
  getPhotoCategories,
  getMediaRegistry,
  getOrphanPhotoPaths,
  normalizePhoto,
  removeSavedPhoto,
  removeSavedPhotos,
  registerMediaPaths,
  withAvailability
};
