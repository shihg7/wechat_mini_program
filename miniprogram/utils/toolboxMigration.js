const INITIALIZED_KEY = "toolbox_initialized_v1";
const LOCAL_NOTICE_KEY = "toolbox_local_notice_seen";
const LEGACY_MEDIA_KEY = "experience_media_files";
const RETIRED_QUICK_RECORDS_KEY = "toolbox_quick_records";
const RETIRED_QUICK_RECORDS_CLEANED_KEY = "toolbox_quick_records_removed_v1";
const LEGACY_KEYS = [
  "hotel_review_records",
  "experience_places",
  "experience_wishlist",
  "experience_trips",
  "trip_split_ledgers",
  "decision_wheels",
  "experience_bookings",
  "experience_checklist_items",
  "experience_form_templates",
  "experience_story_drafts",
  "experience_yearbook_preferences",
  "cleanup_ignored_duplicates",
  LEGACY_MEDIA_KEY,
  "experience_demo_data_registry",
  "experience_demo_mode_state",
  "experience_device_id"
];

function removeStoredValue(key) {
  if (wx.removeStorageSync) wx.removeStorageSync(key);
  else wx.setStorageSync(key, undefined);
}

function removeLegacyMedia(paths) {
  if (!Array.isArray(paths) || !wx.getFileSystemManager) return;
  const manager = wx.getFileSystemManager();
  paths.forEach((filePath) => {
    try {
      manager.unlinkSync(String(filePath || ""));
    } catch (error) {
      // The file may already have been reclaimed by WeChat.
    }
  });
}

function initializeToolboxStorage() {
  if (wx.getStorageSync(INITIALIZED_KEY)) return false;
  removeLegacyMedia(wx.getStorageSync(LEGACY_MEDIA_KEY));
  LEGACY_KEYS.forEach(removeStoredValue);
  wx.setStorageSync(INITIALIZED_KEY, {
    schemaVersion: 1,
    initializedAt: new Date().toISOString()
  });
  return true;
}

function removeRetiredQuickRecords() {
  if (wx.getStorageSync(RETIRED_QUICK_RECORDS_CLEANED_KEY)) return false;
  removeStoredValue(RETIRED_QUICK_RECORDS_KEY);
  wx.setStorageSync(RETIRED_QUICK_RECORDS_CLEANED_KEY, {
    schemaVersion: 1,
    removedAt: new Date().toISOString()
  });
  return true;
}

module.exports = {
  INITIALIZED_KEY,
  LEGACY_KEYS,
  LOCAL_NOTICE_KEY,
  RETIRED_QUICK_RECORDS_CLEANED_KEY,
  RETIRED_QUICK_RECORDS_KEY,
  initializeToolboxStorage,
  removeRetiredQuickRecords
};
