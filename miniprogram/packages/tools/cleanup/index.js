const cleanupService = require("../../../utils/cleanupService");

Page({
  data: { report: null },
  onShow() { this.refresh(); },
  refresh() { this.setData({ report: cleanupService.getCleanupReport() }); },
  goPlace(event) { wx.navigateTo({ url: `/pages/place/detail?id=${event.currentTarget.dataset.id}` }); },
  goRecord(event) { wx.navigateTo({ url: `/pages/record/record?id=${event.currentTarget.dataset.id}` }); },
  goWishlist(event) { wx.navigateTo({ url: `/pages/wishlist/edit?id=${event.currentTarget.dataset.id}` }); },
  ignoreDuplicate(event) { cleanupService.ignoreDuplicate(event.currentTarget.dataset.source, event.currentTarget.dataset.target); this.refresh(); wx.showToast({ title: "已忽略这组建议", icon: "none" }); },
  clearInvalidPhotos(event) {
    wx.showModal({ title: "清理失效照片", content: "只删除已经无法读取的照片元数据，不影响仍存在的照片。", confirmText: "清理", success: (result) => { if (!result.confirm) return; cleanupService.removeInvalidPhotoMetadata(event.currentTarget.dataset.id); this.refresh(); wx.showToast({ title: "失效照片信息已清理", icon: "success" }); } });
  },
  clearOrphans() {
    wx.showModal({ title: "清理无主照片", content: `将删除 ${this.data.report.orphanPhotoPaths.length} 个没有任何记录引用的照片文件。`, confirmText: "清理", success: (result) => { if (!result.confirm) return; const count = cleanupService.cleanOrphanPhotoFiles(); this.refresh(); wx.showToast({ title: `已清理 ${count} 个`, icon: "none" }); } });
  }
});
