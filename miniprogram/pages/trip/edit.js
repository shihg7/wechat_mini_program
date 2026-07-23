const tripStore = require("../../utils/tripStore");

function localDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function blankForm() {
  return {
    title: "",
    destination: "",
    startDate: localDate(0),
    endDate: localDate(1),
    note: ""
  };
}

Page({
  data: {
    id: "",
    mode: "create",
    missing: false,
    form: blankForm(),
    dirty: false,
    saving: false
  },

  onLoad(options = {}) {
    if (!options.id) return;
    const trip = tripStore.getTripById(options.id);
    if (!trip) {
      this.setData({ missing: true });
      wx.showToast({ title: "行程不存在", icon: "none" });
      return;
    }
    this.setData({
      id: trip.id,
      mode: "edit",
      form: {
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        note: trip.note
      }
    });
  },

  onUnload() {
    if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
  },

  goBack() {
    wx.navigateBack();
  },

  markDirty() {
    if (this.data.dirty) return;
    this.setData({ dirty: true });
    if (wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({ message: "行程修改尚未保存，确定离开吗？" });
    }
  },

  input(event) {
    this.setData({
      [`form.${event.currentTarget.dataset.field}`]: event.detail.value
    }, () => this.markDirty());
  },

  date(event) {
    this.setData({
      [`form.${event.currentTarget.dataset.field}`]: event.detail.value
    }, () => this.markDirty());
  },

  save() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      const trip = this.data.mode === "edit"
        ? tripStore.updateTrip(this.data.id, this.data.form)
        : tripStore.addTrip(this.data.form);
      if (!trip) throw new Error("行程不存在");
      if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
      this.setData({ dirty: false });
      wx.redirectTo({ url: `/pages/trip/detail?id=${trip.id}` });
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  }
});
