const wishlistRepository = require("../../utils/repositories/wishlistRepository");
const placeRepository = require("../../utils/repositories/placeRepository");
const tripStore = require("../../utils/tripStore");
const departureStore = require("../../utils/departureStore");

function emptyForm(type = "hotel") {
  return { type, name: "", city: "", area: "", address: "", latitude: null, longitude: null, placeId: "", status: "wishlist", priority: "medium", targetDate: "", budgetText: "", bookingReference: "", companions: "", tripId: "", itineraryItemId: "", bookingId: "", note: "" };
}

Page({
  data: { mode: "create", itemId: "", readonly: false, missing: false, form: emptyForm(), statuses: wishlistRepository.STATUSES, priorities: wishlistRepository.PRIORITIES, suggestions: [], placeChoiceConfirmed: false, dirty: false, trips: [] },
  onLoad(options) {
    this.refreshTrips();
    if (options && options.id) this.loadItem(options.id);
    else if (options && options.placeId) this.loadPlace(options.placeId);
    else this.setData({ form: emptyForm(options && options.type === "restaurant" ? "restaurant" : "hotel") });
  },
  onShow() { this.refreshTrips(); },
  onUnload() { this.setLeaveAlert(false); },
  refreshTrips() { this.setData({ trips: tripStore.getTrips().filter((trip) => trip.status !== "ended" && trip.status !== "archived") }); },
  setLeaveAlert(enabled) {
    if (enabled && wx.enableAlertBeforeUnload) wx.enableAlertBeforeUnload({ message: "想去计划尚未保存，确定离开吗？" });
    if (!enabled && wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
  },
  markDirty(patch, callback) { this.setData({ ...patch, dirty: true }, () => { this.setLeaveAlert(true); if (callback) callback(); }); },
  clearDirty() { this.setData({ dirty: false }); this.setLeaveAlert(false); },
  loadPlace(placeId) {
    const place = placeRepository.getPlaceById(placeId);
    if (!place) return this.setData({ form: emptyForm() });
    this.setData({ form: { ...emptyForm(place.type), name: place.name, city: place.city, area: place.area, address: place.address, latitude: place.latitude, longitude: place.longitude, placeId: place.id }, placeChoiceConfirmed: true });
  },
  loadItem(id) {
    const item = wishlistRepository.getWishlistItem(id);
    if (!item) { this.setData({ missing: true }); wx.showToast({ title: "清单项不存在", icon: "none" }); return; }
    this.setData({ mode: "detail", itemId: item.id, readonly: true, form: item, placeChoiceConfirmed: !!item.placeId, dirty: false });
    this.setLeaveAlert(false);
  },
  edit() { this.setData({ mode: "edit", readonly: false, dirty: false }); },
  goBack() { wx.navigateBack(); },
  onTypeTap(event) { if (!this.data.readonly) this.markDirty({ "form.type": event.currentTarget.dataset.type, "form.placeId": "", placeChoiceConfirmed: false }, () => this.refreshSuggestions()); },
  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.markDirty({ [`form.${field}`]: event.detail.value }, () => { if (["name", "city"].indexOf(field) >= 0) this.refreshSuggestions(); });
  },
  onDateChange(event) { this.markDirty({ "form.targetDate": event.detail.value }); },
  onStatusTap(event) { if (!this.data.readonly) this.markDirty({ "form.status": event.currentTarget.dataset.value }); },
  onPriorityTap(event) { if (!this.data.readonly) this.markDirty({ "form.priority": event.currentTarget.dataset.value }); },
  refreshSuggestions() {
    if (this.data.placeChoiceConfirmed || !this.data.form.name) return this.setData({ suggestions: [] });
    this.setData({ suggestions: placeRepository.findPlaceSuggestions({ type: this.data.form.type, name: this.data.form.name, city: this.data.form.city }).slice(0, 4) });
  },
  selectPlace(event) {
    const place = placeRepository.getPlaceById(event.currentTarget.dataset.id);
    if (!place) return;
    this.markDirty({ form: { ...this.data.form, type: place.type, name: place.name, city: place.city, area: place.area, address: place.address, latitude: place.latitude, longitude: place.longitude, placeId: place.id }, suggestions: [], placeChoiceConfirmed: true });
  },
  createIndependent() { this.markDirty({ "form.placeId": "", suggestions: [], placeChoiceConfirmed: true }); },
  chooseLocation() {
    if (this.data.readonly || !wx.chooseLocation) return;
    wx.chooseLocation({ success: (location) => this.markDirty({ "form.name": this.data.form.name || location.name || "", "form.address": location.address || "", "form.latitude": location.latitude, "form.longitude": location.longitude, placeChoiceConfirmed: false }, () => this.refreshSuggestions()), fail: (error) => { if (String(error && error.errMsg).indexOf("cancel") < 0) wx.showToast({ title: "可继续手工填写", icon: "none" }); } });
  },
  save() {
    if (!String(this.data.form.name || "").trim()) return wx.showToast({ title: "先填写名称", icon: "none" });
    if (this.data.suggestions.length && !this.data.placeChoiceConfirmed) return wx.showToast({ title: "先确认是否关联已有地点", icon: "none" });
    try {
      const item = this.data.mode === "edit" ? wishlistRepository.updateWishlistItem(this.data.itemId, this.data.form) : wishlistRepository.addWishlistItem(this.data.form);
      this.setData({ mode: "detail", itemId: item.id, readonly: true, form: item, dirty: false });
      this.setLeaveAlert(false);
      wx.showToast({ title: "已保存", icon: "success" });
    } catch (error) { wx.showToast({ title: error.message || "保存失败", icon: "none" }); }
  },
  recordVisit() {
    const form = this.data.form;
    wx.navigateTo({ url: `/pages/record/record?type=${form.type}&wishlistId=${form.id}${form.placeId ? `&placeId=${form.placeId}` : ""}` });
  },
  openBooking() {
    const booking = this.data.form.bookingId && departureStore.getBookingById(this.data.form.bookingId);
    wx.navigateTo({ url: booking ? `/pages/departure/edit?id=${booking.id}` : `/pages/departure/edit?wishlistId=${this.data.itemId}` });
  },
  addToTrip() {
    if (!this.data.itemId) return;
    const linkedTrip = this.data.form.tripId && tripStore.getTripById(this.data.form.tripId);
    if (linkedTrip && (linkedTrip.itineraryItems || []).some((item) => item.id === this.data.form.itineraryItemId)) {
      wx.navigateTo({ url: `/pages/trip/detail?id=${linkedTrip.id}` });
      return;
    }
    const choices = this.data.trips;
    if (!choices.length) return wx.showToast({ title: "请先创建行程", icon: "none" });
    wx.showActionSheet({ itemList: choices.map((trip) => trip.title), success: (result) => { const trip = choices[result.tapIndex]; const item = tripStore.addItineraryItem(trip.id, { type: this.data.form.type, title: this.data.form.name, date: this.data.form.targetDate >= trip.startDate && this.data.form.targetDate <= trip.endDate ? this.data.form.targetDate : trip.startDate, placeId: this.data.form.placeId, wishlistId: this.data.itemId, city: this.data.form.city }); wishlistRepository.updateWishlistItem(this.data.itemId, { tripId: trip.id, itineraryItemId: item.itineraryItems[item.itineraryItems.length - 1].id }); this.loadItem(this.data.itemId); wx.showToast({ title: "已加入行程", icon: "success" }); } });
  },
  remove() {
    wx.showModal({ title: "删除清单项", content: "确认删除这条计划吗？", confirmText: "删除", confirmColor: "#a34b32", success: (result) => { if (!result.confirm) return; this.setLeaveAlert(false); wishlistRepository.deleteWishlistItem(this.data.itemId); wx.navigateBack(); } });
  }
});
