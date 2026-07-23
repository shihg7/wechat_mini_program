const { initializeToolboxStorage } = require("./utils/toolboxMigration");

App({
  onLaunch() {
    initializeToolboxStorage();
    const { theme } = wx.getAppBaseInfo ? wx.getAppBaseInfo() : {};
    this.globalData.theme = theme || "light";
  },
  globalData: {
    theme: "light"
  }
});
