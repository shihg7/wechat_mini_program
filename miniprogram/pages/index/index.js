const TOOLS = [
  {
    id: "ledger",
    label: "AA分账",
    icon: "receipt",
    tone: "blue",
    url: "/pages/ledger/index/index"
  },
  {
    id: "trip",
    label: "行程安排",
    icon: "calendar",
    tone: "green",
    url: "/pages/trip/index"
  },
  {
    id: "checklist",
    label: "通用清单",
    icon: "clipboard",
    tone: "amber",
    url: "/pages/checklist/index"
  },
  {
    id: "wheel",
    label: "决策转盘",
    icon: "wheel",
    tone: "accent",
    url: "/packages/tools/wheel/index"
  },
  {
    id: "review",
    label: "酒店餐厅快评",
    icon: "edit",
    tone: "default",
    url: "/pages/record/index"
  },
  {
    id: "career",
    label: "程序员生涯模拟",
    icon: "code",
    tone: "blue",
    url: "/packages/tools/career/index"
  }
];

const HEADER_ACTIONS = [
  {
    id: "help",
    label: "帮助",
    icon: "book",
    url: "/packages/tools/help/index"
  },
  {
    id: "data",
    label: "数据设置",
    icon: "database",
    url: "/packages/tools/data/index"
  }
];

Page({
  data: {
    tools: TOOLS,
    headerActions: HEADER_ACTIONS
  },

  openRoute(event) {
    const url = event.currentTarget.dataset.url;
    if (!url) return;
    wx.navigateTo({ url });
  }
});
