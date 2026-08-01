const TOOLS = [
  {
    id: "date-calculator",
    label: "日期计算",
    icon: "calendar",
    tone: "blue",
    url: "/packages/tools/date-calculator/index"
  },
  {
    id: "unit-converter",
    label: "单位换算",
    icon: "ruler",
    tone: "green",
    url: "/packages/tools/unit-converter/index"
  },
  {
    id: "qr-generator",
    label: "二维码生成",
    icon: "qr-code",
    tone: "amber",
    url: "/packages/tools/qr-generator/index"
  },
  {
    id: "screenshot-redactor",
    label: "截图打码",
    icon: "scan",
    tone: "blue",
    url: "/packages/tools/screenshot-redactor/index"
  },
  {
    id: "wheel",
    label: "决策转盘",
    icon: "wheel",
    tone: "accent",
    url: "/packages/tools/wheel/index"
  },
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
    icon: "plane",
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
    id: "career",
    label: "程序员生涯模拟",
    icon: "code",
    tone: "blue",
    url: "/packages/tools/career/index"
  },
  {
    id: "huawei-sim",
    label: "华子研发模拟",
    icon: "shield",
    tone: "accent",
    url: "/packages/tools/huawei-sim/index"
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
