const quickRecordStore = require("../../utils/quickRecordStore");

function emptyForm(type = "hotel") {
  return {
    id: "",
    type: type === "restaurant" ? "restaurant" : "hotel",
    name: "",
    city: "",
    visitDate: quickRecordStore.getToday(),
    score: null,
    note: "",
    createdAt: "",
    updatedAt: ""
  };
}

function editableSnapshot(form) {
  return JSON.stringify({
    type: form.type,
    name: String(form.name || ""),
    city: String(form.city || ""),
    visitDate: String(form.visitDate || ""),
    score: form.score == null ? "" : String(form.score),
    note: String(form.note || "")
  });
}

function scoreInputValue(score) {
  return score == null ? "" : String(score);
}

Page({
  data: {
    mode: "create",
    recordId: "",
    readonly: false,
    missing: false,
    dirty: false,
    form: emptyForm(),
    scoreInput: ""
  },

  originalSnapshot: "",
  leaveAlertActive: false,

  onLoad(options = {}) {
    if (options.id) {
      this.loadRecord(options.id);
      return;
    }
    this.prepareCreate(options.type);
  },

  onUnload() {
    this.setLeaveAlert(false);
  },

  prepareCreate(type) {
    const form = emptyForm(type);
    this.originalSnapshot = editableSnapshot(form);
    this.setData({
      mode: "create",
      recordId: "",
      readonly: false,
      missing: false,
      dirty: false,
      form,
      scoreInput: ""
    });
    this.setLeaveAlert(false);
  },

  loadRecord(id) {
    const record = quickRecordStore.getRecordById(id);
    if (!record) {
      this.setData({ missing: true, recordId: String(id || "") });
      this.setLeaveAlert(false);
      wx.showToast({ title: "记录不存在", icon: "none" });
      return;
    }
    this.originalSnapshot = editableSnapshot(record);
    this.setData({
      mode: "detail",
      recordId: record.id,
      readonly: true,
      missing: false,
      dirty: false,
      form: record,
      scoreInput: scoreInputValue(record.score)
    });
    this.setLeaveAlert(false);
  },

  setLeaveAlert(enabled) {
    if (enabled === this.leaveAlertActive) return;
    this.leaveAlertActive = enabled;
    if (enabled && wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({ message: "评分记录尚未保存，确定离开吗？" });
    }
    if (!enabled && wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
  },

  refreshDirtyState() {
    const dirty = editableSnapshot(this.data.form) !== this.originalSnapshot;
    this.setData({ dirty });
    this.setLeaveAlert(dirty);
  },

  updateForm(patch) {
    this.setData(patch, () => this.refreshDirtyState());
  },

  onTypeTap(event) {
    if (this.data.readonly) return;
    this.updateForm({ "form.type": event.currentTarget.dataset.type });
  },

  onInput(event) {
    if (this.data.readonly) return;
    const field = event.currentTarget.dataset.field;
    this.updateForm({ [`form.${field}`]: event.detail.value });
  },

  onDateChange(event) {
    if (this.data.readonly) return;
    this.updateForm({ "form.visitDate": event.detail.value });
  },

  onScoreInput(event) {
    if (this.data.readonly) return;
    const value = event.detail.value;
    this.updateForm({
      "form.score": value,
      scoreInput: value
    });
  },

  clearScore() {
    if (this.data.readonly) return;
    this.updateForm({
      "form.score": null,
      scoreInput: ""
    });
  },

  enterEdit() {
    this.originalSnapshot = editableSnapshot(this.data.form);
    this.setData({
      mode: "edit",
      readonly: false,
      dirty: false,
      scoreInput: scoreInputValue(this.data.form.score)
    });
    this.setLeaveAlert(false);
  },

  cancelEdit() {
    if (!this.data.dirty) {
      this.loadRecord(this.data.recordId);
      return;
    }
    wx.showModal({
      title: "放弃修改？",
      content: "尚未保存的内容将会丢失。",
      confirmText: "放弃",
      confirmColor: "#a34b32",
      success: (result) => {
        if (result.confirm) this.loadRecord(this.data.recordId);
      }
    });
  },

  save() {
    const payload = {
      type: this.data.form.type,
      name: this.data.form.name,
      city: this.data.form.city,
      visitDate: this.data.form.visitDate,
      score: this.data.form.score,
      note: this.data.form.note
    };
    try {
      const record = this.data.mode === "edit"
        ? quickRecordStore.updateRecord(this.data.recordId, payload)
        : quickRecordStore.addRecord(payload);
      if (!record) throw new Error("记录不存在");
      this.originalSnapshot = editableSnapshot(record);
      this.setData({
        mode: "detail",
        recordId: record.id,
        readonly: true,
        missing: false,
        dirty: false,
        form: record,
        scoreInput: scoreInputValue(record.score)
      });
      this.setLeaveAlert(false);
      wx.showToast({ title: "已保存", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }
  },

  remove() {
    wx.showModal({
      title: "删除记录？",
      content: "删除后无法恢复。",
      confirmText: "删除",
      confirmColor: "#a34b32",
      success: (result) => {
        if (!result.confirm) return;
        this.setLeaveAlert(false);
        quickRecordStore.deleteRecord(this.data.recordId);
        wx.showToast({ title: "已删除", icon: "success" });
        wx.navigateBack();
      }
    });
  },

  goToList() {
    wx.navigateTo({ url: "/pages/record/index" });
  },

  goBack() {
    wx.navigateBack();
  }
});
