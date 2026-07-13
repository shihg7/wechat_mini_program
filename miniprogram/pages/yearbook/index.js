const { getRecords } = require("../../utils/repositories/recordRepository");
const { getLedgers } = require("../../utils/repositories/ledgerRepository");
const { buildYearbook, drawYearbookLong, getAvailableYears, loadYearbookPreferences, renderYearbookPdf, saveYearbookPreferences } = require("../../utils/yearbookBuilder");
const { fileExists } = require("../../utils/mediaStore");

Page({
  data: { records: [], ledgers: [], years: [], yearLabels: [], yearIndex: 0, year: "", preferences: null, model: null, photoOptions: [], exporting: false },
  onShow() { this.load(); },
  load() {
    const records = getRecords(); const ledgers = getLedgers(); const availableYears = getAvailableYears(records).filter((year) => year !== "all"); const fallbackYear = String(new Date().getFullYear()); const years = availableYears.length ? availableYears : [fallbackYear]; const yearIndex = Math.max(0, years.indexOf(this.data.year)); const year = years[yearIndex];
    this.setData({ records, ledgers, years, yearLabels: years.map((item) => `${item} 年`), yearIndex, year }, () => this.loadYear(year));
  },
  loadYear(year) { const stored = loadYearbookPreferences(year) || {}; const initial = buildYearbook(this.data.records, this.data.ledgers, year, stored); const preferences = { title: stored.title || initial.title, photoIds: stored.photoIds || initial.photoIds, includeAa: !!stored.includeAa }; this.setData({ year, preferences, model: buildYearbook(this.data.records, this.data.ledgers, year, preferences) }, () => this.refreshPhotos()); },
  refreshPhotos() { const selected = new Set(this.data.preferences.photoIds); const options = this.data.records.filter((record) => record.status !== "draft" && String(record.stayDate || record.createdAt).slice(0, 4) === this.data.year).reduce((items, record) => items.concat((record.photos || []).filter((photo) => fileExists(photo.filePath)).map((photo) => ({ ...photo, recordName: record.displayName, checked: selected.has(photo.id) }))), []); this.setData({ photoOptions: options }); },
  refreshModel() { saveYearbookPreferences(this.data.year, this.data.preferences); this.setData({ model: buildYearbook(this.data.records, this.data.ledgers, this.data.year, this.data.preferences) }); },
  onYearChange(event) { const index = Number(event.detail.value || 0); this.setData({ yearIndex: index }, () => this.loadYear(this.data.years[index])); },
  onTitleInput(event) { this.setData({ "preferences.title": event.detail.value }, () => this.refreshModel()); },
  toggleAa() { this.setData({ "preferences.includeAa": !this.data.preferences.includeAa }, () => this.refreshModel()); },
  togglePhoto(event) { const id = event.currentTarget.dataset.id; let ids = this.data.preferences.photoIds.slice(); if (ids.indexOf(id) >= 0) ids = ids.filter((item) => item !== id); else if (ids.length < 24) ids.push(id); else return wx.showToast({ title: "最多选择 24 张", icon: "none" }); this.setData({ "preferences.photoIds": ids, photoOptions: this.data.photoOptions.map((photo) => ({ ...photo, checked: ids.indexOf(photo.id) >= 0 })) }, () => this.refreshModel()); },
  async exportLong() { if (this.data.exporting) return; this.setData({ exporting: true }); try { const path = await drawYearbookLong(this, { ...this.data.model, includeAa: false }); if (wx.showShareImageMenu) wx.showShareImageMenu({ path }); else wx.previewImage({ current: path, urls: [path] }); } catch (error) { wx.showModal({ title: "生成失败", content: error.message || "请稍后重试", showCancel: false }); } finally { this.setData({ exporting: false }); } },
  async exportPdf() { if (this.data.exporting) return; this.setData({ exporting: true }); try { const path = await renderYearbookPdf(this, this.data.model); wx.openDocument({ filePath: path, fileType: "pdf", showMenu: true }); } catch (error) { wx.showModal({ title: "生成失败", content: error.message || "请稍后重试", showCancel: false }); } finally { this.setData({ exporting: false }); } }
});
