const { applyBackup, exportFullBackup, preflightBackup } = require("../../utils/appBackup");
const { getRecords, getSummary } = require("../../utils/hotelReviewStore");
const { getLedgers } = require("../../utils/tripLedgerStore");
const { getPlaces } = require("../../utils/placeStore");
const { exportHotelReport } = require("../../utils/pdfReport");
const { PRIVATE_MODE, REDACTED_MODE } = require("../../utils/privacyPolicy");

function formatExportedAt(value) {
  if (!value) return "未记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false });
}

Page({
  data: {
    localSummary: { recordCount: 0, placeCount: 0, ledgerCount: 0, expenseCount: 0 },
    selectedFileName: "",
    preview: null,
    importing: false,
    exportingBackup: false,
    exportingPdf: false
  },

  onShow() {
    this.refreshLocalSummary();
  },

  refreshLocalSummary() {
    const records = getRecords();
    const ledgers = getLedgers();
    this.setData({
      localSummary: {
        recordCount: records.length,
        placeCount: getPlaces().length,
        ledgerCount: ledgers.length,
        expenseCount: ledgers.reduce((sum, ledger) => sum + ledger.expenses.length, 0)
      }
    });
  },

  chooseBackup() {
    if (!wx.chooseMessageFile) {
      wx.showToast({ title: "当前微信版本不支持文件选择", icon: "none" });
      return;
    }
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["json"],
      success: (result) => this.previewFile(result.tempFiles && result.tempFiles[0]),
      fail: (error) => {
        if (String(error && error.errMsg).indexOf("cancel") < 0) {
          wx.showToast({ title: "选择文件失败", icon: "none" });
        }
      }
    });
  },

  previewFile(file) {
    if (!file || !file.path) return;
    try {
      const content = wx.getFileSystemManager().readFileSync(file.path, "utf8");
      this.checkedBackup = preflightBackup(content);
      const summary = this.checkedBackup.summary;
      this.setData({
        selectedFileName: file.name || "备份文件.json",
        preview: {
          schemaVersion: summary.schemaVersion,
          recordCount: summary.recordCount,
          placeCount: summary.placeCount,
          ledgerCount: summary.ledgerCount,
          expenseCount: summary.expenseCount,
          ledgersLabel: summary.ledgersIncluded ? "包含账本" : "旧版备份，不含账本",
          exportedAtText: formatExportedAt(summary.exportedAt)
        }
      });
    } catch (error) {
      this.checkedBackup = null;
      this.setData({ selectedFileName: "", preview: null });
      wx.showModal({ title: "无法预览备份", content: error.message || "文件格式不正确", showCancel: false });
    }
  },

  confirmImport(event) {
    if (!this.checkedBackup || this.data.importing) return;
    const mode = event.currentTarget.dataset.mode;
    const replace = mode === "replace";
    const preview = this.data.preview;
    const legacyNote = replace && preview.schemaVersion === 1 ? "旧版备份不含账本，现有账本会保留。" : "";
    wx.showModal({
      title: replace ? "确认覆盖体验数据？" : "确认合并备份？",
      content: replace
        ? `将用备份中的 ${preview.recordCount} 条记录、${preview.placeCount} 个地点${preview.schemaVersion >= 2 ? `、${preview.ledgerCount} 本账本` : ""}替换本地数据。${legacyNote}`
        : "同 ID 的不同内容会安全改名，记录与账本支出的关联会同步保留。",
      confirmText: replace ? "确认覆盖" : "确认合并",
      confirmColor: replace ? "#a33d2d" : "#2864d9",
      success: (result) => {
        if (result.confirm) this.runImport(mode);
      }
    });
  },

  runImport(mode) {
    this.setData({ importing: true });
    try {
      const result = applyBackup(this.checkedBackup, mode);
      this.refreshLocalSummary();
      wx.showModal({
        title: "导入完成",
        content: mode === "merge"
          ? `新增 ${result.recordsAdded} 条记录、${result.placesAdded} 个地点、${result.ledgersAdded} 本账本；跳过 ${result.recordsSkipped + result.placesSkipped + result.ledgersSkipped} 项重复内容。`
          : `当前共有 ${result.recordCount} 条记录、${result.placeCount} 个地点、${result.ledgerCount} 本账本。`,
        showCancel: false
      });
    } catch (error) {
      wx.showModal({ title: "导入未完成", content: error.message || "数据写入失败", showCancel: false });
    } finally {
      this.setData({ importing: false });
    }
  },

  exportBackup() {
    if (this.data.exportingBackup) return;
    this.setData({ exportingBackup: true });
    try {
      const result = exportFullBackup();
      if (wx.shareFileMessage) {
        wx.shareFileMessage({
          filePath: result.filePath,
          fileName: "体验档案-完整备份-v4.json",
          fail: (error) => {
            if (String(error && error.errMsg).indexOf("cancel") < 0) wx.showToast({ title: "发送备份失败", icon: "none" });
          }
        });
      } else {
        wx.showModal({ title: "备份已生成", content: "文件已保存在小程序数据目录。", showCancel: false });
      }
    } catch (error) {
      wx.showModal({ title: "导出失败", content: error.message || "无法生成备份", showCancel: false });
    } finally {
      this.setData({ exportingBackup: false });
    }
  },

  exportPdf(event) {
    if (this.data.exportingPdf) return;
    const records = getRecords();
    const ledgers = getLedgers();
    if (!records.length && !ledgers.length) {
      wx.showToast({ title: "暂无可导出的数据", icon: "none" });
      return;
    }
    const privacyMode = event.currentTarget.dataset.mode === REDACTED_MODE ? REDACTED_MODE : PRIVATE_MODE;
    this.setData({ exportingPdf: true });
    exportHotelReport({ page: this, records, ledgers, summary: getSummary(records), privacyMode })
      .catch((error) => {
        console.error("export data report failed", error);
        wx.showModal({ title: "PDF 导出失败", content: error.message || "请稍后重试", showCancel: false });
      })
      .finally(() => this.setData({ exportingPdf: false }));
  }
});
