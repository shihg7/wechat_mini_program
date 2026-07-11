const tripStore = require("../../utils/tripStore");
const { getLedgers } = require("../../utils/repositories/ledgerRepository");

Page({
  data: { id: "", trip: null, summary: null, ledgers: [], expense: { title: "", amountText: "", category: "餐饮", date: "", currency: "CNY", rate: "1", note: "" }, categories: tripStore.CATEGORIES },
  onLoad(options) { this.setData({ id: options.id || "" }); },
  onShow() { this.load(); },
  load() {
    const trip = tripStore.getTripById(this.data.id);
    const ledgers = getLedgers();
    const summary = tripStore.calculateBudget(trip, ledgers);
    summary.byCategory = summary.byCategory.map((row) => ({ ...row, budgetInput: row.budgetCents ? String(row.budgetCents / 100) : "" }));
    this.setData({ trip, summary, ledgers: ledgers.map((ledger) => { const expenses = ledger.expenses || []; const amountCents = expenses.reduce((sum, expense) => sum + Number(expense.amountCents || 0), 0); return { ...ledger, linked: trip.linkedLedgerIds.indexOf(ledger.id) >= 0, expenseCount: expenses.length, amountText: tripStore.money(amountCents) }; }), "expense.currency": trip.baseCurrency, "expense.date": this.data.expense.date || trip.startDate });
  },
  input(event) { this.setData({ [`expense.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  expenseDate(event) { this.setData({ "expense.date": event.detail.value }); },
  category(event) { this.setData({ "expense.category": event.currentTarget.dataset.value }); },
  setCategoryBudget(event) { const category = event.currentTarget.dataset.category; tripStore.updateTrip(this.data.id, { categoryBudgets: { ...this.data.trip.categoryBudgets, [category]: tripStore.cents(event.detail.value) } }); this.load(); },
  toggleLedger(event) { const ledgerId = event.currentTarget.dataset.id; const ids = this.data.trip.linkedLedgerIds.slice(); const index = ids.indexOf(ledgerId); if (index >= 0) ids.splice(index, 1); else ids.push(ledgerId); tripStore.updateTrip(this.data.id, { linkedLedgerIds: ids }); this.load(); },
  addExpense() { try { tripStore.addPersonalExpense(this.data.id, this.data.expense); this.setData({ expense: { title: "", amountText: "", category: "餐饮", date: this.data.trip.startDate, currency: this.data.trip.baseCurrency, rate: "1", note: "" } }); this.load(); } catch (error) { wx.showToast({ title: error.message, icon: "none" }); } },
  removeExpense(event) { tripStore.removePersonalExpense(this.data.id, event.currentTarget.dataset.id); this.load(); }
});
