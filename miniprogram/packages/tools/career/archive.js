const careerGameStore = require("../utils/careerGameStore");

function formatDate(value) {
  if (!value) return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function statView(stat, index) {
  return {
    key: stat && stat.key || `stat-${index}`,
    label: stat && stat.label || "属性",
    value: Math.min(100, Math.max(0, Number(stat && stat.value || 0)))
  };
}

function keyChoiceView(choice, index) {
  if (typeof choice === "string") {
    return {
      key: `choice-${index}`,
      eventTitle: "",
      choiceText: choice,
      outcome: ""
    };
  }
  return {
    key: `${choice && choice.eventTitle || "choice"}-${index}`,
    eventTitle: choice && choice.eventTitle || "",
    choiceText: choice && choice.choiceText || "",
    outcome: choice && choice.outcome || ""
  };
}

function archiveRunView(run, expandedIds) {
  const id = run.id;
  return {
    ...run,
    endingTitle: run.endingTitle || "未抵达结局",
    stageTitle: run.stageTitle || "职业起点",
    modeLabel: run.mode && run.mode.shortLabel || "自由生涯",
    personaTitle: run.persona && run.persona.title || "待编译新人",
    personaIcon: run.persona && run.persona.icon || "code",
    personaTone: run.persona && run.persona.tone || "muted",
    keywords: (Array.isArray(run.keywords) ? run.keywords : []).slice(0, 3),
    statusLabel: run.status === "completed" ? "已抵达结局" : "中断存档",
    choiceCount: Number(run.choiceCount || 0),
    displayDate: formatDate(run.completedAt || run.updatedAt || run.startedAt),
    finalStats: (Array.isArray(run.finalStats) ? run.finalStats : []).slice(0, 5).map(statView),
    keyChoices: (Array.isArray(run.keyChoices) ? run.keyChoices : []).map(keyChoiceView),
    expanded: !!expandedIds[id]
  };
}

function progressView(progress) {
  const total = Math.max(1, Number(progress && progress.total || 12));
  const unlocked = Math.min(total, Math.max(0, Number(progress && progress.unlocked || 0)));
  return {
    total,
    unlocked,
    percent: Math.round(unlocked / total * 100),
    items: (progress && Array.isArray(progress.items) ? progress.items : []).map((item, index) => ({
      ...item,
      number: String(index + 1).padStart(2, "0"),
      displayTitle: item.unlocked ? item.title : "尚未解锁"
    }))
  };
}

function achievementView(progress) {
  const total = Math.max(1, Number(progress && progress.total || 12));
  const unlocked = Math.min(total, Math.max(0, Number(progress && progress.unlocked || 0)));
  return {
    total,
    unlocked,
    percent: Math.round(unlocked / total * 100),
    items: (progress && Array.isArray(progress.items) ? progress.items : []).map((item, index) => ({
      ...item,
      number: item.number || String(index + 1).padStart(2, "0")
    }))
  };
}

Page({
  data: {
    progress: progressView(null),
    achievements: achievementView(null),
    runs: [],
    expandedIds: {},
    loading: true,
    loadFailed: false
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    try {
      const archive = careerGameStore.getCareerArchive();
      const progress = careerGameStore.getEndingProgress();
      const achievements = careerGameStore.getAchievementProgress();
      const expandedIds = this.data.expandedIds;
      this.setData({
        progress: progressView(progress),
        achievements: achievementView(achievements),
        runs: (Array.isArray(archive) ? archive : [])
          .slice()
          .sort((left, right) => Number(new Date(right.completedAt || right.updatedAt || 0)) - Number(new Date(left.completedAt || left.updatedAt || 0)))
          .map((run) => archiveRunView(run, expandedIds)),
        loading: false,
        loadFailed: false
      });
    } catch (error) {
      console.error("加载生涯档案失败", error);
      this.setData({ loading: false, loadFailed: true });
    }
  },

  toggleRun(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const expandedIds = {
      ...this.data.expandedIds,
      [id]: !this.data.expandedIds[id]
    };
    this.setData({
      expandedIds,
      runs: this.data.runs.map((run) => ({ ...run, expanded: !!expandedIds[run.id] }))
    });
  },

  copyRunSummary(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    try {
      const summary = careerGameStore.buildCareerSummary(id);
      if (!wx.setClipboardData) {
        wx.showModal({
          title: "生涯总结",
          content: summary,
          showCancel: false
        });
        return;
      }
      wx.setClipboardData({
        data: summary,
        success: () => {
          if (wx.vibrateShort) wx.vibrateShort({ type: "light" });
          wx.showToast({ title: "生涯总结已复制", icon: "success" });
        },
        fail: () => wx.showToast({ title: "复制失败，请稍后重试", icon: "none" })
      });
    } catch (error) {
      wx.showToast({ title: error.message || "暂时无法生成总结", icon: "none" });
    }
  },

  retryLoad() {
    this.setData({ loading: true });
    this.refresh();
  }
});
