const {
  initializeToolboxStorage,
  removeRetiredQuickRecords
} = require("./utils/toolboxMigration");

App({
  onLaunch() {
    initializeToolboxStorage();
    removeRetiredQuickRecords();
    const { theme } = wx.getAppBaseInfo ? wx.getAppBaseInfo() : {};
    this.globalData.theme = theme || "light";
  },
  globalData: {
    theme: "light"
  }
});
