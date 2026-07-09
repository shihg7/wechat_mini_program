const {
  deleteLedger,
  getLedgerListItems
} = require("../../../utils/tripLedgerStore");

Page({
  data: {
    ledgers: [],
    totalCount: 0
  },

  onShow() {
    this.refreshLedgers();
  },

  refreshLedgers() {
    const ledgers = getLedgerListItems();
    this.setData({
      ledgers,
      totalCount: ledgers.length
    });
  },

  createLedger() {
    wx.navigateTo({
      url: "/pages/ledger/edit/edit"
    });
  },

  goDetail(event) {
    wx.navigateTo({
      url: `/pages/ledger/detail/detail?id=${event.currentTarget.dataset.id}`
    });
  },

  editLedger(event) {
    wx.navigateTo({
      url: `/pages/ledger/edit/edit?id=${event.currentTarget.dataset.id}`
    });
  },

  removeLedger(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: "删除账本",
      content: "删除后会同时删除支出明细，确认继续吗？",
      confirmText: "删除",
      confirmColor: "#a34b32",
      success: (res) => {
        if (!res.confirm) return;
        deleteLedger(id);
        this.refreshLedgers();
        wx.showToast({
          title: "已删除",
          icon: "none"
        });
      }
    });
  }
});
