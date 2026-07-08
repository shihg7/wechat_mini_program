App({
  onLaunch() {
    const { theme } = wx.getSystemInfoSync();
    this.globalData.theme = theme || "light";
  },
  globalData: {
    theme: "light"
  }
});
