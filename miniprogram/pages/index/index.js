const {
  exportBackup,
  getRecords,
  getSummary,
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

Page({
  data: {
    records: [],
    visibleRecords: [],
    keyword: "",
    activeType: "all",
    sortOptions: SORT_OPTIONS,
    sortLabels: SORT_OPTIONS.map((item) => item.label),
    sortMode: "created_desc",
    sortLabel: SORT_OPTIONS[0].label,
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
    const visibleRecords = this.getVisibleRecords(records);
    this.setData({
      records,
      visibleRecords,
      summary: getSummary(records)
    });
  },

  getVisibleRecords(records = this.data.records) {
    return searchAndSortRecords(records, {
      keyword: this.data.keyword,
      activeType: this.data.activeType,
      sortMode: this.data.sortMode
    });
  },

  refreshVisibleRecords() {
    this.setData({
      visibleRecords: this.getVisibleRecords()
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
