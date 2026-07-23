const careerGameStore = require("../utils/careerGameStore");

const MAX_NICKNAME_LENGTH = 12;

function characterCount(value) {
  return Array.from(String(value || "")).length;
}

function formatDate(value) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function phaseLabel(phase) {
  return {
    scene: "等待选择",
    outcome: "查看后果",
    chapter: "阶段小结",
    ending: "生涯结局"
  }[phase] || "进行中";
}

function activeRunView(view) {
  if (!view) return null;
  const progress = view.progress || {};
  const stage = view.stage || {};
  return {
    runId: view.runId,
    playerName: view.playerName,
    phase: view.phase,
    phaseLabel: phaseLabel(view.phase),
    stageTitle: stage.title || "职业起点",
    stageRank: stage.rank || "",
    progressText: `${Number(progress.current || 0)} / ${Number(progress.total || 0)}`,
    updatedText: view.status === "completed" ? "已完成" : "自动存档"
  };
}

function archiveRunView(run) {
  return {
    ...run,
    displayDate: formatDate(run.completedAt || run.updatedAt || run.startedAt),
    endingTitle: run.endingTitle || "未抵达结局",
    stageTitle: run.stageTitle || "职业起点",
    choiceCount: Number(run.choiceCount || 0)
  };
}

function endingProgressView(progress) {
  const total = Math.max(1, Number(progress && progress.total || 12));
  const unlocked = Math.min(total, Math.max(0, Number(progress && progress.unlocked || 0)));
  return {
    total,
    unlocked,
    percent: Math.round(unlocked / total * 100)
  };
}

Page({
  data: {
    nickname: "",
    nicknameCount: 0,
    activeRun: null,
    recentRuns: [],
    endingProgress: endingProgressView(null),
    loading: true,
    loadFailed: false,
    starting: false
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    try {
      const currentView = careerGameStore.getCurrentView();
      const archive = careerGameStore.getCareerArchive();
      const progress = careerGameStore.getEndingProgress();
      const activeRun = activeRunView(currentView);
      const nickname = this.data.nickname || activeRun && activeRun.playerName || "";
      this.setData({
        nickname,
        nicknameCount: characterCount(nickname),
        activeRun,
        recentRuns: (Array.isArray(archive) ? archive : [])
          .slice()
          .sort((left, right) => Number(new Date(right.updatedAt || right.completedAt || 0)) - Number(new Date(left.updatedAt || left.completedAt || 0)))
          .slice(0, 3)
          .map(archiveRunView),
        endingProgress: endingProgressView(progress),
        loading: false,
        loadFailed: false
      });
    } catch (error) {
      console.error("加载生涯数据失败", error);
      this.setData({ loading: false, loadFailed: true });
    }
  },

  onNicknameInput(event) {
    const nickname = event.detail.value || "";
    this.setData({
      nickname,
      nicknameCount: characterCount(nickname)
    });
  },

  onNicknameBlur() {
    const nickname = String(this.data.nickname || "").trim();
    this.setData({
      nickname,
      nicknameCount: characterCount(nickname)
    });
  },

  continueActive() {
    if (!this.data.activeRun) return;
    wx.navigateTo({ url: `/packages/tools/career/play?id=${this.data.activeRun.runId}` });
  },

  startNew() {
    if (this.data.starting) return;
    const nickname = String(this.data.nickname || "").trim();
    const count = characterCount(nickname);
    if (!count) {
      wx.showToast({ title: "先输入你的昵称", icon: "none" });
      return;
    }
    if (count > MAX_NICKNAME_LENGTH) {
      wx.showToast({ title: "昵称最多 12 个字", icon: "none" });
      return;
    }
    if (!this.data.activeRun) {
      this.beginRun(nickname, false);
      return;
    }
    wx.showModal({
      title: "重新开始一段生涯？",
      content: "当前进度会保留为中断记录，新生涯将从第一次面试开始。",
      confirmText: "重新开始",
      confirmColor: "#e86343",
      success: (result) => {
        if (result.confirm) this.beginRun(nickname, true);
      }
    });
  },

  beginRun(nickname, restart) {
    this.setData({ starting: true });
    try {
      const run = restart
        ? careerGameStore.restartRun(nickname)
        : careerGameStore.startRun(nickname, Date.now());
      if (!careerGameStore.getCurrentView(run.id)) {
        throw new Error("新生涯没有正确建立");
      }
      wx.navigateTo({ url: `/packages/tools/career/play?id=${run.id}` });
    } catch (error) {
      wx.showModal({
        title: "暂时无法开始",
        content: error.message || "本地存档写入失败，请稍后重试",
        showCancel: false
      });
    } finally {
      this.setData({ starting: false });
    }
  },

  openArchive() {
    wx.navigateTo({ url: "/packages/tools/career/archive" });
  },

  openRecentRun() {
    this.openArchive();
  },

  retryLoad() {
    this.setData({ loading: true });
    this.refresh();
  }
});
