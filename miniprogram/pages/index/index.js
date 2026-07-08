const {
  exportBackup,
  getCityStats,
  getRecords,
  getSummary,
  getTagStats,
  getTimelineGroups,
  importBackup,
  parseBackupPayload,
  searchAndSortRecords
} = require("../../utils/hotelReviewStore");
const { exportHotelReport } = require("../../utils/pdfReport");

const SORT_OPTIONS = [
  { label: "最近创建", value: "created_desc" },
  { label: "日期最新", value: "stay_desc" },
  { label: "评分最高", value: "score_desc" },
  { label: "评分最低", value: "score_asc" }
];

const VIEW_TABS = [
  { key: "records", label: "记录" },
  { key: "timeline", label: "时间线" },
  { key: "cities", label: "城市" },
  { key: "tags", label: "标签" }
];

Page({
  data: {
    records: [],
    visibleRecords: [],
    timelineGroups: [],
    cityStats: [],
    tagStats: [],
    selectedCity: "",
    cityRecords: [],
    keyword: "",
    activeView: "records",
    viewTabs: VIEW_TABS,
    activeType: "all",
    activeStatus: "all",
    activeTag: "",
    sortOptions: SORT_OPTIONS,
    sortLabels: SORT_OPTIONS.map((item) => item.label),
    sortMode: "created_desc",
    sortLabel: SORT_OPTIONS[0].label,
    summary: {
      total: 0,
      hotelTotal: 0,
      restaurantTotal: 0,
      draftTotal: 0,
      cityTotal: 0,
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
    const visibleRecords = this.getVisibleRecords(records);
    const cityStats = getCityStats(records);
    const selectedCity = this.data.selectedCity
      && cityStats.some((item) => item.city === this.data.selectedCity)
      ? this.data.selectedCity
      : "";
    this.setData({
      records,
      visibleRecords,
      timelineGroups: getTimelineGroups(records),
      cityStats,
      tagStats: getTagStats(records),
      selectedCity,
      cityRecords: selectedCity ? this.getCityRecords(records, selectedCity) : [],
      summary: getSummary(records)
    });
  },

  getVisibleRecords(records = this.data.records) {
    return searchAndSortRecords(records, {
      keyword: this.data.keyword,
      activeType: this.data.activeType,
      activeStatus: this.data.activeStatus,
      activeTag: this.data.activeTag,
      sortMode: this.data.sortMode
    });
  },

  getCityRecords(records, city) {
    return searchAndSortRecords(records.filter((record) => (record.city || "未填写城市") === city), {
      keyword: this.data.keyword,
      activeType: this.data.activeType,
      activeStatus: this.data.activeStatus,
      activeTag: this.data.activeTag,
      sortMode: this.data.sortMode
    });
  },

  refreshVisibleRecords() {
    const visibleRecords = this.getVisibleRecords();
    this.setData({
      visibleRecords,
      cityRecords: this.data.selectedCity ? this.getCityRecords(this.data.records, this.data.selectedCity) : []
    });
  },

  onViewChange(event) {
    this.setData({
      activeView: event.currentTarget.dataset.view
    });
  },

  onKeywordInput(event) {
    this.setData({
      keyword: event.detail.value
    });
    this.refreshVisibleRecords();
  },

  onTypeFilter(event) {
    this.setData({ activeType: event.currentTarget.dataset.type });
    this.refreshVisibleRecords();
  },

  onStatusFilter(event) {
    this.setData({ activeStatus: event.currentTarget.dataset.status });
    this.refreshVisibleRecords();
  },

  onTagFilter(event) {
    const tag = event.currentTarget.dataset.tag || "";
    this.setData({
      activeTag: this.data.activeTag === tag ? "" : tag,
      activeView: "records"
    });
    this.refreshVisibleRecords();
  },

  clearTagFilter() {
    this.setData({ activeTag: "" });
    this.refreshVisibleRecords();
  },

  onSortChange(event) {
    const index = Number(event.detail.value || 0);
    const option = this.data.sortOptions[index] || this.data.sortOptions[0];
    this.setData({
      sortMode: option.value,
      sortLabel: option.label
    });
    this.refreshVisibleRecords();
  },

  goCreate(event) {
    const type = event.currentTarget.dataset.type || "hotel";
    const quick = event.currentTarget.dataset.quick ? "&quick=1" : "";
    wx.navigateTo({
      url: `/pages/record/record?type=${type}${quick}`
    });
  },

  goQuickCreate() {
    wx.showActionSheet({
      itemList: ["快速记录酒店", "快速记录餐厅"],
      success: (res) => {
        const type = res.tapIndex === 1 ? "restaurant" : "hotel";
        wx.navigateTo({
          url: `/pages/record/record?type=${type}&quick=1`
        });
      }
    });
  },

  goDetail(event) {
    wx.navigateTo({
      url: `/pages/record/record?id=${event.currentTarget.dataset.id}`
    });
  },

  selectCity(event) {
    const city = event.currentTarget.dataset.city || "";
    const selectedCity = this.data.selectedCity === city ? "" : city;
    this.setData({
      selectedCity,
      cityRecords: selectedCity ? this.getCityRecords(this.data.records, selectedCity) : []
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
  },

  exportJson() {
    if (!this.data.records.length) {
      wx.showToast({
        title: "暂无记录可备份",
        icon: "none"
      });
      return;
    }

    try {
      const filePath = exportBackup(this.data.records);
      if (wx.shareFileMessage) {
        wx.shareFileMessage({
          filePath,
          fileName: "experience-review-backup.json",
          fail: () => {
            wx.showModal({
              title: "备份已生成",
              content: filePath,
              showCancel: false
            });
          }
        });
      } else {
        wx.showModal({
          title: "备份已生成",
          content: filePath,
          showCancel: false
        });
      }
    } catch (error) {
      console.error("export backup failed", error);
      wx.showToast({
        title: "备份失败",
        icon: "none"
      });
    }
  },

  importJson() {
    if (!wx.chooseMessageFile) {
      wx.showToast({
        title: "当前微信版本不支持选文件",
        icon: "none"
      });
      return;
    }

    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["json"],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file || !file.path) return;
        this.confirmImportBackup(file.path);
      },
      fail: () => {}
    });
  },

  confirmImportBackup(filePath) {
    try {
      const content = wx.getFileSystemManager().readFileSync(filePath, "utf8");
      const records = parseBackupPayload(content);
      wx.showActionSheet({
        itemList: ["合并导入", "覆盖导入"],
        success: (res) => {
          const mode = res.tapIndex === 1 ? "overwrite" : "merge";
          if (mode === "overwrite") {
            wx.showModal({
              title: "覆盖导入",
              content: "这会替换当前所有本地记录，确定继续吗？",
              confirmText: "覆盖",
              confirmColor: "#a34b32",
              success: (modalRes) => {
                if (modalRes.confirm) this.applyImport(records, mode);
              }
            });
            return;
          }
          this.applyImport(records, mode);
        }
      });
    } catch (error) {
      console.error("import backup failed", error);
      wx.showToast({
        title: "备份文件无效",
        icon: "none"
      });
    }
  },

  applyImport(records, mode) {
    importBackup(records, mode);
    this.refreshRecords();
    wx.showToast({
      title: `已导入 ${records.length} 条`,
      icon: "success"
    });
  }
});
