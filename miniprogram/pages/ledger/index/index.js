const ledgerStore = require("../../../utils/tripLedgerStore");

function memberCount(ledger) {
  return (ledger.members || []).filter((member) => {
    return typeof member === "string" || member.status !== "archived";
  }).length;
}

function buildListItem(ledger) {
  const summary = ledgerStore.calculateLedgerSummary(ledger);
  const settlements = ledgerStore.calculateSettlements(ledger) || [];
  const remainingCents = settlements.reduce((total, item) => total + Number(item.amountCents || 0), 0);
  return Object.assign({}, ledger, {
    totalText: summary.totalText,
    expenseCount: summary.expenseCount,
    memberCount: memberCount(ledger),
    settlementCount: settlements.length,
    remainingCents,
    remainingText: ledgerStore.formatCents(remainingCents),
    status: remainingCents > 0 ? "active" : "settled",
    statusText: remainingCents > 0 ? "进行中" : "已结清"
  });
}

Page({
  data: {
    ledgers: [],
    totalCount: 0,
    activeCount: 0,
    settledCount: 0
  },

  onShow() {
    this.refreshLedgers();
  },

  refreshLedgers() {
    const source = ledgerStore.getLedgers
      ? ledgerStore.getLedgers()
      : ledgerStore.getLedgerListItems();
    const ledgers = source.map(buildListItem);
    const settledCount = ledgers.filter((item) => item.status === "settled").length;
    this.setData({
      ledgers,
      totalCount: ledgers.length,
      activeCount: ledgers.length - settledCount,
      settledCount
    });
  },

  createLedger() {
    wx.navigateTo({ url: "/pages/ledger/edit/edit" });
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
      content: "删除后会同时删除支出与结算记录，确认继续吗？",
      confirmText: "删除",
      confirmColor: "#a34b32",
      success: (res) => {
        if (!res.confirm) return;
        ledgerStore.deleteLedger(id);
        this.refreshLedgers();
        wx.showToast({ title: "已删除", icon: "none" });
      }
    });
  }
});
