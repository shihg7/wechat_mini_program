const wishlistRepository = require("../../utils/repositories/wishlistRepository");
const placeRepository = require("../../utils/repositories/placeRepository");

function emptyForm(type = "hotel") {
  return { type, name: "", city: "", area: "", address: "", latitude: null, longitude: null, placeId: "", status: "wishlist", priority: "medium", targetDate: "", budgetText: "", bookingReference: "", companions: "", note: "" };
}

Page({
  data: { mode: "create", itemId: "", readonly: false, form: emptyForm(), statuses: wishlistRepository.STATUSES, priorities: wishlistRepository.PRIORITIES, suggestions: [], placeChoiceConfirmed: false, dirty: false },
  onLoad(options) {
    if (options && options.id) this.loadItem(options.id);
    else if (options && options.placeId) this.loadPlace(options.placeId);
    else this.setData({ form: emptyForm(options && options.type === "restaurant" ? "restaurant" : "hotel") });
  },
  loadPlace(placeId) {
    const place = placeRepository.getPlaceById(placeId);
    if (!place) return this.setData({ form: emptyForm() });
    this.setData({ form: { ...emptyForm(place.type), name: place.name, city: place.city, area: place.area, address: place.address, latitude: place.latitude, longitude: place.longitude, placeId: place.id }, placeChoiceConfirmed: true });
  },
  loadItem(id) {
    const item = wishlistRepository.getWishlistItem(id);
    if (!item) return wx.showToast({ title: "清单项不存在", icon: "none" });
    this.setData({ mode: "detail", itemId: item.id, readonly: true, form: item, placeChoiceConfirmed: !!item.placeId, dirty: false });
  },
  edit() { this.setData({ mode: "edit", readonly: false, dirty: false }); },
  onTypeTap(event) { if (!this.data.readonly) this.setData({ "form.type": event.currentTarget.dataset.type, "form.placeId": "", placeChoiceConfirmed: false, dirty: true }, () => this.refreshSuggestions()); },
  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value, dirty: true }, () => { if (["name", "city"].indexOf(field) >= 0) this.refreshSuggestions(); });
  },
  onDateChange(event) { this.setData({ "form.targetDate": event.detail.value, dirty: true }); },
  onStatusTap(event) { if (!this.data.readonly) this.setData({ "form.status": event.currentTarget.dataset.value, dirty: true }); },
  onPriorityTap(event) { if (!this.data.readonly) this.setData({ "form.priority": event.currentTarget.dataset.value, dirty: true }); },
  refreshSuggestions() {
    if (this.data.placeChoiceConfirmed || !this.data.form.name) return this.setData({ suggestions: [] });
    this.setData({ suggestions: placeRepository.findPlaceSuggestions({ type: this.data.form.type, name: this.data.form.name, city: this.data.form.city }).slice(0, 4) });
  },
  selectPlace(event) {
    const place = placeRepository.getPlaceById(event.currentTarget.dataset.id);
    if (!place) return;
    this.setData({ form: { ...this.data.form, type: place.type, name: place.name, city: place.city, area: place.area, address: place.address, latitude: place.latitude, longitude: place.longitude, placeId: place.id }, suggestions: [], placeChoiceConfirmed: true, dirty: true });
  },
  createIndependent() { this.setData({ "form.placeId": "", suggestions: [], placeChoiceConfirmed: true, dirty: true }); },
  chooseLocation() {
    if (this.data.readonly || !wx.chooseLocation) return;
    wx.chooseLocation({ success: (location) => this.setData({ "form.name": this.data.form.name || location.name || "", "form.address": location.address || "", "form.latitude": location.latitude, "form.longitude": location.longitude, placeChoiceConfirmed: false, dirty: true }, () => this.refreshSuggestions()), fail: (error) => { if (String(error && error.errMsg).indexOf("cancel") < 0) wx.showToast({ title: "可继续手工填写", icon: "none" }); } });
  },
  save() {
    if (!String(this.data.form.name || "").trim()) return wx.showToast({ title: "先填写名称", icon: "none" });
    if (this.data.suggestions.length && !this.data.placeChoiceConfirmed) return wx.showToast({ title: "先确认是否关联已有地点", icon: "none" });
    try {
      const item = this.data.mode === "edit" ? wishlistRepository.updateWishlistItem(this.data.itemId, this.data.form) : wishlistRepository.addWishlistItem(this.data.form);
      this.setData({ mode: "detail", itemId: item.id, readonly: true, form: item, dirty: false });
      wx.showToast({ title: "已保存", icon: "success" });
    } catch (error) { wx.showToast({ title: error.message || "保存失败", icon: "none" }); }
  },
  recordVisit() {
    const form = this.data.form;
    wx.navigateTo({ url: `/pages/record/record?type=${form.type}&wishlistId=${form.id}${form.placeId ? `&placeId=${form.placeId}` : ""}` });
  },
  remove() {
    wx.showModal({ title: "删除清单项", content: "确认删除这条计划吗？", confirmText: "删除", confirmColor: "#a34b32", success: (result) => { if (!result.confirm) return; wishlistRepository.deleteWishlistItem(this.data.itemId); wx.navigateBack(); } });
  }
});
