const engine = require("../../utils/wheelEngine");
const store = require("../../utils/wheelStore");
const demoMode = require("../../utils/demoMode");

const COLORS = ["#176b68", "#e86343", "#e6af2e", "#3568ad", "#a63d52", "#5f8f4e", "#7257a5", "#26849a"];

Page({
  data: { wheels: [], wheelTitles: [], wheelIndex: 0, wheel: null, batchText: "", enabledCount: 0, spinning: false, winner: null, showEditor: true, historyExpanded: false, demoActive: false },
  onLoad(options = {}) { const demoActive = options.demo === "wheel" && demoMode.getState().active; this.requestFrame = null; this.rotation = 0; this.velocity = 0; this.lastTouchAngle = 0; this.lastTouchTime = 0; this.lastSector = -1; this.setData({ demoActive }); this.loadWheels(options.id); },
  onReady() { this.prepareCanvas(); },
  onUnload() { this.cancelAnimation(); },

  loadWheels(preferredId) {
    let wheels = store.getWheels();
    if (!wheels.length) wheels = [store.createWheel({ title: "今天选什么", options: [] })];
    let wheelIndex = Math.max(0, wheels.findIndex((item) => item.id === String(preferredId || (this.data.wheel && this.data.wheel.id) || "")));
    if (wheelIndex < 0) wheelIndex = 0;
    const sourceWheel = wheels[wheelIndex];
    if (this.data.demoActive && preferredId && sourceWheel.id === String(preferredId)) demoMode.markStep("wheel");
    const wheel = { ...sourceWheel, history: sourceWheel.history.map((item) => ({ ...item, displayTime: item.spunAt.replace("T", " ").slice(0, 16) })) };
    this.setData({ wheels, wheelTitles: wheels.map((item) => item.title), wheelIndex, wheel, enabledCount: wheel.options.filter((item) => item.enabled).length }, () => this.draw());
  },

  prepareCanvas() {
    wx.createSelectorQuery().in(this).select("#wheelCanvas").fields({ node: true, size: true }).exec((result) => {
      const info = result && result[0]; if (!info || !info.node) return;
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : (wx.getSystemInfoSync ? wx.getSystemInfoSync() : {});
      const scale = windowInfo.pixelRatio || 2;
      this.canvas = info.node; this.ctx = this.canvas.getContext("2d"); this.canvasWidth = info.width; this.canvasHeight = info.height;
      this.canvas.width = info.width * scale; this.canvas.height = info.height * scale; this.ctx.scale(scale, scale); this.draw();
    });
  },

  enabledOptions() { return this.data.wheel ? this.data.wheel.options.filter((item) => item.enabled) : []; },
  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx; const width = this.canvasWidth; const height = this.canvasHeight; const cx = width / 2; const cy = height / 2; const radius = Math.min(width, height) / 2 - 8; const options = this.enabledOptions();
    ctx.clearRect(0, 0, width, height); ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath(); ctx.arc(0, 0, radius + 5, 0, engine.TAU); ctx.fillStyle = "#172033"; ctx.shadowColor = "rgba(23,32,51,.24)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8; ctx.fill(); ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.save(); ctx.rotate(this.rotation);
    if (!options.length) { ctx.beginPath(); ctx.arc(0, 0, radius - 2, 0, engine.TAU); ctx.fillStyle = "#e5e9ee"; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, radius * 0.7, 0, engine.TAU); ctx.strokeStyle = "#cbd2db"; ctx.lineWidth = 1; ctx.setLineDash([5, 6]); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#667085"; ctx.font = "600 14px sans-serif"; ctx.textAlign = "center"; ctx.fillText("等待你的选项", 0, 5); ctx.restore(); ctx.restore(); return; }
    const slice = engine.TAU / options.length; const maxChars = options.length > 24 ? 3 : options.length > 12 ? 5 : 9;
    options.forEach((option, index) => {
      const start = -Math.PI / 2 + index * slice; const end = start + slice;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius - 2, start, end); ctx.closePath(); ctx.fillStyle = COLORS[index % COLORS.length]; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.82)"; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.save(); ctx.rotate(start + slice / 2); ctx.translate(radius * 0.62, 0); if (start + slice / 2 > Math.PI / 2 && start + slice / 2 < Math.PI * 1.5) ctx.rotate(Math.PI); ctx.fillStyle = "#fff"; ctx.font = `${options.length > 24 ? 10 : options.length > 12 ? 11 : 13}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(engine.truncateLabel(option.text, maxChars), 0, 0); ctx.restore();
    });
    ctx.beginPath(); ctx.arc(0, 0, radius - 8, 0, engine.TAU); ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, Math.max(24, radius * 0.13), 0, engine.TAU); ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(23,32,51,.25)"; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowColor = "transparent"; ctx.beginPath(); ctx.arc(0, 0, Math.max(18, radius * 0.09), 0, engine.TAU); ctx.fillStyle = "#172033"; ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "700 10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("GO", 0, 0); ctx.restore(); ctx.restore();
  },

  frame(callback) { if (this.canvas && this.canvas.requestAnimationFrame) return this.canvas.requestAnimationFrame(callback); return setTimeout(() => callback(Date.now()), 16); },
  cancelAnimation() { if (this.requestFrame == null) return; if (this.canvas && this.canvas.cancelAnimationFrame) this.canvas.cancelAnimationFrame(this.requestFrame); else clearTimeout(this.requestFrame); this.requestFrame = null; },
  tickFeedback() { this.lastSector = engine.winnerIndex(this.rotation, this.enabledOptions().length); },

  spin() {
    if (this.data.spinning) return; if (this.data.enabledCount < 2) return wx.showToast({ title: "至少启用两个选项", icon: "none" });
    const start = this.rotation; const target = engine.targetRotation(start, this.data.enabledCount, Math.random()); const duration = 3800; let startedAt = 0;
    this.setData({ spinning: true, winner: null, showEditor: false });
    const animate = (time) => { if (!startedAt) startedAt = time; const progress = Math.min(1, (time - startedAt) / duration); const eased = 1 - Math.pow(1 - progress, 3); this.rotation = start + (target - start) * eased; this.tickFeedback(); this.draw(); if (progress < 1) this.requestFrame = this.frame(animate); else { this.requestFrame = null; this.finishSpin(); } };
    this.requestFrame = this.frame(animate);
  },

  touchAngle(touch) { const x = Number(touch.x == null ? touch.clientX : touch.x) - this.canvasWidth / 2; const y = Number(touch.y == null ? touch.clientY : touch.y) - this.canvasHeight / 2; return Math.atan2(y, x); },
  onTouchStart(event) { if (this.data.spinning || this.data.enabledCount < 2) return; const touch = event.touches && event.touches[0]; if (!touch) return; this.dragging = true; this.velocity = 0; this.lastTouchAngle = this.touchAngle(touch); this.lastTouchTime = Date.now(); this.setData({ winner: null }); },
  onTouchMove(event) { if (!this.dragging || this.data.spinning) return; const touch = event.touches && event.touches[0]; if (!touch) return; const angle = this.touchAngle(touch); const now = Date.now(); const delta = engine.shortestAngleDelta(angle, this.lastTouchAngle); const elapsed = Math.max(8, now - this.lastTouchTime); this.rotation += delta; this.velocity = delta * (16 / elapsed); this.lastTouchAngle = angle; this.lastTouchTime = now; this.tickFeedback(); this.draw(); },
  onTouchEnd() { if (!this.dragging || this.data.spinning) return; this.dragging = false; if (Math.abs(this.velocity) < 0.035) this.velocity = this.velocity < 0 ? -0.075 : 0.075; this.setData({ spinning: true, showEditor: false }); const coast = () => { this.rotation += this.velocity; this.velocity = engine.stepVelocity(this.velocity); this.tickFeedback(); this.draw(); if (this.velocity) this.requestFrame = this.frame(coast); else { this.requestFrame = null; this.finishSpin(); } }; this.requestFrame = this.frame(coast); },
  finishSpin() { const options = this.enabledOptions(); const option = options[engine.winnerIndex(this.rotation, options.length)]; if (!option) return this.setData({ spinning: false }); const result = store.recordResult(this.data.wheel.id, option.id); this.setData({ spinning: false, winner: result }); this.loadWheels(this.data.wheel.id); },

  onWheelChange(event) { if (this.data.spinning) return; const index = Number(event.detail.value || 0); this.rotation = 0; this.loadWheels(this.data.wheels[index] && this.data.wheels[index].id); },
  createWheel() { if (this.data.spinning) return; wx.showModal({ title: "新建转盘", editable: true, placeholderText: "例如：今晚吃什么", success: (result) => { if (!result.confirm) return; const wheel = store.createWheel({ title: result.content || "新转盘", options: [] }); this.rotation = 0; this.loadWheels(wheel.id); } }); },
  renameWheel() { if (this.data.spinning) return; wx.showModal({ title: "重命名转盘", editable: true, placeholderText: this.data.wheel.title, success: (result) => { if (!result.confirm) return; store.updateWheel(this.data.wheel.id, { title: result.content || this.data.wheel.title }); this.loadWheels(this.data.wheel.id); } }); },
  deleteWheel() { if (this.data.spinning) return; if (this.data.wheels.length <= 1) return wx.showToast({ title: "至少保留一个转盘", icon: "none" }); wx.showModal({ title: "删除这个转盘？", content: "选项和抽取历史将一起删除。", confirmText: "删除", confirmColor: "#a34b32", success: (result) => { if (!result.confirm) return; store.deleteWheel(this.data.wheel.id); this.rotation = 0; this.loadWheels(); } }); },
  onBatchInput(event) { this.setData({ batchText: event.detail.value }); },
  addBatch() { if (this.data.spinning) return; if (!this.data.batchText.trim()) return wx.showToast({ title: "请输入选项", icon: "none" }); store.addOptions(this.data.wheel.id, this.data.batchText); this.setData({ batchText: "", showEditor: false }); this.loadWheels(this.data.wheel.id); },
  editOption(event) { if (this.data.spinning) return; const option = this.data.wheel.options.find((item) => item.id === event.currentTarget.dataset.id); if (!option) return; wx.showModal({ title: "编辑选项", editable: true, placeholderText: option.text, success: (result) => { if (!result.confirm) return; try { store.updateOption(this.data.wheel.id, option.id, result.content || option.text); this.loadWheels(this.data.wheel.id); } catch (error) { wx.showToast({ title: error.message, icon: "none" }); } } }); },
  optionAction(event) { if (this.data.spinning) return; const id = event.currentTarget.dataset.id; const action = event.currentTarget.dataset.action; try { if (action === "remove") store.removeOption(this.data.wheel.id, id); else if (action === "toggle") store.toggleOption(this.data.wheel.id, id); else store.moveOption(this.data.wheel.id, id, action); this.loadWheels(this.data.wheel.id); } catch (error) { wx.showToast({ title: error.message, icon: "none" }); } },
  toggleEditor() { if (!this.data.spinning) this.setData({ showEditor: !this.data.showEditor }); },
  closeWinner() { this.setData({ winner: null, showEditor: false }); },
  spinAgain() { this.setData({ winner: null }, () => this.spin()); },
  removeWinner() { if (!this.data.winner) return; try { store.removeOption(this.data.wheel.id, this.data.winner.optionId); this.setData({ winner: null, showEditor: false }); this.loadWheels(this.data.wheel.id); } catch (error) { wx.showToast({ title: error.message, icon: "none" }); } },
  toggleHistory() { this.setData({ historyExpanded: !this.data.historyExpanded }); },
  clearHistory() { wx.showModal({ title: "清空抽取历史？", content: "此操作不会删除转盘选项。", confirmText: "清空", confirmColor: "#a34b32", success: (result) => { if (!result.confirm) return; store.clearHistory(this.data.wheel.id); this.loadWheels(this.data.wheel.id); } }); }
});
