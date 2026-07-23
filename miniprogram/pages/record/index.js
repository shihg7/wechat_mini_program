const quickRecordStore = require("../../utils/quickRecordStore");

function buildRecordView(record) {
  const hasScore = record.score != null;
  return {
    ...record,
    typeLabel: record.type === "restaurant" ? "餐厅" : "酒店",
    iconName: record.type === "restaurant" ? "utensils" : "hotel",
    scoreLabel: hasScore ? String(record.score) : "--",
    hasScore,
    locationLabel: record.city || "未填写城市"
  };
}

Page({
  data: {
    query: "",
    typeFilter: "all",
    records: [],
    total: 0,
    visibleTotal: 0
  },

  allRecords: [],

  onLoad(options = {}) {
    if (options.type === "hotel" || options.type === "restaurant") {
      this.setData({ typeFilter: options.type });
    }
  },

  onShow() {
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh();
    if (wx.stopPullDownRefresh) wx.stopPullDownRefresh();
  },

  refresh() {
    this.allRecords = quickRecordStore.getRecords();
    this.applyFilters();
  },

  applyFilters() {
    const records = quickRecordStore.filterRecords(this.allRecords, {
      query: this.data.query,
      type: this.data.typeFilter
    }).map(buildRecordView);
    this.setData({
      records,
      total: this.allRecords.length,
      visibleTotal: records.length
    });
  },

  onSearchInput(event) {
    this.setData({ query: event.detail.value }, () => this.applyFilters());
  },

  clearSearch() {
    this.setData({ query: "" }, () => this.applyFilters());
  },

  onFilterTap(event) {
    this.setData({ typeFilter: event.currentTarget.dataset.type }, () => this.applyFilters());
  },

  createRecord() {
    wx.showActionSheet({
      itemList: ["酒店", "餐厅"],
      success: (result) => {
        const type = result.tapIndex === 1 ? "restaurant" : "hotel";
        wx.navigateTo({ url: `/pages/record/record?type=${type}` });
      }
    });
  },

  openRecord(event) {
    wx.navigateTo({ url: `/pages/record/record?id=${event.currentTarget.dataset.id}` });
  }
});
