const assert = require("assert");

const content = require("../miniprogram/packages/tools/utils/careerGameContent");

const {
  STAT_KEYS,
  STAT_META,
  STAGES,
  EVENTS,
  ENDINGS,
  getEventById,
  getEndingById,
  validateContent
} = content;

const EXPECTED_EXPORTS = [
  "ENDINGS",
  "EVENTS",
  "STAGES",
  "STAT_KEYS",
  "STAT_META",
  "getEndingById",
  "getEventById",
  "validateContent"
];
const EXPECTED_ENDINGS = [
  "首席架构师",
  "技术负责人",
  "工程经理",
  "独立开发者",
  "创业合伙人",
  "开源之星",
  "远程游牧",
  "生活优先",
  "产品转型",
  "稳健老兵",
  "高薪燃尽",
  "被优化的一天"
];
const PREDICATE_TYPES = new Set(["stat", "flag", "history"]);
const PREDICATE_OPS = new Set(["gte", "lte", "eq", "truthy"]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function snapshot(overrides = {}) {
  return {
    STAT_KEYS: clone(STAT_KEYS),
    STAT_META: clone(STAT_META),
    STAGES: clone(STAGES),
    EVENTS: clone(EVENTS),
    ENDINGS: clone(ENDINGS),
    ...overrides
  };
}

function assertRequirements(items, label) {
  assert(Array.isArray(items), `${label} must be an array`);
  items.forEach((item, index) => {
    assert(PREDICATE_TYPES.has(item.type), `${label}[${index}] invalid type`);
    assert(PREDICATE_OPS.has(item.op), `${label}[${index}] invalid op`);
    assert.strictEqual(typeof item.key, "string");
    assert(Object.prototype.hasOwnProperty.call(item, "value"));
    if (item.type === "stat") assert(STAT_KEYS.includes(item.key), `${label}[${index}] invalid stat`);
  });
}

assert.deepStrictEqual(Object.keys(content).sort(), EXPECTED_EXPORTS);
assert.deepStrictEqual(STAT_KEYS, ["tech", "communication", "energy", "savings", "influence"]);
assert.deepStrictEqual(Object.keys(STAT_META).sort(), STAT_KEYS.slice().sort());
STAT_KEYS.forEach((key) => {
  const meta = STAT_META[key];
  assert(meta.label);
  assert(["blue", "green", "coral", "gold", "navy"].includes(meta.tone));
  assert(meta.min < meta.max);
  assert(meta.initial >= meta.min && meta.initial <= meta.max);
});

const summary = validateContent();
assert.strictEqual(summary.stageCount, 6);
assert.strictEqual(summary.eventCount, 120);
assert.strictEqual(summary.endingCount, 12);
assert(summary.choiceCount >= 330);
assert(summary.pendingEffectCount >= 25);

assert.strictEqual(STAGES.length, 6);
const stageIds = new Set();
const referencedEventIds = new Set();
STAGES.forEach((stage, index) => {
  assert.deepStrictEqual(Object.keys(stage).sort(), [
    "coreEventIds",
    "id",
    "illustration",
    "index",
    "poolEventIds",
    "rank",
    "subtitle",
    "title"
  ]);
  assert.strictEqual(stage.index, index + 1);
  assert(!stageIds.has(stage.id), `duplicate stage id ${stage.id}`);
  stageIds.add(stage.id);
  assert(stage.title && stage.rank && stage.subtitle && stage.illustration);
  assert.strictEqual(stage.coreEventIds.length, 4);
  assert.strictEqual(stage.poolEventIds.length, 16);
  stage.coreEventIds.concat(stage.poolEventIds).forEach((eventId) => {
    assert(!referencedEventIds.has(eventId), `duplicate event reference ${eventId}`);
    referencedEventIds.add(eventId);
  });
});

assert.strictEqual(EVENTS.length, 120);
assert.strictEqual(referencedEventIds.size, 120);
const eventIds = new Set();
const choiceIds = new Set();
const pendingIds = new Set();
EVENTS.forEach((event) => {
  assert(!eventIds.has(event.id), `duplicate event id ${event.id}`);
  eventIds.add(event.id);
  assert(stageIds.has(event.stageId), `unknown stage ${event.stageId}`);
  assert(["core", "pool"].includes(event.kind));
  assert(event.title && event.body);
  assert(event.choices.length >= 2 && event.choices.length <= 4);
  assert.strictEqual(getEventById(event.id), event);
  if (event.requirements) assertRequirements(event.requirements, `${event.id}.requirements`);
  if (event.priority !== undefined) assert(Number.isFinite(event.priority));

  const stage = STAGES[event.stageId === STAGES[0].id ? 0 : STAGES.findIndex((item) => item.id === event.stageId)];
  const references = event.kind === "core" ? stage.coreEventIds : stage.poolEventIds;
  assert(references.includes(event.id), `${event.id} kind/reference mismatch`);

  event.choices.forEach((choice) => {
    ["id", "text", "tags", "outcome", "effects"].forEach((key) => {
      assert(Object.prototype.hasOwnProperty.call(choice, key), `${choice.id || event.id} missing ${key}`);
    });
    assert(!choiceIds.has(choice.id), `duplicate choice id ${choice.id}`);
    choiceIds.add(choice.id);
    assert(choice.text && choice.outcome);
    assert(Array.isArray(choice.tags) && choice.tags.length > 0);
    Object.keys(choice.effects).forEach((key) => assert(STAT_KEYS.includes(key), `${choice.id} invalid stat ${key}`));
    if (choice.requirements) assertRequirements(choice.requirements, `${choice.id}.requirements`);
    if (choice.addFlags) assert.strictEqual(new Set(choice.addFlags).size, choice.addFlags.length);
    if (choice.removeFlags) assert.strictEqual(new Set(choice.removeFlags).size, choice.removeFlags.length);
    if (choice.endingId) assert(getEndingById(choice.endingId), `${choice.id} invalid endingId`);

    (choice.pendingEffects || []).forEach((pendingEffect) => {
      assert.deepStrictEqual(
        Object.keys(pendingEffect).filter((key) => !["id", "delay", "effects", "addFlags", "narrative"].includes(key)),
        [],
        `${pendingEffect.id} has unsupported fields`
      );
      assert(!pendingIds.has(pendingEffect.id), `duplicate pending effect id ${pendingEffect.id}`);
      pendingIds.add(pendingEffect.id);
      assert(Number.isInteger(pendingEffect.delay) && pendingEffect.delay > 0);
      Object.keys(pendingEffect.effects).forEach((key) => assert(STAT_KEYS.includes(key), `${pendingEffect.id} invalid stat ${key}`));
      if (pendingEffect.addFlags) assert.strictEqual(new Set(pendingEffect.addFlags).size, pendingEffect.addFlags.length);
      if (pendingEffect.narrative !== undefined) assert(pendingEffect.narrative.trim());
    });
  });
});

assert.deepStrictEqual(eventIds, referencedEventIds);
assert.strictEqual(choiceIds.size, summary.choiceCount);
assert.strictEqual(pendingIds.size, summary.pendingEffectCount);

const expandedEvents = EVENTS.filter((event) => /_x\d+_/.test(event.id));
assert.strictEqual(expandedEvents.length, 60);
const expandedByStage = new Map();
expandedEvents.forEach((event) => {
  expandedByStage.set(event.stageId, (expandedByStage.get(event.stageId) || 0) + 1);
  assert(event.category && event.category.trim(), `${event.id} must expose a theme label`);
});
STAGES.forEach((stage) => assert.strictEqual(expandedByStage.get(stage.id), 10));
assert(new Set(expandedEvents.map((event) => event.category)).size >= 12);
const expandedText = expandedEvents.map((event) => `${event.title}${event.body}`).join("\n");
["AI", "无障碍", "供应链", "隐私", "开源", "远程", "裁员", "照护", "数据泄露"].forEach((keyword) => {
  assert(expandedText.includes(keyword), `expanded event library should cover ${keyword}`);
});
assert(expandedEvents.filter((event) => event.requirements && event.priority >= 30).length >= 18);
assert.strictEqual(getEventById("missing"), null);

assert.strictEqual(ENDINGS.length, 12);
assert.deepStrictEqual(ENDINGS.map((ending) => ending.title).sort(), EXPECTED_ENDINGS.slice().sort());
const endingIds = new Set();
ENDINGS.forEach((ending) => {
  assert(!endingIds.has(ending.id), `duplicate ending id ${ending.id}`);
  endingIds.add(ending.id);
  assert.strictEqual(getEndingById(ending.id), ending);
  assert(ending.title && ending.hint && ending.summary);
  assert(Number.isFinite(ending.priority));
  assertRequirements(ending.requirements, `${ending.id}.requirements`);
});
assert.strictEqual(getEndingById("missing"), null);

const defaultEnding = ENDINGS.find((ending) => ending.title === "稳健老兵");
assert(defaultEnding);
assert.deepStrictEqual(defaultEnding.requirements, []);
ENDINGS.filter((ending) => ending !== defaultEnding).forEach((ending) => {
  assert(ending.priority > defaultEnding.priority);
  assert(ending.requirements.length > 0);
});

const badStat = snapshot();
badStat.EVENTS[0].choices[0].effects.luck = 10;
assert.throws(() => validateContent(badStat), /unknown stat luck/);

const badStageReference = snapshot();
badStageReference.STAGES[0].coreEventIds[0] = "missing_event";
assert.throws(() => validateContent(badStageReference), /unknown event|missing from its stage/);

const duplicateChoice = snapshot();
duplicateChoice.EVENTS[1].choices[0].id = duplicateChoice.EVENTS[0].choices[0].id;
assert.throws(() => validateContent(duplicateChoice), /duplicate choice id/);

const pendingLocation = EVENTS.map((event) => event.choices.findIndex((choice) => choice.pendingEffects && choice.pendingEffects.length))
  .findIndex((index) => index >= 0);
const pendingChoiceIndex = EVENTS[pendingLocation].choices.findIndex((choice) => choice.pendingEffects && choice.pendingEffects.length);
const badPending = snapshot();
badPending.EVENTS[pendingLocation].choices[pendingChoiceIndex].pendingEffects[0].delay = 0;
assert.throws(() => validateContent(badPending), /invalid delay/);

const badFlag = snapshot();
badFlag.EVENTS[0].choices[0].addFlags = ["unknown_flag"];
assert.throws(() => validateContent(badFlag), /unknown flag/);

const badEndingReference = snapshot();
badEndingReference.EVENTS[0].choices[0].endingId = "missing_ending";
assert.throws(() => validateContent(badEndingReference), /unknown ending/);

const validHistoryRequirement = snapshot();
validHistoryRequirement.EVENTS[0].requirements = [{
  type: "history",
  key: EVENTS[1].id,
  op: "gte",
  value: 1
}];
assert.doesNotThrow(() => validateContent(validHistoryRequirement));

const missingEnding = snapshot();
missingEnding.ENDINGS[0].title = "普通结局";
assert.throws(() => validateContent(missingEnding), /missing required ending/);

console.log(`career content tests passed: ${summary.eventCount} events, ${summary.choiceCount} choices, ${summary.endingCount} endings`);
