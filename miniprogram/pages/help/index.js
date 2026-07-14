const HELP_SECTIONS = [
  {
    id: "quick",
    navTitle: "上手",
    icon: "play",
    tone: "blue",
    keywords: "第一次 新手 怎么用 快速开始",
    title: "三分钟快速上手",
    subtitle: "先完成一条体验，再认识行程和 AA",
    intro: "第一次使用不必一次填完所有资料。先保存酒店或餐厅名称、城市和日期，之后随时编辑补充评分、照片与备注。",
    flow: [
      { icon: "plus", label: "新增" },
      { icon: "sliders", label: "评分" },
      { icon: "check", label: "保存" }
    ],
    steps: [
      { title: "新增第一条体验", text: "首页选择新增酒店或新增餐厅，名称为必填项。" },
      { title: "资料不全先存草稿", text: "草稿明确显示未评分，不会影响平均分和地点趋势。" },
      { title: "回到首页继续探索", text: "底部可进入行程和 AA 账本，首页旅行工具可打开预订、地图与转盘。" }
    ],
    tips: ["首页右上角的手册入口会一直保留。", "想边看边练习，可打开新手演示；演示不会覆盖个人数据。"],
    actionLabel: "开始新手演示",
    url: "/pages/demo/index"
  },
  {
    id: "records",
    navTitle: "体验",
    icon: "hotel",
    tone: "accent",
    keywords: "酒店 餐厅 测评 打分 草稿 照片 备注",
    title: "酒店与餐厅体验",
    subtitle: "评分、照片、标签、备注和多次到访",
    intro: "酒店记录行政酒廊、早餐和泳池；餐厅记录菜品、服务、饮品和环境。已完成且已评分的记录才会进入个人均分。",
    flow: [
      { icon: "hotel", label: "选类型" },
      { icon: "image", label: "补细节" },
      { icon: "book", label: "进档案" }
    ],
    steps: [
      { title: "填写基础信息", text: "记录名称、城市、日期；酒店可填房型和会员，餐厅可填菜系与米其林等级。" },
      { title: "完成评分与标签", text: "拖动评分项后自动计算分类分、总分和结论，也可添加自定义标签。" },
      { title: "管理照片与备注", text: "每条体验最多 9 张照片，可分类、写说明、排序并设置封面。" },
      { title: "后续维护", text: "详情页支持编辑、复制、删除和生成照片回顾；编辑不会新增重复记录。" }
    ],
    tips: ["快速记录会保存为未评分草稿。", "公开摘要与私密备注分开保存，公开预览默认隐藏敏感字段。"],
    actionLabel: "新增体验",
    url: "/pages/record/record?type=hotel"
  },
  {
    id: "places",
    navTitle: "地点",
    icon: "pin",
    tone: "green",
    keywords: "地点 分店 重复 合并 想去 到访 定位",
    title: "地点与想去清单",
    subtitle: "把同一家店的多次到访聚合起来",
    intro: "一次入住或用餐是一条体验，同一家酒店或餐厅是一个地点。地点页汇总到访次数、均分、最高分和评分变化。",
    flow: [
      { icon: "heart", label: "想去" },
      { icon: "pin", label: "关联地点" },
      { icon: "check", label: "已到访" }
    ],
    steps: [
      { title: "确认地点建议", text: "系统只提供相似候选，必须由你选择关联已有地点或创建新地点。" },
      { title: "管理多次到访", text: "从地点详情再次入住或再次用餐，会自动带入名称、城市和地址。" },
      { title: "处理重复地点", text: "确认重复后可手动合并；有关联记录的地点不能直接删除。" },
      { title: "管理想去状态", text: "想去项可在想去、已预订、已到访之间流转，并可继续创建预订或加入行程。" }
    ],
    tips: ["地图位置是可选信息，拒绝授权后仍可手工保存。", "地点改名不会篡改历史体验中的名称快照。"],
    actionLabel: "新增想去地点",
    url: "/pages/wishlist/edit?type=hotel"
  },
  {
    id: "departure",
    navTitle: "出发",
    icon: "plane",
    tone: "amber",
    keywords: "预订 取消截止 出发 倒计时 行前准备",
    title: "预订与出发中心",
    subtitle: "集中管理取消期限、付款和行前清单",
    intro: "住宿、餐厅、交通、门票和其他预订统一放在出发中心。免费取消期限临近时会提高提示优先级。",
    flow: [
      { icon: "heart", label: "计划" },
      { icon: "plane", label: "预订" },
      { icon: "clipboard", label: "清单" }
    ],
    steps: [
      { title: "新增预订", text: "填写日期时间、人数、金额、付款状态、预订编号与免费取消截止时间。" },
      { title: "接入旅行流程", text: "预订可加入行程、计入预算、预填 AA 支出，酒店和餐厅到访后还能直接创建体验。" },
      { title: "完成行前清单", text: "清单可绑定行程或保存在通用清单，任务支持负责人、完成状态和备注。" }
    ],
    tips: ["重复加入行程或预算时会打开既有内容，不会重复创建。", "删除预订不会静默删除已关联的行程或支出。"],
    actionLabel: "打开出发中心",
    url: "/pages/departure/index"
  },
  {
    id: "trips",
    navTitle: "行程",
    icon: "route",
    tone: "blue",
    keywords: "路线 日程 预算 个人支出 共同支出 汇率",
    title: "行程与预算中心",
    subtitle: "按天安排，并分清个人支出和共同支出",
    intro: "行程支持多个城市、日期、本位币、总预算、分类预算和按天日程。时间冲突会在日程中明确提示。",
    flow: [
      { icon: "calendar", label: "定日期" },
      { icon: "route", label: "排日程" },
      { icon: "wallet", label: "看预算" }
    ],
    steps: [
      { title: "建立行程", text: "填写名称、城市、起止日期和预算，行程列表会显示状态、进度与摘要。" },
      { title: "安排每日时间线", text: "日程可编辑、排序、移动、复制单条或整天，并限制在行程日期内。" },
      { title: "记录个人支出", text: "预算中心中的个人费用单独保存，支持外币和固定汇率。" },
      { title: "关联 AA 账本", text: "共同支出从所选账本实时读取，不复制费用，避免重复统计。" }
    ],
    tips: ["复制整段行程会保留结构和预算，但清空实际支出与到访结果。", "删除行程前会列出仍需处理的日程和关联数据。"],
    actionLabel: "查看我的行程",
    url: "/pages/trip/index",
    tab: true
  },
  {
    id: "ledger",
    navTitle: "AA",
    icon: "users",
    tone: "green",
    keywords: "AA 三人分账 多人记账 谁给谁 尾差 转账 平摊",
    title: "AA 账本精确分账",
    subtitle: "记录谁付款、谁参与，自动生成转账建议",
    intro: "每笔支出先选择付款人，再选择真正参与分摊的人。金额始终按整数分计算，所有人的应摊合计严格等于原支出。",
    flow: [
      { icon: "users", label: "加成员" },
      { icon: "receipt", label: "记支出" },
      { icon: "check", label: "去结算" }
    ],
    steps: [
      { title: "维护同行人", text: "成员使用稳定 ID，改名不影响历史归属；有历史记录的成员只能归档。" },
      { title: "选择分摊方式", text: "支持人均、固定金额、百分比和份数，也可只让部分成员参与。" },
      { title: "核对成员净额", text: "正数表示应收，负数表示应付；系统自动生成尽量精简的转账方案。" },
      { title: "确认实际到账", text: "支持部分或完整转账，确认后重新计算剩余金额，也可撤销并保留历史。" }
    ],
    tips: ["三人均分 300.02 元会固化为 100.01、100.01、100.00 元。", "分享给同行人时优先使用匿名 PDF 或结算图片。"],
    actionLabel: "打开 AA 账本",
    url: "/pages/ledger/index/index",
    tab: true
  },
  {
    id: "wheel",
    navTitle: "转盘",
    icon: "wheel",
    tone: "accent",
    keywords: "选择困难 随机 抽签 手拨 决定",
    title: "决策转盘",
    subtitle: "输入多个选项，点击或手拨做决定",
    intro: "一个转盘可保存 2 至 50 个等概率选项。选项支持编辑、排序、临时停用和移出本轮。",
    flow: [
      { icon: "file", label: "输选项" },
      { icon: "wheel", label: "转一转" },
      { icon: "refresh", label: "再决定" }
    ],
    steps: [
      { title: "批量加入选项", text: "每行输入一个选项，至少启用两个选项后才可旋转。" },
      { title: "开始旋转", text: "可点击按钮，也可直接用手拨动；固定指针决定最终结果。" },
      { title: "处理结果", text: "抽中后可再转一次或移出本轮，每个转盘保留最近 50 条历史。" }
    ],
    tips: ["动画只旋转转盘，页面主体不会抖动。", "多个转盘和抽取历史都会进入完整备份。"],
    actionLabel: "打开决策转盘",
    url: "/pages/wheel/index"
  },
  {
    id: "review",
    navTitle: "回顾",
    icon: "chart",
    tone: "amber",
    keywords: "地图 足迹 统计 故事 年度 回忆 PDF",
    title: "地图、洞察与回忆",
    subtitle: "从记录生成个人旅行视角",
    intro: "旅行工具会基于个人档案生成地图、年度洞察、照片故事和年度回忆册，不需要公开数据。",
    flow: [
      { icon: "map", label: "看足迹" },
      { icon: "chart", label: "看趋势" },
      { icon: "book", label: "做回忆" }
    ],
    steps: [
      { title: "旅行地图", text: "聚合已到访和想去地点，缺少坐标的内容会单独列出。" },
      { title: "旅行洞察", text: "按年份查看最佳体验、城市、标签、评分轨迹和复访变化。" },
      { title: "照片故事", text: "从单条体验选择最多 6 张照片，生成可分享长图。" },
      { title: "年度回忆册", text: "按月份整理年度体验，可生成分享长图或私人多页 PDF。" }
    ],
    tips: ["回忆册分享长图不包含 AA 金额。", "私人回忆册 PDF 可选择加入年度 AA 聚合金额，但不展示成员明细。"],
    actionLabel: "打开旅行洞察",
    url: "/pages/insights/index"
  },
  {
    id: "data",
    navTitle: "数据",
    icon: "database",
    tone: "blue",
    keywords: "备份 恢复 导入 导出 照片二进制 换手机 隐私",
    title: "备份、恢复与隐私",
    subtitle: "本地数据需要主动备份",
    intro: "当前版本没有账号和云同步。重要旅行结束后、更换设备前或清理微信缓存前，请导出完整 JSON 备份。",
    flow: [
      { icon: "database", label: "本地数据" },
      { icon: "download", label: "导出备份" },
      { icon: "upload", label: "校验恢复" }
    ],
    steps: [
      { title: "导出完整备份", text: "v9 备份包含体验、地点、想去、行程、预订、清单、AA、转盘、模板和偏好。" },
      { title: "选择恢复方式", text: "合并导入会保留现有数据；覆盖导入会先列出影响范围。" },
      { title: "理解照片边界", text: "JSON 只保存照片路径与说明，不包含图片二进制，跨设备不会自动带回照片。" },
      { title: "选择隐私版本", text: "私人版用于个人归档；脱敏版隐藏精确日期、价格、等级、私密备注和成员姓名。" }
    ],
    tips: ["恢复任一缓存失败时会自动回滚，避免只恢复一半。", "卸载小程序或清理本地数据可能造成内容丢失。"],
    actionLabel: "打开数据管理",
    url: "/pages/data/index"
  },
  {
    id: "faq",
    navTitle: "问答",
    icon: "alert",
    tone: "accent",
    keywords: "问题 为什么 怎么办 找不到 金额不对",
    title: "常见问题",
    subtitle: "遇到统计、地点、照片或金额问题时先看这里",
    intro: "以下问题覆盖最容易产生疑问的行为。仍无法解决时，先导出完整备份，再进行清理或覆盖恢复。",
    flow: [
      { icon: "search", label: "找问题" },
      { icon: "alert", label: "看原因" },
      { icon: "check", label: "再处理" }
    ],
    steps: [
      { title: "为什么草稿没有分数？", text: "草稿不会进入均分。补齐评分并保存为已完成后才参与统计。" },
      { title: "为什么同名地点没有自动合并？", text: "同名可能是不同分店或城市，系统只给建议，必须由用户确认。" },
      { title: "为什么均分后有人多一分钱？", text: "人民币最小单位是分，无法整除的尾差按稳定成员顺序分配，总额始终守恒。" },
      { title: "为什么恢复后没有照片？", text: "跨设备恢复只有照片元数据，没有原图文件，需要重新添加。" },
      { title: "拒绝位置权限还能保存吗？", text: "可以。地图是可选增强，名称、城市、地区和地址都能手工填写。" }
    ],
    tips: ["涉及金额时，以账本中固化的每人承担金额和结算历史为准。", "任何覆盖导入或清理前，都建议先保存一份新备份。"]
  }
];

function searchableText(section) {
  const stepText = (section.steps || []).map((item) => `${item.title} ${item.text}`).join(" ");
  return [section.navTitle, section.title, section.subtitle, section.intro, section.keywords || "", stepText, ...(section.tips || [])]
    .join(" ")
    .toLowerCase();
}

const SECTIONS = HELP_SECTIONS.map((section) => ({ ...section, searchText: searchableText(section) }));

function visibleSections(keyword, expandedSections) {
  const normalized = String(keyword || "").trim().toLowerCase();
  return SECTIONS
    .filter((section) => !normalized || section.searchText.indexOf(normalized) >= 0)
    .map((section) => ({ ...section, expanded: !!expandedSections[section.id] }));
}

Page({
  data: {
    keyword: "",
    sections: SECTIONS,
    visibleSections: visibleSections("", { quick: true }),
    expandedSections: { quick: true },
    allExpanded: false,
    scrollTarget: ""
  },

  applyView(keyword, expandedSections) {
    const visible = visibleSections(keyword, expandedSections);
    this.setData({
      keyword,
      expandedSections,
      visibleSections: visible,
      allExpanded: !!visible.length && visible.every((section) => section.expanded)
    });
  },

  onSearchInput(event) {
    const keyword = event.detail.value || "";
    const matches = visibleSections(keyword, {});
    const expandedSections = { ...this.data.expandedSections };
    if (keyword.trim()) matches.forEach((section) => { expandedSections[section.id] = true; });
    this.applyView(keyword, expandedSections);
  },

  clearSearch() {
    this.applyView("", { quick: true });
  },

  toggleSection(event) {
    const id = event.currentTarget.dataset.id;
    const expandedSections = { ...this.data.expandedSections, [id]: !this.data.expandedSections[id] };
    this.applyView(this.data.keyword, expandedSections);
  },

  jumpToSection(event) {
    const id = event.currentTarget.dataset.id;
    const expandedSections = { ...this.data.expandedSections, [id]: true };
    this.applyView("", expandedSections);
    this.setData({ scrollTarget: `help-${id}` });
    setTimeout(() => this.setData({ scrollTarget: "" }), 450);
  },

  toggleAll() {
    const nextExpanded = !this.data.allExpanded;
    const expandedSections = { ...this.data.expandedSections };
    this.data.visibleSections.forEach((section) => { expandedSections[section.id] = nextExpanded; });
    this.applyView(this.data.keyword, expandedSections);
  },

  openFeature(event) {
    const url = event.currentTarget.dataset.url;
    if (!url) return;
    if (event.currentTarget.dataset.tab) {
      wx.switchTab({ url });
      return;
    }
    wx.navigateTo({ url });
  }
});
