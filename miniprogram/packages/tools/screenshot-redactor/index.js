const redactor = require("../utils/screenshotRedactor");

const ANALYSIS_MAX_WIDTH = 480;
const ANALYSIS_MAX_HEIGHT = 4096;
const MAX_HISTORY = 30;
const MIN_REGION_SIZE = 10;
const MODES = ["move", "frame", "brush"];
const EFFECTS = ["mosaic", "blur", "solid"];
const SOLID_COLORS = ["#182230", "#667085", "#ffffff"];

function cloneRegions(regions) {
  return JSON.parse(JSON.stringify(regions || []));
}

function distance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first, second) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function rectContains(rect, point) {
  return point.normalizedX >= rect.x
    && point.normalizedX <= rect.x + rect.width
    && point.normalizedY >= rect.y
    && point.normalizedY <= rect.y + rect.height;
}

function normalizedRectBetween(first, second) {
  return redactor.normalizeRect({
    x: first.normalizedX,
    y: first.normalizedY,
    width: second.normalizedX - first.normalizedX,
    height: second.normalizedY - first.normalizedY
  });
}

function isPermissionDenied(error) {
  const message = String(error && (error.errMsg || error.message) || "");
  return message.includes("auth deny") || message.includes("authorize:fail") || message.includes("permission denied");
}

Page({
  data: {
    canRedo: false,
    canUndo: false,
    candidateCount: 0,
    effectType: "mosaic",
    exporting: false,
    hasImage: false,
    loading: false,
    mode: "move",
    recognizing: false,
    regionCount: 0,
    selectedEnabled: true,
    selectedId: "",
    solidColor: "#182230",
    strength: 12
  },

  onReady() {
    this.regions = [];
    this.undoStack = [];
    this.redoStack = [];
    this.transform = null;
    this.imageSize = null;
    this.queryCanvas("#analysisCanvas", "analysis").catch(() => {});
    this.queryCanvas("#scratchCanvas", "scratch").catch(() => {});
    this.queryCanvas("#exportCanvas", "export").catch(() => {});
  },

  onUnload() {
    this.destroyEditor();
  },

  queryCanvas(selector, key) {
    if (this[`${key}Canvas`]) return Promise.resolve(this[`${key}Canvas`]);
    if (this[`${key}Promise`]) return this[`${key}Promise`];
    this[`${key}Promise`] = new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select(selector)
        .fields({ node: true, rect: true, size: true })
        .exec((result) => {
          const info = result && result[0];
          if (!info || !info.node) {
            this[`${key}Promise`] = null;
            reject(new Error("图片画布不可用"));
            return;
          }
          this[`${key}Canvas`] = info.node;
          this[`${key}Context`] = info.node.getContext("2d");
          this[`${key}Info`] = info;
          resolve(info.node);
        });
    });
    return this[`${key}Promise`];
  },

  async preparePreviewCanvas() {
    const canvas = await this.queryCanvas("#previewCanvas", "preview");
    const info = this.previewInfo;
    const system = wx.getWindowInfo
      ? wx.getWindowInfo()
      : wx.getSystemInfoSync ? wx.getSystemInfoSync() : { pixelRatio: 2 };
    const ratio = Math.max(1, Math.min(3, Number(system.pixelRatio) || 2));
    const width = Math.max(1, Math.round(info.width));
    const height = Math.max(1, Math.round(info.height));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    this.previewContext = canvas.getContext("2d");
    this.previewContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.previewRatio = ratio;
    this.viewport = { width, height };
    return canvas;
  },

  chooseScreenshot() {
    if (this.data.loading || this.data.exporting) return;
    const choose = wx.chooseMedia
      ? new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ["image"],
          sourceType: ["album"],
          success: (result) => resolve(result.tempFiles && result.tempFiles[0] && result.tempFiles[0].tempFilePath),
          fail: reject
        });
      })
      : new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sourceType: ["album"],
          success: (result) => resolve(result.tempFilePaths && result.tempFilePaths[0]),
          fail: reject
        });
      });

    this.setData({ loading: true });
    choose
      .then((filePath) => {
        if (!filePath) throw new Error("没有选择图片");
        return this.loadScreenshot(filePath);
      })
      .catch((error) => {
        const message = String(error && (error.errMsg || error.message) || "");
        if (!message.includes("cancel")) wx.showToast({ icon: "none", title: "图片读取失败" });
      })
      .finally(() => this.setData({ loading: false }));
  },

  getImageInfo(filePath) {
    return new Promise((resolve, reject) => {
      if (!wx.getImageInfo) {
        resolve({ path: filePath });
        return;
      }
      wx.getImageInfo({ src: filePath, success: resolve, fail: reject });
    });
  },

  loadCanvasImage(filePath) {
    return new Promise((resolve, reject) => {
      const image = this.previewCanvas.createImage();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("图片解码失败"));
      image.src = filePath;
    });
  },

  loadScreenshot(filePath) {
    return new Promise((resolve, reject) => {
      this.setData({ hasImage: true, recognizing: true }, async () => {
        try {
          this.previewCanvas = null;
          this.previewContext = null;
          this.previewInfo = null;
          this.previewPromise = null;
          await this.preparePreviewCanvas();
          await this.queryCanvas("#scratchCanvas", "scratch");
          const info = await this.getImageInfo(filePath);
          const image = await this.loadCanvasImage(info.path || filePath);
          const width = Math.round(Number(image.width || info.width));
          const height = Math.round(Number(image.height || info.height));
          if (!width || !height) throw new Error("无法读取图片尺寸");

          this.safeRemoveTemp(this.outputTempPath);
          this.outputTempPath = "";
          this.sourcePath = filePath;
          this.sourceImage = image;
          this.imageSize = { width, height };
          this.transform = redactor.fitImageToViewport(this.imageSize, this.viewport);
          this.regions = [];
          this.undoStack = [];
          this.redoStack = [];
          this.gesture = null;
          this.draftRect = null;
          await this.runRecognition();
          this.syncEditorState();
          this.renderPreview();
          resolve();
        } catch (error) {
          this.setData({ hasImage: false, recognizing: false });
          reject(error);
        }
      });
    });
  },

  async createAnalysisImageData() {
    await this.queryCanvas("#analysisCanvas", "analysis");
    const ratio = Math.min(
      1,
      ANALYSIS_MAX_WIDTH / this.imageSize.width,
      ANALYSIS_MAX_HEIGHT / this.imageSize.height
    );
    const width = Math.max(1, Math.round(this.imageSize.width * ratio));
    const height = Math.max(1, Math.round(this.imageSize.height * ratio));
    this.analysisCanvas.width = width;
    this.analysisCanvas.height = height;
    const context = this.analysisCanvas.getContext("2d");
    context.clearRect(0, 0, width, height);
    context.drawImage(this.sourceImage, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  },

  currentEffect() {
    return {
      type: this.data.effectType,
      strength: this.data.strength,
      color: this.data.solidColor
    };
  },

  async runRecognition() {
    this.setData({ recognizing: true });
    try {
      const imageData = await this.createAnalysisImageData();
      const automatic = redactor.detectChatIdentityRegions(imageData, { effect: this.currentEffect() });
      const manual = this.regions.filter((region) => region.source === "manual");
      this.regions = automatic.concat(manual);
      this.undoStack = [];
      this.redoStack = [];
      this.setData({ recognizing: false, selectedId: "" });
      this.syncEditorState();
      this.renderPreview();
    } catch (error) {
      this.regions = this.createTitleFallback().concat(this.regions.filter((region) => region.source === "manual"));
      this.setData({ recognizing: false });
      this.syncEditorState();
      this.renderPreview();
      wx.showToast({ icon: "none", title: "自动识别受限，请手动检查" });
    }
  },

  createTitleFallback() {
    const height = Math.min(0.2, this.imageSize.width * 0.105 / this.imageSize.height);
    return [redactor.normalizeMaskRegion({
      id: "auto-title-fallback",
      source: "auto",
      targetType: "title",
      confidence: 0.4,
      effect: this.currentEffect(),
      rect: {
        x: 0.22,
        y: this.imageSize.width * 0.028 / this.imageSize.height,
        width: 0.56,
        height
      }
    }, this.imageSize)];
  },

  recognizeAgain() {
    if (this.data.recognizing) return;
    const before = cloneRegions(this.regions);
    this.runRecognition().then(() => {
      this.undoStack.push(before);
      this.trimHistory();
      this.syncEditorState();
    });
  },

  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!MODES.includes(mode)) return;
    this.gesture = null;
    this.draftRect = null;
    this.setData({ mode });
    this.renderPreview();
  },

  selectEffect(event) {
    const effectType = event.currentTarget.dataset.effect;
    if (!EFFECTS.includes(effectType)) return;
    const selected = this.getSelectedRegion();
    if (selected && selected.effect.type !== effectType) {
      this.pushUndo();
      selected.effect = { ...selected.effect, type: effectType };
    }
    this.setData({ effectType });
    this.syncEditorState();
    this.renderPreview();
  },

  changeStrength(event) {
    const strength = Math.max(2, Math.min(30, Number(event.detail.value) || 12));
    const selected = this.getSelectedRegion();
    if (selected && selected.effect.strength !== strength) {
      this.pushUndo();
      selected.effect.strength = strength;
    }
    this.setData({ strength });
    this.syncEditorState();
    this.renderPreview();
  },

  selectSolidColor(event) {
    const solidColor = String(event.currentTarget.dataset.color || "").toLowerCase();
    if (!SOLID_COLORS.includes(solidColor)) return;
    const selected = this.getSelectedRegion();
    if (selected && selected.effect.color !== solidColor) {
      this.pushUndo();
      selected.effect.color = solidColor;
    }
    this.setData({ solidColor });
    this.syncEditorState();
    this.renderPreview();
  },

  getSelectedRegion() {
    return this.regions.find((region) => region.id === this.data.selectedId) || null;
  },

  toggleSelectedRegion() {
    const selected = this.getSelectedRegion();
    if (!selected) return;
    this.pushUndo();
    selected.enabled = !selected.enabled;
    this.syncEditorState();
    this.renderPreview();
  },

  deleteSelectedRegion() {
    const selected = this.getSelectedRegion();
    if (!selected) return;
    this.pushUndo();
    this.regions = this.regions.filter((region) => region.id !== selected.id);
    this.setData({ selectedId: "" });
    this.syncEditorState();
    this.renderPreview();
  },

  enableAllCandidates() {
    const disabled = this.regions.filter((region) => region.source === "auto" && !region.enabled);
    if (!disabled.length) {
      wx.showToast({ icon: "none", title: "自动候选均已启用" });
      return;
    }
    this.pushUndo();
    disabled.forEach((region) => { region.enabled = true; });
    this.syncEditorState();
    this.renderPreview();
  },

  clearMasks() {
    if (!this.regions.length) return;
    wx.showModal({
      title: "清除全部打码？",
      content: "自动候选和手工区域都会被清除，可通过撤销恢复。",
      confirmText: "清除",
      confirmColor: "#b5472f",
      success: (result) => {
        if (!result.confirm) return;
        this.pushUndo();
        this.regions = [];
        this.setData({ selectedId: "" });
        this.syncEditorState();
        this.renderPreview();
      }
    });
  },

  pushUndo(snapshot) {
    this.undoStack.push(snapshot || cloneRegions(this.regions));
    this.redoStack = [];
    this.trimHistory();
    this.syncEditorState();
  },

  trimHistory() {
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.splice(0, this.undoStack.length - MAX_HISTORY);
    if (this.redoStack.length > MAX_HISTORY) this.redoStack.splice(0, this.redoStack.length - MAX_HISTORY);
  },

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(cloneRegions(this.regions));
    this.regions = this.undoStack.pop();
    this.setData({ selectedId: "" });
    this.syncEditorState();
    this.renderPreview();
  },

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(cloneRegions(this.regions));
    this.regions = this.redoStack.pop();
    this.setData({ selectedId: "" });
    this.syncEditorState();
    this.renderPreview();
  },

  syncEditorState() {
    const selected = this.getSelectedRegion();
    const candidateCount = this.regions.filter((region) => region.source === "auto").length;
    const patch = {
      canRedo: this.redoStack.length > 0,
      canUndo: this.undoStack.length > 0,
      candidateCount,
      regionCount: this.regions.length,
      selectedEnabled: selected ? selected.enabled : true
    };
    if (selected) {
      patch.effectType = selected.effect.type;
      patch.solidColor = selected.effect.color;
      patch.strength = selected.effect.strength;
    }
    this.setData(patch);
  },

  touchPoint(touch) {
    const info = this.previewInfo || {};
    const hasReportedPagePoint = touch && touch.pageX !== undefined && touch.pageY !== undefined;
    const localLooksSynthetic = touch && Number(touch.x) === 0 && Number(touch.y) === 0
      && hasReportedPagePoint && (Number(touch.pageX) !== 0 || Number(touch.pageY) !== 0);
    const hasLocalPoint = touch && touch.x !== undefined && touch.y !== undefined && !localLooksSynthetic;
    const pageX = Number(touch && (hasLocalPoint
      ? touch.x
      : touch.pageX !== undefined ? touch.pageX : touch.clientX)) || 0;
    const pageY = Number(touch && (hasLocalPoint
      ? touch.y
      : touch.pageY !== undefined ? touch.pageY : touch.clientY)) || 0;
    if (hasLocalPoint) return { x: pageX, y: pageY };
    return { x: pageX - (Number(info.left) || 0), y: pageY - (Number(info.top) || 0) };
  },

  imagePoint(canvasPoint) {
    return redactor.mapCanvasPointToImage(canvasPoint, this.transform, this.imageSize);
  },

  hitRegion(point) {
    for (let index = this.regions.length - 1; index >= 0; index -= 1) {
      if (rectContains(this.regions[index].rect, point)) return this.regions[index];
    }
    return null;
  },

  isResizeHandle(region, canvasPoint) {
    if (!region || region.id !== this.data.selectedId) return false;
    const right = this.transform.offsetX + (region.rect.x + region.rect.width) * this.imageSize.width * this.transform.scale;
    const bottom = this.transform.offsetY + (region.rect.y + region.rect.height) * this.imageSize.height * this.transform.scale;
    return Math.abs(canvasPoint.x - right) <= 22 && Math.abs(canvasPoint.y - bottom) <= 22;
  },

  onCanvasTouchStart(event) {
    if (!this.sourceImage || this.data.recognizing || this.data.exporting) return;
    const touches = Array.from(event.touches || []).map((touch) => this.touchPoint(touch));
    if (touches.length >= 2 && this.data.mode === "move") {
      const center = midpoint(touches[0], touches[1]);
      this.gesture = {
        type: "pinch",
        distance: Math.max(1, distance(touches[0], touches[1])),
        scale: this.transform.scale,
        imagePoint: this.imagePoint(center)
      };
      return;
    }
    if (!touches.length) return;
    const canvasPoint = touches[0];
    const point = this.imagePoint(canvasPoint);

    if (this.data.mode === "frame" || this.data.mode === "brush") {
      this.gesture = { type: this.data.mode, start: point, latest: point, before: cloneRegions(this.regions) };
      this.draftRect = this.data.mode === "brush" ? this.brushRect(point) : normalizedRectBetween(point, point);
      this.renderPreview();
      return;
    }

    const selected = this.getSelectedRegion();
    if (this.isResizeHandle(selected, canvasPoint)) {
      this.gesture = {
        type: "resize",
        start: point,
        original: { ...selected.rect },
        before: cloneRegions(this.regions),
        changed: false
      };
      return;
    }

    const hit = this.hitRegion(point);
    if (hit) {
      this.setData({ selectedId: hit.id }, () => this.syncEditorState());
      this.gesture = {
        type: "move-region",
        start: point,
        original: { ...hit.rect },
        regionId: hit.id,
        before: cloneRegions(this.regions),
        changed: false
      };
      this.renderPreview();
      return;
    }

    this.setData({ selectedId: "" });
    this.gesture = {
      type: "pan",
      start: canvasPoint,
      offsetX: this.transform.offsetX,
      offsetY: this.transform.offsetY
    };
    this.renderPreview();
  },

  onCanvasTouchMove(event) {
    if (!this.gesture) return;
    const touches = Array.from(event.touches || []).map((touch) => this.touchPoint(touch));
    if (this.gesture.type === "pinch" && touches.length >= 2) {
      const center = midpoint(touches[0], touches[1]);
      const nextScale = this.clampScale(this.gesture.scale * distance(touches[0], touches[1]) / this.gesture.distance);
      this.transform.scale = nextScale;
      this.transform.offsetX = center.x - this.gesture.imagePoint.x * nextScale;
      this.transform.offsetY = center.y - this.gesture.imagePoint.y * nextScale;
      this.clampTransform();
      this.renderPreview();
      return;
    }
    if (!touches.length) return;
    const canvasPoint = touches[0];
    const point = this.imagePoint(canvasPoint);

    if (this.gesture.type === "pan") {
      this.transform.offsetX = this.gesture.offsetX + canvasPoint.x - this.gesture.start.x;
      this.transform.offsetY = this.gesture.offsetY + canvasPoint.y - this.gesture.start.y;
      this.clampTransform();
    } else if (this.gesture.type === "frame") {
      this.gesture.latest = point;
      this.draftRect = normalizedRectBetween(this.gesture.start, point);
    } else if (this.gesture.type === "brush") {
      this.gesture.latest = point;
      const first = this.brushRect(this.gesture.start);
      const latest = this.brushRect(point);
      this.draftRect = redactor.normalizeRect({
        x: Math.min(first.x, latest.x),
        y: Math.min(first.y, latest.y),
        width: Math.max(first.x + first.width, latest.x + latest.width) - Math.min(first.x, latest.x),
        height: Math.max(first.y + first.height, latest.y + latest.height) - Math.min(first.y, latest.y)
      });
    } else if (this.gesture.type === "move-region") {
      const region = this.regions.find((item) => item.id === this.gesture.regionId);
      if (region) {
        region.rect.x = Math.max(0, Math.min(1 - region.rect.width, this.gesture.original.x + point.normalizedX - this.gesture.start.normalizedX));
        region.rect.y = Math.max(0, Math.min(1 - region.rect.height, this.gesture.original.y + point.normalizedY - this.gesture.start.normalizedY));
        this.gesture.changed = true;
      }
    } else if (this.gesture.type === "resize") {
      const region = this.getSelectedRegion();
      if (region) {
        const minimumWidth = MIN_REGION_SIZE / this.imageSize.width;
        const minimumHeight = MIN_REGION_SIZE / this.imageSize.height;
        region.rect.width = Math.max(minimumWidth, Math.min(1 - region.rect.x, point.normalizedX - region.rect.x));
        region.rect.height = Math.max(minimumHeight, Math.min(1 - region.rect.y, point.normalizedY - region.rect.y));
        this.gesture.changed = true;
      }
    }
    this.renderPreview();
  },

  onCanvasTouchEnd() {
    if (!this.gesture) return;
    if ((this.gesture.type === "frame" || this.gesture.type === "brush") && this.isDraftLargeEnough()) {
      this.undoStack.push(this.gesture.before);
      this.redoStack = [];
      const id = `manual-${Date.now()}-${this.regions.length + 1}`;
      const region = redactor.normalizeMaskRegion({
        id,
        source: "manual",
        targetType: "custom",
        effect: this.currentEffect(),
        rect: this.draftRect,
        confidence: 1,
        enabled: true
      }, this.imageSize);
      this.regions.push(region);
      this.setData({ selectedId: id });
    } else if ((this.gesture.type === "move-region" || this.gesture.type === "resize") && this.gesture.changed) {
      this.undoStack.push(this.gesture.before);
      this.redoStack = [];
    }
    this.trimHistory();
    this.gesture = null;
    this.draftRect = null;
    this.syncEditorState();
    this.renderPreview();
  },

  brushRect(point) {
    const radius = 18 / this.transform.scale;
    return redactor.normalizeRect({
      x: point.normalizedX - radius / this.imageSize.width,
      y: point.normalizedY - radius / this.imageSize.height,
      width: radius * 2 / this.imageSize.width,
      height: radius * 2 / this.imageSize.height
    });
  },

  isDraftLargeEnough() {
    if (!this.draftRect) return false;
    return this.draftRect.width * this.imageSize.width * this.transform.scale >= MIN_REGION_SIZE
      && this.draftRect.height * this.imageSize.height * this.transform.scale >= MIN_REGION_SIZE;
  },

  clampScale(scale) {
    const minimum = this.transform.baseScale;
    return Math.max(minimum, Math.min(minimum * 6, scale));
  },

  clampTransform() {
    const drawnWidth = this.imageSize.width * this.transform.scale;
    const drawnHeight = this.imageSize.height * this.transform.scale;
    const visible = 60;
    if (drawnWidth <= this.viewport.width) {
      this.transform.offsetX = (this.viewport.width - drawnWidth) / 2;
    } else {
      this.transform.offsetX = Math.max(this.viewport.width - drawnWidth - visible, Math.min(visible, this.transform.offsetX));
    }
    if (drawnHeight <= this.viewport.height) {
      this.transform.offsetY = (this.viewport.height - drawnHeight) / 2;
    } else {
      this.transform.offsetY = Math.max(this.viewport.height - drawnHeight - visible, Math.min(visible, this.transform.offsetY));
    }
  },

  renderPreview() {
    if (!this.previewContext || !this.sourceImage || !this.transform) return;
    const context = this.previewContext;
    context.clearRect(0, 0, this.viewport.width, this.viewport.height);
    context.fillStyle = "#202936";
    context.fillRect(0, 0, this.viewport.width, this.viewport.height);
    context.drawImage(
      this.sourceImage,
      this.transform.offsetX,
      this.transform.offsetY,
      this.imageSize.width * this.transform.scale,
      this.imageSize.height * this.transform.scale
    );
    this.regions.filter((region) => region.enabled).forEach((region) => {
      this.drawRegionEffect(context, region, this.transform);
    });
    this.regions.forEach((region) => this.drawRegionOutline(context, region));
    if (this.draftRect) {
      this.drawRegionOutline(context, {
        id: "draft",
        source: "manual",
        enabled: true,
        rect: this.draftRect
      });
    }
  },

  sourceAndDestination(region, transform) {
    const source = {
      x: Math.round(region.rect.x * this.imageSize.width),
      y: Math.round(region.rect.y * this.imageSize.height),
      width: Math.max(1, Math.round(region.rect.width * this.imageSize.width)),
      height: Math.max(1, Math.round(region.rect.height * this.imageSize.height))
    };
    return {
      source,
      destination: {
        x: transform.offsetX + source.x * transform.scale,
        y: transform.offsetY + source.y * transform.scale,
        width: source.width * transform.scale,
        height: source.height * transform.scale
      }
    };
  },

  drawRegionEffect(context, region, transform) {
    const boxes = this.sourceAndDestination(region, transform);
    const { source, destination } = boxes;
    if (region.effect.type === "solid") {
      context.fillStyle = region.effect.color;
      context.fillRect(destination.x, destination.y, destination.width, destination.height);
      return;
    }
    if (!this.scratchCanvas) return;
    const divisor = region.effect.type === "mosaic"
      ? region.effect.strength
      : Math.max(3, region.effect.strength * 1.6);
    const width = Math.max(1, Math.min(320, Math.round(source.width / divisor)));
    const height = Math.max(1, Math.min(320, Math.round(source.height / divisor)));
    this.scratchCanvas.width = width;
    this.scratchCanvas.height = height;
    const scratch = this.scratchCanvas.getContext("2d");
    scratch.clearRect(0, 0, width, height);
    scratch.imageSmoothingEnabled = true;
    scratch.drawImage(this.sourceImage, source.x, source.y, source.width, source.height, 0, 0, width, height);
    context.save();
    context.imageSmoothingEnabled = region.effect.type === "blur";
    context.drawImage(this.scratchCanvas, 0, 0, width, height, destination.x, destination.y, destination.width, destination.height);
    context.restore();
  },

  drawRegionOutline(context, region) {
    const boxes = this.sourceAndDestination(region, this.transform);
    const { destination } = boxes;
    const selected = region.id === this.data.selectedId;
    context.save();
    context.lineWidth = selected ? 3 : 2;
    context.strokeStyle = !region.enabled ? "#98a2b3" : region.source === "auto" ? "#2f9a72" : "#3f83d5";
    if (!region.enabled && context.setLineDash) context.setLineDash([7, 5]);
    context.strokeRect(destination.x, destination.y, destination.width, destination.height);
    if (selected) {
      context.fillStyle = "#ffffff";
      context.strokeStyle = "#2877d4";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(destination.x + destination.width, destination.y + destination.height, 7, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    context.restore();
  },

  confirmWithoutMasks() {
    return new Promise((resolve) => {
      wx.showModal({
        title: "尚未添加打码",
        content: "当前图片会按原样保存，确定继续吗？",
        confirmText: "仍然保存",
        success: (result) => resolve(Boolean(result.confirm))
      });
    });
  },

  async saveRedactedImage() {
    if (this.saveRequested || this.data.exporting || !this.sourceImage) return;
    this.saveRequested = true;
    const enabled = this.regions.filter((region) => region.enabled);
    if (!enabled.length && !(await this.confirmWithoutMasks())) {
      this.saveRequested = false;
      return;
    }
    this.setData({ exporting: true });
    wx.showLoading({ title: "生成原图中", mask: true });
    try {
      const filePath = await this.exportOriginalImage(enabled);
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({ filePath, success: resolve, fail: reject });
      });
      wx.showToast({ icon: "success", title: "已保存到相册" });
    } catch (error) {
      if (isPermissionDenied(error)) {
        wx.showModal({
          title: "需要相册权限",
          content: "请在设置中允许保存图片到相册。",
          confirmText: "打开设置",
          success: (result) => {
            if (result.confirm && wx.openSetting) wx.openSetting();
          }
        });
      } else {
        wx.showModal({
          title: "原图生成失败",
          content: "图片尺寸可能超过当前设备的处理能力。为避免降低清晰度，本工具不会自动缩小原图。",
          showCancel: false,
          confirmText: "知道了"
        });
      }
    } finally {
      wx.hideLoading();
      this.saveRequested = false;
      this.setData({ exporting: false });
    }
  },

  async exportOriginalImage(regions) {
    await this.queryCanvas("#exportCanvas", "export");
    await this.queryCanvas("#scratchCanvas", "scratch");
    const { width, height } = this.imageSize;
    try {
      this.exportCanvas.width = width;
      this.exportCanvas.height = height;
    } catch (error) {
      throw new Error("设备无法创建原图画布");
    }
    if (this.exportCanvas.width !== width || this.exportCanvas.height !== height) {
      throw new Error("设备未能保持原图尺寸");
    }
    const context = this.exportCanvas.getContext("2d");
    context.clearRect(0, 0, width, height);
    context.drawImage(this.sourceImage, 0, 0, width, height);
    const identityTransform = { scale: 1, offsetX: 0, offsetY: 0 };
    regions.forEach((region) => this.drawRegionEffect(context, region, identityTransform));

    const filePath = await new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas: this.exportCanvas,
        x: 0,
        y: 0,
        width,
        height,
        destWidth: width,
        destHeight: height,
        fileType: "png",
        success: (result) => resolve(result.tempFilePath),
        fail: reject
      }, this);
    });
    this.safeRemoveTemp(this.outputTempPath);
    this.outputTempPath = filePath;
    return filePath;
  },

  safeRemoveTemp(filePath) {
    if (!filePath || !wx.getFileSystemManager) return;
    try {
      wx.getFileSystemManager().unlink({ filePath, fail() {} });
    } catch (error) {
      // Temporary files are also reclaimed by WeChat.
    }
  },

  destroyEditor() {
    this.safeRemoveTemp(this.outputTempPath);
    ["preview", "analysis", "scratch", "export"].forEach((key) => {
      const canvas = this[`${key}Canvas`];
      const context = this[`${key}Context`] || canvas && canvas.getContext && canvas.getContext("2d");
      if (canvas && context) {
        try {
          context.clearRect(0, 0, canvas.width || 1, canvas.height || 1);
          canvas.width = 1;
          canvas.height = 1;
        } catch (error) {
          // The page is already being destroyed.
        }
      }
      this[`${key}Canvas`] = null;
      this[`${key}Context`] = null;
      this[`${key}Promise`] = null;
    });
    this.sourceImage = null;
    this.sourcePath = "";
    this.outputTempPath = "";
    this.saveRequested = false;
    this.regions = [];
    this.undoStack = [];
    this.redoStack = [];
    this.gesture = null;
    this.draftRect = null;
  }
});
