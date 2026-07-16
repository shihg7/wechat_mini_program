const { getRecordById } = require("../../../utils/repositories/recordRepository");
const { LAYOUTS, buildStoryModel, loadStoryPreferences, renderStory, saveStoryPreferences } = require("../../../utils/storyRenderer");
const { withAvailability } = require("../../../utils/repositories/mediaRepository");

Page({
  data: { record: null, missing: false, layouts: LAYOUTS, optionItems: [{ key: "showCity", label: "城市" }, { key: "showMonth", label: "月份" }, { key: "showScore", label: "总分" }, { key: "showCategories", label: "分类评分" }, { key: "showTags", label: "标签" }, { key: "showSummary", label: "分享摘要" }], preferences: null, photoOptions: [], model: null, exporting: false },
  onLoad(options) {
    const record = getRecordById(options && options.id);
    if (!record) { this.setData({ missing: true }); wx.showToast({ title: "体验不存在", icon: "none" }); return; }
    const stored = loadStoryPreferences(record.id) || {};
    const preferences = { title: stored.title || record.displayName, layout: stored.layout || "archive", photoIds: stored.photoIds || (record.photos || []).slice(0, 6).map((photo) => photo.id), options: { showCity: true, showMonth: true, showScore: true, showCategories: true, showTags: true, showSummary: true, ...(stored.options || {}) } };
    const photoOptions = withAvailability(record.photos, record.recordType).map((photo) => ({ ...photo, checked: preferences.photoIds.indexOf(photo.id) >= 0 }));
    this.setData({ record, preferences, photoOptions, model: buildStoryModel(record, preferences) });
  },
  goBack() { wx.navigateBack(); },
  refreshModel() { saveStoryPreferences(this.data.record.id, this.data.preferences); this.setData({ model: buildStoryModel(this.data.record, this.data.preferences) }); },
  onTitleInput(event) { this.setData({ "preferences.title": event.detail.value }, () => this.refreshModel()); },
  onLayoutTap(event) { this.setData({ "preferences.layout": event.currentTarget.dataset.value }, () => this.refreshModel()); },
  onOptionTap(event) { const key = event.currentTarget.dataset.key; this.setData({ [`preferences.options.${key}`]: !this.data.preferences.options[key] }, () => this.refreshModel()); },
  onPhotoToggle(event) {
    const id = event.currentTarget.dataset.id; let ids = this.data.preferences.photoIds.slice();
    if (ids.indexOf(id) >= 0) ids = ids.filter((item) => item !== id); else if (ids.length < 6) ids.push(id); else return wx.showToast({ title: "最多选择 6 张", icon: "none" });
    this.setData({ "preferences.photoIds": ids, photoOptions: this.data.photoOptions.map((photo) => ({ ...photo, checked: ids.indexOf(photo.id) >= 0 })) }, () => this.refreshModel());
  },
  movePhoto(event) { const id = event.currentTarget.dataset.id; const direction = Number(event.currentTarget.dataset.direction); const ids = this.data.preferences.photoIds.slice(); const index = ids.indexOf(id); const target = index + direction; if (index < 0 || target < 0 || target >= ids.length) return; [ids[index], ids[target]] = [ids[target], ids[index]]; this.setData({ "preferences.photoIds": ids }, () => this.refreshModel()); },
  async exportStory() { if (this.data.exporting) return; this.setData({ exporting: true }); try { const path = await renderStory(this, this.data.model); if (wx.showShareImageMenu) wx.showShareImageMenu({ path }); else wx.previewImage({ current: path, urls: [path] }); } catch (error) { wx.showModal({ title: "生成失败", content: error.message || "请稍后重试", showCancel: false }); } finally { this.setData({ exporting: false }); } }
});
