const demoData = require("../../utils/demoData");
const demoMode = require("../../utils/demoMode");

const STEP_DEFINITIONS = [
  { id: "record", number: "01", title: "查看一条完整体验", description: "认识评分、标签、照片与地点关联", action: "查看酒店记录" },
  { id: "trip", number: "02", title: "浏览周末行程", description: "查看按天安排、预算与行程状态", action: "打开示例行程" },
  { id: "ledger", number: "03", title: "核对 AA 结算", description: "三人分摊 300.02 元，看看尾差如何准确处理", action: "查看结算建议" },
  { id: "wheel", number: "04", title: "亲手转一次转盘", description: "四个晚餐选项，点击或手拨都可以", action: "去转一转" }
];

Page({
  data: {
    steps: [],
    completed: 0,
    total: STEP_DEFINITIONS.length,
    percent: 0,
    allDone: false
  },

  onLoad() {
    if (!demoMode.getState().active) demoMode.start();
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const progress = demoMode.getProgress();
    const completedIds = progress.completedStepIds || [];
    this.setData({
      steps: STEP_DEFINITIONS.map((step) => ({ ...step, completed: completedIds.indexOf(step.id) >= 0 })),
      completed: progress.completed,
      total: progress.total,
      percent: progress.percent,
      allDone: progress.completed === progress.total
    });
  },

  openStep(event) {
    const stepId = event.currentTarget.dataset.id;
    const registry = demoData.getRegistry();
    const routes = {
      record: registry.recordIds[0] ? `/pages/record/record?id=${registry.recordIds[0]}` : "",
      trip: registry.tripIds[0] ? `/pages/trip/detail?id=${registry.tripIds[0]}` : "",
      ledger: registry.ledgerIds[0] ? `/pages/ledger/detail/detail?id=${registry.ledgerIds[0]}` : "",
      wheel: registry.wheelIds[0] ? `/pages/wheel/index?id=${registry.wheelIds[0]}` : ""
    };
    const url = routes[stepId];
    if (!url) {
      wx.showToast({ title: "演示数据需要重新准备", icon: "none" });
      demoMode.start();
      this.refresh();
      return;
    }
    demoMode.markStep(stepId);
    this.refresh();
    wx.navigateTo({ url });
  },

  restart() {
    wx.showModal({
      title: "重新开始演示？",
      content: "会重置任务进度并重新准备示例，不影响你的个人内容。",
      confirmText: "重新开始",
      success: (result) => {
        if (!result.confirm) return;
        demoMode.start();
        this.refresh();
      }
    });
  },

  finish() {
    wx.showModal({
      title: this.data.allDone ? "完成演示" : "退出演示？",
      content: "演示创建的酒店、餐厅、行程、账本和转盘会被清除，个人数据会保留。",
      confirmText: this.data.allDone ? "完成" : "退出",
      confirmColor: this.data.allDone ? "#176b68" : "#a34b32",
      success: (result) => {
        if (!result.confirm) return;
        demoMode.finish();
        wx.showToast({ title: "演示已结束", icon: "success" });
        setTimeout(() => wx.switchTab({ url: "/pages/index/index" }), 350);
      }
    });
  }
});
