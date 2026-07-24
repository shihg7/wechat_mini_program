const {
  STAGES,
  STAT_KEYS,
  STAT_META
} = require("./careerGameContent");

const MODE_FREE = "free";
const MODE_DAILY = "daily";
const MODES = [MODE_FREE, MODE_DAILY];

const STYLE_GROUPS = [
  {
    id: "deep-tech",
    title: "技术深潜",
    description: "你倾向于用更扎实的工程能力换取确定性。",
    tags: ["技术", "架构", "深度", "文档", "学习", "严谨", "标准"]
  },
  {
    id: "team-link",
    title: "团队连接",
    description: "你习惯先让人和信息流动起来，再推动事情落地。",
    tags: ["沟通", "团队", "协作", "带教", "领导", "管理", "信任"]
  },
  {
    id: "opportunity",
    title: "机会捕手",
    description: "你愿意承担波动，换取更大的选择空间。",
    tags: ["冒险", "财富", "创业", "产品", "谈判", "机会", "副业"]
  },
  {
    id: "sustainable",
    title: "节奏守护",
    description: "你会主动管理边界，不让职业吞掉生活本身。",
    tags: ["生活", "边界", "平衡", "恢复", "长期", "稳定", "克制"]
  },
  {
    id: "influence",
    title: "影响扩散",
    description: "你在把个人能力变成他人可见、可复用的影响。",
    tags: ["影响", "开源", "分享", "展示", "传承", "公共资产", "声誉"]
  }
];

const PERSONAS = [
  {
    id: "deep-builder",
    title: "深潜工程师",
    description: "你相信复杂问题最终要靠扎实的技术判断拆开。",
    icon: "code",
    tone: "blue",
    weights: { tech: 1.25, communication: 0.15, energy: 0.1, savings: 0.1, influence: 0.25 },
    flags: ["architecture", "documentation", "learning", "reliability"],
    tags: ["技术", "架构", "深度", "严谨"]
  },
  {
    id: "team-catalyst",
    title: "团队催化剂",
    description: "你的价值不只在产出代码，也在让一群人更顺畅地前进。",
    icon: "users",
    tone: "green",
    weights: { tech: 0.25, communication: 1.15, energy: 0.2, savings: 0.05, influence: 0.75 },
    flags: ["teamwork", "mentoring", "leadership", "management"],
    tags: ["沟通", "团队", "带教", "领导", "管理"]
  },
  {
    id: "indie-maker",
    title: "独立造物者",
    description: "你想把能力变成自己的产品、现金流和选择权。",
    icon: "zap",
    tone: "accent",
    weights: { tech: 0.7, communication: 0.2, energy: 0.2, savings: 0.9, influence: 0.45 },
    flags: ["sideProject", "independence", "product", "ownership"],
    tags: ["独立", "产品", "副业", "创造", "财富"]
  },
  {
    id: "frontier-lead",
    title: "机会开拓者",
    description: "你擅长在信息不完整时下注，并把机会推成现实。",
    icon: "route",
    tone: "amber",
    weights: { tech: 0.25, communication: 0.7, energy: 0.15, savings: 0.5, influence: 1.0 },
    flags: ["entrepreneurship", "networking", "negotiation", "visibility"],
    tags: ["冒险", "创业", "谈判", "机会", "影响"]
  },
  {
    id: "long-term",
    title: "长期建设者",
    description: "你更在意系统能否持续运行，而不是一时跑得多快。",
    icon: "shield",
    tone: "green",
    weights: { tech: 0.55, communication: 0.35, energy: 0.85, savings: 0.25, influence: 0.2 },
    flags: ["balance", "integrity", "reliability", "documentation"],
    tags: ["长期", "稳健", "生活", "边界", "原则"]
  },
  {
    id: "org-pilot",
    title: "组织掌舵人",
    description: "你开始用方向、机制和信任，而不只是个人产出来解决问题。",
    icon: "chart",
    tone: "blue",
    weights: { tech: 0.35, communication: 0.9, energy: 0.2, savings: 0.1, influence: 1.0 },
    flags: ["leadership", "management", "politics", "crisisHandled"],
    tags: ["领导", "管理", "组织", "决策", "责任"]
  }
];

const ACHIEVEMENTS = [
  { id: "first-choice", title: "Hello, World", hint: "做出第一个职业选择。", icon: "play", tone: "blue", target: 1 },
  { id: "first-stage", title: "熬过试用期", hint: "完整走过一个职业阶段。", icon: "check", tone: "green", target: 1 },
  { id: "first-ending", title: "跑到答案", hint: "完成第一段程序员生涯。", icon: "route", tone: "accent", target: 1 },
  { id: "daily", title: "今日有解", hint: "在今日挑战中做出选择。", icon: "calendar", tone: "amber", target: 1 },
  { id: "replay", title: "平行宇宙", hint: "完成两段不同的生涯。", icon: "refresh", tone: "blue", target: 2 },
  { id: "deep-tech", title: "技术硬通货", hint: "任一存档的技术力达到 80。", icon: "code", tone: "blue", target: 80 },
  { id: "trusted-voice", title: "可信的声音", hint: "沟通力达到 75，影响力达到 65。", icon: "users", tone: "green", target: 1 },
  { id: "runway", title: "选择的底气", hint: "任一存档的积蓄达到 70。", icon: "wallet", tone: "amber", target: 70 },
  { id: "sustainable", title: "可持续运行", hint: "带着生活边界和 65 点精力抵达结局。", icon: "heart", tone: "green", target: 1 },
  { id: "firefighter", title: "生产守夜人", hint: "成功处理一次职业危机。", icon: "alert", tone: "accent", target: 1 },
  { id: "six-endings", title: "六面人生", hint: "解锁六种不同结局。", icon: "book", tone: "blue", target: 6 },
  { id: "all-endings", title: "职业万花筒", hint: "解锁全部十二种结局。", icon: "sparkles", tone: "amber", target: 12 }
];

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function normalizeMode(value) {
  return MODES.indexOf(value) >= 0 ? value : MODE_FREE;
}

function localDateKey(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (number) => String(number).padStart(2, "0");
  return `${safeDate.getFullYear()}-${pad(safeDate.getMonth() + 1)}-${pad(safeDate.getDate())}`;
}

function getDailyChallenge(value = new Date()) {
  const date = localDateKey(value);
  const parts = date.split("-").map(Number);
  return {
    date,
    label: `${parts[1]} 月 ${parts[2]} 日`,
    shortLabel: `${parts[1]}.${parts[2]}`,
    seed: `career-daily-v1:${date}`,
    description: "今天的事件池固定，适合与朋友对照不同选择。"
  };
}

function getModeInfo(run = {}) {
  const id = normalizeMode(run.mode);
  if (id === MODE_DAILY) {
    const challenge = getDailyChallenge(run.challengeDate || run.startedAt);
    return {
      id,
      label: "今日挑战",
      shortLabel: `挑战 ${challenge.shortLabel}`,
      description: challenge.description,
      challengeDate: challenge.date,
      icon: "calendar",
      tone: "amber"
    };
  }
  return {
    id,
    label: "自由生涯",
    shortLabel: "自由生涯",
    description: "每次开局都会抽取新的种子事件。",
    challengeDate: "",
    icon: "route",
    tone: "blue"
  };
}

function historyItems(runOrHistory) {
  if (Array.isArray(runOrHistory)) return runOrHistory;
  return Array.isArray(runOrHistory && runOrHistory.history) ? runOrHistory.history : [];
}

function countTags(runOrHistory) {
  return historyItems(runOrHistory).reduce((counts, entry) => {
    (entry.tags || []).forEach((tag) => {
      const key = String(tag || "").trim();
      if (key) counts[key] = Number(counts[key] || 0) + 1;
    });
    return counts;
  }, {});
}

function getTopKeywords(runOrHistory, limit = 3) {
  const counts = countTags(runOrHistory);
  return Object.keys(counts)
    .sort((left, right) => counts[right] - counts[left] || left.localeCompare(right, "zh-CN"))
    .slice(0, Math.max(0, Number(limit) || 0));
}

function getChoiceStyle(runOrHistory) {
  const tags = countTags(runOrHistory);
  const ranked = STYLE_GROUPS.map((style, index) => ({
    ...style,
    score: style.tags.reduce((sum, tag) => sum + Number(tags[tag] || 0), 0),
    index
  })).sort((left, right) => right.score - left.score || left.index - right.index);
  const top = ranked[0];
  if (!top || top.score <= 0) {
    return {
      id: "steady",
      title: "稳步推进",
      description: "你还没有形成固定路线，职业可能性仍然很宽。",
      score: 0
    };
  }
  return {
    id: top.id,
    title: top.title,
    description: top.description,
    score: top.score
  };
}

function getPersona(run = {}) {
  const history = historyItems(run);
  const stats = run.stats || {};
  const values = STAT_KEYS.map((key) => clamp(stats[key], 0, 100));
  if (!history.length) {
    return {
      id: "uncompiled",
      title: "待编译新人",
      description: "第一份选择还没提交，一切职业分支都处于可达状态。",
      icon: "code",
      tone: "muted"
    };
  }
  if (Number(stats.energy || 0) <= 15) {
    return {
      id: "overloaded",
      title: "红线冲锋者",
      description: "你还在向前，但系统资源已经接近极限。",
      icon: "alert",
      tone: "accent"
    };
  }
  if (values.every((value) => value >= 55) && Math.max(...values) - Math.min(...values) <= 22) {
    return {
      id: "balanced-builder",
      title: "六边形建设者",
      description: "你没有把未来押在单一能力上，职业韧性正在形成。",
      icon: "sparkles",
      tone: "amber"
    };
  }
  const tags = countTags(history);
  const flags = run.flags || {};
  const ranked = PERSONAS.map((persona, index) => {
    const statScore = Object.keys(persona.weights).reduce(
      (sum, key) => sum + Number(persona.weights[key] || 0) * Number(stats[key] || 0),
      0
    );
    const flagScore = persona.flags.reduce((sum, flag) => sum + (flags[flag] ? 22 : 0), 0);
    const tagScore = persona.tags.reduce((sum, tag) => sum + Number(tags[tag] || 0) * 7, 0);
    return { ...persona, score: statScore + flagScore + tagScore, index };
  }).sort((left, right) => right.score - left.score || left.index - right.index);
  const top = ranked[0];
  return {
    id: top.id,
    title: top.title,
    description: top.description,
    icon: top.icon,
    tone: top.tone
  };
}

function statDeltaItems(startStats = {}, endStats = {}) {
  return STAT_KEYS.map((key) => {
    const value = Number(endStats[key] || 0) - Number(startStats[key] || 0);
    return {
      key,
      label: STAT_META[key] && STAT_META[key].label || key,
      value,
      displayValue: value > 0 ? `+${value}` : String(value),
      direction: value > 0 ? "positive" : value < 0 ? "negative" : "neutral"
    };
  });
}

function getStageReport(run = {}, stageIndex = Number(run.stageIndex || 0)) {
  const stage = STAGES[stageIndex] || STAGES[0];
  const entries = historyItems(run).filter((entry) => entry.stageId === stage.id);
  const style = getChoiceStyle(entries);
  const deltas = statDeltaItems(run.stageStartStats || run.stats, run.stats);
  const changed = deltas.slice().sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
  const dominant = changed[0];
  const turningPoint = entries.slice().sort((left, right) => {
    const impact = (entry) => Object.keys(entry.deltas || {})
      .reduce((sum, key) => sum + Math.abs(Number(entry.deltas[key] || 0)), 0);
    return impact(right) - impact(left);
  })[0] || null;
  let trend = "这一章没有明显偏科，你把更多可能性留给了下一阶段。";
  if (dominant && dominant.value) {
    trend = dominant.value > 0
      ? `${dominant.label}成为本章增长最快的能力，净变化 ${dominant.displayValue}。`
      : `${dominant.label}消耗最明显，净变化 ${dominant.displayValue}，下一阶段需要留意。`;
  }
  const nextStage = STAGES[stageIndex + 1];
  return {
    title: `${stage.title}完成`,
    summary: `这一章你走出了“${style.title}”路线。${trend}`,
    style,
    deltas,
    turningPoint: turningPoint ? {
      eventTitle: turningPoint.eventTitle,
      choiceText: turningPoint.choiceText
    } : null,
    pendingCount: (run.pendingEffects || []).length,
    nextTitle: nextStage ? nextStage.title : "职业答案",
    nextTease: nextStage ? nextStage.subtitle : "所有选择即将汇总成你的职业答案"
  };
}

function getCareerSignal(run = {}) {
  const stats = run.stats || {};
  const echoes = run.lastOutcome && run.lastOutcome.echoes || [];
  const pendingCount = (run.pendingEffects || []).length;
  if (echoes.length) {
    return {
      title: "旧选择回来了",
      text: `${echoes.length} 个早先决定刚刚产生远期后果。`,
      icon: "zap",
      tone: "amber"
    };
  }
  if (Number(stats.energy || 0) <= 15) {
    return {
      title: "系统资源告急",
      text: "精力已进入红线，后续事件可能更偏向危机与恢复。",
      icon: "alert",
      tone: "accent"
    };
  }
  if (pendingCount) {
    return {
      title: "伏笔仍在发酵",
      text: `${pendingCount} 个选择尚未显现全部后果。`,
      icon: "clock",
      tone: "blue"
    };
  }
  const persona = getPersona(run);
  return {
    title: persona.title,
    text: persona.description,
    icon: persona.icon,
    tone: persona.tone
  };
}

function achievementContext(runs) {
  const list = Array.isArray(runs) ? runs : [];
  const completed = list.filter((run) => run.status === "completed" && run.endingId);
  const endings = new Set(completed.map((run) => run.endingId));
  const anyRun = (predicate) => list.some(predicate);
  return {
    list,
    completed,
    endings,
    values: {
      "first-choice": anyRun((run) => historyItems(run).length >= 1) ? 1 : 0,
      "first-stage": anyRun((run) => Number(run.stageIndex || 0) >= 1 || historyItems(run).length >= 6) ? 1 : 0,
      "first-ending": completed.length ? 1 : 0,
      daily: anyRun((run) => normalizeMode(run.mode) === MODE_DAILY && historyItems(run).length) ? 1 : 0,
      replay: completed.length,
      "deep-tech": list.reduce((max, run) => Math.max(max, Number(run.stats && run.stats.tech || 0)), 0),
      "trusted-voice": anyRun((run) => (
        Number(run.stats && run.stats.communication || 0) >= 75
        && Number(run.stats && run.stats.influence || 0) >= 65
      )) ? 1 : 0,
      runway: list.reduce((max, run) => Math.max(max, Number(run.stats && run.stats.savings || 0)), 0),
      sustainable: completed.some((run) => (
        Number(run.stats && run.stats.energy || 0) >= 65
        && !!(run.flags && run.flags.balance)
      )) ? 1 : 0,
      firefighter: anyRun((run) => !!(run.flags && run.flags.crisisHandled)) ? 1 : 0,
      "six-endings": endings.size,
      "all-endings": endings.size
    }
  };
}

function getAchievementProgress(runs) {
  const context = achievementContext(runs);
  const items = ACHIEVEMENTS.map((achievement, index) => {
    const progress = clamp(context.values[achievement.id], 0, achievement.target);
    return {
      ...achievement,
      number: String(index + 1).padStart(2, "0"),
      progress,
      unlocked: progress >= achievement.target,
      progressText: achievement.target > 1 ? `${progress} / ${achievement.target}` : (progress ? "已达成" : "未达成")
    };
  });
  return {
    total: items.length,
    unlocked: items.filter((item) => item.unlocked).length,
    percent: Math.round(items.filter((item) => item.unlocked).length / Math.max(1, items.length) * 100),
    items
  };
}

function buildCareerSummary(run = {}, endingTitle = "") {
  const persona = getPersona(run);
  const mode = getModeInfo(run);
  const keywords = getTopKeywords(run, 3);
  const stats = STAT_KEYS.map((key) => (
    `${STAT_META[key] && STAT_META[key].label || key} ${Number(run.stats && run.stats[key] || 0)}`
  )).join(" · ");
  const keyChoices = historyItems(run).slice(-3).map((entry) => `- ${entry.eventTitle}：${entry.choiceText}`);
  return [
    `《${run.playerName || "我"}的程序员生涯》`,
    `结局：${endingTitle || "仍在编译中"}`,
    `职业画像：${persona.title}`,
    `模式：${mode.label}${mode.challengeDate ? `（${mode.challengeDate}）` : ""}`,
    `最终属性：${stats}`,
    `关键词：${keywords.length ? keywords.join(" / ") : "尚未形成"}`,
    keyChoices.length ? `最后的关键选择：\n${keyChoices.join("\n")}` : "",
    "来自离线工具箱「程序员升级之路」"
  ].filter(Boolean).join("\n");
}

module.exports = {
  ACHIEVEMENTS,
  MODE_DAILY,
  MODE_FREE,
  MODES,
  PERSONAS,
  STYLE_GROUPS,
  buildCareerSummary,
  getAchievementProgress,
  getCareerSignal,
  getChoiceStyle,
  getDailyChallenge,
  getModeInfo,
  getPersona,
  getStageReport,
  getTopKeywords,
  localDateKey,
  normalizeMode,
  statDeltaItems
};
