const assert = require("assert");
const {
  selectAdaptiveEvents
} = require("../miniprogram/packages/tools/utils/adaptiveEventSelector");

function event(id, patch = {}) {
  return {
    id,
    stageId: "stage-1",
    role: "branch",
    unlockRun: 1,
    priority: 0,
    cooldownRuns: 1,
    ...patch
  };
}

function select(patch = {}) {
  return selectAdaptiveEvents({
    candidates: [],
    count: 1,
    seed: "selector-test",
    stageId: "stage-1",
    runNumber: 2,
    profile: {
      eventUsage: {},
      recentEventIds: [],
      lastShownRuns: {}
    },
    recentWindow: 3,
    ...patch
  });
}

function testDeterminismAndPurity() {
  const candidates = Array.from({ length: 12 }, (_, index) => event(`event-${index}`));
  const profile = {
    eventUsage: { "event-0": 1 },
    recentEventIds: ["event-0"],
    lastShownRuns: { "event-0": 1 }
  };
  const snapshot = JSON.stringify({ candidates, profile });
  const first = select({ candidates, count: 6, seed: "stable", profile });
  const second = select({ candidates, count: 6, seed: "stable", profile });

  assert.deepStrictEqual(first, second, "identical input must reproduce the same selection");
  assert.strictEqual(JSON.stringify({ candidates, profile }), snapshot, "selector must not mutate inputs");
  assert.strictEqual(first.eventIds.length, 6);
  assert.strictEqual(new Set(first.eventIds).size, 6);
}

function testUnseenAndUnlockPriority() {
  const result = select({
    candidates: [
      event("seen", { priority: 100 }),
      event("unseen", { priority: -10 }),
      event("newly-unlocked", { unlockRun: 2, priority: -100 }),
      event("future", { unlockRun: 3 }),
      event("other-stage", { stageId: "stage-2", unlockRun: 2 })
    ],
    count: 3,
    profile: {
      eventUsage: { seen: 1 },
      recentEventIds: [],
      lastShownRuns: { seen: 0 }
    }
  });

  assert.deepStrictEqual(result.eventIds, ["newly-unlocked", "unseen", "seen"]);
  assert.deepStrictEqual(result.newEventIds, ["newly-unlocked", "unseen"]);
  assert.deepStrictEqual(result.repeatEventIds, ["seen"]);
  assert.strictEqual(result.diagnostics[0].reason, "newly-unlocked-matched");
  assert(!result.eventIds.includes("future"));
  assert(!result.eventIds.includes("other-stage"));
}

function testRoleQuotas() {
  const result = select({
    candidates: [
      event("anchor-1", { role: "anchor" }),
      event("anchor-2", { role: "anchor" }),
      event("branch-1"),
      event("branch-2"),
      event("branch-3"),
      event("rare-1", { role: "rare" })
    ],
    count: 5,
    roleQuotas: { anchor: 2, branch: 2, rare: 1 }
  });
  const roles = result.diagnostics.reduce((counts, item) => {
    counts[item.role] = Number(counts[item.role] || 0) + 1;
    return counts;
  }, {});

  assert.deepStrictEqual(roles, { anchor: 2, branch: 2, rare: 1 });
  assert(result.diagnostics.every((item) => item.selectionPhase === "role-quota"));
}

function testRequirementBuckets() {
  const matchesRequirements = (requirements) => !!(requirements && requirements.allowed);
  const result = select({
    candidates: [
      event("unseen-unmatched", { priority: 100, requirements: { allowed: false } }),
      event("unseen-matched", { priority: -100, requirements: { allowed: true } }),
      event("unlocked-unmatched", { unlockRun: 2, requirements: { allowed: false } }),
      event("unlocked-matched", { unlockRun: 2, requirements: { allowed: true } })
    ],
    count: 4,
    matchesRequirements
  });

  assert.deepStrictEqual(result.eventIds, [
    "unlocked-matched",
    "unlocked-unmatched",
    "unseen-matched",
    "unseen-unmatched"
  ]);
  assert.deepStrictEqual(
    result.diagnostics.map((item) => item.reason),
    ["newly-unlocked-matched", "newly-unlocked", "unseen-matched", "unseen"]
  );
}

function testCooldownAndLowFrequency() {
  const matchesRequirements = (requirements) => !!(requirements && requirements.allowed);
  const result = select({
    candidates: [
      event("cooled-high", { requirements: { allowed: true } }),
      event("cooled-low", { requirements: { allowed: true } }),
      event("cooled-unmatched", { requirements: { allowed: false } }),
      event("recent-low", { requirements: { allowed: true } })
    ],
    count: 4,
    runNumber: 6,
    profile: {
      eventUsage: {
        "cooled-high": 8,
        "cooled-low": 2,
        "cooled-unmatched": 1,
        "recent-low": 1
      },
      recentEventIds: ["recent-low"],
      lastShownRuns: {
        "cooled-high": 2,
        "cooled-low": 2,
        "cooled-unmatched": 2,
        "recent-low": 5
      }
    },
    matchesRequirements
  });

  assert.deepStrictEqual(result.eventIds, [
    "cooled-low",
    "cooled-high",
    "cooled-unmatched",
    "recent-low"
  ]);
  assert.deepStrictEqual(
    result.diagnostics.map((item) => item.reason),
    ["cooled-matched", "cooled-matched", "cooled", "recent-repeat"]
  );
}

function testFamilyAvoidanceAndRelaxation() {
  const varied = select({
    candidates: [
      event("family-a-high", { familyId: "family-a", priority: 10 }),
      event("family-a-low", { familyId: "family-a", priority: 5 }),
      event("family-b", { familyId: "family-b" })
    ],
    count: 2
  });
  assert(varied.eventIds.includes("family-a-high"));
  assert(varied.eventIds.includes("family-b"));
  assert(!varied.eventIds.includes("family-a-low"));
  assert(varied.diagnostics.every((item) => !item.familyRelaxed));

  const constrained = select({
    candidates: [
      event("family-a-1", { familyId: "family-a" }),
      event("family-a-2", { familyId: "family-a" })
    ],
    count: 2,
    usedFamilyIds: new Set(["family-a"])
  });
  assert.strictEqual(constrained.eventIds.length, 2);
  assert(constrained.diagnostics.every((item) => item.familyRelaxed));
}

function testPoolAndQuotaShortageFallback() {
  const result = select({
    candidates: [
      event("only-anchor", { role: "anchor" }),
      event("branch-1"),
      event("branch-2"),
      event("locked", { role: "rare", unlockRun: 4 })
    ],
    count: 5,
    roleQuotas: { anchor: 2, branch: 1, rare: 2 }
  });

  assert.deepStrictEqual(new Set(result.eventIds), new Set(["only-anchor", "branch-1", "branch-2"]));
  assert.strictEqual(result.eventIds.length, 3, "eligible pool size caps the result");
  assert(result.diagnostics.some((item) => item.selectionPhase === "quota-fallback"));
}

testDeterminismAndPurity();
testUnseenAndUnlockPriority();
testRoleQuotas();
testRequirementBuckets();
testCooldownAndLowFrequency();
testFamilyAvoidanceAndRelaxation();
testPoolAndQuotaShortageFallback();

console.log("adaptive event selector tests passed");
