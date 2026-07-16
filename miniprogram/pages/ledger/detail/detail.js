const ledgerStore = require("../../../utils/repositories/ledgerRepository");
const { PRIVATE_MODE, REDACTED_MODE, exportLedgerImage, exportLedgerJson, exportLedgerPdf } = require("../../../utils/ledgerExport");
const demoMode = require("../../../utils/demoMode");
const departureStore = require("../../../utils/repositories/departureRepository");

const {
  DEFAULT_CATEGORIES,
  SPLIT_MODES,
  addExpense,
  calculateLedgerSummary,
  calculateSettlements,
  deleteExpense,
  formatCents,
  getLedgerById,
  parseAmountToCents,
  updateExpense
} = ledgerStore;

function centsToInput(cents) {
  const value = Number(cents || 0);
  if (!value) return "";
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

function memberObject(member, index) {
  if (typeof member === "string") {
    return { id: member, name: member, status: "active", legacy: true };
  }
  return {
    id: String(member.id || `member_${index}`),
    name: String(member.name || "").trim(),
    status: member.status === "archived" ? "archived" : "active"
  };
}

function getMembers(ledger) {
  return (ledger.members || []).map(memberObject).filter((member) => member.name);
}

function getActiveMemberList(ledger, members) {
  if (ledgerStore.getActiveMembers) {
    return ledgerStore.getActiveMembers(ledger).map(memberObject);
  }
  return members.filter((member) => member.status !== "archived");
}

function findMember(members, idOrName) {
  return members.find((member) => {
    return String(member.id) === String(idOrName) || member.name === idOrName;
  });
}

function expenseMemberIds(expense, members) {
  if (Array.isArray(expense.participantIds)) return expense.participantIds.map(String);
  return (expense.participants || []).map((value) => {
    const member = findMember(members, value);
    return member ? member.id : String(value);
  });
}

function expensePayerId(expense, members) {
  if (expense.payerId) return String(expense.payerId);
  const member = findMember(members, expense.payer);
  return member ? member.id : String(expense.payer || "");
}

function optionMembers(activeMembers, allMembers, referencedIds) {
  const ids = referencedIds || [];
  return allMembers.filter((member) => {
    return activeMembers.some((active) => active.id === member.id) || ids.indexOf(member.id) >= 0;
  });
}

function buildExpenseForm(ledger, members, activeMembers, expense) {
  const payerId = expense
    ? expensePayerId(expense, members)
    : (activeMembers[0] ? activeMembers[0].id : "");
  const participantIds = expense
    ? expenseMemberIds(expense, members)
    : activeMembers.map((member) => member.id);
  const payerOptions = optionMembers(activeMembers, members, payerId ? [payerId] : []);
  const participantMembers = optionMembers(activeMembers, members, participantIds);
  const payerIndex = Math.max(0, payerOptions.findIndex((member) => member.id === payerId));
  const categoryIndex = expense ? Math.max(0, DEFAULT_CATEGORIES.indexOf(expense.category)) : 0;
  const splitMode = expense && expense.splitMode ? expense.splitMode : "equal";
  const allocationMap = ((expense && expense.allocations) || []).reduce((map, item) => {
    map[String(item.memberId)] = item;
    return map;
  }, {});
  const participantCount = participantIds.length;
  const allocationRows = participantMembers.filter((member) => participantIds.indexOf(member.id) >= 0).map((member, index) => {
    const allocation = allocationMap[member.id] || {};
    let value = allocation.inputValue == null ? "" : String(allocation.inputValue);
    if (!value && splitMode === "shares") value = "1";
    if (!value && splitMode === "ratio" && participantCount) {
      const base = Math.floor(10000 / participantCount) / 100;
      value = String(index === participantCount - 1 ? Number((100 - base * (participantCount - 1)).toFixed(2)) : base);
    }
    return { id: member.id, name: member.name, status: member.status, value, shareText: allocation.shareCents == null ? "" : formatCents(allocation.shareCents, ledger.baseCurrency) };
  });
  return {
    id: expense ? expense.id : "",
    title: expense ? expense.title : "",
    amount: expense ? centsToInput(expense.amountCents) : "",
    payerId: payerOptions[payerIndex] ? payerOptions[payerIndex].id : "",
    payerIndex,
    payerName: payerOptions[payerIndex] ? payerOptions[payerIndex].name : "",
    payerOptions,
    participantIds,
    participantMembers,
    splitMode,
    allocationRows,
    categoryIndex,
    categoryName: DEFAULT_CATEGORIES[categoryIndex] || "其他",
    paidAt: expense ? expense.paidAt : "",
    note: expense ? expense.note : ""
  };
}

function buildMemberOptions(members, selectedIds) {
  return members.map((member) => ({
    id: member.id,
    name: member.name,
    status: member.status,
    checked: selectedIds.indexOf(member.id) >= 0
  }));
}

function settlementView(item, members, index, baseCurrency) {
  const fromValue = item.fromMemberId || item.fromId || item.from;
  const toValue = item.toMemberId || item.toId || item.to;
  const from = findMember(members, fromValue) || { id: String(fromValue || ""), name: String(item.fromName || fromValue || "") };
  const to = findMember(members, toValue) || { id: String(toValue || ""), name: String(item.toName || toValue || "") };
  const amountCents = Number(item.amountCents || 0);
  return {
    key: `${from.id}_${to.id}_${index}`,
    fromMemberId: from.id,
    toMemberId: to.id,
    fromName: from.name,
    toName: to.name,
    amountCents,
    amountText: item.amountText || formatCents(amountCents, baseCurrency),
    text: `${from.name} 给 ${to.name} ${item.amountText || formatCents(amountCents, baseCurrency)}`
  };
}

function expenseView(expense, members, baseCurrency) {
  const payer = findMember(members, expensePayerId(expense, members));
  const participants = expenseMemberIds(expense, members).map((id) => findMember(members, id)).filter(Boolean);
  const allocationText = (expense.allocations || []).map((allocation) => {
    const member = findMember(members, allocation.memberId);
    return `${member ? member.name : "未知成员"} ${formatCents(allocation.shareCents, baseCurrency)}`;
  }).join(" · ");
  return Object.assign({}, expense, {
    payerName: payer ? payer.name : "未知成员",
    participantNames: participants.map((member) => member.name).join("、") || "无",
    allocationText,
    splitSummary: expense.splitModeLabel || ((SPLIT_MODES.find((mode) => mode.key === expense.splitMode) || SPLIT_MODES[0]).label),
    archivedHint: (payer && payer.status === "archived") || participants.some((member) => member.status === "archived") ? " · 含归档成员" : ""
  });
}

function transferView(transfer, members, baseCurrency) {
  const fromValue = transfer.fromMemberId || transfer.fromId || transfer.from;
  const toValue = transfer.toMemberId || transfer.toId || transfer.to;
  const from = findMember(members, fromValue);
  const to = findMember(members, toValue);
  const voided = transfer.status === "void" || transfer.status === "voided" || !!transfer.voidedAt;
  const time = transfer.createdAt ? String(transfer.createdAt).replace("T", " ").slice(0, 16) : "";
  return Object.assign({}, transfer, {
    fromName: transfer.fromName || (from ? from.name : String(fromValue || "未知成员")),
    toName: transfer.toName || (to ? to.name : String(toValue || "未知成员")),
    amountText: transfer.amountText || formatCents(transfer.amountCents, baseCurrency),
    time,
    voided,
    statusText: voided ? "已撤销" : "已确认"
  });
}

function summaryMemberViews(summary, members) {
  return (summary.members || []).map((item) => {
    const member = findMember(members, item.memberId || item.id || item.name);
    return Object.assign({}, item, {
      key: String(item.memberId || item.id || item.name),
      name: item.name || (member ? member.name : "未知成员"),
      status: member ? member.status : "active"
    });
  });
}

Page({
  data: {
    ledgerId: "",
    ledger: null,
    members: [],
    activeMembers: [],
    memberCount: 0,
    summary: null,
    summaryMembers: [],
    settlements: [],
    transfers: [],
    expenseViews: [],
    categories: DEFAULT_CATEGORIES,
    splitModes: SPLIT_MODES,
    expenseForm: null,
    memberOptions: [],
    editingExpenseId: "",
    participantSummary: "",
    showExpenseForm: false,
    expenseFormSnapshot: "",
    expenseFormDirty: false,
    pendingTransfer: null,
    remainingText: formatCents(0),
    baseCurrency: ledgerStore.DEFAULT_BASE_CURRENCY,
    currencyLabel: ledgerStore.CURRENCY_OPTIONS[0].label,
    isSettled: true,
    showExportPanel: false,
    exporting: false,
    ledgerTab: "expenses",
    demoActive: false
  },

  onLoad(options) {
    const demoActive = !!(options && options.demo === "ledger" && demoMode.getState().active);
    this.pendingBookingId = String(options && options.bookingId || "");
    this.bookingPrefillApplied = false;
    this.setData({ demoActive });
    if (options && options.id) {
      this.setData({ ledgerId: options.id });
      this.refreshLedger(options.id);
    }
  },

  onShow() {
    if (this.data.ledgerId) this.refreshLedger(this.data.ledgerId);
  },

  onUnload() {
    this.disableLeaveAlert();
  },

  refreshLedger(id) {
    const ledger = getLedgerById(id);
    if (!ledger) {
      wx.showToast({ title: "账本不存在", icon: "none" });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    if (this.data.demoActive) demoMode.markStep("ledger");
    const members = getMembers(ledger);
    const activeMembers = getActiveMemberList(ledger, members);
    const summary = calculateLedgerSummary(ledger);
    const baseCurrency = ledger.baseCurrency || ledgerStore.DEFAULT_BASE_CURRENCY;
    const settlements = (calculateSettlements(ledger) || []).map((item, index) => settlementView(item, members, index, baseCurrency));
    const remainingCents = settlements.reduce((total, item) => total + item.amountCents, 0);
    let expenseForm = this.data.expenseForm;
    if (!expenseForm || !this.data.showExpenseForm) {
      expenseForm = buildExpenseForm(ledger, members, activeMembers, null);
    }
    const participantMembers = optionMembers(activeMembers, members, expenseForm.participantIds);
    expenseForm.participantMembers = participantMembers;
    this.setData({
      ledger,
      members,
      activeMembers,
      memberCount: activeMembers.length,
      baseCurrency,
      currencyLabel: ledger.currencyLabel || baseCurrency,
      summary,
      summaryMembers: summaryMemberViews(summary, members),
      settlements,
      transfers: (ledger.transfers || []).map((item) => transferView(item, members, baseCurrency)),
      expenseViews: (ledger.expenses || []).map((item) => expenseView(item, members, baseCurrency)),
      remainingText: formatCents(remainingCents, baseCurrency),
      isSettled: remainingCents === 0,
      expenseForm,
      memberOptions: buildMemberOptions(participantMembers, expenseForm.participantIds),
      participantSummary: `${expenseForm.participantIds.length}/${participantMembers.length} 人参与`
    }, () => this.applyBookingExpensePrefill());
  },

  applyBookingExpensePrefill() {
    if (this.bookingPrefillApplied || !this.pendingBookingId || !this.data.ledger) return;
    const booking = departureStore.getBookingById(this.pendingBookingId);
    this.bookingPrefillApplied = true;
    if (!booking || booking.ledgerId && booking.ledgerId !== this.data.ledgerId) return;
    if (booking.ledgerExpenseId && (this.data.ledger.expenses || []).some((item) => item.id === booking.ledgerExpenseId)) {
      wx.showToast({ title: "这笔预订已记入账本", icon: "none" });
      return;
    }
    const categoryIndex = Math.max(0, this.data.categories.indexOf(booking.category));
    const form = {
      ...buildExpenseForm(this.data.ledger, this.data.members, this.data.activeMembers, null),
      title: booking.name,
      amount: centsToInput(booking.amountCents),
      categoryIndex,
      categoryName: this.data.categories[categoryIndex] || "其他",
      paidAt: booking.startDate,
      note: booking.bookingReference ? `预订编号：${booking.bookingReference}` : booking.note
    };
    this.setData({
      ledgerTab: "expenses",
      expenseForm: form,
      memberOptions: buildMemberOptions(form.participantMembers, form.participantIds),
      participantSummary: `${form.participantIds.length}/${form.participantMembers.length} 人参与`,
      editingExpenseId: "",
      expenseFormSnapshot: JSON.stringify(form),
      expenseFormDirty: false,
      showExpenseForm: true
    });
    if (wx.pageScrollTo) wx.pageScrollTo({ scrollTop: 260, duration: 180 });
  },

  editLedger() {
    wx.navigateTo({ url: `/pages/ledger/edit/edit?id=${this.data.ledgerId}` });
  },

  onLedgerTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (["expenses", "settlement", "members"].indexOf(tab) >= 0) this.setData({ ledgerTab: tab });
  },

  showLedgerActions() {
    wx.showActionSheet({
      itemList: ["管理成员与账本", "导出单币种结算"],
      success: (result) => {
        if (result.tapIndex === 0) this.editLedger();
        if (result.tapIndex === 1) this.setData({ showExportPanel: true });
      }
    });
  },

  toggleExportPanel() { this.setData({ showExportPanel: !this.data.showExportPanel }); },

  async exportLedger(event) {
    if (this.data.exporting) return;
    const format = event.currentTarget.dataset.format;
    const privacyMode = event.currentTarget.dataset.mode === REDACTED_MODE ? REDACTED_MODE : PRIVATE_MODE;
    this.setData({ exporting: true });
    try {
      let filePath;
      if (format === "image") {
        filePath = await exportLedgerImage({ page: this, ledger: this.data.ledger, privacyMode });
        if (wx.showShareImageMenu) wx.showShareImageMenu({ path: filePath });
        else wx.previewImage({ current: filePath, urls: [filePath] });
      } else if (format === "pdf") {
        filePath = await exportLedgerPdf({ page: this, ledger: this.data.ledger, privacyMode });
        wx.openDocument({ filePath, fileType: "pdf", showMenu: true });
      } else {
        filePath = exportLedgerJson(this.data.ledger, privacyMode);
        if (wx.shareFileMessage) wx.shareFileMessage({ filePath, fileName: `AA账本-${this.data.baseCurrency}-${privacyMode === REDACTED_MODE ? "分享版" : "私人版"}.json` });
        else wx.showToast({ title: "JSON 已生成", icon: "none" });
      }
    } catch (error) { wx.showModal({ title: "导出失败", content: error.message || "请稍后重试", showCancel: false }); }
    finally { this.setData({ exporting: false }); }
  },

  openExpenseForm() {
    this.setData({ ledgerTab: "expenses" });
    if (!this.data.showExpenseForm) {
      const form = buildExpenseForm(this.data.ledger, this.data.members, this.data.activeMembers, null);
      this.setData({
        expenseForm: form,
        memberOptions: buildMemberOptions(form.participantMembers, form.participantIds),
        participantSummary: `${form.participantIds.length}/${form.participantMembers.length} 人参与`,
        editingExpenseId: "",
        expenseFormSnapshot: JSON.stringify(form),
        expenseFormDirty: false,
        showExpenseForm: true
      });
    }
    wx.pageScrollTo({ scrollTop: 260, duration: 180 });
  },

  markExpenseDirty() {
    const dirty = JSON.stringify(this.data.expenseForm) !== this.data.expenseFormSnapshot;
    this.setData({ expenseFormDirty: dirty });
    if (dirty) this.enableLeaveAlert();
    else this.disableLeaveAlert();
  },

  enableLeaveAlert() {
    if (wx.enableAlertBeforeUnload) wx.enableAlertBeforeUnload({ message: "支出尚未保存，确定离开吗？" });
  },

  disableLeaveAlert() {
    if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
  },

  closeExpenseForm() {
    if (!this.data.expenseFormDirty) return this.discardExpenseForm();
    wx.showModal({
      title: "放弃未保存内容？",
      content: "收起后，本次填写的支出内容不会保留。",
      confirmText: "放弃",
      confirmColor: "#a34b32",
      success: (res) => {
        if (res.confirm) this.discardExpenseForm();
      }
    });
  },

  discardExpenseForm() {
    const form = buildExpenseForm(this.data.ledger, this.data.members, this.data.activeMembers, null);
    this.disableLeaveAlert();
    this.setData({
      showExpenseForm: false,
      editingExpenseId: "",
      expenseForm: form,
      expenseFormSnapshot: JSON.stringify(form),
      expenseFormDirty: false,
      memberOptions: buildMemberOptions(form.participantMembers, form.participantIds),
      participantSummary: `${form.participantIds.length}/${form.participantMembers.length} 人参与`
    });
  },

  onExpenseInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`expenseForm.${field}`]: event.detail.value }, () => this.markExpenseDirty());
  },

  rebuildAllocationRows(mode, selectedIds, preserve) {
    const current = preserve ? (this.data.expenseForm.allocationRows || []).reduce((map, row) => { map[row.id] = row; return map; }, {}) : {};
    const members = this.data.expenseForm.participantMembers.filter((member) => selectedIds.indexOf(member.id) >= 0);
    const count = members.length;
    return members.map((member, index) => {
      const existing = current[member.id];
      if (existing) return { ...existing, name: member.name, status: member.status };
      let value = "";
      if (mode === "shares") value = "1";
      if (mode === "ratio" && count) {
        const base = Math.floor(10000 / count) / 100;
        value = String(index === count - 1 ? Number((100 - base * (count - 1)).toFixed(2)) : base);
      }
      return { id: member.id, name: member.name, status: member.status, value, shareText: "" };
    });
  },

  onSplitModeTap(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!SPLIT_MODES.some((item) => item.key === mode) || mode === this.data.expenseForm.splitMode) return;
    const rows = this.rebuildAllocationRows(mode, this.data.expenseForm.participantIds, false);
    this.setData({ "expenseForm.splitMode": mode, "expenseForm.allocationRows": rows }, () => this.markExpenseDirty());
  },

  onAllocationInput(event) {
    const memberId = String(event.currentTarget.dataset.id);
    const rows = this.data.expenseForm.allocationRows.map((row) => row.id === memberId ? { ...row, value: event.detail.value } : row);
    this.setData({ "expenseForm.allocationRows": rows }, () => this.markExpenseDirty());
  },

  onPayerChange(event) {
    const payerIndex = Number(event.detail.value || 0);
    const payer = this.data.expenseForm.payerOptions[payerIndex];
    this.setData({
      "expenseForm.payerIndex": payerIndex,
      "expenseForm.payerId": payer ? payer.id : "",
      "expenseForm.payerName": payer ? payer.name : ""
    }, () => this.markExpenseDirty());
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value || 0);
    this.setData({
      "expenseForm.categoryIndex": categoryIndex,
      "expenseForm.categoryName": this.data.categories[categoryIndex] || "其他"
    }, () => this.markExpenseDirty());
  },

  onPaidAtChange(event) {
    this.setData({ "expenseForm.paidAt": event.detail.value }, () => this.markExpenseDirty());
  },

  onParticipantsChange(event) {
    const ids = (event.detail.value || []).map(String);
    const allocationRows = this.rebuildAllocationRows(this.data.expenseForm.splitMode, ids, true);
    this.setData({
      "expenseForm.participantIds": ids,
      "expenseForm.allocationRows": allocationRows,
      memberOptions: buildMemberOptions(this.data.expenseForm.participantMembers, ids),
      participantSummary: `${ids.length}/${this.data.expenseForm.participantMembers.length} 人参与`
    }, () => this.markExpenseDirty());
  },

  selectAllParticipants() {
    const ids = this.data.expenseForm.participantMembers.map((member) => member.id);
    const allocationRows = this.rebuildAllocationRows(this.data.expenseForm.splitMode, ids, true);
    this.setData({
      "expenseForm.participantIds": ids,
      "expenseForm.allocationRows": allocationRows,
      memberOptions: buildMemberOptions(this.data.expenseForm.participantMembers, ids),
      participantSummary: `${ids.length}/${ids.length} 人参与`
    }, () => this.markExpenseDirty());
  },

  clearParticipants() {
    this.setData({
      "expenseForm.participantIds": [],
      "expenseForm.allocationRows": [],
      memberOptions: buildMemberOptions(this.data.expenseForm.participantMembers, []),
      participantSummary: `0/${this.data.expenseForm.participantMembers.length} 人参与`
    }, () => this.markExpenseDirty());
  },

  saveExpense() {
    const form = this.data.expenseForm;
    const amountCents = parseAmountToCents(form.amount);
    if (!String(form.title || "").trim()) {
      wx.showToast({ title: "先填写支出名称", icon: "none" });
      return;
    }
    if (amountCents <= 0) {
      wx.showToast({ title: "金额需要大于 0", icon: "none" });
      return;
    }
    if (!form.payerId || !form.participantIds.length) {
      wx.showToast({ title: "请选择付款人和参与人", icon: "none" });
      return;
    }
    const payload = {
      title: form.title,
      amountCents,
      payerId: form.payerId,
      participantIds: form.participantIds,
      splitMode: form.splitMode,
      allocations: form.allocationRows.map((row) => ({ memberId: row.id, inputValue: row.value })),
      category: this.data.categories[form.categoryIndex] || "其他",
      paidAt: form.paidAt,
      note: form.note
    };
    const wasEditing = !!this.data.editingExpenseId;
    let savedExpense;
    try {
      if (wasEditing) savedExpense = updateExpense(this.data.ledgerId, this.data.editingExpenseId, payload);
      else savedExpense = addExpense(this.data.ledgerId, payload);
    } catch (error) {
      wx.showToast({ title: error.message || "支出保存失败", icon: "none" });
      return;
    }
    if (!wasEditing && this.pendingBookingId && savedExpense) {
      departureStore.updateBooking(this.pendingBookingId, { ledgerId: this.data.ledgerId, ledgerExpenseId: savedExpense.id });
      this.pendingBookingId = "";
    }
    this.disableLeaveAlert();
    this.setData({ showExpenseForm: false, expenseFormDirty: false, editingExpenseId: "" });
    this.refreshLedger(this.data.ledgerId);
    wx.showToast({ title: wasEditing ? "已更新" : "已记一笔", icon: "success" });
  },

  editExpense(event) {
    const expense = this.data.ledger.expenses.find((item) => String(item.id) === String(event.currentTarget.dataset.id));
    if (!expense) return;
    const form = buildExpenseForm(this.data.ledger, this.data.members, this.data.activeMembers, expense);
    this.setData({
      expenseForm: form,
      editingExpenseId: expense.id,
      showExpenseForm: true,
      expenseFormSnapshot: JSON.stringify(form),
      expenseFormDirty: false,
      memberOptions: buildMemberOptions(form.participantMembers, form.participantIds),
      participantSummary: `${form.participantIds.length}/${form.participantMembers.length} 人参与`
    });
    wx.pageScrollTo({ scrollTop: 260, duration: 200 });
  },

  removeExpense(event) {
    const expenseId = event.currentTarget.dataset.id;
    wx.showModal({
      title: "删除支出",
      content: "确认删除这笔支出吗？结算建议会随之更新。",
      confirmText: "删除",
      confirmColor: "#a34b32",
      success: (res) => {
        if (!res.confirm) return;
        deleteExpense(this.data.ledgerId, expenseId);
        this.refreshLedger(this.data.ledgerId);
      }
    });
  },

  openTransfer(event) {
    const item = this.data.settlements[Number(event.currentTarget.dataset.index)];
    if (!item) return;
    this.setData({
      pendingTransfer: Object.assign({}, item, { amount: centsToInput(item.amountCents) })
    });
  },

  onTransferAmountInput(event) {
    this.setData({ "pendingTransfer.amount": event.detail.value });
  },

  cancelTransfer() {
    this.setData({ pendingTransfer: null });
  },

  confirmTransfer() {
    const transfer = this.data.pendingTransfer;
    const amountCents = parseAmountToCents(transfer && transfer.amount);
    if (!transfer || amountCents <= 0 || amountCents > transfer.amountCents) {
      wx.showToast({ title: "请输入不超过建议额的金额", icon: "none" });
      return;
    }
    if (!ledgerStore.addTransfer) {
      wx.showToast({ title: "转账接口尚未就绪", icon: "none" });
      return;
    }
    try {
      ledgerStore.addTransfer(this.data.ledgerId, {
        fromMemberId: transfer.fromMemberId,
        toMemberId: transfer.toMemberId,
        amountCents
      });
    } catch (error) {
      wx.showToast({ title: error.message || "转账确认失败", icon: "none" });
      this.refreshLedger(this.data.ledgerId);
      return;
    }
    this.setData({ pendingTransfer: null });
    this.refreshLedger(this.data.ledgerId);
    wx.showToast({ title: "转账已确认", icon: "success" });
  },

  voidTransfer(event) {
    const transferId = event.currentTarget.dataset.id;
    wx.showModal({
      title: "撤销转账",
      content: "撤销后该金额会重新计入待结算。",
      confirmText: "撤销",
      confirmColor: "#a34b32",
      success: (res) => {
        if (!res.confirm) return;
        if (!ledgerStore.voidTransfer) {
          wx.showToast({ title: "转账接口尚未就绪", icon: "none" });
          return;
        }
        ledgerStore.voidTransfer(this.data.ledgerId, transferId);
        this.refreshLedger(this.data.ledgerId);
        wx.showToast({ title: "已撤销", icon: "none" });
      }
    });
  },

  copySettlementText() {
    const recommendation = this.data.settlements.length
      ? this.data.settlements.map((item) => item.text).join("\n")
      : "账目已结清，无需转账";
    const history = this.data.transfers.length
      ? this.data.transfers.map((item) => `${item.fromName} 给 ${item.toName} ${item.amountText}（${item.statusText}）`).join("\n")
      : "暂无结算记录";
    wx.setClipboardData({
      data: `${this.data.ledger.title}\n单币种 ${this.data.baseCurrency} · 金额按原值记录 · 未进行汇率换算\n${this.data.isSettled ? "已结清" : `剩余待结算 ${this.data.remainingText}`}\n\n结算建议\n${recommendation}\n\n结算历史\n${history}`
    });
  }
});
