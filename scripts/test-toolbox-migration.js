const assert = require("assert");

const memory = {
  hotel_review_records: [{ id: "legacy-record" }],
  experience_places: [{ id: "legacy-place" }],
  experience_media_files: ["/tmp/legacy-photo-a.jpg", "/tmp/legacy-photo-b.jpg"],
  toolbox_quick_records: [{ id: "new-record" }],
  toolbox_trips: [{ id: "new-trip" }]
};
const removedFiles = [];

global.wx = {
  getStorageSync(key) {
    return memory[key];
  },
  setStorageSync(key, value) {
    memory[key] = value;
  },
  removeStorageSync(key) {
    delete memory[key];
  },
  getFileSystemManager() {
    return {
      unlinkSync(filePath) {
        removedFiles.push(filePath);
      }
    };
  }
};

const {
  INITIALIZED_KEY,
  LEGACY_KEYS,
  initializeToolboxStorage
} = require("../miniprogram/utils/toolboxMigration");

assert.strictEqual(initializeToolboxStorage(), true);
LEGACY_KEYS.forEach((key) => assert.strictEqual(memory[key], undefined, `${key} should be removed`));
assert.deepStrictEqual(removedFiles, ["/tmp/legacy-photo-a.jpg", "/tmp/legacy-photo-b.jpg"]);
assert.deepStrictEqual(memory.toolbox_quick_records, [{ id: "new-record" }]);
assert.deepStrictEqual(memory.toolbox_trips, [{ id: "new-trip" }]);
assert.strictEqual(memory[INITIALIZED_KEY].schemaVersion, 1);

memory.hotel_review_records = [{ id: "late-legacy-value" }];
assert.strictEqual(initializeToolboxStorage(), false);
assert.deepStrictEqual(memory.hotel_review_records, [{ id: "late-legacy-value" }], "cleanup must only run once");
assert.strictEqual(removedFiles.length, 2);

console.log("toolbox migration tests passed");
