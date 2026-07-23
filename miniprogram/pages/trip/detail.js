const tripStore = require("../../utils/tripStore");

function blankItem(date) {
  return {
    date: date || "",
    time: "",
    title: "",
    location: "",
    note: ""
  };
}

function dayLabel(date, index) {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日 · 第 ${index + 1} 天`;
}

Page({
  data: {
    id: "",
    trip: null,
    missing: false,
    days: [],
    conflicts: [],
    showForm: false,
    editingItemId: "",
    itemForm: blankItem("")
  },

  onLoad(options = {}) {
    this.setData({ id: options.id || "" });
  },

  onShow() {
    this.load();
  },

  load() {
    const trip = tripStore.getTripById(this.data.id);
    if (!trip) {
      this.setData({ trip: null, missing: true, days: [], conflicts: [] });
      return;
    }
    const conflicts = tripStore.findConflicts(trip.items);
    const conflictIds = new Set(conflicts.reduce((ids, pair) => ids.concat(pair), []));
    const days = tripStore.dateRange(trip.startDate, trip.endDate).map((date, index) => {
      const items = trip.items
        .filter((item) => item.date === date)
        .sort((a, b) => a.order - b.order || a.time.localeCompare(b.time))
        .map((item, itemIndex, dayItems) => ({
          ...item,
          canMoveUp: itemIndex > 0,
          canMoveDown: itemIndex < dayItems.length - 1,
          conflict: conflictIds.has(item.id)
        }));
      return { date, label: dayLabel(date, index), items };
    });
    this.setData({
      trip: {
        ...trip,
        destinationText: trip.destination || "目的地待定"
      },
      missing: false,
      days,
      conflicts
    });
  },

  goBack() {
    wx.navigateBack();
  },

  edit() {
    wx.navigateTo({ url: `/pages/trip/edit?id=${this.data.id}` });
  },

  openNewItem() {
    if (!this.data.trip) return;
    this.setData({
      showForm: true,
      editingItemId: "",
      itemForm: blankItem(this.data.trip.startDate)
    });
  },

  toggleForm() {
    if (this.data.showForm) this.cancelForm();
    else this.openNewItem();
  },

  cancelForm() {
    this.setData({
      showForm: false,
      editingItemId: "",
      itemForm: blankItem("")
    });
  },

  input(event) {
    this.setData({
      [`itemForm.${event.currentTarget.dataset.field}`]: event.detail.value
    });
  },

  choose(event) {
    this.setData({
      [`itemForm.${event.currentTarget.dataset.field}`]: event.detail.value
    });
  },

  clearTime() {
    this.setData({ "itemForm.time": "" });
  },

  editItem(event) {
    const item = this.data.trip && this.data.trip.items.find((entry) => {
      return entry.id === event.currentTarget.dataset.id;
    });
    if (!item) return;
    this.setData({
      showForm: true,
      editingItemId: item.id,
      itemForm: {
        date: item.date,
        time: item.time,
        title: item.title,
        location: item.location,
        note: item.note
      }
    });
  },

  saveItem() {
    const editing = !!this.data.editingItemId;
    try {
      const updated = editing
        ? tripStore.updateItem(this.data.id, this.data.editingItemId, this.data.itemForm)
        : tripStore.addItem(this.data.id, this.data.itemForm);
      if (!updated) throw new Error("行程或日程不存在");
      this.cancelForm();
      this.load();
      wx.showToast({
        title: editing ? "日程已更新" : "日程已添加",
        icon: "success"
      });
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }
  },

  add() {
    this.saveItem();
  },

  removeItem(event) {
    const itemId = event.currentTarget.dataset.id;
    wx.showModal({
      title: "删除日程",
      content: "确认删除这项安排吗？",
      confirmText: "删除",
      confirmColor: "#b54736",
      success: (result) => {
        if (!result.confirm) return;
        tripStore.deleteItem(this.data.id, itemId);
        this.load();
      }
    });
  },

  remove(event) {
    this.removeItem(event);
  },

  copyItem(event) {
    const updated = tripStore.duplicateItem(this.data.id, event.currentTarget.dataset.id);
    if (!updated) return;
    this.load();
    wx.showToast({ title: "日程已复制", icon: "success" });
  },

  moveItem(event) {
    tripStore.moveItem(
      this.data.id,
      event.currentTarget.dataset.id,
      event.currentTarget.dataset.direction
    );
    this.load();
  },

  showItemActions(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.data.days
      .reduce((items, day) => items.concat(day.items), [])
      .find((entry) => entry.id === id);
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
        const actionEvent = { currentTarget: { dataset: { id, direction: action.key } } };
        if (action.key === "up" || action.key === "down") return this.moveItem(actionEvent);
        if (action.key === "copy") return this.copyItem(actionEvent);
        this.removeItem(actionEvent);
      }
    });
  },

  showTripActions() {
    wx.showActionSheet({
      itemList: ["复制行程", "删除行程"],
      success: (result) => {
        if (result.tapIndex === 0) this.duplicate();
        if (result.tapIndex === 1) this.removeTrip();
      }
    });
  },

  showMoreActions() {
    this.showTripActions();
  },

  removeTrip() {
    wx.showModal({
      title: "删除行程？",
      content: "行程和其中的全部日程都会被删除，且无法恢复。",
      confirmText: "删除",
      confirmColor: "#b54736",
      success: (result) => {
        if (!result.confirm) return;
        tripStore.deleteTrip(this.data.id);
        wx.navigateBack();
      }
    });
  },

  duplicate() {
    const copy = tripStore.duplicateTrip(this.data.id);
    if (copy) wx.navigateTo({ url: `/pages/trip/detail?id=${copy.id}` });
  }
});
