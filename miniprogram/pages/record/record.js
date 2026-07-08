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
  getRecordById
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
    pageText: getPageText("create", "hotel", buildInitialForm()),
    form: buildInitialForm()
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
      pageText: getPageText("create", recordType, form),
      form
    });
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
      pageText: getPageText("detail", record.recordType, form),
      form
    });
  },

  onFieldInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },

  onDateChange(event) {
    this.setData({
      "form.stayDate": event.detail.value
    });
  },

  onScoreChange(event) {
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
    });
  },

  onToggleTag(event) {
    if (this.data.mode === "detail") return;
    const { category, tag } = event.currentTarget.dataset;
    const selectedTags = this.data.form.selectedTags;
    const current = selectedTags[category] || [];
    selectedTags[category] = current.includes(tag)
      ? current.filter((item) => item !== tag)
      : current.concat(tag);
    this.setData({
      "form.selectedTags": selectedTags
    });
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

    addRecord(this.data.form);
    wx.showToast({
      title: "已保存",
      icon: "success"
    });
    setTimeout(() => wx.navigateBack(), 450);
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
  }
});
