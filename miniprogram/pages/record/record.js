const {
  buildScores,
  buildSelectedTags,
  getCategories,
  getCategoryScores,
  getOverallScore,
  getRecordTitle,
  getTypeConfig,
  getVerdict
} = require("../../utils/hotelScore");
const {
  addRecord,
  deleteRecord,
  duplicateRecord,
  getRecordById,
  updateRecord
} = require("../../utils/hotelReviewStore");

function buildInitialForm(recordType = "hotel") {
  const scores = buildScores(recordType);
  const overallScore = getOverallScore(scores, recordType);
  return {
    recordType,
    hotelName: "",
    restaurantName: "",
    city: "",
    stayDate: "",
    roomType: "",
    memberLevel: "",
    cuisine: "",
    michelinLevel: "",
    mealPeriod: "",
    priceRange: "",
    note: "",
    scores,
    selectedTags: buildSelectedTags(recordType),
    categoryScores: getCategoryScores(scores, recordType),
    overallScore,
    verdict: getVerdict(overallScore, recordType)
  };
}

function getPageText(mode, recordType, form = {}) {
  const typeConfig = getTypeConfig(recordType);
  if (mode === "edit") {
    return {
      eyebrow: `编辑${typeConfig.label}`,
      title: getRecordTitle(form)
    };
  }
  return {
    eyebrow: mode === "detail" ? `${typeConfig.label}详情` : `新增${typeConfig.label}`,
    title: mode === "detail"
      ? getRecordTitle(form)
      : (recordType === "restaurant" ? "新增米其林餐厅" : "新增酒店记录")
  };
}

Page({
  data: {
    mode: "create",
    recordId: "",
    recordType: "hotel",
    typeConfig: getTypeConfig("hotel"),
    categories: getCategories("hotel"),
    isReadonly: false,
    hasUnsavedChanges: false,
    pageText: getPageText("create", "hotel", buildInitialForm()),
    form: buildInitialForm(),
    originalForm: null
  },

  onLoad(options) {
    if (options && options.id) {
      this.loadDetail(options.id);
      return;
    }
    const recordType = options && options.type === "restaurant" ? "restaurant" : "hotel";
    this.setRecordType(recordType);
  },

  setRecordType(recordType) {
    const form = buildInitialForm(recordType);
    this.setData({
      recordType,
      typeConfig: getTypeConfig(recordType),
      categories: getCategories(recordType),
      isReadonly: false,
      hasUnsavedChanges: false,
      pageText: getPageText("create", recordType, form),
      form,
      originalForm: JSON.stringify(form)
    });
    this.disableLeaveAlert();
  },

  onTypeChange(event) {
    if (this.data.mode === "detail") return;
    this.setRecordType(event.currentTarget.dataset.type);
  },

  loadDetail(id) {
    const record = getRecordById(id);
    if (!record) {
      wx.showToast({
        title: "记录不存在",
        icon: "none"
      });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }

    const form = {
      ...record,
      categoryScores: getCategoryScores(record.scores, record.recordType)
    };
    this.setData({
      mode: "detail",
      recordId: record.id,
      recordType: record.recordType,
      typeConfig: getTypeConfig(record.recordType),
      categories: getCategories(record.recordType),
      isReadonly: true,
      hasUnsavedChanges: false,
      pageText: getPageText("detail", record.recordType, form),
      form,
      originalForm: JSON.stringify(form)
    });
    this.disableLeaveAlert();
  },

  enterEdit() {
    const originalForm = JSON.stringify(this.data.form);
    this.setData({
      mode: "edit",
      isReadonly: false,
      hasUnsavedChanges: false,
      pageText: getPageText("edit", this.data.recordType, this.data.form),
      originalForm
    });
    this.disableLeaveAlert();
  },

  cancelEdit() {
    if (this.data.hasUnsavedChanges) {
      wx.showModal({
        title: "放弃修改",
        content: "当前修改尚未保存，确定放弃吗？",
        confirmText: "放弃",
        success: (res) => {
          if (res.confirm) this.restoreOriginalForm();
        }
      });
      return;
    }
    this.restoreOriginalForm();
  },

  restoreOriginalForm() {
    const form = this.data.originalForm ? JSON.parse(this.data.originalForm) : this.data.form;
    this.setData({
      mode: "detail",
      isReadonly: true,
      hasUnsavedChanges: false,
      pageText: getPageText("detail", this.data.recordType, form),
      form
    });
    this.disableLeaveAlert();
  },

  markDirty() {
    const changed = JSON.stringify(this.data.form) !== this.data.originalForm;
    this.setData({ hasUnsavedChanges: changed });
    if (changed) {
      this.enableLeaveAlert();
    } else {
      this.disableLeaveAlert();
    }
  },

  enableLeaveAlert() {
    if (!wx.enableAlertBeforeUnload) return;
    wx.enableAlertBeforeUnload({
      message: "当前修改尚未保存，确定离开吗？"
    });
  },

  disableLeaveAlert() {
    if (!wx.disableAlertBeforeUnload) return;
    wx.disableAlertBeforeUnload();
  },

  onFieldInput(event) {
    if (this.data.isReadonly) return;
    const { field } = event.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: event.detail.value
    }, () => this.markDirty());
  },

  onDateChange(event) {
    if (this.data.isReadonly) return;
    this.setData({
      "form.stayDate": event.detail.value
    }, () => this.markDirty());
  },

  onScoreChange(event) {
    if (this.data.isReadonly) return;
    const { category, metric } = event.currentTarget.dataset;
    const recordType = this.data.form.recordType;
    const scores = this.data.form.scores;
    scores[category][metric] = Number(event.detail.value);
    const overallScore = getOverallScore(scores, recordType);
    this.setData({
      "form.scores": scores,
      "form.categoryScores": getCategoryScores(scores, recordType),
      "form.overallScore": overallScore,
      "form.verdict": getVerdict(overallScore, recordType)
    }, () => this.markDirty());
  },

  onToggleTag(event) {
    if (this.data.isReadonly) return;
    const { category, tag } = event.currentTarget.dataset;
    const selectedTags = this.data.form.selectedTags;
    const current = selectedTags[category] || [];
    selectedTags[category] = current.includes(tag)
      ? current.filter((item) => item !== tag)
      : current.concat(tag);
    this.setData({
      "form.selectedTags": selectedTags
    }, () => this.markDirty());
  },

  saveRecord() {
    if (this.data.mode === "detail") return;
    const title = getRecordTitle(this.data.form);
    if (!title || title.indexOf("未命名") === 0) {
      wx.showToast({
        title: this.data.recordType === "restaurant" ? "先填写餐厅名" : "先填写酒店名",
        icon: "none"
      });
      return;
    }

    if (this.data.mode === "edit") {
      const updated = updateRecord(this.data.recordId, this.data.form);
      const form = {
        ...updated,
        categoryScores: getCategoryScores(updated.scores, updated.recordType)
      };
      this.setData({
        mode: "detail",
        isReadonly: true,
        hasUnsavedChanges: false,
        form,
        pageText: getPageText("detail", updated.recordType, form),
        originalForm: JSON.stringify(form)
      });
      this.disableLeaveAlert();
      wx.showToast({
        title: "已更新",
        icon: "success"
      });
      return;
    }

    addRecord(this.data.form);
    this.disableLeaveAlert();
    wx.showToast({
      title: "已保存",
      icon: "success"
    });
    setTimeout(() => wx.navigateBack(), 450);
  },

  copyRecord() {
    const record = duplicateRecord(this.data.recordId);
    if (!record) {
      wx.showToast({
        title: "复制失败",
        icon: "none"
      });
      return;
    }
    wx.showToast({
      title: "已复制",
      icon: "success"
    });
    this.loadDetail(record.id);
  },

  deleteRecord() {
    wx.showModal({
      title: "删除记录",
      content: "删除后无法恢复，确认删除这条酒店记录吗？",
      confirmText: "删除",
      confirmColor: "#a34b32",
      success: (res) => {
        if (!res.confirm) return;
        deleteRecord(this.data.recordId);
        wx.showToast({
          title: "已删除",
          icon: "none"
        });
        setTimeout(() => wx.navigateBack(), 450);
      }
    });
  },

  onUnload() {
    this.disableLeaveAlert();
  }
});
