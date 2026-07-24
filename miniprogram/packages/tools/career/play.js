const careerGameStore = require("../utils/careerGameStore");

const STAGE_ASSETS = {
  1: "/packages/tools/career/assets/stage-01.svg",
  2: "/packages/tools/career/assets/stage-02.svg",
  3: "/packages/tools/career/assets/stage-03.svg",
  4: "/packages/tools/career/assets/stage-04.svg",
  5: "/packages/tools/career/assets/stage-05.svg",
  6: "/packages/tools/career/assets/stage-06.svg"
};

const VALID_PHASES = ["scene", "outcome", "chapter", "ending"];
const VALID_TONES = ["blue", "green", "coral", "gold", "navy", "red"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function stageIndex(stage) {
  const explicit = Number(stage && (stage.index || stage.order));
  if (explicit >= 1 && explicit <= 6) return explicit;
  const matched = String(stage && stage.id || "").match(/(?:stage[_-]?)?([1-6])/i);
  return matched ? Number(matched[1]) : 1;
}

function illustrationPath(stage) {
  const source = String(stage && stage.illustration || "").trim();
  if (source.charAt(0) === "/") return source;
  if (source.endsWith(".svg")) {
    return `/packages/tools/career/assets/${source.split("/").pop()}`;
  }
  return STAGE_ASSETS[stageIndex(stage)] || STAGE_ASSETS[1];
}

function statView(stat, index) {
  const value = clamp(stat && stat.value, 0, 100);
  const tone = VALID_TONES.indexOf(stat && stat.tone) >= 0
    ? stat.tone
    : ["blue", "green", "coral", "gold", "navy"][index] || "blue";
  return {
    key: stat && stat.key || `stat-${index}`,
    label: stat && stat.label || "属性",
    value,
    tone,
    warning: !!(stat && stat.warning),
    meterWidth: value
  };
}

function deltaView(delta, index) {
  const value = Number(delta && delta.value || 0);
  return {
    key: delta && delta.key || `delta-${index}`,
    label: delta && delta.label || "属性",
    value,
    displayValue: value > 0 ? `+${value}` : String(value),
    direction: value > 0 ? "positive" : value < 0 ? "negative" : "neutral"
  };
}

function echoView(echo, index) {
  if (typeof echo === "string") {
    return { id: `echo-${index}`, text: echo, deltas: [] };
  }
  return {
    ...(echo || {}),
    id: echo && echo.id || `echo-${index}`,
    text: echo && echo.text || "",
    deltas: (echo && Array.isArray(echo.deltas) ? echo.deltas : []).map(deltaView)
  };
}

function safeVibrate(type = "light") {
  if (!wx.vibrateShort) return;
  try {
    wx.vibrateShort({ type });
  } catch (error) {
    // Haptics are optional and must not block a choice.
  }
}

function normalizeView(view) {
  if (!view) return null;
  const stage = view.stage || {};
  const progress = view.progress || {};
  const current = Math.max(0, Number(progress.current || 0));
  const total = Math.max(1, Number(progress.total || 1));
  const phase = VALID_PHASES.indexOf(view.phase) >= 0 ? view.phase : "scene";
  return {
    ...view,
    phase,
    mode: view.mode || { id: "free", label: "自由模拟", shortLabel: "自由模拟" },
    persona: view.persona || {
      id: "uncompiled",
      title: "待编译新人",
      description: "职业画像仍在形成",
      icon: "code",
      tone: "muted"
    },
    signal: view.signal || {
      title: "职业信号",
      text: "每一次选择都会留下痕迹",
      icon: "sparkles",
      tone: "blue"
    },
    keywords: (Array.isArray(view.keywords) ? view.keywords : []).slice(0, 3),
    foreshadowCount: Math.max(0, Number(view.foreshadowCount || 0)),
    foreshadowText: String(view.foreshadowText || ""),
    stage: {
      ...stage,
      index: stageIndex(stage),
      illustrationPath: illustrationPath(stage)
    },
    stats: (Array.isArray(view.stats) ? view.stats : []).slice(0, 5).map(statView),
    progress: {
      ...progress,
      current,
      total,
      percent: Math.round(clamp(current / total * 100, 0, 100)),
      chapterCurrent: Math.max(0, Number(progress.chapterCurrent || 0)),
      chapterTotal: Math.max(1, Number(progress.chapterTotal || 1))
    },
    scene: {
      ...(view.scene || {}),
      choices: (view.scene && Array.isArray(view.scene.choices) ? view.scene.choices : []).slice(0, 4)
    },
    outcome: {
      ...(view.outcome || {}),
      deltas: (view.outcome && Array.isArray(view.outcome.deltas) ? view.outcome.deltas : []).map(deltaView),
      echoes: (view.outcome && Array.isArray(view.outcome.echoes) ? view.outcome.echoes : []).map(echoView)
    },
    chapter: {
      ...(view.chapter || {}),
      deltas: (view.chapter && Array.isArray(view.chapter.deltas) ? view.chapter.deltas : []).map(deltaView),
      style: view.chapter && view.chapter.style || {},
      turningPoint: view.chapter && view.chapter.turningPoint || null
    },
    ending: view.ending || {}
  };
}

Page({
  data: {
    runId: "",
    view: null,
    loading: true,
    missing: false,
    choosingId: "",
    advancing: false,
    scrollTop: 0
  },

  onLoad(options = {}) {
    this.setData({ runId: String(options.id || "") });
    this.loadCurrentView();
  },

  onShow() {
    if (!this.data.loading) this.loadCurrentView(false);
  },

  loadCurrentView(resetScroll = true) {
    try {
      const view = normalizeView(careerGameStore.getCurrentView(this.data.runId || undefined));
      if (!view) {
        this.setData({ view: null, loading: false, missing: true });
        return;
      }
      const nextData = {
        runId: view.runId,
        view,
        loading: false,
        missing: false,
        choosingId: "",
        advancing: false
      };
      if (resetScroll) nextData.scrollTop = 0;
      this.setData(nextData);
    } catch (error) {
      console.error("加载当前生涯失败", error);
      this.setData({ view: null, loading: false, missing: true });
    }
  },

  chooseOption(event) {
    const view = this.data.view;
    if (!view || view.phase !== "scene" || this.data.choosingId) return;
    const choiceId = event.currentTarget.dataset.choiceId;
    if (!choiceId) return;
    this.setData({ choosingId: choiceId });
    try {
      careerGameStore.applyChoice(view.runId, view.scene.id, choiceId);
      safeVibrate("light");
      this.loadCurrentView();
    } catch (error) {
      this.setData({ choosingId: "" });
      wx.showModal({
        title: "选择没有保存",
        content: error.message || "本地写入失败，请重新选择",
        showCancel: false
      });
    }
  },

  advance() {
    const view = this.data.view;
    if (!view || this.data.advancing || view.phase === "scene" || view.phase === "ending") return;
    this.setData({ advancing: true });
    try {
      careerGameStore.continueRun(view.runId);
      safeVibrate(view.phase === "chapter" ? "medium" : "light");
      this.loadCurrentView();
    } catch (error) {
      this.setData({ advancing: false });
      wx.showModal({
        title: "暂时无法继续",
        content: error.message || "本地存档写入失败，请稍后重试",
        showCancel: false
      });
    }
  },

  restartCareer() {
    const playerName = this.data.view && this.data.view.playerName;
    if (!playerName) return;
    wx.showModal({
      title: "再走一条职业路线？",
      content: "本次结果会保留在生涯档案中，新的模拟从求职阶段开始。",
      confirmText: "重新模拟",
      confirmColor: "#e86343",
      success: (result) => {
        if (!result.confirm) return;
        try {
          const options = this.data.view.mode && this.data.view.mode.id === "daily"
            ? {
              mode: "daily",
              challengeDate: this.data.view.mode.challengeDate
            }
            : { mode: "free" };
          const run = careerGameStore.restartRun(playerName, options);
          this.setData({ runId: run.id });
          safeVibrate("medium");
          this.loadCurrentView();
        } catch (error) {
          wx.showToast({ title: error.message || "无法重新模拟", icon: "none" });
        }
      }
    });
  },

  openArchive() {
    wx.navigateTo({ url: "/packages/tools/career/archive" });
  },

  copyCareerSummary() {
    const runId = this.data.runId;
    if (!runId) return;
    try {
      const summary = careerGameStore.buildCareerSummary(runId);
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
          safeVibrate("light");
          wx.showToast({ title: "生涯总结已复制", icon: "success" });
        },
        fail: () => wx.showToast({ title: "复制失败，请稍后重试", icon: "none" })
      });
    } catch (error) {
      wx.showToast({ title: error.message || "暂时无法生成总结", icon: "none" });
    }
  },

  returnToCareer() {
    wx.navigateBack({
      fail: () => wx.redirectTo({ url: "/packages/tools/career/index" })
    });
  }
});
