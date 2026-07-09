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

Page({
  data: {
    mode: "create",
    ledgerId: "",
    newMemberName: "",
    form: {
      title: "",
      city: "",
      startDate: "",
      endDate: "",
      members: ["我"],
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
        members: ledger.members,
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

  onNewMemberInput(event) {
    this.setData({
      newMemberName: event.detail.value
    });
  },

  addMember() {
    const name = String(this.data.newMemberName || "").trim();
    if (!name) {
      wx.showToast({
        title: "先填写成员名",
        icon: "none"
      });
      return;
    }
    if (this.data.form.members.indexOf(name) >= 0) {
      wx.showToast({
        title: "成员已存在",
        icon: "none"
      });
      this.setData({ newMemberName: "" });
      return;
    }
    this.setData({
      "form.members": this.data.form.members.concat(name),
      newMemberName: ""
    });
  },

  removeMember(event) {
    const name = event.currentTarget.dataset.name;
    if (this.data.form.members.length <= 1) {
      wx.showToast({
        title: "至少保留一个成员",
        icon: "none"
      });
      return;
    }
    this.setData({
      "form.members": this.data.form.members.filter((member) => member !== name)
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
    const members = parseMembers(this.data.form.members.join("\n"));
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
