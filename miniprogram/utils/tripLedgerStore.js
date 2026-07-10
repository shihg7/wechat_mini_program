const { createId } = require("./id");
const { SCHEMA_VERSION, migrateLedger, migrateLedgers } = require("./ledgerMigration");
const { assertValidLedger } = require("./ledgerValidation");

const STORAGE_KEY = "trip_split_ledgers";
const DEFAULT_CATEGORIES = ["酒店", "餐饮", "交通", "门票", "购物", "其他"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeMemberName(name) {
  return String(name || "").trim();
}

function uniqueNames(members) {
  return (members || []).map((member) => normalizeMemberName(member && typeof member === "object" ? member.name : member)).filter(Boolean).reduce((result, name) => {
    if (result.indexOf(name) < 0) result.push(name);
    return result;
  }, []);
}

function parseAmountToCents(value) {
  const text = String(value == null ? "" : value).trim().replace(/,/g, "");
  if (!text) return 0;
  const match = text.match(/^(\d+)(?:\.(\d{0,2}))?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 100 + Number((match[2] || "").padEnd(2, "0"));
}

function formatCents(cents) {
  const value = Number(cents || 0);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}¥${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function memberByReference(ledger, reference) {
  const text = normalizeMemberName(reference && typeof reference === "object" ? reference.id || reference.name : reference);
  return ledger.members.find((member) => member.id === text || member.name === text) || null;
}

function requireMember(ledger, reference, field) {
  const member = memberByReference(ledger, reference);
  if (!member) {
    const error = new Error(`${field}引用了不存在的成员`);
    error.code = "INVALID_MEMBER_REFERENCE";
    throw error;
  }
  return member;
}

function normalizeExpense(input, ledger) {
  const payer = requireMember(ledger, input.payerId || input.payer || ledger.members[0].id, "付款人");
  const participantRefs = input.participantIds && input.participantIds.length
    ? input.participantIds
    : (input.participants && input.participants.length ? input.participants : ledger.members.filter((member) => member.status === "active").map((member) => member.id));
  const participantIds = participantRefs.map((reference) => requireMember(ledger, reference, "参与人").id);
  const amountCents = input.amountCents == null || input.amountCents === ""
    ? parseAmountToCents(input.amount || input.amountText)
    : Number(input.amountCents);
  const expense = {
    ...input,
    id: String(input.id || createId("expense")),
    title: String(input.title || "").trim(),
    amountCents,
    category: DEFAULT_CATEGORIES.indexOf(input.category) >= 0 ? input.category : "其他",
    note: String(input.note || "").trim(),
    paidAt: String(input.paidAt || "").trim(),
    relatedRecordId: input.relatedRecordId ? String(input.relatedRecordId) : "",
    payerId: payer.id,
    participantIds: Array.from(new Set(participantIds)),
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || ""
  };
  delete expense.payer;
  delete expense.participants;
  delete expense.amountText;
  delete expense.participantsText;
  delete expense.noteText;
  return expense;
}

function reconcileMembers(inputMembers, existingMembers, ledgerId) {
  if (inputMembers == null) return clone(existingMembers || []);
  if (inputMembers.some((member) => member && typeof member === "object")) {
    return inputMembers.map((source) => {
      const name = normalizeMemberName(source && typeof source === "object" ? source.name : source);
      const found = (existingMembers || []).find((member) => member.id === source.id || member.name === name);
      return {
        ...(found || {}),
        ...(source && typeof source === "object" ? source : {}),
        id: String((source && source.id) || (found && found.id) || createId("member")),
        name,
        status: source && source.status != null ? source.status : "active"
      };
    });
  }
  const names = uniqueNames(inputMembers);
  const existing = existingMembers || [];
  const next = names.map((name) => {
    const found = existing.find((member) => member.name === name);
    return found ? { ...found, status: "active" } : { id: createId("member"), name, status: "active" };
  });
  existing.forEach((member) => {
    if (names.indexOf(member.name) < 0) next.push({ ...member, status: "archived" });
  });
  return next.length ? next : [{ id: createId("member"), name: "我", status: "active" }];
}

function normalizeInternalLedger(input = {}, existing = null) {
  const base = migrateLedger({
    ...input,
    members: input.memberRecords || input.members || (existing && existing.members),
    expenses: input.expenses || [],
    transfers: input.transfers || []
  });
  const members = reconcileMembers(input.memberRecords || input.members, existing ? existing.members : base.members, base.id);
  const skeleton = { ...base, members };
  const ledger = {
    ...skeleton,
    schemaVersion: SCHEMA_VERSION,
    id: String(input.id || base.id || createId("ledger")),
    title: String(input.title || "").trim(),
    city: String(input.city || "").trim(),
    startDate: String(input.startDate || "").trim(),
    endDate: String(input.endDate || "").trim(),
    note: String(input.note || "").trim(),
    expenses: (input.expenses || []).map((expense) => normalizeExpense(expense, skeleton)),
    transfers: (input.transfers || []).map((transfer) => ({
      ...transfer,
      id: String(transfer.id || createId("transfer")),
      fromMemberId: requireMember(skeleton, transfer.fromMemberId || transfer.from, "转出成员").id,
      toMemberId: requireMember(skeleton, transfer.toMemberId || transfer.to, "转入成员").id,
      amountCents: Number(transfer.amountCents),
      status: transfer.status == null ? "confirmed" : transfer.status,
      transferredAt: String(transfer.transferredAt || "").trim(),
      note: String(transfer.note || "").trim(),
      createdAt: transfer.createdAt || nowIso(),
      updatedAt: transfer.updatedAt || ""
    })),
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || ""
  };
  delete ledger.memberRecords;
  assertValidLedger(ledger);
  return ledger;
}

function toPublicLedger(internal) {
  const memberMap = internal.members.reduce((map, member) => {
    map[member.id] = member;
    return map;
  }, {});
  const activeMembers = internal.members.filter((member) => member.status === "active");
  return {
    ...clone(internal),
    memberRecords: clone(internal.members),
    members: clone(internal.members),
    activeMemberNames: activeMembers.map((member) => member.name),
    expenses: internal.expenses.map((expense) => {
      const payer = memberMap[expense.payerId];
      const participants = expense.participantIds.map((id) => memberMap[id]).filter(Boolean);
      return {
        ...clone(expense),
        amountText: formatCents(expense.amountCents),
        payer: payer ? payer.name : "",
        participants: participants.map((member) => member.name),
        participantsText: participants.map((member) => member.name).join("、"),
        noteText: expense.note ? `· ${expense.note}` : ""
      };
    }),
    transfers: internal.transfers.map((transfer) => ({
      ...clone(transfer),
      from: memberMap[transfer.fromMemberId] ? memberMap[transfer.fromMemberId].name : "",
      to: memberMap[transfer.toMemberId] ? memberMap[transfer.toMemberId].name : "",
      amountText: formatCents(transfer.amountCents)
    }))
  };
}

function readInternalLedgers() {
  const raw = wx.getStorageSync(STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  const migrated = migrateLedgers(raw).map((ledger) => normalizeInternalLedger(ledger));
  const changed = JSON.stringify(raw) !== JSON.stringify(migrated);
  if (changed) wx.setStorageSync(STORAGE_KEY, migrated);
  return migrated.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function writeInternalLedgers(ledgers) {
  const normalized = ledgers.map((ledger) => normalizeInternalLedger(ledger));
  normalized.forEach(assertValidLedger);
  wx.setStorageSync(STORAGE_KEY, normalized);
  return normalized;
}

function getLedgers() {
  return readInternalLedgers().map(toPublicLedger);
}

function setLedgers(ledgers) {
  const normalized = ledgers.map((ledger) => normalizeInternalLedger(ledger));
  writeInternalLedgers(normalized);
  return normalized.map(toPublicLedger);
}

function getInternalLedgerById(id) {
  return readInternalLedgers().find((ledger) => String(ledger.id) === String(id)) || null;
}

function getLedgerById(id) {
  const ledger = getInternalLedgerById(id);
  return ledger ? toPublicLedger(ledger) : null;
}

function replaceLedger(id, updater) {
  let result = null;
  const ledgers = readInternalLedgers();
  const next = ledgers.map((ledger) => {
    if (String(ledger.id) !== String(id)) return ledger;
    result = normalizeInternalLedger(updater(clone(ledger)), ledger);
    result.id = ledger.id;
    result.createdAt = ledger.createdAt;
    result.updatedAt = nowIso();
    assertValidLedger(result);
    return result;
  });
  if (!result) return null;
  writeInternalLedgers(next);
  return toPublicLedger(result);
}

function addLedger(input) {
  const timestamp = nowIso();
  const raw = { ...input, id: createId("ledger"), schemaVersion: SCHEMA_VERSION, transfers: input.transfers || [], createdAt: timestamp, updatedAt: timestamp };
  const ledger = normalizeInternalLedger(raw);
  writeInternalLedgers([ledger].concat(readInternalLedgers()));
  return toPublicLedger(ledger);
}

function updateLedger(id, patch) {
  return replaceLedger(id, (ledger) => ({ ...ledger, ...patch, id: ledger.id, createdAt: ledger.createdAt }));
}

function addLedgerMember(id, name) {
  const memberName = normalizeMemberName(name);
  if (!memberName) return null;
  const ledger = getInternalLedgerById(id);
  if (!ledger) return null;
  const existing = ledger.members.find((member) => member.name === memberName);
  if (existing) return existing.status === "archived" ? updateLedgerMember(id, existing.id, { status: "active" }) : toPublicLedger(ledger);
  return replaceLedger(id, (current) => ({ ...current, members: current.members.concat({ id: createId("member"), name: memberName, status: "active" }) }));
}

function getActiveMembers(ledgerOrId) {
  const ledger = typeof ledgerOrId === "object"
    ? (ledgerOrId.memberRecords ? { members: ledgerOrId.memberRecords } : ledgerOrId)
    : getInternalLedgerById(ledgerOrId);
  return ledger ? clone(ledger.members.filter((member) => member.status === "active")) : [];
}

function updateLedgerMember(ledgerId, memberId, patch = {}) {
  return replaceLedger(ledgerId, (ledger) => {
    const target = requireMember(ledger, memberId, "成员");
    const name = patch.name == null ? target.name : normalizeMemberName(patch.name);
    if (!name) throw new Error("成员名称不能为空");
    if (ledger.members.some((member) => member.id !== target.id && member.name === name)) throw new Error("成员名称已存在");
    const status = patch.status == null ? target.status : patch.status;
    return { ...ledger, members: ledger.members.map((member) => member.id === target.id ? { ...member, name, status } : member) };
  });
}

function archiveLedgerMember(ledgerId, memberId) {
  return updateLedgerMember(ledgerId, memberId, { status: "archived" });
}

function isMemberReferenced(ledger, memberId) {
  return ledger.expenses.some((expense) => expense.payerId === memberId || expense.participantIds.indexOf(memberId) >= 0)
    || ledger.transfers.some((transfer) => transfer.fromMemberId === memberId || transfer.toMemberId === memberId);
}

function removeLedgerMember(ledgerId, memberId) {
  const ledger = getInternalLedgerById(ledgerId);
  if (!ledger) return null;
  const target = requireMember(ledger, memberId, "成员");
  const activeCount = ledger.members.filter((member) => member.status === "active").length;
  if (target.status === "active" && activeCount <= 1) throw new Error("至少保留一个当前成员");
  if (isMemberReferenced(ledger, target.id)) return null;
  if (ledger.members.length <= 1) throw new Error("至少保留一个成员");
  return replaceLedger(ledgerId, (current) => ({ ...current, members: current.members.filter((member) => member.id !== target.id) }));
}

function deleteLedger(id) {
  const ledgers = readInternalLedgers().filter((ledger) => String(ledger.id) !== String(id));
  writeInternalLedgers(ledgers);
  return ledgers.map(toPublicLedger);
}

function addExpense(ledgerId, input) {
  let created = null;
  const updated = replaceLedger(ledgerId, (ledger) => {
    const timestamp = nowIso();
    created = normalizeExpense({ ...input, id: createId("expense"), createdAt: timestamp, updatedAt: timestamp }, ledger);
    return { ...ledger, expenses: [created].concat(ledger.expenses) };
  });
  if (!updated) return null;
  return toPublicLedger({ ...getInternalLedgerById(ledgerId), expenses: [created] }).expenses[0];
}

function updateExpense(ledgerId, expenseId, patch) {
  let updatedExpense = null;
  const updated = replaceLedger(ledgerId, (ledger) => ({
    ...ledger,
    expenses: ledger.expenses.map((expense) => {
      if (String(expense.id) !== String(expenseId)) return expense;
      updatedExpense = normalizeExpense({ ...expense, ...patch, id: expense.id, createdAt: expense.createdAt, updatedAt: nowIso() }, ledger);
      return updatedExpense;
    })
  }));
  if (!updated || !updatedExpense) return null;
  return updated.expenses.find((expense) => String(expense.id) === String(expenseId));
}

function deleteExpense(ledgerId, expenseId) {
  return replaceLedger(ledgerId, (ledger) => ({ ...ledger, expenses: ledger.expenses.filter((expense) => String(expense.id) !== String(expenseId)) }));
}

function addTransfer(ledgerId, input) {
  let created = null;
  const updated = replaceLedger(ledgerId, (ledger) => {
    const from = requireMember(ledger, input.fromMemberId || input.from, "转出成员");
    const to = requireMember(ledger, input.toMemberId || input.to, "转入成员");
    if (from.id === to.id) throw new Error("不能转给自己");
    const amountCents = Number(input.amountCents == null ? parseAmountToCents(input.amount) : input.amountCents);
    const recommendation = calculateSettlements(toPublicLedger(ledger)).find((item) => {
      return item.fromMemberId === from.id && item.toMemberId === to.id;
    });
    if (!recommendation) throw new Error("当前没有这笔待结算款项");
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > recommendation.amountCents) {
      throw new Error(`转账金额不能超过当前待结算金额 ${formatCents(recommendation.amountCents)}`);
    }
    const timestamp = nowIso();
    created = {
      id: createId("transfer"),
      fromMemberId: from.id,
      toMemberId: to.id,
      amountCents,
      status: "confirmed",
      transferredAt: String(input.transferredAt || "").trim(),
      note: String(input.note || "").trim(),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    return { ...ledger, transfers: [created].concat(ledger.transfers) };
  });
  if (!updated) return null;
  return updated.transfers.find((transfer) => transfer.id === created.id);
}

function voidTransfer(ledgerId, transferId) {
  let found = false;
  const updated = replaceLedger(ledgerId, (ledger) => ({
    ...ledger,
    transfers: ledger.transfers.map((transfer) => {
      if (String(transfer.id) !== String(transferId)) return transfer;
      found = true;
      return { ...transfer, status: "void", updatedAt: nowIso() };
    })
  }));
  return found ? updated.transfers.find((transfer) => String(transfer.id) === String(transferId)) : null;
}

function getParticipantShares(amountCents, participantIds) {
  if (!participantIds.length) return {};
  const base = Math.floor(amountCents / participantIds.length);
  let remainder = amountCents - base * participantIds.length;
  return participantIds.reduce((shares, id) => {
    const extra = remainder > 0 ? 1 : 0;
    shares[id] = base + extra;
    remainder -= extra;
    return shares;
  }, {});
}

function calculateLedgerSummary(ledgerInput) {
  const internal = normalizeInternalLedger(ledgerInput.memberRecords ? { ...ledgerInput, members: ledgerInput.memberRecords } : ledgerInput);
  const memberMap = internal.members.reduce((map, member) => {
    map[member.id] = { id: member.id, name: member.name, status: member.status, paidCents: 0, shareCents: 0, transferredOutCents: 0, transferredInCents: 0, balanceCents: 0 };
    return map;
  }, {});
  let totalCents = 0;
  const categoryMap = {};
  internal.expenses.forEach((expense) => {
    totalCents += expense.amountCents;
    if (!categoryMap[expense.category]) categoryMap[expense.category] = { category: expense.category, totalCents: 0, count: 0 };
    categoryMap[expense.category].totalCents += expense.amountCents;
    categoryMap[expense.category].count += 1;
    memberMap[expense.payerId].paidCents += expense.amountCents;
    const shares = getParticipantShares(expense.amountCents, expense.participantIds);
    Object.keys(shares).forEach((id) => { memberMap[id].shareCents += shares[id]; });
  });
  internal.transfers.filter((transfer) => transfer.status === "confirmed").forEach((transfer) => {
    memberMap[transfer.fromMemberId].transferredOutCents += transfer.amountCents;
    memberMap[transfer.toMemberId].transferredInCents += transfer.amountCents;
  });
  const members = Object.keys(memberMap).map((id) => {
    const member = memberMap[id];
    member.balanceCents = member.paidCents - member.shareCents + member.transferredOutCents - member.transferredInCents;
    member.paidText = formatCents(member.paidCents);
    member.shareText = formatCents(member.shareCents);
    member.balanceText = formatCents(member.balanceCents);
    return member;
  }).sort((a, b) => b.balanceCents - a.balanceCents);
  const categories = Object.keys(categoryMap).map((category) => ({ ...categoryMap[category], totalText: formatCents(categoryMap[category].totalCents) })).sort((a, b) => b.totalCents - a.totalCents);
  const activeCount = internal.members.filter((member) => member.status === "active").length;
  return {
    totalCents,
    totalText: formatCents(totalCents),
    averageCents: activeCount ? Math.round(totalCents / activeCount) : 0,
    averageText: formatCents(activeCount ? Math.round(totalCents / activeCount) : 0),
    expenseCount: internal.expenses.length,
    confirmedTransferCount: internal.transfers.filter((transfer) => transfer.status === "confirmed").length,
    members,
    categories
  };
}

function calculateSettlements(ledgerInput) {
  const summary = calculateLedgerSummary(ledgerInput);
  const debtors = summary.members.filter((member) => member.balanceCents < 0).map((member) => ({ ...member, amount: -member.balanceCents })).sort((a, b) => b.amount - a.amount);
  const creditors = summary.members.filter((member) => member.balanceCents > 0).map((member) => ({ ...member, amount: member.balanceCents })).sort((a, b) => b.amount - a.amount);
  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) settlements.push({ fromMemberId: debtor.id, toMemberId: creditor.id, from: debtor.name, to: creditor.name, amountCents: amount, amountText: formatCents(amount), text: `${debtor.name} 给 ${creditor.name} ${formatCents(amount)}` });
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) debtorIndex += 1;
    if (creditor.amount === 0) creditorIndex += 1;
  }
  return settlements;
}

function getLedgerListItems(ledgers = getLedgers()) {
  return ledgers.map((ledger) => {
    const summary = calculateLedgerSummary(ledger);
    const settlements = calculateSettlements(ledger);
    const remainingCents = settlements.reduce((sum, item) => sum + item.amountCents, 0);
    return {
      ...clone(ledger),
      totalText: summary.totalText,
      expenseCount: summary.expenseCount,
      memberCount: getActiveMembers(ledger).length,
      settlementCount: settlements.length,
      remainingCents,
      remainingText: formatCents(remainingCents),
      status: remainingCents > 0 ? "active" : "settled",
      statusText: remainingCents > 0 ? "进行中" : "已结清"
    };
  });
}

function normalizeLedger(input) {
  return toPublicLedger(normalizeInternalLedger(input));
}

module.exports = {
  DEFAULT_CATEGORIES,
  SCHEMA_VERSION,
  STORAGE_KEY,
  addExpense,
  addLedger,
  addLedgerMember,
  addTransfer,
  archiveLedgerMember,
  calculateLedgerSummary,
  calculateSettlements,
  deleteExpense,
  deleteLedger,
  formatCents,
  getActiveMembers,
  getLedgerById,
  getLedgerListItems,
  getLedgers,
  normalizeLedger,
  parseAmountToCents,
  removeLedgerMember,
  setLedgers,
  updateExpense,
  updateLedger,
  updateLedgerMember,
  voidTransfer
};
