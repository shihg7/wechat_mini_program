const {
  applyBackup,
  exportFullBackup,
  getLocalDataSummary,
  preflightBackup,
  resetAllData
} = require("../utils/appBackup");

function formatDateTime(value) {
  if (!value) return "尚未备份";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatStorage(kilobytes) {
  const value = Number(kilobytes || 0);
  if (value < 1) return "< 1 KB";
  if (value < 1024) return `${Math.round(value)} KB`;
  return `${(value / 1024).toFixed(1)} MB`;
}

function summaryView(summary) {
  return {
    ...summary,
    lastBackupText: formatDateTime(summary.lastBackupAt),
    storageText: formatStorage(summary.currentSizeKb),
    storageLimitText: summary.limitSizeKb ? formatStorage(summary.limitSizeKb) : ""
  };
}

function totalAdded(result) {
  return ["records", "trips", "checklists", "ledgers", "wheels"]
    .reduce((sum, key) => sum + Number(result[`${key}Added`] || 0), 0);
}

function totalSkipped(result) {
  return ["records", "trips", "checklists", "ledgers", "wheels"]
    .reduce((sum, key) => sum + Number(result[`${key}Skipped`] || 0), 0);
}

Page({
  data: {
    localSummary: summaryView({}),
    selectedFileName: "",
    preview: null,
    importing: false,
    exporting: false,
    clearing: false
  },

  onShow() {
    this.refreshSummary();
  },

  refreshSummary() {
    this.setData({ localSummary: summaryView(getLocalDataSummary()) });
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
        if (String(error && error.errMsg || "").indexOf("cancel") < 0) {
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
      this.setData({
        selectedFileName: file.name || "工具箱备份.json",
        preview: {
          ...this.checkedBackup.summary,
          exportedAtText: formatDateTime(this.checkedBackup.summary.exportedAt)
        }
      });
    } catch (error) {
      this.checkedBackup = null;
      this.setData({ selectedFileName: "", preview: null });
      wx.showModal({
        title: "无法读取备份",
        content: error.message || "文件格式不正确",
        showCancel: false
      });
    }
  },

  confirmImport(event) {
    if (!this.checkedBackup || this.data.importing) return;
    const mode = event.currentTarget.dataset.mode === "replace" ? "replace" : "merge";
    const preview = this.data.preview;
    wx.showModal({
      title: mode === "replace" ? "覆盖本地数据？" : "合并这份备份？",
      content: mode === "replace"
        ? `本机五类工具数据会替换为：${preview.recordCount} 条快评、${preview.tripCount} 个行程、${preview.checklistCount} 份清单、${preview.ledgerCount} 本账本和 ${preview.wheelCount} 个转盘。`
        : "已有内容会保留；相同 ID 且内容不同的项目会生成新 ID，完全相同的项目会跳过。",
      confirmText: mode === "replace" ? "确认覆盖" : "确认合并",
      confirmColor: mode === "replace" ? "#a33d2d" : "#2864d9",
      success: (result) => {
        if (result.confirm) this.runImport(mode);
      }
    });
  },

  runImport(mode) {
    this.setData({ importing: true });
    try {
      const result = applyBackup(this.checkedBackup, mode);
      this.refreshSummary();
      wx.showModal({
        title: "恢复完成",
        content: mode === "merge"
          ? `新增 ${totalAdded(result)} 项，跳过 ${totalSkipped(result)} 项重复内容。`
          : "五类工具数据已按备份完整恢复。",
        showCancel: false
      });
    } catch (error) {
      wx.showModal({
        title: "恢复未完成",
        content: error.message || "本地写入失败，原数据已保留",
        showCancel: false
      });
    } finally {
      this.setData({ importing: false });
    }
  },

  exportBackup() {
    if (this.data.exporting) return;
    this.setData({ exporting: true });
    try {
      const result = exportFullBackup();
      this.refreshSummary();
      if (wx.shareFileMessage) {
        wx.shareFileMessage({
          filePath: result.filePath,
          fileName: "工具箱-完整备份-v1.json",
          fail: (error) => {
            if (String(error && error.errMsg || "").indexOf("cancel") < 0) {
              wx.showToast({ title: "发送备份失败", icon: "none" });
            }
          }
        });
      } else {
        wx.showModal({
          title: "备份已生成",
          content: "JSON 文件已保存在小程序本地目录。",
          showCancel: false
        });
      }
    } catch (error) {
      wx.showModal({
        title: "导出失败",
        content: error.message || "无法生成备份文件",
        showCancel: false
      });
    } finally {
      this.setData({ exporting: false });
    }
  },

  confirmClear() {
    if (this.data.clearing) return;
    wx.showModal({
      title: "清空全部本地数据？",
      content: "快评、行程、清单、AA 账本和转盘都会删除，且无法撤销。建议先导出备份。",
      confirmText: "全部清空",
      confirmColor: "#a33d2d",
      success: (result) => {
        if (!result.confirm) return;
        this.clearAllData();
      }
    });
  },

  clearAllData() {
    this.setData({ clearing: true });
    try {
      resetAllData();
      this.checkedBackup = null;
      this.setData({ selectedFileName: "", preview: null });
      this.refreshSummary();
      wx.showToast({ title: "本地数据已清空", icon: "success" });
    } catch (error) {
      wx.showModal({
        title: "清空失败",
        content: error.message || "请稍后重试",
        showCancel: false
      });
    } finally {
      this.setData({ clearing: false });
    }
  }
});
