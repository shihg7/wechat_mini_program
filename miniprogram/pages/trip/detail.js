const tripStore = require("../../utils/repositories/tripRepository");
const demoMode = require("../../utils/demoMode");
const TYPES = [{ key: "hotel", label: "酒店" }, { key: "restaurant", label: "餐厅" }, { key: "transport", label: "交通" }, { key: "attraction", label: "景点" }, { key: "custom", label: "其他" }];
Page({
  data: { id: "", trip: null, missing: false, days: [], conflicts: [], itemForm: { title: "", type: "custom", date: "", startTime: "", endTime: "", note: "" }, showForm: false, editingItemId: "", types: TYPES, demoActive: false },
  onLoad(options = {}) { const demoActive = options.demo === "trip" && demoMode.getState().active; this.setData({ id: options.id || "", demoActive }); },
  onShow() { this.load(); },
  load() { const trip = tripStore.getTripById(this.data.id); if (!trip) { this.setData({ trip: null, missing: true }); return; } if (this.data.demoActive) demoMode.markStep("trip"); const conflicts = tripStore.findConflicts(trip.itineraryItems); const conflictIds = new Set([].concat(...conflicts)); const days = tripStore.dateRange(trip.startDate, trip.endDate).map((date) => { const items = trip.itineraryItems.filter((item) => item.date === date).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.startTime.localeCompare(b.startTime)); return { date, label: `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`, items: items.map((item, index) => ({ ...item, canMoveUp: index > 0, canMoveDown: index < items.length - 1, conflict: conflictIds.has(item.id), typeLabel: (TYPES.find((type) => type.key === item.type) || TYPES[4]).label })) }; }); this.setData({ trip: { ...trip, cityText: trip.cities.join("、") || "目的地待定" }, missing: false, days, conflicts }); },
  goBack() { wx.navigateBack(); },
  edit() { wx.navigateTo({ url: `/pages/trip/edit?id=${this.data.id}` }); }, budget() { wx.navigateTo({ url: `/pages/trip/budget?id=${this.data.id}` }); },
  showMoreActions() { wx.showActionSheet({ itemList: ["出发准备", "复制行程", "删除行程"], success: (result) => { if (result.tapIndex === 0) this.goDeparture(); else if (result.tapIndex === 1) this.duplicate(); else if (result.tapIndex === 2) this.removeTrip(); } }); },
  goDeparture() { wx.navigateTo({ url: `/pages/departure/index?tripId=${this.data.id}&tab=checklist` }); },
  toggleForm() { this.setData({ showForm: !this.data.showForm, editingItemId: "", itemForm: { title: "", type: "custom", date: this.data.trip.startDate, startTime: "", endTime: "", note: "" } }); }, input(event) { this.setData({ [`itemForm.${event.currentTarget.dataset.field}`]: event.detail.value }); }, choose(event) { this.setData({ [`itemForm.${event.currentTarget.dataset.field}`]: event.detail.value }); }, type(event) { this.setData({ "itemForm.type": event.currentTarget.dataset.value }); },
  editItem(event) { const item = this.data.trip.itineraryItems.find((entry) => entry.id === event.currentTarget.dataset.id); if (!item) return; this.setData({ showForm: true, editingItemId: item.id, itemForm: { title: item.title, type: item.type, date: item.date, startTime: item.startTime, endTime: item.endTime, note: item.note } }); },
  add() { if (!this.data.itemForm.title.trim()) return wx.showToast({ title: "请填写日程名称", icon: "none" }); try { if (this.data.editingItemId) tripStore.updateItineraryItem(this.data.id, this.data.editingItemId, this.data.itemForm); else tripStore.addItineraryItem(this.data.id, this.data.itemForm); this.setData({ showForm: false, editingItemId: "" }); this.load(); } catch (error) { wx.showToast({ title: error.message, icon: "none" }); } },
  remove(event) { const itemId = event.currentTarget.dataset.id; wx.showModal({ title: "删除日程", content: "确认删除这项安排吗？", success: (result) => { if (result.confirm) { tripStore.removeItineraryItem(this.data.id, itemId); this.load(); } } }); },
  copyItem(event) { tripStore.duplicateItineraryItem(this.data.id, event.currentTarget.dataset.id); this.load(); wx.showToast({ title: "已复制日程", icon: "success" }); },
  copyDay(event) { const items = this.data.trip.itineraryItems.filter((item) => item.date === event.currentTarget.dataset.date); items.forEach((item) => tripStore.duplicateItineraryItem(this.data.id, item.id)); this.load(); wx.showToast({ title: `已复制 ${items.length} 项`, icon: "success" }); },
  moveItem(event) { tripStore.moveItineraryItem(this.data.id, event.currentTarget.dataset.id, event.currentTarget.dataset.direction); this.load(); },
  showItemActions(event) {
    const id = event.currentTarget.dataset.id;
    const items = [].concat(...this.data.days.map((day) => day.items));
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const actions = [];
    if (item.canMoveUp) actions.push({ label: "上移日程", key: "up" });
    if (item.canMoveDown) actions.push({ label: "下移日程", key: "down" });
    actions.push({ label: "复制日程", key: "copy" });
    actions.push({ label: "删除日程", key: "remove" });
    wx.showActionSheet({
      itemList: actions.map((action) => action.label),
      success: (result) => {
        const action = actions[result.tapIndex];
        if (!action) return;
        if (action.key === "up" || action.key === "down") return this.moveItem({ currentTarget: { dataset: { id, direction: action.key } } });
        if (action.key === "copy") return this.copyItem({ currentTarget: { dataset: { id } } });
        this.remove({ currentTarget: { dataset: { id } } });
      }
    });
  },
  removeTrip() { const trip = tripStore.getTripById(this.data.id); const blocks = []; if (trip.itineraryItems.length) blocks.push(`${trip.itineraryItems.length} 项日程`); if (trip.personalExpenses.length) blocks.push(`${trip.personalExpenses.length} 笔个人支出`); if (trip.linkedLedgerIds.length) blocks.push(`${trip.linkedLedgerIds.length} 本关联账本`); if (blocks.length) return wx.showModal({ title: "暂时不能删除", content: `请先处理：${blocks.join("、")}。`, showCancel: false }); wx.showModal({ title: "删除行程？", content: "删除后无法恢复。", confirmText: "删除", confirmColor: "#a34b32", success: (result) => { if (!result.confirm) return; tripStore.deleteTrip(this.data.id); wx.navigateBack(); } }); },
  duplicate() { const copy = tripStore.duplicateTrip(this.data.id); if (copy) wx.navigateTo({ url: `/pages/trip/detail?id=${copy.id}` }); }
});
