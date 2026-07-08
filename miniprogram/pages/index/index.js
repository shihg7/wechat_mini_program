const { getRecords, getSummary } = require("../../utils/hotelReviewStore");
const { exportHotelReport } = require("../../utils/pdfReport");

Page({
  data: {
    records: [],
    visibleRecords: [],
    activeType: "all",
    summary: {
      total: 0,
      hotelTotal: 0,
      restaurantTotal: 0,
      averageScore: 0,
      bestHotelName: "",
      latestHotelName: ""
    },
    exporting: false
  },

  onShow() {
    this.refreshRecords();
  },

  refreshRecords() {
    const records = getRecords();
    const visibleRecords = this.filterRecords(records, this.data.activeType);
    this.setData({
      records,
      visibleRecords,
      summary: getSummary(records)
    });
  },

  filterRecords(records, activeType) {
    if (activeType === "hotel") {
      return records.filter((record) => record.recordType !== "restaurant");
    }
    if (activeType === "restaurant") {
      return records.filter((record) => record.recordType === "restaurant");
    }
    return records;
  },

  onTypeFilter(event) {
    const activeType = event.currentTarget.dataset.type;
    this.setData({
      activeType,
      visibleRecords: this.filterRecords(this.data.records, activeType)
    });
  },

  goCreate(event) {
    const type = event.currentTarget.dataset.type || "hotel";
    wx.navigateTo({
      url: `/pages/record/record?type=${type}`
    });
  },

  goDetail(event) {
    wx.navigateTo({
      url: `/pages/record/record?id=${event.currentTarget.dataset.id}`
    });
  },

  async exportPdf() {
    if (!this.data.records.length) {
      wx.showToast({
        title: "暂无记录可导出",
        icon: "none"
      });
      return;
    }

    this.setData({ exporting: true });
    wx.showLoading({
      title: "生成 PDF 中"
    });

    try {
      await exportHotelReport({
        page: this,
        records: this.data.records,
        summary: this.data.summary
      });
    } catch (error) {
      console.error("export pdf failed", error);
      wx.showToast({
        title: "PDF 生成失败",
        icon: "none"
      });
    } finally {
      wx.hideLoading();
      this.setData({ exporting: false });
    }
  }
});
