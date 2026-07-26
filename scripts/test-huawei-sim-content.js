const assert = require("assert");

const {
  DISCLAIMER,
  EVENTS,
  GLOSSARY,
  GLOSSARY_CATEGORIES,
  PERSONAS,
  SOURCE_SUMMARY,
  STAGES,
  STAT_KEYS
} = require("../miniprogram/packages/tools/utils/huaweiSimContent");

function assertUnique(items, label) {
  assert.strictEqual(new Set(items).size, items.length, `${label} should be unique`);
}

assert(DISCLAIMER.includes("非官方情景模拟"));
assert(DISCLAIMER.includes("虚构复合"));
assert(DISCLAIMER.includes("不代表"));
assert.strictEqual(STAT_KEYS.length, 4);
assert.strictEqual(STAGES.length, 5);
assert(GLOSSARY.length >= 48, "glossary should provide a substantial public-term collection");
assert(EVENTS.length >= 64, "scenario pool should provide varied fictional encounters");
assert(PERSONAS.length >= 8, "simulation should offer varied result profiles");
assert(SOURCE_SUMMARY.length >= 4, "source boundary should be visible in the product");

assertUnique(GLOSSARY.map((item) => item.id), "glossary ids");
assertUnique(GLOSSARY.map((item) => item.term), "glossary terms");
assertUnique(EVENTS.map((item) => item.id), "event ids");
assertUnique(PERSONAS.map((item) => item.id), "persona ids");

const categoryIds = new Set(GLOSSARY_CATEGORIES.map((item) => item.id));
const termIds = new Set(GLOSSARY.map((item) => item.id));
const stageIds = new Set(STAGES.map((item) => item.id));
const allowedSourceKinds = new Set(["official", "public", "common", "reported"]);

GLOSSARY.forEach((item) => {
  assert(item.term.length >= 2, `${item.id} should have a readable term`);
  assert(item.plain.length >= 14, `${item.id} should have a useful plain-language explanation`);
  assert(item.usage.length >= 12, `${item.id} should explain practical usage`);
  assert(categoryIds.has(item.category), `${item.id} references an unknown category`);
  assert(allowedSourceKinds.has(item.sourceKind), `${item.id} should declare source scope`);
  assert(item.sourceLabel, `${item.id} should show source scope`);
});

[
  "customer-centric",
  "self-criticism",
  "main-channel",
  "grow-grain",
  "soil-fertility",
  "frontline-command",
  "call-artillery",
  "force-one-hole",
  "entropy-reduction",
  "red-blue",
  "strategic-reserve",
  "black-soil",
  "ipd",
  "pdt",
  "tr4a",
  "pbc",
  "e2e",
  "close-loop",
  "b-rating",
  "b-front",
  "at-review",
  "rd-output",
  "performance-talk",
  "public-scolding",
  "person-role-fit",
  "appeal-trace"
].forEach((id) => assert(termIds.has(id), `missing expected public term ${id}`));

GLOSSARY.filter((item) => item.sourceKind === "reported").forEach((item) => {
  assert.strictEqual(item.category, "network", `${item.id} should stay in the visibly separated network category`);
  assert.strictEqual(item.sourceLabel, "网络职场叙事");
});

const allChoiceIds = [];
EVENTS.forEach((item) => {
  assert(stageIds.has(item.stageId), `${item.id} references an unknown stage`);
  assert(termIds.has(item.termId), `${item.id} references an unknown glossary term`);
  assert(item.title.length >= 6, `${item.id} should have a descriptive title`);
  assert(item.situation.length >= 28, `${item.id} should contain a complete fictional situation`);
  assert.strictEqual(item.choices.length, 3, `${item.id} should always present three choices`);
  if (item.replayOnly) {
    assert.strictEqual(item.unlockRun, 2, `${item.id} replay encounters should unlock on the second run`);
  }
  item.choices.forEach((option) => {
    allChoiceIds.push(`${item.id}:${option.id}`);
    assert(option.text.length >= 16, `${item.id}/${option.id} choice text is too shallow`);
    assert(option.outcome.length >= 12, `${item.id}/${option.id} outcome is too shallow`);
    assert(option.tags.length >= 2, `${item.id}/${option.id} should expose route tags`);
    assert(Object.keys(option.effects).length >= 2, `${item.id}/${option.id} should affect multiple dimensions`);
    Object.keys(option.effects).forEach((key) => {
      assert(STAT_KEYS.includes(key), `${item.id}/${option.id} has unknown stat ${key}`);
      assert(Number.isInteger(option.effects[key]), `${item.id}/${option.id} effects must use integers`);
    });
  });
});
assertUnique(allChoiceIds, "qualified choice ids");

STAGES.forEach((stage) => {
  const count = EVENTS.filter((item) => item.stageId === stage.id).length;
  assert(count >= 10, `${stage.id} should have at least ten candidate encounters`);
  const replayCount = EVENTS.filter((item) => item.stageId === stage.id && item.replayOnly).length;
  assert.strictEqual(replayCount, 2, `${stage.id} should add two second-run encounters`);
});

const serialized = JSON.stringify({ EVENTS, GLOSSARY });
[
  "B绩效",
  "B 里靠前",
  "输出非研发",
  "当众批评",
  "被告知“输出非研发”",
  "复盘会突然变成挨骂大会"
].forEach((fragment) => {
  assert(serialized.includes(fragment), `content should cover requested pressure scenario: ${fragment}`);
});
[
  "周报被改成了一份态度证明",
  "深夜群里突然开始报在线",
  "零点前十分钟的“一行代码”",
  "三天支援悄悄变成长期驻场",
  "只有一个选项的“双向选择”"
].forEach((fragment) => {
  assert(serialized.includes(fragment), `replay content should include ${fragment}`);
});
["真实员工经历", "内部泄密", "未经证实"].forEach((fragment) => {
  assert(!serialized.includes(fragment), `content should not make unsupported claims: ${fragment}`);
});
assert(DISCLAIMER.includes("二手公开报道"));
assert(DISCLAIMER.includes("不代表已证实制度"));

console.log(`huawei simulation content tests passed (${GLOSSARY.length} terms, ${EVENTS.length} events, ${allChoiceIds.length} choices)`);
