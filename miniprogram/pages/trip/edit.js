const tripStore = require("../../utils/repositories/tripRepository");

function localDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function blank() {
  return { title: "", citiesText: "", startDate: localDate(0), endDate: localDate(1), status: "upcoming", baseCurrency: "CNY", budgetText: "", note: "" };
}

Page({
  data: {
    id: "",
    mode: "create",
    missing: false,
    form: blank(),
    dirty: false,
    statuses: [{ key: "upcoming", label: "即将开始" }, { key: "active", label: "进行中" }, { key: "ended", label: "已结束" }, { key: "archived", label: "已归档" }]
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
        citiesText: trip.cities.join("、"),
        startDate: trip.startDate,
        endDate: trip.endDate,
        status: trip.status,
        baseCurrency: trip.baseCurrency,
        budgetText: trip.budgetTotalCents ? String(trip.budgetTotalCents / 100) : "",
        note: trip.note
      }
    });
  },

  onUnload() { if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload(); },
  goBack() { wx.navigateBack(); },
  dirty() { this.setData({ dirty: true }); if (wx.enableAlertBeforeUnload) wx.enableAlertBeforeUnload({ message: "行程修改尚未保存，确定离开吗？" }); },
  input(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }, () => this.dirty()); },
  date(event) { this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }, () => this.dirty()); },
  status(event) { this.setData({ "form.status": event.currentTarget.dataset.value }, () => this.dirty()); },

  save() {
    try {
      const input = { ...this.data.form, cities: this.data.form.citiesText, budgetTotalCents: tripStore.cents(this.data.form.budgetText) };
      const trip = this.data.mode === "edit" ? tripStore.updateTrip(this.data.id, input) : tripStore.addTrip(input);
      if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
      this.setData({ dirty: false });
      wx.redirectTo({ url: `/pages/trip/detail?id=${trip.id}` });
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }
  }
});
