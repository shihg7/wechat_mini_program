const VALID_ROLES = ["anchor", "branch", "rare"];

function hashSeed(value) {
  const source = String(value == null ? "" : value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function toNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function normalizeRole(role) {
  return VALID_ROLES.includes(role) ? role : "branch";
}

function normalizeFamilyIds(input) {
  const values = input instanceof Set
    ? Array.from(input)
    : (Array.isArray(input) ? input : []);
  return new Set(values.map((item) => String(item || "")).filter(Boolean));
}

function normalizeProfile(input, recentWindow) {
  const source = input && typeof input === "object" ? input : {};
  const usageSource = source.eventUsage && typeof source.eventUsage === "object"
    ? source.eventUsage
    : {};
  const lastShownSource = source.lastShownRuns && typeof source.lastShownRuns === "object"
    ? source.lastShownRuns
    : {};
  const eventUsage = {};
  const lastShownRuns = {};

  Object.keys(usageSource).forEach((id) => {
    const count = toNonNegativeInteger(usageSource[id]);
    if (count > 0) eventUsage[String(id)] = count;
  });
  Object.keys(lastShownSource).forEach((id) => {
    const run = toNonNegativeInteger(lastShownSource[id], -1);
    if (run >= 0) lastShownRuns[String(id)] = run;
  });

  const recentEventIds = (Array.isArray(source.recentEventIds) ? source.recentEventIds : [])
    .slice(0, recentWindow)
    .map((item) => String(item || ""))
    .filter(Boolean);

  return {
    eventUsage,
    lastShownRuns,
    recentEventIds: new Set(recentEventIds)
  };
}

function normalizeCandidates(candidates, stageId, runNumber) {
  const seenIds = new Set();
  return (Array.isArray(candidates) ? candidates : [])
    .filter((event) => event && typeof event === "object")
    .map((event) => ({
      event,
      id: String(event.id || ""),
      stageId: String(event.stageId || ""),
      role: normalizeRole(event.role),
      unlockRun: Math.max(1, toNonNegativeInteger(event.unlockRun, 1)),
      priority: Number.isFinite(Number(event.priority)) ? Number(event.priority) : 0,
      cooldownRuns: toNonNegativeInteger(event.cooldownRuns),
      familyId: String(event.familyId || "")
    }))
    .filter((entry) => {
      if (!entry.id || seenIds.has(entry.id)) return false;
      if (stageId && entry.stageId !== stageId) return false;
      if (entry.unlockRun > runNumber) return false;
      seenIds.add(entry.id);
      return true;
    });
}

function evaluateRequirements(event, matchesRequirements) {
  if (typeof matchesRequirements !== "function") return true;
  try {
    return !!matchesRequirements(event.requirements, event);
  } catch (error) {
    return false;
  }
}

function classifyCandidate(entry, options) {
  const {
    matchesRequirements,
    profile,
    runNumber,
    seed,
    stageId
  } = options;
  const usage = toNonNegativeInteger(profile.eventUsage[entry.id]);
  const requirementMatched = evaluateRequirements(entry.event, matchesRequirements);
  const newlyUnlocked = entry.unlockRun === runNumber;
  const lastShownRun = Number(profile.lastShownRuns[entry.id]);
  const hasLastShownRun = Number.isFinite(lastShownRun);
  const runDistance = hasLastShownRun ? runNumber - lastShownRun : Infinity;
  const inRecentWindow = profile.recentEventIds.has(entry.id);
  const cooldownSatisfied = !inRecentWindow && runDistance > entry.cooldownRuns;

  let bucket = 6;
  let reason = "recent-repeat";
  if (usage === 0 && newlyUnlocked && requirementMatched) {
    bucket = 0;
    reason = "newly-unlocked-matched";
  } else if (usage === 0 && newlyUnlocked) {
    bucket = 1;
    reason = "newly-unlocked";
  } else if (usage === 0 && requirementMatched) {
    bucket = 2;
    reason = "unseen-matched";
  } else if (usage === 0) {
    bucket = 3;
    reason = "unseen";
  } else if (cooldownSatisfied && requirementMatched) {
    bucket = 4;
    reason = "cooled-matched";
  } else if (cooldownSatisfied) {
    bucket = 5;
    reason = "cooled";
  }

  return {
    ...entry,
    bucket,
    reason,
    usage,
    requirementMatched,
    newlyUnlocked,
    cooldownSatisfied,
    inRecentWindow,
    lastShownRun: hasLastShownRun ? lastShownRun : null,
    tieBreaker: hashSeed(`${seed}:${stageId}:${entry.id}`)
  };
}

function compareCandidates(left, right) {
  return left.bucket - right.bucket
    || left.usage - right.usage
    || right.priority - left.priority
    || left.tieBreaker - right.tieBreaker
    || left.id.localeCompare(right.id);
}

function normalizeRoleQuotas(input, count) {
  if (!input || typeof input !== "object") return null;
  let remaining = count;
  const quotas = {};
  VALID_ROLES.forEach((role) => {
    const requested = toNonNegativeInteger(input[role]);
    quotas[role] = Math.min(requested, remaining);
    remaining -= quotas[role];
  });
  return quotas;
}

function selectAdaptiveEvents(options = {}) {
  const count = toNonNegativeInteger(options.count);
  const seed = String(options.seed == null ? "" : options.seed);
  const stageId = String(options.stageId || "");
  const runNumber = Math.max(1, toNonNegativeInteger(options.runNumber, 1));
  const recentWindow = toNonNegativeInteger(options.recentWindow, 30);
  const profile = normalizeProfile(options.profile, recentWindow);
  const candidates = normalizeCandidates(options.candidates, stageId, runNumber)
    .map((entry) => classifyCandidate(entry, {
      matchesRequirements: options.matchesRequirements,
      profile,
      runNumber,
      seed,
      stageId
    }))
    .sort(compareCandidates);
  const roleQuotas = normalizeRoleQuotas(options.roleQuotas, count);
  const selected = [];
  const selectedIds = new Set();
  const selectedFamilyIds = normalizeFamilyIds(options.usedFamilyIds);

  function takeCandidates(limit, role, allowFamilyRepeat, selectionPhase) {
    let added = 0;
    for (let index = 0; index < candidates.length && added < limit; index += 1) {
      const candidate = candidates[index];
      if (selectedIds.has(candidate.id)) continue;
      if (role && candidate.role !== role) continue;
      const repeatsFamily = !!candidate.familyId && selectedFamilyIds.has(candidate.familyId);
      if (repeatsFamily && !allowFamilyRepeat) continue;

      selected.push({
        ...candidate,
        familyRelaxed: repeatsFamily,
        selectionPhase
      });
      selectedIds.add(candidate.id);
      if (candidate.familyId) selectedFamilyIds.add(candidate.familyId);
      added += 1;
    }
    return added;
  }

  if (roleQuotas) {
    VALID_ROLES.forEach((role) => {
      const target = Math.min(roleQuotas[role], count - selected.length);
      if (target <= 0) return;
      const strictCount = takeCandidates(target, role, false, "role-quota");
      if (strictCount < target) {
        takeCandidates(target - strictCount, role, true, "role-quota");
      }
    });
  }

  const strictRemaining = Math.max(0, count - selected.length);
  if (strictRemaining > 0) {
    takeCandidates(strictRemaining, "", false, roleQuotas ? "quota-fallback" : "fill");
  }
  const relaxedRemaining = Math.max(0, count - selected.length);
  if (relaxedRemaining > 0) {
    takeCandidates(relaxedRemaining, "", true, roleQuotas ? "quota-fallback" : "fill");
  }

  const eventIds = selected.map((entry) => entry.id);
  return {
    eventIds,
    newEventIds: selected.filter((entry) => entry.usage === 0).map((entry) => entry.id),
    repeatEventIds: selected.filter((entry) => entry.usage > 0).map((entry) => entry.id),
    diagnostics: selected.map((entry) => ({
      eventId: entry.id,
      stageId: entry.stageId,
      role: entry.role,
      familyId: entry.familyId,
      reason: entry.reason,
      usage: entry.usage,
      priority: entry.priority,
      newlyUnlocked: entry.newlyUnlocked,
      requirementMatched: entry.requirementMatched,
      cooldownSatisfied: entry.cooldownSatisfied,
      inRecentWindow: entry.inRecentWindow,
      lastShownRun: entry.lastShownRun,
      familyRelaxed: entry.familyRelaxed,
      selectionPhase: entry.selectionPhase
    }))
  };
}

module.exports = {
  selectAdaptiveEvents
};
