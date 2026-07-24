const assert = require("assert");

const content = require("../miniprogram/packages/tools/utils/careerGameContent");
const meta = require("../miniprogram/packages/tools/utils/careerGameMeta");

const dailyA = meta.getDailyChallenge("2026-07-24");
const dailyB = meta.getDailyChallenge(new Date(2026, 6, 24, 23, 59));
const dailyNext = meta.getDailyChallenge("2026-07-25");
assert.strictEqual(dailyA.date, "2026-07-24");
assert.strictEqual(dailyA.seed, dailyB.seed);
assert.notStrictEqual(dailyA.seed, dailyNext.seed);
assert.strictEqual(meta.normalizeMode("unknown"), meta.MODE_FREE);
assert.strictEqual(meta.getModeInfo({ mode: "daily", challengeDate: "2026-07-24" }).label, "今日情景");

const newcomer = meta.getPersona({
  stats: { tech: 45, communication: 45, energy: 65, savings: 30, influence: 35 },
  history: []
});
assert.strictEqual(newcomer.id, "uncompiled");

const deepTech = meta.getPersona({
  stats: { tech: 88, communication: 40, energy: 60, savings: 35, influence: 42 },
  flags: { architecture: true, documentation: true },
  history: [
    { tags: ["技术", "架构"] },
    { tags: ["技术", "深度"] }
  ]
});
assert.strictEqual(deepTech.id, "deep-builder");

const overloaded = meta.getPersona({
  stats: { tech: 90, communication: 80, energy: 12, savings: 70, influence: 80 },
  history: [{ tags: ["技术"] }]
});
assert.strictEqual(overloaded.id, "overloaded");

const balanced = meta.getPersona({
  stats: { tech: 68, communication: 62, energy: 70, savings: 58, influence: 61 },
  history: [{ tags: ["稳健"] }]
});
assert.strictEqual(balanced.id, "balanced-builder");

const style = meta.getChoiceStyle([
  { tags: ["沟通", "团队"] },
  { tags: ["领导", "管理"] },
  { tags: ["技术"] }
]);
assert.strictEqual(style.id, "team-link");
assert.deepStrictEqual(meta.getTopKeywords([
  { tags: ["技术", "架构"] },
  { tags: ["技术", "长期"] }
], 2), ["技术", "架构"]);

const stage = content.STAGES[0];
const stageReport = meta.getStageReport({
  stageIndex: 0,
  stats: { tech: 57, communication: 48, energy: 55, savings: 36, influence: 39 },
  stageStartStats: { tech: 45, communication: 45, energy: 65, savings: 30, influence: 35 },
  pendingEffects: [{ id: "future" }],
  history: [
    {
      stageId: stage.id,
      eventTitle: "第一次 Code Review",
      choiceText: "把问题写成文档",
      tags: ["技术", "文档"],
      deltas: { tech: 8, communication: 3 }
    },
    {
      stageId: stage.id,
      eventTitle: "线上告警",
      choiceText: "先定位根因",
      tags: ["技术", "稳健"],
      deltas: { tech: 4, energy: -10 }
    }
  ]
});
assert.strictEqual(stageReport.style.id, "deep-tech");
assert.strictEqual(stageReport.pendingCount, 1);
assert.strictEqual(stageReport.deltas.find((item) => item.key === "tech").value, 12);
assert.strictEqual(stageReport.deltas.find((item) => item.key === "energy").value, -10);
assert.strictEqual(stageReport.turningPoint.eventTitle, "线上告警");
assert(stageReport.nextTitle.includes("第二章"));

const baseRun = {
  id: "run-1",
  playerName: "小码",
  mode: "daily",
  challengeDate: "2026-07-24",
  status: "completed",
  endingId: content.ENDINGS[0].id,
  stageIndex: 5,
  stats: { tech: 82, communication: 78, energy: 68, savings: 72, influence: 70 },
  flags: { balance: true, crisisHandled: true, architecture: true },
  history: Array.from({ length: 6 }, (_, index) => ({
    stageId: stage.id,
    eventTitle: `事件 ${index + 1}`,
    choiceText: "做出选择",
    tags: ["技术", index % 2 ? "架构" : "稳健"],
    deltas: { tech: 1 }
  }))
};
const secondRun = {
  ...baseRun,
  id: "run-2",
  mode: "free",
  endingId: content.ENDINGS[1].id
};
const achievements = meta.getAchievementProgress([baseRun, secondRun]);
assert.strictEqual(achievements.total, 12);
[
  "first-choice",
  "first-stage",
  "first-ending",
  "daily",
  "replay",
  "deep-tech",
  "trusted-voice",
  "runway",
  "sustainable",
  "firefighter"
].forEach((id) => {
  assert(achievements.items.find((item) => item.id === id).unlocked, `${id} should be unlocked`);
});
assert.strictEqual(achievements.items.find((item) => item.id === "six-endings").unlocked, false);

const allEndingRuns = content.ENDINGS.map((ending, index) => ({
  ...baseRun,
  id: `ending-run-${index}`,
  endingId: ending.id
}));
const completeAchievements = meta.getAchievementProgress(allEndingRuns);
assert.strictEqual(completeAchievements.items.find((item) => item.id === "all-endings").unlocked, true);

const signal = meta.getCareerSignal({
  ...baseRun,
  pendingEffects: [{ id: "one" }, { id: "two" }],
  lastOutcome: { echoes: [] }
});
assert.strictEqual(signal.title, "伏笔仍在发酵");
assert(signal.text.includes("2"));

const summary = meta.buildCareerSummary(baseRun, "首席架构师");
assert(summary.includes("《小码的程序员生涯》"));
assert(summary.includes("今日情景"));
assert(summary.includes("首席架构师"));
assert(summary.includes("程序员生涯模拟"));
assert(!summary.includes("程序员升级之路"));
assert(!summary.includes(baseRun.id));

console.log("career game meta-system tests passed");
