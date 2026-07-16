const tripStore = require("../../utils/repositories/tripRepository");
const { formatCents, getLedgers } = require("../../utils/repositories/ledgerRepository");

Page({
  data: { id: "", trip: null, summary: null, missing: false, ledgers: [], editingExpenseId: "", expense: { title: "", amountText: "", category: "餐饮", date: "", currency: "CNY", rate: "1", note: "" }, categories: tripStore.CATEGORIES },
  onLoad(options = {}) { this.setData({ id: options.id || "" }); },
  onShow() { this.load(); },
  load() {
    const trip = tripStore.getTripById(this.data.id);
    if (!trip) { if (!this.data.missing) wx.showToast({ title: "行程不存在", icon: "none" }); this.setData({ trip: null, summary: null, missing: true }); return; }
    const ledgers = getLedgers();
    const summary = tripStore.calculateBudget(trip, ledgers);
    summary.byCategory = summary.byCategory.map((row) => ({ ...row, budgetInput: row.budgetCents ? String(row.budgetCents / 100) : "" }));
    this.setData({ trip, summary, missing: false, ledgers: ledgers.map((ledger) => { const expenses = ledger.expenses || []; const amountCents = expenses.reduce((sum, expense) => sum + Number(expense.amountCents || 0), 0); const linked = trip.linkedLedgerIds.indexOf(ledger.id) >= 0; const compatible = String(ledger.baseCurrency || "CNY").toUpperCase() === trip.baseCurrency; return { ...ledger, linked, compatible, ignored: linked && !compatible, expenseCount: expenses.length, amountText: formatCents(amountCents, ledger.baseCurrency) }; }), "expense.currency": trip.baseCurrency, "expense.date": this.data.expense.date || trip.startDate });
  },
  goBack() { wx.navigateBack(); },
  input(event) { this.setData({ [`expense.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  expenseDate(event) { this.setData({ "expense.date": event.detail.value }); },
  category(event) { this.setData({ "expense.category": event.currentTarget.dataset.value }); },
  setCategoryBudget(event) { const category = event.currentTarget.dataset.category; tripStore.updateTrip(this.data.id, { categoryBudgets: { ...this.data.trip.categoryBudgets, [category]: tripStore.cents(event.detail.value) } }); this.load(); },
  toggleLedger(event) { const ledgerId = event.currentTarget.dataset.id; const ledger = this.data.ledgers.find((item) => item.id === ledgerId); const ids = this.data.trip.linkedLedgerIds.slice(); const index = ids.indexOf(ledgerId); if (index >= 0) ids.splice(index, 1); else if (ledger && !ledger.compatible) { wx.showToast({ title: "账本币种与行程不一致", icon: "none" }); return; } else ids.push(ledgerId); tripStore.updateTrip(this.data.id, { linkedLedgerIds: ids }); this.load(); },
  editExpense(event) { const item = this.data.trip.personalExpenses.find((expense) => expense.id === event.currentTarget.dataset.id); if (!item) return; this.setData({ editingExpenseId: item.id, expense: { title: item.title, amountText: String(item.originalAmountCents / 100), category: item.category, date: item.date, currency: item.currency, rate: String(item.rate), note: item.note } }); },
  cancelExpenseEdit() { this.setData({ editingExpenseId: "", expense: { title: "", amountText: "", category: "餐饮", date: this.data.trip.startDate, currency: this.data.trip.baseCurrency, rate: "1", note: "" } }); },
  addExpense() { try { if (this.data.editingExpenseId) tripStore.updatePersonalExpense(this.data.id, this.data.editingExpenseId, this.data.expense); else tripStore.addPersonalExpense(this.data.id, this.data.expense); const message = this.data.editingExpenseId ? "支出已更新" : "支出已记录"; this.cancelExpenseEdit(); this.load(); wx.showToast({ title: message, icon: "success" }); } catch (error) { wx.showToast({ title: error.message, icon: "none" }); } },
  removeExpense(event) { wx.showModal({ title: "删除个人支出", content: "删除后预算统计会立即更新。", confirmText: "删除", confirmColor: "#a34b32", success: (result) => { if (!result.confirm) return; tripStore.removePersonalExpense(this.data.id, event.currentTarget.dataset.id); this.load(); wx.showToast({ title: "已删除", icon: "success" }); } }); }
});
