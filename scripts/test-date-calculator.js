const assert = require("assert");
const dateCalculator = require("../miniprogram/packages/tools/utils/dateCalculator");

assert.strictEqual(dateCalculator.parseDate("2024-02-29"), Date.UTC(2024, 1, 29));
assert.throws(() => dateCalculator.parseDate("2023-02-29"), /日期不存在/);
assert.throws(() => dateCalculator.parseDate("02-29-2024"), /日期格式/);
assert.strictEqual(dateCalculator.addNaturalDays("2024-02-28", 2), "2024-03-01");
assert.strictEqual(dateCalculator.addNaturalDays("2025-01-01", -1), "2024-12-31");

const forward = dateCalculator.getInterval("2026-07-24", "2026-08-03");
assert.deepStrictEqual(
  {
    days: forward.days,
    direction: forward.direction,
    inclusiveDays: forward.inclusiveDays,
    remainingDays: forward.remainingDays,
    signedDays: forward.signedDays,
    weeks: forward.weeks
  },
  {
    days: 10,
    direction: "after",
    inclusiveDays: 11,
    remainingDays: 3,
    signedDays: 10,
    weeks: 1
  }
);
const backward = dateCalculator.getInterval("2026-08-03", "2026-07-24");
assert.strictEqual(backward.signedDays, -10);
assert.strictEqual(backward.direction, "before");
assert.strictEqual(dateCalculator.getInterval("2026-07-24", "2026-07-24").direction, "same");

assert.strictEqual(dateCalculator.addWorkdays("2026-07-24", 1), "2026-07-27");
assert.strictEqual(dateCalculator.addWorkdays("2026-07-27", -1), "2026-07-24");
assert.strictEqual(dateCalculator.addWorkdays("2026-07-24", 5), "2026-07-31");
assert.strictEqual(dateCalculator.addWorkdays("2026-07-25", 0), "2026-07-25");
assert.throws(() => dateCalculator.addWorkdays("2026-07-24", 1.5), /整数/);

assert.deepStrictEqual(
  dateCalculator.getCountdown("2026-07-25", "2026-07-24"),
  { signedDays: 1, days: 1, state: "future", weekday: "周六" }
);
assert.strictEqual(dateCalculator.getCountdown("2026-07-24", "2026-07-24").state, "today");
assert.strictEqual(dateCalculator.getCountdown("2026-07-20", "2026-07-24").state, "past");
assert.strictEqual(
  dateCalculator.getLocalToday(new Date(2026, 6, 24, 23, 30)),
  "2026-07-24"
);

assert(dateCalculator.buildIntervalCopy("2026-07-24", "2026-08-03", forward).includes("相隔 10 天"));
assert(dateCalculator.buildOffsetCopy("2026-07-24", 1, "workday", "2026-07-27").includes("工作日"));
assert(dateCalculator.buildCountdownCopy("2026-07-25", "2026-07-24", dateCalculator.getCountdown("2026-07-25", "2026-07-24")).includes("还有 1 天"));

console.log("date calculator tests passed");
