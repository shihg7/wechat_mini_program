const { createStableId } = require("./id");
const { DEFAULT_BASE_CURRENCY, SCHEMA_VERSION, assertValidLedger } = require("./ledgerValidation");

function normalizeBaseCurrency(value) {
  return String(value || DEFAULT_BASE_CURRENCY).trim().toUpperCase();
}

function equalAllocations(amountCents, participantIds) {
  const ids = participantIds || [];
  if (!ids.length) return [];
  const base = Math.floor(Number(amountCents || 0) / ids.length);
  let remainder = Number(amountCents || 0) - base * ids.length;
  return ids.map((memberId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { memberId, inputValue: "1", shareCents: base + extra };
  });
}

function memberName(value) {
  return String(value && typeof value === "object" ? value.name : value || "").trim();
}

function migrateLedger(input, ledgerIndex = 0) {
  if (!input || typeof input !== "object") throw new Error("账本数据无效");
  const ledgerId = String(input.id || createStableId("ledger", `legacy:${ledgerIndex}:${input.title || ""}`));
  const sourceMembers = Array.isArray(input.members) && input.members.length ? input.members : ["我"];
  const members = [];
  const nameToId = {};
  const idSet = new Set();

  sourceMembers.forEach((source, index) => {
    const name = memberName(source);
    if (!name || nameToId[name]) return;
    let id = source && typeof source === "object" && source.id ? String(source.id) : createStableId("member", `${ledgerId}:${index}:${name}`);
    if (idSet.has(id)) id = createStableId("member", `${ledgerId}:${index}:${name}:duplicate`);
    const status = source && typeof source === "object" && source.status != null ? source.status : "active";
    members.push({ ...(source && typeof source === "object" ? source : {}), id, name, status });
    nameToId[name] = id;
    idSet.add(id);
  });

  function ensureReferencedMember(name, hint) {
    const normalized = memberName(name);
    if (!normalized) return "";
    if (nameToId[normalized]) return nameToId[normalized];
    const id = createStableId("member", `${ledgerId}:historical:${hint}:${normalized}`);
    members.push({ id, name: normalized, status: "archived" });
    nameToId[normalized] = id;
    idSet.add(id);
    return id;
  }

  const expenses = (input.expenses || []).map((expense, index) => {
    const payerId = expense.payerId && idSet.has(String(expense.payerId))
      ? String(expense.payerId)
      : ensureReferencedMember(expense.payer, `expense:${index}:payer`);
    const participantIds = Array.isArray(expense.participantIds) && expense.participantIds.every((id) => idSet.has(String(id)))
      ? expense.participantIds.map(String)
      : (expense.participants || []).map((name, participantIndex) => ensureReferencedMember(name, `expense:${index}:participant:${participantIndex}`));
    const uniqueParticipantIds = Array.from(new Set(participantIds));
    const splitMode = ["equal", "amount", "ratio", "shares"].indexOf(expense.splitMode) >= 0 ? expense.splitMode : "equal";
    const hasValidAllocations = Array.isArray(expense.allocations)
      && expense.allocations.length === uniqueParticipantIds.length
      && expense.allocations.every((allocation) => uniqueParticipantIds.indexOf(String(allocation.memberId)) >= 0);
    return {
      ...expense,
      payerId,
      participantIds: uniqueParticipantIds,
      splitMode,
      allocations: hasValidAllocations
        ? expense.allocations.map((allocation) => ({ ...allocation, memberId: String(allocation.memberId) }))
        : equalAllocations(expense.amountCents, uniqueParticipantIds)
    };
  });

  const transfers = (input.transfers || []).map((transfer, index) => ({
    ...transfer,
    fromMemberId: transfer.fromMemberId && idSet.has(String(transfer.fromMemberId))
      ? String(transfer.fromMemberId)
      : ensureReferencedMember(transfer.from || transfer.fromMember, `transfer:${index}:from`),
    toMemberId: transfer.toMemberId && idSet.has(String(transfer.toMemberId))
      ? String(transfer.toMemberId)
      : ensureReferencedMember(transfer.to || transfer.toMember, `transfer:${index}:to`),
    status: transfer.status == null ? "confirmed" : transfer.status
  }));

  const migrated = {
    ...input,
    id: ledgerId,
    schemaVersion: SCHEMA_VERSION,
    baseCurrency: normalizeBaseCurrency(input.baseCurrency),
    members,
    expenses,
    transfers
  };
  assertValidLedger(migrated);
  return migrated;
}

function migrateLedgers(inputs) {
  if (!Array.isArray(inputs)) throw new Error("账本集合必须是数组");
  return inputs.map(migrateLedger);
}

module.exports = {
  SCHEMA_VERSION,
  migrateLedger,
  migrateLedgers
};
