const ledgerStore = require("../../../utils/repositories/ledgerRepository");

function memberCount(ledger) {
  return (ledger.members || []).filter((member) => {
    return typeof member === "string" || member.status !== "archived";
  }).length;
}

function buildListItem(ledger) {
  const summary = ledgerStore.calculateLedgerSummary(ledger);
  const settlements = ledgerStore.calculateSettlements(ledger) || [];
  const remainingCents = settlements.reduce((total, item) => total + Number(item.amountCents || 0), 0);
  const expenseCount = summary.expenseCount;
  const status = expenseCount === 0 ? "empty" : remainingCents > 0 ? "active" : "settled";
  return Object.assign({}, ledger, {
    totalCents: summary.totalCents,
    totalText: summary.totalText,
    expenseCount,
    memberCount: memberCount(ledger),
    settlementCount: settlements.length,
    remainingCents,
    remainingText: ledgerStore.formatCents(remainingCents),
    status,
    statusText: status === "empty" ? "未记账" : status === "active" ? "进行中" : "已结清"
  });
}

Page({
  data: {
    ledgers: [],
    totalCount: 0,
    activeCount: 0,
    settledCount: 0,
    totalSpentText: "¥0.00"
  },

  onShow() {
    this.refreshLedgers();
  },

  refreshLedgers() {
    const source = ledgerStore.getLedgers
      ? ledgerStore.getLedgers()
      : ledgerStore.getLedgerListItems();
    const ledgers = source.map(buildListItem);
    const activeCount = ledgers.filter((item) => item.status === "active").length;
    const settledCount = ledgers.filter((item) => item.status === "settled").length;
    this.setData({
      ledgers,
      totalCount: ledgers.length,
      activeCount,
      settledCount,
      totalSpentText: ledgerStore.formatCents(ledgers.reduce((sum, item) => sum + item.totalCents, 0))
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

  manageLedger(event) {
    const id = event.currentTarget.dataset.id;
    wx.showActionSheet({ itemList: ["编辑账本", "删除账本"], success: (result) => { if (result.tapIndex === 0) this.editLedger({ currentTarget: { dataset: { id } } }); else this.confirmRemoveLedger(id); } });
  },

  confirmRemoveLedger(id) {
    wx.showModal({ title: "删除账本", content: "删除后会同时删除支出与结算记录，确认继续吗？", confirmText: "删除", confirmColor: "#a34b32", success: (result) => { if (!result.confirm) return; ledgerStore.deleteLedger(id); this.refreshLedgers(); wx.showToast({ title: "已删除", icon: "none" }); } });
  },

  removeLedger(event) {
    const id = event.currentTarget.dataset.id;
    this.confirmRemoveLedger(id);
  }
});
