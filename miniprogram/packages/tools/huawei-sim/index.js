const {
  DISCLAIMER,
  EVENTS,
  GLOSSARY,
  GLOSSARY_CATEGORIES,
  SOURCE_SUMMARY,
  STAT_KEYS,
  STAT_META
} = require("../utils/huaweiSimContent");
const huaweiSimEngine = require("../utils/huaweiSimEngine");
const huaweiSimProgressStore = require("../utils/huaweiSimProgressStore");

const CHOICE_MARKS = ["A", "B", "C"];
const FEATURED_TERM_IDS = [
  "pbc",
  "tr",
  "grow-grain",
  "soil-fertility",
  "call-artillery",
  "black-soil",
  "e2e",
  "close-loop",
  "b-front",
  "rd-output"
];

function statViews(stats) {
  return STAT_KEYS.map((key) => ({
    id: key,
    label: STAT_META[key].label,
    shortLabel: STAT_META[key].shortLabel,
    tone: STAT_META[key].tone,
    value: Number(stats[key] || 0)
  }));
}

function deltaViews(deltas) {
  return STAT_KEYS
    .filter((key) => Number(deltas && deltas[key] || 0) !== 0)
    .map((key) => {
      const value = Number(deltas[key]);
      return {
        id: key,
        label: STAT_META[key].shortLabel,
        value,
        text: `${value > 0 ? "+" : ""}${value}`,
        direction: value > 0 ? "up" : "down"
      };
    });
}

function glossaryView(item) {
  return Object.assign({}, item, {
    sourceTone: item.sourceKind === "official"
      ? "official"
      : item.sourceKind === "reported" ? "network" : "public"
  });
}

function readProgress() {
  try {
    return huaweiSimProgressStore.getProgress();
  } catch (error) {
    return huaweiSimProgressStore.normalizeProgress();
  }
}

function explorationView(progress) {
  const normalized = huaweiSimProgressStore.normalizeProgress(progress);
  const seenCount = normalized.seenEventIds.length;
  const totalCount = EVENTS.length;
  const completedRuns = normalized.completedRuns;
  const isFirstVisit = completedRuns === 0 && seenCount === 0;
  const replayEventCount = EVENTS.filter((item) => item.replayOnly).length;
  const unlockedCount = EVENTS.filter((item) => (
    Number(item.unlockRun || 1) <= completedRuns + 1
  )).length;
  let title = "首轮完成后解锁复玩支线";
  let detail = `先体验核心题库；完成后开放 ${replayEventCount} 个新情景，之后每局优先抽未见内容。`;
  if (!isFirstVisit && completedRuns === 0) {
    title = "继续探索，先避开已经见过的题";
    detail = `当前已见 ${seenCount} 个情景；完成首轮后还会解锁 ${replayEventCount} 个复玩支线。`;
  } else if (completedRuns > 0) {
    title = `第 ${completedRuns + 1} 次模拟，优先安排新情景`;
    detail = seenCount < totalCount
      ? `已见 ${seenCount} / ${totalCount} 个情景，本轮先抽未见题，近期题目放到最后。`
      : "题库已经全部遇见过，本轮会优先选择出现次数更少、近期没出现的情景。";
  }
  return {
    completedRuns,
    detail,
    isFirstVisit,
    percent: Math.round((seenCount / totalCount) * 100),
    seenCount,
    startLabel: isFirstVisit ? "开始情景模拟" : "继续探索新情景",
    title,
    totalCount,
    unlockedCount
  };
}

function runView(run) {
  const current = huaweiSimEngine.getCurrentEvent(run);
  if (!current) return null;
  const stage = huaweiSimEngine.getStageById(current.stageId);
  const term = huaweiSimEngine.getGlossaryById(current.termId);
  const completedChoices = run.history.length;
  const progress = Math.round((completedChoices / huaweiSimEngine.TOTAL_EVENTS) * 100);
  return {
    eventId: current.id,
    stageTitle: stage ? stage.title : "研发现场",
    stageSubtitle: stage ? stage.subtitle : "",
    eventNumber: run.eventIndex + 1,
    totalEvents: huaweiSimEngine.TOTAL_EVENTS,
    progress,
    title: current.title,
    situation: current.situation,
    term: glossaryView(term),
    noveltyLabel: run.replayEventIds.includes(current.id)
      ? "复玩解锁"
      : run.newEventIds.includes(current.id) ? "首次遇见" : "",
    noveltyTone: run.replayEventIds.includes(current.id) ? "replay" : "new",
    stats: statViews(run.stats),
    choices: current.choices.map((item, index) => ({
      id: item.id,
      mark: CHOICE_MARKS[index] || String(index + 1),
      text: item.text,
      tags: item.tags
    })),
    isFeedback: run.phase === "feedback",
    feedback: run.lastOutcome ? {
      outcome: run.lastOutcome.outcome,
      choiceText: run.lastOutcome.choiceText,
      deltas: deltaViews(run.lastOutcome.deltas)
    } : null,
    continueLabel: run.eventIndex === run.eventIds.length - 1
      ? "查看我的研发画像"
      : "进入下一情景"
  };
}

function resultView(run, progress) {
  const result = huaweiSimEngine.buildResult(run);
  const exploration = explorationView(progress);
  const newCount = result.history.filter((entry) => run.newEventIds.includes(entry.eventId)).length;
  return {
    persona: result.persona,
    stats: statViews(result.stats),
    keywords: result.keywords,
    choiceCount: result.choiceCount,
    exploration: {
      completedRuns: exploration.completedRuns,
      newCount,
      percent: exploration.percent,
      seenCount: exploration.seenCount,
      totalCount: exploration.totalCount
    },
    history: result.history.map((entry, index) => {
      const term = huaweiSimEngine.getGlossaryById(entry.termId);
      return {
        id: `${entry.eventId}-${index}`,
        index: index + 1,
        eventTitle: entry.eventTitle,
        term: term ? term.term : "研发现场",
        choiceText: entry.choiceText
      };
    })
  };
}

function filteredGlossary(query, category) {
  return huaweiSimEngine.searchGlossary(query, category).map(glossaryView);
}

Page({
  data: {
    activeTab: "simulation",
    screen: "intro",
    runView: null,
    resultView: null,
    disclaimer: DISCLAIMER,
    sourceSummary: SOURCE_SUMMARY,
    contentStats: {
      termCount: GLOSSARY.length,
      eventCount: EVENTS.length,
      choicesPerRun: huaweiSimEngine.TOTAL_EVENTS,
      replayEventCount: EVENTS.filter((item) => item.replayOnly).length
    },
    exploration: explorationView(huaweiSimProgressStore.normalizeProgress()),
    featuredTerms: FEATURED_TERM_IDS
      .map((id) => huaweiSimEngine.getGlossaryById(id))
      .filter(Boolean)
      .map(glossaryView),
    glossaryCategories: GLOSSARY_CATEGORIES,
    glossaryCategory: "all",
    glossaryQuery: "",
    glossaryResults: filteredGlossary("", "all")
  },

  onLoad() {
    this.run = null;
    this.progress = readProgress();
    this.setData({ exploration: explorationView(this.progress) });
  },

  onUnload() {
    this.run = null;
  },

  switchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== "simulation" && tab !== "glossary") return;
    this.setData({ activeTab: tab });
  },

  startSimulation() {
    const timestamp = new Date().toISOString();
    this.progress = readProgress();
    this.run = huaweiSimEngine.createRun({
      seed: `${timestamp}:${Math.random()}`,
      timestamp,
      ...huaweiSimProgressStore.getSelectionProfile(this.progress)
    });
    const current = huaweiSimEngine.getCurrentEvent(this.run);
    if (current) {
      try {
        this.progress = huaweiSimProgressStore.markEventSeen(current.id);
      } catch (error) {
        // Exploration history is optional; simulation must still work when storage is unavailable.
      }
    }
    this.setData({
      activeTab: "simulation",
      screen: "run",
      runView: runView(this.run),
      resultView: null,
      exploration: explorationView(this.progress)
    });
    if (wx.vibrateShort) wx.vibrateShort({ type: "light" });
  },

  chooseOption(event) {
    if (!this.run || this.run.phase !== "scene") return;
    const choiceId = event.currentTarget.dataset.id;
    try {
      this.run = huaweiSimEngine.resolveChoice(
        this.run,
        this.run.eventIds[this.run.eventIndex],
        choiceId
      );
      this.setData({ runView: runView(this.run) });
      if (wx.vibrateShort) wx.vibrateShort({ type: "medium" });
    } catch (error) {
      wx.showToast({ title: error.message || "暂时无法选择", icon: "none" });
    }
  },

  continueSimulation() {
    if (!this.run || this.run.phase !== "feedback") return;
    try {
      this.run = huaweiSimEngine.continueRun(this.run);
      if (this.run.status === "completed") {
        try {
          this.progress = huaweiSimProgressStore.recordRunCompleted(this.run.seed);
        } catch (error) {
          // Result rendering does not depend on writing exploration history.
        }
        this.setData({
          screen: "result",
          runView: null,
          resultView: resultView(this.run, this.progress),
          exploration: explorationView(this.progress)
        });
      } else {
        const current = huaweiSimEngine.getCurrentEvent(this.run);
        if (current) {
          try {
            this.progress = huaweiSimProgressStore.markEventSeen(current.id);
          } catch (error) {
            // Keep the current run playable if optional progress storage fails.
          }
        }
        this.setData({ runView: runView(this.run) });
      }
    } catch (error) {
      wx.showToast({ title: error.message || "暂时无法继续", icon: "none" });
    }
  },

  restartSimulation() {
    const restart = () => this.startSimulation();
    if (!this.run || this.run.status === "completed") {
      restart();
      return;
    }
    wx.showModal({
      title: "重新开始模拟？",
      content: "当前选择和结果会清空；已经见过的题仍会记录，用来减少下一局重复。",
      confirmText: "重新开始",
      confirmColor: "#c4473a",
      success(result) {
        if (result.confirm) restart();
      }
    });
  },

  backToIntro() {
    this.run = null;
    this.progress = readProgress();
    this.setData({
      screen: "intro",
      runView: null,
      resultView: null,
      exploration: explorationView(this.progress)
    });
  },

  copyResult() {
    if (!this.run || this.run.status !== "completed") return;
    wx.setClipboardData({
      data: huaweiSimEngine.formatSummary(this.run),
      success() {
        wx.showToast({ title: "模拟总结已复制", icon: "success" });
      }
    });
  },

  onGlossaryInput(event) {
    const glossaryQuery = event.detail.value || "";
    this.setData({
      glossaryQuery,
      glossaryResults: filteredGlossary(glossaryQuery, this.data.glossaryCategory)
    });
  },

  clearGlossarySearch() {
    this.setData({
      glossaryQuery: "",
      glossaryResults: filteredGlossary("", this.data.glossaryCategory)
    });
  },

  selectGlossaryCategory(event) {
    const glossaryCategory = event.currentTarget.dataset.id;
    if (!GLOSSARY_CATEGORIES.some((item) => item.id === glossaryCategory)) return;
    this.setData({
      glossaryCategory,
      glossaryResults: filteredGlossary(this.data.glossaryQuery, glossaryCategory)
    });
  },

  copyGlossaryTerm(event) {
    const item = huaweiSimEngine.getGlossaryById(event.currentTarget.dataset.id);
    if (!item) return;
    wx.setClipboardData({
      data: `${item.term}：${item.plain}\n${item.usage}`,
      success() {
        wx.showToast({ title: "词条已复制", icon: "success" });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: "华子研发模拟：每次复玩，优先遇见新情景",
      path: "/packages/tools/huawei-sim/index"
    };
  }
});
