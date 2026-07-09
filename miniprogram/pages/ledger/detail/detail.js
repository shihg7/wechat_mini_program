const {
  DEFAULT_CATEGORIES,
  addExpense,
  calculateLedgerSummary,
  calculateSettlements,
  deleteExpense,
  formatCents,
  getLedgerById,
  parseAmountToCents,
  updateExpense
} = require("../../../utils/tripLedgerStore");

function centsToInput(cents) {
  const value = Number(cents || 0);
  if (!value) return "";
  const yuan = Math.floor(value / 100);
  const cent = String(value % 100).padStart(2, "0");
  return `${yuan}.${cent}`;
}

function buildExpenseForm(ledger, expense = null) {
  const payerIndex = expense ? Math.max(0, ledger.members.indexOf(expense.payer)) : 0;
  const categoryIndex = expense ? Math.max(0, DEFAULT_CATEGORIES.indexOf(expense.category)) : 0;
  return {
    id: expense ? expense.id : "",
    title: expense ? expense.title : "",
    amount: expense ? centsToInput(expense.amountCents) : "",
    payerIndex,
    payerName: ledger.members[payerIndex] || "",
    participantValues: expense ? expense.participants.slice() : ledger.members.slice(),
    categoryIndex,
    categoryName: DEFAULT_CATEGORIES[categoryIndex] || "其他",
    paidAt: expense ? expense.paidAt : "",
    note: expense ? expense.note : ""
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
    memberOptions: [],
    editingExpenseId: "",
    participantSummary: ""
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
      memberOptions: buildMemberOptions(ledger.members, expenseForm.participantValues),
      participantSummary: `${expenseForm.participantValues.length}/${ledger.members.length} 人参与`
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
      memberOptions: buildMemberOptions(this.data.ledger.members, values),
      participantSummary: `${values.length}/${this.data.ledger.members.length} 人参与`
    });
  },

  selectAllParticipants() {
    const values = this.data.ledger.members.slice();
    this.setData({
      "expenseForm.participantValues": values,
      memberOptions: buildMemberOptions(this.data.ledger.members, values),
      participantSummary: `${values.length}/${this.data.ledger.members.length} 人参与`
    });
  },

  clearParticipants() {
    this.setData({
      "expenseForm.participantValues": [],
      memberOptions: buildMemberOptions(this.data.ledger.members, []),
      participantSummary: `0/${this.data.ledger.members.length} 人参与`
    });
  },

  resetExpenseForm() {
    const expenseForm = buildExpenseForm(this.data.ledger);
    this.setData({
      expenseForm,
      editingExpenseId: "",
      memberOptions: buildMemberOptions(this.data.ledger.members, expenseForm.participantValues),
      participantSummary: `${expenseForm.participantValues.length}/${this.data.ledger.members.length} 人参与`
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

    const payload = {
      title: form.title,
      amountCents,
      payer: this.data.ledger.members[form.payerIndex] || this.data.ledger.members[0],
      participants: form.participantValues,
      category: this.data.categories[form.categoryIndex] || "其他",
      paidAt: form.paidAt,
      note: form.note
    };
    const wasEditing = !!this.data.editingExpenseId;
    if (wasEditing) {
      updateExpense(this.data.ledgerId, this.data.editingExpenseId, payload);
    } else {
      addExpense(this.data.ledgerId, payload);
    }
    this.resetExpenseForm();
    this.refreshLedger(this.data.ledgerId);
    wx.showToast({
      title: wasEditing ? "已更新" : "已记一笔",
      icon: "success"
    });
  },

  editExpense(event) {
    const expenseId = event.currentTarget.dataset.id;
    const expense = this.data.ledger.expenses.find((item) => String(item.id) === String(expenseId));
    if (!expense) return;
    const expenseForm = buildExpenseForm(this.data.ledger, expense);
    this.setData({
      expenseForm,
      editingExpenseId: expense.id,
      memberOptions: buildMemberOptions(this.data.ledger.members, expenseForm.participantValues),
      participantSummary: `${expenseForm.participantValues.length}/${this.data.ledger.members.length} 人参与`
    });
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 200
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
