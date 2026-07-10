const assert = require("assert");

const existing = new Set();
const storage = {};
const removed = [];
let savedIndex = 0;
global.wx = {
  getStorageSync(key) { return storage[key]; },
  setStorageSync(key, value) { storage[key] = JSON.parse(JSON.stringify(value)); },
  chooseMedia(options) {
    options.success({ tempFiles: [{ tempFilePath: "/tmp/a.jpg" }, { tempFilePath: "/tmp/b.jpg" }] });
  },
  saveFile(options) {
    const savedFilePath = `/saved/${savedIndex += 1}.jpg`;
    existing.add(savedFilePath);
    options.success({ savedFilePath });
  },
  getFileSystemManager() {
    return {
      accessSync(path) {
        if (!existing.has(path)) throw new Error("missing");
      },
      unlinkSync(path) {
        existing.delete(path);
        removed.push(path);
      }
    };
  }
};

const mediaStore = require("../miniprogram/utils/mediaStore");

async function run() {
  assert.deepStrictEqual(mediaStore.getPhotoCategories("hotel"), ["房间", "早餐", "酒廊", "泳池", "环境", "其他"]);
  assert.deepStrictEqual(mediaStore.getPhotoCategories("restaurant"), ["菜品", "环境", "酒水", "菜单", "其他"]);
  const photos = await mediaStore.chooseAndSavePhotos("hotel", 7);
  assert.strictEqual(photos.length, 2);
  assert(photos.every((photo) => photo.id && photo.filePath && photo.category === "房间"));
  assert(photos.every((photo) => mediaStore.fileExists(photo.filePath)));
  const states = mediaStore.withAvailability(photos.concat({ id: "missing", filePath: "/lost.jpg" }), "hotel");
  assert.deepStrictEqual(states.map((photo) => photo.available), [true, true, false]);
  mediaStore.removeSavedPhotos(photos.map((photo) => photo.filePath));
  assert.strictEqual(existing.size, 0);
  assert.strictEqual(removed.length, 2);
  await assert.rejects(() => mediaStore.chooseAndSavePhotos("hotel", 9), /最多 9 张/);
  console.log("media store tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
