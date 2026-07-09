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
    placeId: "",
    placeName: "",
    placeAlias: "",
    cloudRecordId: "",
    publicReviewId: "",
    city: "",
    stayDate: "",
    visitMonth: "",
    roomType: "",
    memberLevel: "",
    cuisine: "",
    michelinLevel: "",
    mealPeriod: "",
    priceRange: "",
    note: "",
    privateNote: "",
    publicNote: "",
    visibility: "private",
    publishStatus: "local",
    scores,
    selectedTags: buildSelectedTags(recordType),
    customTags: [],
    status: "completed",
    categoryScores: getCategoryScores(scores, recordType),
    overallScore,
    verdict: getVerdict(overallScore, recordType)
  };
}

function buildScoreBars(form) {
  return getCategories(form.recordType).map((category) => {
    const score = form.categoryScores && form.categoryScores[category.key]
      ? form.categoryScores[category.key]
      : 0;
    return {
      key: category.key,
      title: category.title,
      accent: category.accent,
      score,
      percent: Math.max(0, Math.min(100, score * 10))
    };
  });
}

function buildPublicPreview(form) {
  const typeConfig = getTypeConfig(form.recordType);
  const tags = Object.keys(form.selectedTags || {}).reduce((items, key) => {
    return items.concat(form.selectedTags[key] || []);
  }, []).concat(form.customTags || []);
  return {
    title: form.placeName || getRecordTitle(form),
    typeLabel: typeConfig.label,
    visitMonth: form.visitMonth || (form.stayDate ? form.stayDate.slice(0, 7) : "未填写月份"),
    summary: form.publicNote || form.verdict || "暂无公开摘要",
    tags: tags.slice(0, 8).join("、") || "暂无标签"
  };
}

function getPageText(mode, recordType, form = {}, isQuick = false) {
  const typeConfig = getTypeConfig(recordType);
  if (isQuick) {
    return {
      eyebrow: `快速记录${typeConfig.label}`,
      title: recordType === "restaurant" ? "快速记录餐厅" : "快速记录酒店"
    };
  }
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
    isQuick: false,
    hasUnsavedChanges: false,
    pageText: getPageText("create", "hotel", buildInitialForm()),
    form: buildInitialForm(),
    originalForm: null,
    customTagInput: "",
    scoreBars: buildScoreBars(buildInitialForm()),
    publicPreview: buildPublicPreview(buildInitialForm())
  },

  onLoad(options) {
    if (options && options.id) {
      this.loadDetail(options.id);
      return;
    }
    const recordType = options && options.type === "restaurant" ? "restaurant" : "hotel";
    this.setRecordType(recordType, options && options.quick === "1");
  },

  setRecordType(recordType, isQuick = false) {
    const form = buildInitialForm(recordType);
    if (isQuick) form.status = "draft";
    this.setData({
      recordType,
      typeConfig: getTypeConfig(recordType),
      categories: getCategories(recordType),
      isReadonly: false,
      isQuick,
      hasUnsavedChanges: false,
      pageText: getPageText("create", recordType, form, isQuick),
      form,
      originalForm: JSON.stringify(form),
      customTagInput: "",
      scoreBars: buildScoreBars(form),
      publicPreview: buildPublicPreview(form)
    });
    this.disableLeaveAlert();
  },

  onTypeChange(event) {
    if (this.data.mode === "detail") return;
    this.setRecordType(event.currentTarget.dataset.type, this.data.isQuick);
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
      isQuick: false,
      hasUnsavedChanges: false,
      pageText: getPageText("detail", record.recordType, form),
      form,
      originalForm: JSON.stringify(form),
      customTagInput: "",
      scoreBars: buildScoreBars(form),
      publicPreview: buildPublicPreview(form)
    });
    this.disableLeaveAlert();
  },

  enterEdit() {
    const originalForm = JSON.stringify(this.data.form);
    this.setData({
      mode: "edit",
      isReadonly: false,
      isQuick: false,
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
      form,
      scoreBars: buildScoreBars(form),
      publicPreview: buildPublicPreview(form)
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
    const updates = {
      [`form.${field}`]: event.detail.value
    };
    if (field === "note") {
      updates["form.privateNote"] = event.detail.value;
    }
    this.setData(updates, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      this.markDirty();
    });
  },

  onDateChange(event) {
    if (this.data.isReadonly) return;
    this.setData({
      "form.stayDate": event.detail.value,
      "form.visitMonth": event.detail.value ? event.detail.value.slice(0, 7) : ""
    }, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      this.markDirty();
    });
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
      "form.verdict": getVerdict(overallScore, recordType),
      "scoreBars": buildScoreBars({
        ...this.data.form,
        scores,
        categoryScores: getCategoryScores(scores, recordType),
        overallScore
      })
    }, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      this.markDirty();
    });
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
    }, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      this.markDirty();
    });
  },

  onVisibilityChange(event) {
    if (this.data.isReadonly) return;
    this.setData({
      "form.visibility": event.currentTarget.dataset.visibility || "private"
    }, () => this.markDirty());
  },

  onCustomTagInput(event) {
    if (this.data.isReadonly) return;
    this.setData({ customTagInput: event.detail.value });
  },

  addCustomTag() {
    if (this.data.isReadonly) return;
    const tag = String(this.data.customTagInput || "").trim();
    if (!tag) {
      wx.showToast({
        title: "先输入标签",
        icon: "none"
      });
      return;
    }
    const customTags = this.data.form.customTags || [];
    if (customTags.indexOf(tag) >= 0) {
      this.setData({ customTagInput: "" });
      return;
    }
    this.setData({
      "form.customTags": customTags.concat(tag),
      customTagInput: ""
    }, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      this.markDirty();
    });
  },

  removeCustomTag(event) {
    if (this.data.isReadonly) return;
    const tag = event.currentTarget.dataset.tag;
    const customTags = (this.data.form.customTags || []).filter((item) => item !== tag);
    this.setData({
      "form.customTags": customTags
    }, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      this.markDirty();
    });
  },

  saveRecord(event) {
    if (this.data.mode === "detail") return;
    const targetStatus = event && event.currentTarget && event.currentTarget.dataset.status;
    const title = getRecordTitle(this.data.form);
    if (!title || title.indexOf("未命名") === 0) {
      wx.showToast({
        title: this.data.recordType === "restaurant" ? "先填写餐厅名" : "先填写酒店名",
        icon: "none"
      });
      return;
    }
    const nextForm = {
      ...this.data.form,
      placeName: this.data.form.placeName || title,
      privateNote: this.data.form.note,
      visitMonth: this.data.form.visitMonth || (this.data.form.stayDate ? this.data.form.stayDate.slice(0, 7) : ""),
      status: targetStatus || this.data.form.status || "completed"
    };

    if (this.data.mode === "edit") {
      const updated = updateRecord(this.data.recordId, nextForm);
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
        originalForm: JSON.stringify(form),
        scoreBars: buildScoreBars(form),
        publicPreview: buildPublicPreview(form)
      });
      this.disableLeaveAlert();
      wx.showToast({
        title: nextForm.status === "draft" ? "草稿已更新" : "已更新",
        icon: "success"
      });
      return;
    }

    addRecord(nextForm);
    this.disableLeaveAlert();
    wx.showToast({
      title: nextForm.status === "draft" ? "草稿已保存" : "已保存",
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
      content: "删除后无法恢复，确认删除这条记录吗？",
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
