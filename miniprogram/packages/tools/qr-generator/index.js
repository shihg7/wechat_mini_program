const qrGenerator = require("../utils/qrGenerator");

const CANVAS_SIZE = 800;
const SECURITY_OPTIONS = [
  { id: "WPA", name: "WPA/WPA2" },
  { id: "WEP", name: "WEP" },
  { id: "nopass", name: "无密码" }
];

Page({
  data: {
    byteCount: 0,
    canvasReady: false,
    hasQr: false,
    hidden: false,
    mode: "text",
    password: "",
    securityIndex: 0,
    securityOptions: SECURITY_OPTIONS,
    ssid: "",
    textContent: ""
  },

  onReady() {
    this.prepareCanvas();
  },

  onUnload() {
    if (this.context) this.context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    this.lastContent = "";
    this.context = null;
    this.canvas = null;
    this.setData({
      byteCount: 0,
      hasQr: false,
      password: "",
      ssid: "",
      textContent: ""
    });
  },

  prepareCanvas() {
    if (this.canvasPromise) return this.canvasPromise;
    this.canvasPromise = new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select("#qrCanvas")
        .fields({ node: true, size: true })
        .exec((result) => {
          const canvas = result && result[0] && result[0].node;
          if (!canvas) {
            this.canvasPromise = null;
            reject(new Error("二维码画布不可用"));
            return;
          }
          canvas.width = CANVAS_SIZE;
          canvas.height = CANVAS_SIZE;
          this.canvas = canvas;
          this.context = canvas.getContext("2d");
          this.context.fillStyle = "#ffffff";
          this.context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
          this.setData({ canvasReady: true });
          resolve(canvas);
        });
    });
    return this.canvasPromise;
  },

  switchMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode });
    this.invalidateQr();
  },

  onTextInput(event) {
    const textContent = event.detail.value;
    this.setData({
      byteCount: qrGenerator.utf8ByteLength(textContent),
      textContent
    });
    this.invalidateQr();
  },

  onSsidInput(event) {
    this.setData({ ssid: event.detail.value });
    this.invalidateQr();
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value });
    this.invalidateQr();
  },

  onSecurityChange(event) {
    this.setData({ securityIndex: Number(event.detail.value) });
    this.invalidateQr();
  },

  onHiddenChange(event) {
    this.setData({ hidden: event.detail.value });
    this.invalidateQr();
  },

  invalidateQr() {
    this.lastContent = "";
    if (this.context) {
      this.context.fillStyle = "#ffffff";
      this.context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    if (this.data.hasQr) this.setData({ hasQr: false });
  },

  getContent() {
    if (this.data.mode === "wifi") {
      return qrGenerator.buildWifiPayload({
        hidden: this.data.hidden,
        password: this.data.password,
        security: SECURITY_OPTIONS[this.data.securityIndex].id,
        ssid: this.data.ssid
      });
    }
    return this.data.textContent;
  },

  async generateQr() {
    try {
      const content = this.getContent();
      const checked = qrGenerator.validateContent(content);
      const matrix = qrGenerator.createMatrix(content);
      await this.prepareCanvas();
      qrGenerator.drawMatrix(this.context, matrix, CANVAS_SIZE);
      this.lastContent = content;
      this.setData({
        byteCount: checked.byteLength,
        hasQr: true
      });
    } catch (error) {
      wx.showToast({ icon: "none", title: error.message || "二维码生成失败" });
    }
  },

  copyContent() {
    if (!this.lastContent || !this.data.hasQr) {
      wx.showToast({ icon: "none", title: "请先生成二维码" });
      return;
    }
    wx.setClipboardData({ data: this.lastContent });
  },

  async saveImage() {
    if (!this.canvas || !this.data.hasQr) {
      wx.showToast({ icon: "none", title: "请先生成二维码" });
      return;
    }
    try {
      const filePath = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas: this.canvas,
          destHeight: CANVAS_SIZE,
          destWidth: CANVAS_SIZE,
          fileType: "png",
          success: (result) => resolve(result.tempFilePath),
          fail: reject
        }, this);
      });
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({ filePath, success: resolve, fail: reject });
      });
      wx.showToast({ icon: "success", title: "已保存到相册" });
    } catch (error) {
      const message = String(error && error.errMsg || error && error.message || "");
      if (message.includes("auth deny") || message.includes("authorize:fail")) {
        wx.showModal({
          title: "需要相册权限",
          content: "请在设置中允许保存图片到相册。",
          confirmText: "打开设置",
          success: (result) => {
            if (result.confirm && wx.openSetting) wx.openSetting();
          }
        });
        return;
      }
      wx.showToast({ icon: "none", title: "图片保存失败" });
    }
  }
});
