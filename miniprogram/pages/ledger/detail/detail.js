const {
  DEFAULT_CATEGORIES,
  addExpense,
  calculateLedgerSummary,
  calculateSettlements,
  deleteExpense,
  formatCents,
  getLedgerById,
  parseAmountToCents
} = require("../../../utils/tripLedgerStore");

function buildExpenseForm(ledger) {
  return {
    title: "",
    amount: "",
    payerIndex: 0,
    payerName: ledger.members[0] || "",
    participantValues: ledger.members.slice(),
    categoryIndex: 0,
    categoryName: DEFAULT_CATEGORIES[0],
    paidAt: "",
    note: ""
  };
}

function buildMemberOptions(members, selected) {
  return members.map((member) => ({
    name: member,
    checked: selected.indexOf(member) >= 0
  }));
}

Page({
  data: {
    ledgerId: "",
    ledger: null,
    summary: null,
    settlements: [],
    categories: DEFAULT_CATEGORIES,
    expenseForm: null,
    memberOptions: []
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ ledgerId: options.id });
      this.refreshLedger(options.id);
    }
  },

  onShow() {
    if (this.data.ledgerId) this.refreshLedger(this.data.ledgerId);
  },

  refreshLedger(id) {
    const ledger = getLedgerById(id);
    if (!ledger) {
      wx.showToast({
        title: "账本不存在",
        icon: "none"
      });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    const expenseForm = this.data.expenseForm || buildExpenseForm(ledger);
    this.setData({
      ledger,
      summary: calculateLedgerSummary(ledger),
      settlements: calculateSettlements(ledger),
      expenseForm,
      memberOptions: buildMemberOptions(ledger.members, expenseForm.participantValues)
    });
  },

  editLedger() {
    wx.navigateTo({
      url: `/pages/ledger/edit/edit?id=${this.data.ledgerId}`
    });
  },

  onExpenseInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`expenseForm.${field}`]: event.detail.value
    });
  },

  onPayerChange(event) {
    const payerIndex = Number(event.detail.value || 0);
    this.setData({
      "expenseForm.payerIndex": payerIndex,
      "expenseForm.payerName": this.data.ledger.members[payerIndex] || this.data.ledger.members[0]
    });
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value || 0);
    this.setData({
      "expenseForm.categoryIndex": categoryIndex,
      "expenseForm.categoryName": this.data.categories[categoryIndex] || "其他"
    });
  },

  onPaidAtChange(event) {
    this.setData({
      "expenseForm.paidAt": event.detail.value
    });
  },

  onParticipantsChange(event) {
    const values = event.detail.value || [];
    this.setData({
      "expenseForm.participantValues": values,
      memberOptions: buildMemberOptions(this.data.ledger.members, values)
    });
  },

  resetExpenseForm() {
    const expenseForm = buildExpenseForm(this.data.ledger);
    this.setData({
      expenseForm,
      memberOptions: buildMemberOptions(this.data.ledger.members, expenseForm.participantValues)
    });
  },

  saveExpense() {
    const form = this.data.expenseForm;
    if (!form.title.trim()) {
      wx.showToast({
        title: "先填写支出名称",
        icon: "none"
      });
      return;
    }
    const amountCents = parseAmountToCents(form.amount);
    if (!amountCents || amountCents <= 0) {
      wx.showToast({
        title: "金额需要大于 0",
        icon: "none"
      });
      return;
    }
    if (!form.participantValues.length) {
      wx.showToast({
        title: "至少选择一个平分人",
        icon: "none"
      });
      return;
    }

    addExpense(this.data.ledgerId, {
      title: form.title,
      amountCents,
      payer: this.data.ledger.members[form.payerIndex] || this.data.ledger.members[0],
      participants: form.participantValues,
      category: this.data.categories[form.categoryIndex] || "其他",
      paidAt: form.paidAt,
      note: form.note
    });
    this.resetExpenseForm();
    this.refreshLedger(this.data.ledgerId);
    wx.showToast({
      title: "已记一笔",
      icon: "success"
    });
  },

  removeExpense(event) {
    const expenseId = event.currentTarget.dataset.id;
    wx.showModal({
      title: "删除支出",
      content: "确认删除这笔支出吗？",
      confirmText: "删除",
      confirmColor: "#a34b32",
      success: (res) => {
        if (!res.confirm) return;
        deleteExpense(this.data.ledgerId, expenseId);
        this.refreshLedger(this.data.ledgerId);
      }
    });
  },

  formatAmount(cents) {
    return formatCents(cents);
  }
});
