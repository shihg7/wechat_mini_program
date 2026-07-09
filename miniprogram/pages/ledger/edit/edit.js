const {
  addLedger,
  getLedgerById,
  updateLedger
} = require("../../../utils/tripLedgerStore");

function parseMembers(text) {
  return String(text || "")
    .split(/[\n,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((result, name) => {
      if (result.indexOf(name) < 0) result.push(name);
      return result;
    }, []);
}

function membersToText(members) {
  return (members || []).join("\n");
}

Page({
  data: {
    mode: "create",
    ledgerId: "",
    form: {
      title: "",
      city: "",
      startDate: "",
      endDate: "",
      membersText: "我\n朋友A\n朋友B",
      note: ""
    }
  },

  onLoad(options) {
    if (options && options.id) {
      this.loadLedger(options.id);
    }
  },

  loadLedger(id) {
    const ledger = getLedgerById(id);
    if (!ledger) {
      wx.showToast({
        title: "账本不存在",
        icon: "none"
      });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    this.setData({
      mode: "edit",
      ledgerId: ledger.id,
      form: {
        title: ledger.title,
        city: ledger.city,
        startDate: ledger.startDate,
        endDate: ledger.endDate,
        membersText: membersToText(ledger.members),
        note: ledger.note
      }
    });
  },

  onFieldInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },

  onStartDateChange(event) {
    this.setData({
      "form.startDate": event.detail.value
    });
  },

  onEndDateChange(event) {
    this.setData({
      "form.endDate": event.detail.value
    });
  },

  saveLedger() {
    const members = parseMembers(this.data.form.membersText);
    if (!this.data.form.title.trim()) {
      wx.showToast({
        title: "先填写账本名称",
        icon: "none"
      });
      return;
    }
    if (!members.length) {
      wx.showToast({
        title: "至少填写一个成员",
        icon: "none"
      });
      return;
    }

    const payload = {
      title: this.data.form.title,
      city: this.data.form.city,
      startDate: this.data.form.startDate,
      endDate: this.data.form.endDate,
      members,
      note: this.data.form.note
    };

    if (this.data.mode === "edit") {
      updateLedger(this.data.ledgerId, payload);
      wx.showToast({
        title: "已更新",
        icon: "success"
      });
      setTimeout(() => wx.navigateBack(), 450);
      return;
    }

    const ledger = addLedger(payload);
    wx.showToast({
      title: "已创建",
      icon: "success"
    });
    setTimeout(() => {
      wx.redirectTo({
        url: `/pages/ledger/detail/detail?id=${ledger.id}`
      });
    }, 450);
  }
});
