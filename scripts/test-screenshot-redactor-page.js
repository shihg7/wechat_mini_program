const assert = require("assert");
const fs = require("fs");
const path = require("path");

const pageRoot = path.join(__dirname, "..", "miniprogram", "packages", "tools", "screenshot-redactor");
const modulePath = path.join(pageRoot, "index.js");

function makeContext() {
  const operations = [];
  return {
    operations,
    arc(...args) { operations.push(["arc", ...args]); },
    beginPath() {},
    clearRect(...args) { operations.push(["clearRect", ...args]); },
    drawImage(...args) { operations.push(["drawImage", ...args]); },
    fill() {},
    fillRect(...args) { operations.push(["fillRect", ...args]); },
    getImageData() { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; },
    restore() {},
    save() {},
    setLineDash() {},
    setTransform() {},
    stroke() {},
    strokeRect(...args) { operations.push(["strokeRect", ...args]); }
  };
}

function makeCanvas() {
  const context = makeContext();
  return {
    context,
    canvas: {
      height: 1,
      width: 1,
      createImage() { return {}; },
      getContext() { return context; }
    }
  };
}

function loadPage(wxMock) {
  let definition;
  global.Page = (config) => { definition = config; };
  global.wx = wxMock;
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  const page = {};
  Object.keys(definition).forEach((key) => {
    page[key] = key === "data" ? JSON.parse(JSON.stringify(definition.data)) : definition[key];
  });
  page.setData = function setData(patch, callback) {
    Object.assign(this.data, patch);
    if (callback) callback();
  };
  page.regions = [];
  page.undoStack = [];
  page.redoStack = [];
  return page;
}

function mask(id = "mask-1") {
  return {
    id,
    source: "auto",
    targetType: "avatar",
    effect: { type: "mosaic", strength: 12, color: "#182230" },
    rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    confidence: 0.8,
    enabled: true
  };
}

async function testEditingAndHistory() {
  const toasts = [];
  const page = loadPage({ showToast: (options) => toasts.push(options) });
  page.regions = [mask()];
  page.data.selectedId = "mask-1";
  page.renderPreview = () => {};
  page.syncEditorState();

  page.selectEffect({ currentTarget: { dataset: { effect: "solid" } } });
  assert.strictEqual(page.regions[0].effect.type, "solid");
  assert.strictEqual(page.data.canUndo, true);
  page.selectSolidColor({ currentTarget: { dataset: { color: "#ffffff" } } });
  assert.strictEqual(page.regions[0].effect.color, "#ffffff");
  page.changeStrength({ detail: { value: 2 } });
  assert.strictEqual(page.regions[0].effect.strength, 8, "privacy strength must not drop below the safe minimum");
  page.toggleSelectedRegion();
  assert.strictEqual(page.regions[0].enabled, false);
  page.enableAllCandidates();
  assert.strictEqual(page.regions[0].enabled, true);
  page.undo();
  assert.strictEqual(page.regions[0].enabled, false);
  page.redo();
  assert.strictEqual(page.regions[0].enabled, true);
  page.enableAllCandidates();
  assert(toasts.some((item) => item.title.includes("均已启用")));
  page.data.selectedId = "mask-1";
  page.deleteSelectedRegion();
  assert.strictEqual(page.regions.length, 0);
  page.undo();
  assert.strictEqual(page.regions.length, 1, "deleting one region should be undoable");
}

async function testManualFrameGesture() {
  const page = loadPage({});
  page.sourceImage = {};
  page.imageSize = { width: 1000, height: 1000 };
  page.viewport = { width: 300, height: 300 };
  page.transform = { baseScale: 0.3, scale: 0.3, offsetX: 0, offsetY: 0 };
  page.previewInfo = { left: 0, top: 0 };
  page.renderPreview = () => {};
  page.data.hasImage = true;
  page.data.mode = "frame";

  page.previewInfo = { left: 20, top: 30 };
  assert.deepStrictEqual(page.touchPoint({ pageX: 50, pageY: 70 }), { x: 30, y: 40 });
  assert.deepStrictEqual(page.touchPoint({ clientX: 0, clientY: 0, pageX: 50, pageY: 70 }), { x: 30, y: 40 });
  assert.deepStrictEqual(page.touchPoint({ x: 0, y: 0, pageX: 50, pageY: 70 }), { x: 30, y: 40 });
  page.previewInfo = { left: 0, top: 0 };

  page.onCanvasTouchStart({ touches: [{ x: 30, y: 30 }] });
  page.onCanvasTouchMove({ touches: [{ x: 120, y: 90 }] });
  page.onCanvasTouchEnd();
  assert.strictEqual(page.regions.length, 1);
  assert.strictEqual(page.regions[0].source, "manual");
  assert.strictEqual(page.data.selectedId, page.regions[0].id);
  assert.strictEqual(page.undoStack.length, 1);

  const regionId = page.regions[0].id;
  const originalRect = { ...page.regions[0].rect };
  page.data.mode = "move";
  page.onCanvasTouchStart({ touches: [{ x: 75, y: 60 }] });
  page.onCanvasTouchMove({ touches: [{ x: 105, y: 90 }] });
  page.onCanvasTouchEnd();
  assert(page.regions[0].rect.x > originalRect.x && page.regions[0].rect.y > originalRect.y, "selected regions should move");
  page.undo();
  assert.deepStrictEqual(page.regions[0].rect, originalRect, "region movement should be undoable");

  page.data.selectedId = regionId;
  page.onCanvasTouchStart({ touches: [{ x: 120, y: 90 }] });
  page.onCanvasTouchMove({ touches: [{ x: 150, y: 120 }] });
  page.onCanvasTouchEnd();
  assert(page.regions[0].rect.width > originalRect.width, "bottom-right handle should resize a region");
  assert(page.regions[0].rect.height > originalRect.height);

  const baseScale = page.transform.scale;
  page.onCanvasTouchStart({ touches: [{ x: 70, y: 70 }, { x: 130, y: 70 }] });
  page.onCanvasTouchMove({ touches: [{ x: 40, y: 70 }, { x: 160, y: 70 }] });
  page.onCanvasTouchEnd();
  assert(page.transform.scale > baseScale, "two-finger gestures should zoom the preview");
  assert(page.transform.scale <= page.transform.baseScale * 6);

  page.data.mode = "brush";
  page.onCanvasTouchStart({ touches: [{ x: 180, y: 180 }] });
  page.onCanvasTouchMove({ touches: [{ x: 230, y: 210 }] });
  page.onCanvasTouchEnd();
  assert.strictEqual(page.regions.length, 2, "brush gestures should create a manual region");
}

async function testOriginalSizeExport() {
  let exportOptions;
  const wxMock = {
    canvasToTempFilePath(options) {
      exportOptions = options;
      options.success({ tempFilePath: "/tmp/redacted.png" });
    }
  };
  const page = loadPage(wxMock);
  const exported = makeCanvas();
  const scratch = makeCanvas();
  page.exportCanvas = exported.canvas;
  page.exportContext = exported.context;
  page.scratchCanvas = scratch.canvas;
  page.scratchContext = scratch.context;
  page.sourceImage = {};
  page.imageSize = { width: 1080, height: 2400 };
  page.safeRemoveTemp = () => {};
  const pathResult = await page.exportOriginalImage([mask()]);
  assert.strictEqual(pathResult, "/tmp/redacted.png");
  assert.strictEqual(exportOptions.destWidth, 1080);
  assert.strictEqual(exportOptions.destHeight, 2400);
  assert.strictEqual(exportOptions.fileType, "png");
  assert(exported.context.operations.some((item) => item[0] === "drawImage"));
}

async function testSaveGuardAndPermissionFailure() {
  let modalOptions;
  let saveCalls = 0;
  let settingsOpened = false;
  const wxMock = {
    hideLoading() {},
    openSetting() { settingsOpened = true; },
    saveImageToPhotosAlbum({ fail }) {
      saveCalls += 1;
      fail({ errMsg: "saveImageToPhotosAlbum:fail auth deny" });
    },
    showLoading() {},
    showModal(options) {
      modalOptions = options;
      if (options.title === "尚未添加打码") options.success({ confirm: true });
    },
    showToast() {}
  };
  const page = loadPage(wxMock);
  page.sourceImage = {};
  page.regions = [];
  page.exportOriginalImage = async () => "/tmp/redacted.png";
  const first = page.saveRedactedImage();
  const second = page.saveRedactedImage();
  await Promise.all([first, second]);
  assert.strictEqual(saveCalls, 1, "repeated save taps should only start one export");
  assert.strictEqual(modalOptions.title, "需要相册权限");
  modalOptions.success({ confirm: true });
  assert.strictEqual(settingsOpened, true, "permission guidance should open settings after confirmation");
}

async function testCancelAndFailurePaths() {
  let modal;
  let exportCalls = 0;
  const page = loadPage({
    hideLoading() {},
    showLoading() {},
    showModal(options) { modal = options; },
    showToast() {}
  });
  page.sourceImage = {};
  page.regions = [mask()];
  page.renderPreview = () => {};
  page.clearMasks();
  modal.success({ confirm: false });
  assert.strictEqual(page.regions.length, 1, "cancelling clear-all should preserve masks");
  page.clearMasks();
  modal.success({ confirm: true });
  assert.strictEqual(page.regions.length, 0);
  page.undo();
  assert.strictEqual(page.regions.length, 1);

  page.regions = [];
  page.exportOriginalImage = async () => { exportCalls += 1; return "/tmp/unused.png"; };
  const pendingSave = page.saveRedactedImage();
  modal.success({ confirm: false });
  await pendingSave;
  assert.strictEqual(exportCalls, 0, "cancelling a no-mask export must not write a file");
  assert.strictEqual(page.saveRequested, false);

  const broken = loadPage({});
  const scratch = makeCanvas();
  broken.exportCanvas = {
    get height() { return 1; },
    set height(value) {},
    get width() { return 1; },
    set width(value) {},
    getContext() { return makeContext(); }
  };
  broken.scratchCanvas = scratch.canvas;
  broken.sourceImage = {};
  broken.imageSize = { width: 1080, height: 20000 };
  await assert.rejects(() => broken.exportOriginalImage([mask()]), /原图尺寸/);
}

async function testRecognitionFallbackAndCleanup() {
  const toasts = [];
  const removed = [];
  const page = loadPage({
    getFileSystemManager() {
      return { unlink({ filePath }) { removed.push(filePath); } };
    },
    showToast(options) { toasts.push(options); }
  });
  page.imageSize = { width: 360, height: 720 };
  page.sourceImage = {};
  page.regions = [{ ...mask("manual"), source: "manual" }];
  page.createAnalysisImageData = async () => { throw new Error("analysis failed"); };
  page.renderPreview = () => {};
  await page.runRecognition();
  const titleFallback = page.regions.find((region) => region.targetType === "title");
  assert(titleFallback, "recognition failure should retain a title fallback");
  assert(titleFallback.rect.y >= 0.05, "full screenshots should place the fallback below the system status bar");
  assert(page.regions.some((region) => region.id === "manual"), "recognition failure must preserve manual masks");
  assert.strictEqual(page.data.avatarCandidateCount, 0);
  assert.strictEqual(page.data.nameCandidateCount, 0);
  assert(toasts.some((item) => item.title.includes("手动检查")));

  const preview = makeCanvas();
  page.previewCanvas = preview.canvas;
  page.previewContext = preview.context;
  page.outputTempPath = "/tmp/redacted.png";
  page.destroyEditor();
  assert.deepStrictEqual(removed, ["/tmp/redacted.png"]);
  assert.strictEqual(page.sourceImage, null);
  assert.strictEqual(page.regions.length, 0);
  assert.strictEqual(preview.canvas.width, 1);
  assert.strictEqual(preview.canvas.height, 1);
}

function testRecognitionSummary() {
  const page = loadPage({});
  page.regions = [
    mask("avatar"),
    { ...mask("name"), targetType: "name" },
    { ...mask("title"), targetType: "title" },
    { ...mask("manual"), source: "manual", targetType: "custom" }
  ];
  page.syncEditorState();
  assert.strictEqual(page.data.avatarCandidateCount, 1);
  assert.strictEqual(page.data.nameCandidateCount, 1);
  assert.strictEqual(page.data.candidateCount, 3, "manual masks must not inflate automatic candidate counts");
}

function testLayoutGuards() {
  const wxml = fs.readFileSync(path.join(pageRoot, "index.wxml"), "utf8");
  const wxss = fs.readFileSync(path.join(pageRoot, "index.wxss"), "utf8");
  const config = JSON.parse(fs.readFileSync(path.join(pageRoot, "index.json"), "utf8"));
  assert.strictEqual(config.disableScroll, true);
  assert(wxml.includes('class="bottom-bar"'), "save actions should stay in the bottom bar");
  assert(wxml.includes('catchtouchmove="onCanvasTouchMove"'), "canvas gestures should not scroll the page");
  assert(wxml.includes("识别结果仅供辅助"), "automatic detection must set user expectations");
  assert(wxml.includes("图片不会上传"), "privacy promise should be visible before choosing an image");
  assert(wxml.includes('bindtap="deleteSelectedRegion"'), "a single mistaken mask should be removable");
  assert(wxml.includes('min="8"'), "redaction strength should enforce a privacy-safe minimum");
  assert(wxml.includes("仅标记顶部标题"), "low-confidence recognition should be stated honestly");
  assert(!wxss.includes("text-overflow: ellipsis"), "editor text must not be truncated");
  assert(!fs.readFileSync(modulePath, "utf8").includes("StorageSync"), "temporary screenshot state must not use storage");
  assert(/\.page\s*\{[\s\S]*?height:\s*100vh[\s\S]*?overflow:\s*hidden/.test(wxss));
  assert(/\.bottom-bar\s*\{[\s\S]*?flex:\s*none/.test(wxss));
}

Promise.resolve()
  .then(testEditingAndHistory)
  .then(testManualFrameGesture)
  .then(testOriginalSizeExport)
  .then(testSaveGuardAndPermissionFailure)
  .then(testCancelAndFailurePaths)
  .then(testRecognitionFallbackAndCleanup)
  .then(testRecognitionSummary)
  .then(testLayoutGuards)
  .then(() => console.log("screenshot redactor page tests passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
