const assert = require("assert");

const {
  EVENTS,
  GLOSSARY,
  STAGES,
  STAT_KEYS
} = require("../miniprogram/packages/tools/utils/huaweiSimContent");
const engine = require("../miniprogram/packages/tools/utils/huaweiSimEngine");

function completeRun(seed, choiceIndex = 0) {
  let run = engine.createRun({ seed, timestamp: "2026-07-24T00:00:00.000Z" });
  while (run.status === "active") {
    const event = engine.getCurrentEvent(run);
    run = engine.resolveChoice(run, event.id, event.choices[choiceIndex].id, "2026-07-24T00:01:00.000Z");
    run = engine.continueRun(run, "2026-07-24T00:02:00.000Z");
  }
  return run;
}

function testSeededSelection() {
  const first = engine.createRun({ seed: "same-seed", timestamp: "2026-07-24T00:00:00.000Z" });
  const second = engine.createRun({ seed: "same-seed", timestamp: "2026-07-24T12:00:00.000Z" });
  const third = engine.createRun({ seed: "different-seed", timestamp: "2026-07-24T00:00:00.000Z" });
  assert.deepStrictEqual(first.eventIds, second.eventIds, "same seed should reproduce the event sequence");
  assert.notDeepStrictEqual(first.eventIds, third.eventIds, "different seeds should usually change the event sequence");
  assert.strictEqual(first.eventIds.length, engine.TOTAL_EVENTS);
  assert.strictEqual(new Set(first.eventIds).size, engine.TOTAL_EVENTS);

  STAGES.forEach((stage, stageIndex) => {
    const ids = first.eventIds.slice(
      stageIndex * engine.EVENTS_PER_STAGE,
      (stageIndex + 1) * engine.EVENTS_PER_STAGE
    );
    assert(ids.every((id) => engine.getEventById(id).stageId === stage.id), `${stage.id} selection should stay in stage`);
  });
}

function testChoiceLifecycleAndBounds() {
  let run = engine.createRun({ seed: "lifecycle", timestamp: "2026-07-24T00:00:00.000Z" });
  const event = engine.getCurrentEvent(run);
  const selected = event.choices[0];
  run.stats = { delivery: 99, tech: 1, energy: 99, influence: 1 };
  const chosen = engine.resolveChoice(run, event.id, selected.id, "2026-07-24T00:01:00.000Z");
  assert.strictEqual(chosen.phase, "feedback");
  assert.strictEqual(chosen.history.length, 1);
  STAT_KEYS.forEach((key) => {
    assert(chosen.stats[key] >= 0 && chosen.stats[key] <= 100, `${key} must remain clamped`);
  });
  assert.throws(
    () => engine.resolveChoice(chosen, event.id, selected.id),
    /不能重复选择/,
    "feedback phase must reject duplicate settlement"
  );
  const next = engine.continueRun(chosen, "2026-07-24T00:02:00.000Z");
  assert.strictEqual(next.phase, "scene");
  assert.strictEqual(next.eventIndex, 1);
  assert.strictEqual(next.history.length, 1);
  assert.throws(() => engine.continueRun(next), /先完成当前选择/);
  assert.throws(() => engine.resolveChoice(next, "wrong-event", "wrong-choice"), /情景已经变化/);
}

function testCompleteRunAndSummary() {
  const run = completeRun("complete-run", 0);
  assert.strictEqual(run.status, "completed");
  assert.strictEqual(run.phase, "result");
  assert.strictEqual(run.history.length, engine.TOTAL_EVENTS);
  const result = engine.buildResult(run);
  assert(result.persona && result.persona.title);
  assert.strictEqual(result.choiceCount, engine.TOTAL_EVENTS);
  assert(result.keywords.length >= 1);
  const summary = engine.formatSummary(run);
  assert(summary.includes(result.persona.title));
  assert(summary.includes("非官方情景模拟"));
  STAT_KEYS.forEach((key) => assert(summary.includes(String(result.stats[key]))));
}

function testGlossarySearch() {
  assert(engine.searchGlossary("PBC").some((item) => item.id === "pbc"));
  assert(engine.searchGlossary("发布准备").some((item) => item.id === "tr4a" || item.id === "tr6"));
  assert(engine.searchGlossary("", "process").every((item) => item.category === "process"));
  assert.strictEqual(engine.searchGlossary("不存在的黑话").length, 0);
  assert.strictEqual(engine.searchGlossary("").length, GLOSSARY.length);
}

function testPoolReachability() {
  const reached = new Set();
  for (let index = 0; index < 240; index += 1) {
    engine.buildEventIds(`reach-${index}`).forEach((id) => reached.add(id));
  }
  assert.strictEqual(reached.size, EVENTS.length, "every encounter should be reachable from seeded runs");
}

function testPersonas() {
  assert.strictEqual(engine.selectPersona({ delivery: 90, tech: 80, energy: 20, influence: 80 }).id, "burnout-warning");
  assert.strictEqual(engine.selectPersona({ delivery: 75, tech: 82, energy: 60, influence: 55 }).id, "tr-guardian");
  assert.strictEqual(engine.selectPersona({ delivery: 58, tech: 84, energy: 60, influence: 50 }).id, "black-soil-builder");
  assert.strictEqual(engine.selectPersona({ delivery: 70, tech: 62, energy: 60, influence: 82 }).id, "frontline-caller");
  assert.strictEqual(engine.selectPersona({ delivery: 50, tech: 58, energy: 64, influence: 75 }).id, "process-translator");
  assert.strictEqual(engine.selectPersona({ delivery: 62, tech: 63, energy: 68, influence: 60 }).id, "e2e-generalist");
}

testSeededSelection();
testChoiceLifecycleAndBounds();
testCompleteRunAndSummary();
testGlossarySearch();
testPoolReachability();
testPersonas();
console.log("huawei simulation engine tests passed");
