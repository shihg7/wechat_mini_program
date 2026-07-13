const {
  deleteEmptyPlace,
  findPlaceSuggestions,
  getPlaceById,
  getPlaceRecords,
  getPlaceStats,
  getPlaces,
  mergePlaces,
  updatePlace
} = require("../../utils/repositories/placeRepository");

Page({
  data: {
    placeId: "",
    place: null,
    stats: null,
    visits: [],
    mergeCandidates: [],
    editing: false,
    form: null,
    dirty: false
  },

  onLoad(options) {
    if (options && options.id) this.setData({ placeId: options.id });
  },

  onShow() {
    if (this.data.placeId && !this.data.editing) this.refresh();
  },

  onUnload() { this.setLeaveAlert(false); },

  setLeaveAlert(enabled) {
    if (enabled && wx.enableAlertBeforeUnload) wx.enableAlertBeforeUnload({ message: "地点修改尚未保存，确定离开吗？" });
    if (!enabled && wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
  },

  markDirty(patch) { this.setData({ ...patch, dirty: true }); this.setLeaveAlert(true); },

  refresh() {
    const place = getPlaceById(this.data.placeId);
    if (!place) {
      wx.showToast({ title: "地点不存在", icon: "none" });
      setTimeout(() => wx.navigateBack(), 500);
      return;
    }
    const stats = getPlaceStats(place.id);
    const visits = getPlaceRecords(place.id).sort((a, b) => String(b.stayDate || b.createdAt).localeCompare(String(a.stayDate || a.createdAt)));
    const suggestedIds = findPlaceSuggestions({ type: place.type, name: place.name, city: place.city }).reduce((map, item) => { map[item.id] = true; return map; }, {});
    const mergeCandidates = getPlaces().filter((item) => item.id !== place.id && suggestedIds[item.id]).map((item) => ({
      ...item,
      visitCount: getPlaceStats(item.id).visitCount
    }));
    this.setData({ place, stats, visits, mergeCandidates, form: { ...place, aliasesText: (place.aliases || []).join("、") } });
  },

  addVisit() {
    wx.navigateTo({ url: `/pages/record/record?type=${this.data.place.type}&placeId=${this.data.place.id}` });
  },

  addWishlist() {
    wx.navigateTo({ url: `/pages/wishlist/edit?placeId=${this.data.place.id}` });
  },

  goRecord(event) {
    wx.navigateTo({ url: `/pages/record/record?id=${event.currentTarget.dataset.id}` });
  },

  startEdit() {
    this.setData({ editing: true, dirty: false });
  },

  cancelEdit() {
    if (this.data.dirty) {
      wx.showModal({ title: "放弃修改？", content: "尚未保存的地点信息会丢失。", confirmText: "放弃", confirmColor: "#a34b32", success: (result) => { if (result.confirm) this.resetEdit(); } });
      return;
    }
    this.resetEdit();
  },

  resetEdit() {
    const place = this.data.place;
    this.setData({ editing: false, dirty: false, form: { ...place, aliasesText: (place.aliases || []).join("、") } });
    this.setLeaveAlert(false);
  },

  onInput(event) {
    this.markDirty({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value });
  },

  chooseLocation() {
    if (!wx.chooseLocation) return;
    wx.chooseLocation({
      success: (location) => {
        this.markDirty({
          "form.address": location.address || "",
          "form.latitude": location.latitude,
          "form.longitude": location.longitude,
          "form.name": this.data.form.name || location.name || ""
        });
      },
      fail: (error) => {
        if (String(error && error.errMsg).indexOf("cancel") < 0) wx.showToast({ title: "可继续手工填写", icon: "none" });
      }
    });
  },

  openLocation() {
    const place = this.data.place;
    if (place.latitude == null || place.longitude == null || !wx.openLocation) return;
    wx.openLocation({ latitude: place.latitude, longitude: place.longitude, name: place.name, address: place.address || "" });
  },

  savePlace() {
    try {
      const updated = updatePlace(this.data.placeId, {
        ...this.data.form,
        aliases: String(this.data.form.aliasesText || "").split(/[，,、\n]/).filter(Boolean)
      });
      this.setData({ editing: false, dirty: false, place: updated });
      this.setLeaveAlert(false);
      this.refresh();
      wx.showToast({ title: "地点已更新", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }
  },

  mergeInto(event) {
    const targetId = event.currentTarget.dataset.id;
    const target = this.data.mergeCandidates.find((item) => item.id === targetId);
    if (!target) return;
    wx.showModal({
      title: "合并重复地点",
      content: `将“${this.data.place.name}”的全部到访记录合并到“${target.name}”，原地点会删除。`,
      confirmText: "确认合并",
      success: (result) => {
        if (!result.confirm) return;
        try {
          mergePlaces(this.data.placeId, targetId);
          wx.redirectTo({ url: `/pages/place/detail?id=${targetId}` });
        } catch (error) {
          wx.showToast({ title: error.message || "合并失败", icon: "none" });
        }
      }
    });
  },

  deletePlace() {
    wx.showModal({
      title: "删除地点",
      content: this.data.visits.length ? "该地点仍有到访记录，请先合并或删除记录。" : "确认删除这个空地点吗？",
      showCancel: !this.data.visits.length,
      confirmText: this.data.visits.length ? "知道了" : "删除",
      success: (result) => {
        if (!result.confirm || this.data.visits.length) return;
        try {
          deleteEmptyPlace(this.data.placeId);
          wx.navigateBack();
        } catch (error) {
          wx.showToast({ title: error.message || "删除失败", icon: "none" });
        }
      }
    });
  }
});
