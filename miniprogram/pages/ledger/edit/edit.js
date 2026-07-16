const ledgerStore = require("../../../utils/repositories/ledgerRepository");
const CURRENCY_OPTIONS = ledgerStore.CURRENCY_OPTIONS;

function currencyIndex(baseCurrency) {
  const index = CURRENCY_OPTIONS.findIndex((item) => item.code === baseCurrency);
  return index < 0 ? 0 : index;
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

function normalizeMembers(members) {
  return (members || []).map(memberObject).filter((member) => member.name);
}

function createLocalMember(name) {
  return {
    id: `member_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    name,
    status: "active"
  };
}

Page({
  data: {
    mode: "create",
    ledgerId: "",
    newMemberName: "",
    currencyOptions: CURRENCY_OPTIONS,
    currencyIndex: 0,
    selectedCurrencyLabel: CURRENCY_OPTIONS[0].label,
    hasMoneyRecords: false,
    hasUnsavedChanges: false,
    originalForm: "",
    form: {
      title: "",
      city: "",
      startDate: "",
      endDate: "",
      baseCurrency: ledgerStore.DEFAULT_BASE_CURRENCY,
      members: [createLocalMember("我")],
      note: ""
    }
  },

  onLoad(options) {
    if (options && options.id) {
      this.loadLedger(options.id);
      return;
    }
    this.rememberForm();
  },

  onUnload() {
    this.disableLeaveAlert();
  },

  rememberForm() {
    this.setData({
      originalForm: JSON.stringify(this.data.form),
      hasUnsavedChanges: false
    });
    this.disableLeaveAlert();
  },

  markDirty() {
    const changed = JSON.stringify(this.data.form) !== this.data.originalForm;
    this.setData({ hasUnsavedChanges: changed });
    if (changed) this.enableLeaveAlert();
    else this.disableLeaveAlert();
  },

  enableLeaveAlert() {
    if (!wx.enableAlertBeforeUnload) return;
    wx.enableAlertBeforeUnload({ message: "账本修改尚未保存，确定离开吗？" });
  },

  disableLeaveAlert() {
    if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
  },

  loadLedger(id) {
    const ledger = ledgerStore.getLedgerById(id);
    if (!ledger) {
      wx.showToast({ title: "账本不存在", icon: "none" });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    const form = {
      title: ledger.title,
      city: ledger.city,
      startDate: ledger.startDate,
      endDate: ledger.endDate,
      baseCurrency: ledger.baseCurrency,
      members: normalizeMembers(ledger.members),
      note: ledger.note
    };
    this.setData({
      mode: "edit",
      ledgerId: ledger.id,
      form,
      currencyIndex: currencyIndex(form.baseCurrency),
      selectedCurrencyLabel: CURRENCY_OPTIONS[currencyIndex(form.baseCurrency)].label,
      hasMoneyRecords: !!((ledger.expenses || []).length || (ledger.transfers || []).length),
      originalForm: JSON.stringify(form),
      hasUnsavedChanges: false
    });
    this.disableLeaveAlert();
  },

  onFieldInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value }, () => this.markDirty());
  },

  onNewMemberInput(event) {
    this.setData({ newMemberName: event.detail.value });
  },

  addMember() {
    const name = String(this.data.newMemberName || "").trim();
    if (!name) {
      wx.showToast({ title: "先填写成员名", icon: "none" });
      return;
    }
    if (this.data.form.members.some((member) => member.name === name)) {
      wx.showToast({ title: "成员已存在", icon: "none" });
      return;
    }
    if (this.data.mode === "edit" && ledgerStore.addLedgerMember) {
      const updated = ledgerStore.addLedgerMember(this.data.ledgerId, name);
      if (!updated) {
        wx.showToast({ title: "添加失败", icon: "none" });
        return;
      }
      this.syncPersistedMembers(updated);
      return;
    }
    this.setData({
      "form.members": this.data.form.members.concat(createLocalMember(name)),
      newMemberName: ""
    }, () => this.markDirty());
  },

  syncPersistedMembers(updatedLedger) {
    const members = normalizeMembers(updatedLedger.members);
    const original = this.data.originalForm ? JSON.parse(this.data.originalForm) : this.data.form;
    original.members = members;
    this.setData({
      "form.members": members,
      newMemberName: "",
      originalForm: JSON.stringify(original)
    }, () => this.markDirty());
  },

  renameMember(event) {
    const id = event.currentTarget.dataset.id;
    const member = this.data.form.members.find((item) => String(item.id) === String(id));
    if (!member) return;
    wx.showModal({
      title: "修改成员名",
      editable: true,
      placeholderText: "成员名",
      content: member.name,
      success: (res) => {
        if (!res.confirm) return;
        const name = String(res.content || "").trim();
        if (!name || this.data.form.members.some((item) => item.id !== member.id && item.name === name)) {
          wx.showToast({ title: name ? "成员名已存在" : "成员名不能为空", icon: "none" });
          return;
        }
        if (this.data.mode === "create") {
          const members = this.data.form.members.map((item) => {
            return item.id === member.id ? Object.assign({}, item, { name }) : item;
          });
          this.setData({ "form.members": members }, () => this.markDirty());
          return;
        }
        if (!ledgerStore.updateLedgerMember) return this.showContractToast();
        const updated = ledgerStore.updateLedgerMember(this.data.ledgerId, member.id, { name });
        if (updated) this.syncPersistedMembers(updated);
      }
    });
  },

  archiveMember(event) {
    const id = event.currentTarget.dataset.id;
    const member = this.data.form.members.find((item) => String(item.id) === String(id));
    if (!member) return;
    const activeCount = this.data.form.members.filter((item) => item.status !== "archived").length;
    if (activeCount <= 1) {
      wx.showToast({ title: "至少保留一位当前成员", icon: "none" });
      return;
    }
    wx.showModal({
      title: "归档成员",
      content: `归档 ${member.name} 后，新支出不再默认包含该成员，历史支出仍会完整保留。`,
      confirmText: "归档",
      success: (res) => {
        if (!res.confirm) return;
        if (this.data.mode === "create") {
          const members = this.data.form.members.map((item) => {
            return item.id === member.id ? Object.assign({}, item, { status: "archived" }) : item;
          });
          this.setData({ "form.members": members }, () => this.markDirty());
          return;
        }
        if (!ledgerStore.archiveLedgerMember) return this.showContractToast();
        const updated = ledgerStore.archiveLedgerMember(this.data.ledgerId, member.id);
        if (updated) this.syncPersistedMembers(updated);
      }
    });
  },

  removeMember(event) {
    const id = event.currentTarget.dataset.id;
    const member = this.data.form.members.find((item) => String(item.id) === String(id));
    if (!member) return;
    const activeCount = this.data.form.members.filter((item) => item.status !== "archived").length;
    if (member.status !== "archived" && activeCount <= 1) {
      wx.showToast({ title: "至少保留一位当前成员", icon: "none" });
      return;
    }
    wx.showModal({
      title: "移除成员",
      content: "仅未被任何支出或转账引用的成员可以移除；有历史记录的成员请保留为归档。",
      confirmText: "尝试移除",
      confirmColor: "#a34b32",
      success: (res) => {
        if (!res.confirm) return;
        if (this.data.mode === "create") {
          const members = this.data.form.members.filter((item) => item.id !== member.id);
          this.setData({ "form.members": members }, () => this.markDirty());
          return;
        }
        if (!ledgerStore.removeLedgerMember) return this.showContractToast();
        let updated;
        try {
          updated = ledgerStore.removeLedgerMember(this.data.ledgerId, member.id);
        } catch (error) {
          wx.showToast({ title: error.message || "成员移除失败", icon: "none" });
          return;
        }
        if (!updated) {
          wx.showToast({ title: "成员有历史记录，不能移除", icon: "none" });
          return;
        }
        this.syncPersistedMembers(updated);
      }
    });
  },

  showContractToast() {
    wx.showToast({ title: "成员接口尚未就绪", icon: "none" });
  },

  onStartDateChange(event) {
    this.setData({ "form.startDate": event.detail.value }, () => this.markDirty());
  },

  onEndDateChange(event) {
    this.setData({ "form.endDate": event.detail.value }, () => this.markDirty());
  },

  onCurrencyChange(event) {
    const nextIndex = Number(event.detail.value || 0);
    const currency = this.data.currencyOptions[nextIndex];
    if (!currency || currency.code === this.data.form.baseCurrency) return;
    const applyCurrency = () => {
      this.setData({
        currencyIndex: nextIndex,
        selectedCurrencyLabel: currency.label,
        "form.baseCurrency": currency.code
      }, () => this.markDirty());
    };
    if (this.data.mode !== "edit" || !this.data.hasMoneyRecords) {
      applyCurrency();
      return;
    }
    wx.showModal({
      title: "更换账本币种？",
      content: `现有支出与转账会统一改为 ${currency.label} 显示，金额数值不会换算。请确认已自行换算原有金额。`,
      confirmText: "只改币种",
      success: (result) => {
        if (result.confirm) applyCurrency();
      }
    });
  },

  saveLedger() {
    const form = this.data.form;
    const activeMembers = form.members.filter((member) => member.status !== "archived");
    if (!form.title.trim()) {
      wx.showToast({ title: "先填写账本名称", icon: "none" });
      return;
    }
    if (!activeMembers.length) {
      wx.showToast({ title: "至少保留一位当前成员", icon: "none" });
      return;
    }
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      wx.showToast({ title: "结束日期不能早于开始日期", icon: "none" });
      return;
    }
    const payload = {
      title: form.title,
      city: form.city,
      startDate: form.startDate,
      endDate: form.endDate,
      baseCurrency: form.baseCurrency,
      members: form.members,
      note: form.note
    };
    try {
      if (this.data.mode === "edit") {
        ledgerStore.updateLedger(this.data.ledgerId, payload);
        this.rememberForm();
        wx.showToast({ title: "已更新", icon: "success" });
        setTimeout(() => wx.navigateBack(), 450);
        return;
      }
      const ledger = ledgerStore.addLedger(payload);
      this.rememberForm();
      wx.showToast({ title: "已创建", icon: "success" });
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/ledger/detail/detail?id=${ledger.id}` });
      }, 450);
    } catch (error) {
      wx.showToast({ title: error.message || "账本保存失败", icon: "none" });
    }
  }
});
