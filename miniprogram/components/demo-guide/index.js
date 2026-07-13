Component({
  properties: {
    active: { type: Boolean, value: false },
    stepLabel: { type: String, value: "演示任务" },
    title: { type: String, value: "" },
    hint: { type: String, value: "" },
    compact: { type: Boolean, value: false }
  },

  methods: {
    backToDemo() {
      wx.navigateBack({
        delta: 1,
        fail: () => wx.navigateTo({ url: "/pages/demo/index" })
      });
    }
  }
});
