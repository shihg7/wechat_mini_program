App({
  onLaunch() {
    const { theme } = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
    this.globalData.theme = theme || "light";
  },
  globalData: {
    theme: "light"
  }
});
