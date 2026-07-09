const STORAGE_KEY = "trip_split_ledgers";

const DEFAULT_CATEGORIES = ["酒店", "餐饮", "交通", "门票", "购物", "其他"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

function normalizeMemberName(name) {
  return String(name || "").trim();
}

function uniqueMembers(members) {
  return (members || []).map(normalizeMemberName).filter(Boolean).reduce((result, name) => {
    if (result.indexOf(name) < 0) result.push(name);
    return result;
  }, []);
}

function parseAmountToCents(value) {
  const text = String(value || "").trim().replace(/,/g, "");
  if (!text) return 0;
  const match = text.match(/^(\d+)(?:\.(\d{0,2}))?$/);
  if (!match) return 0;
  const yuan = Number(match[1] || 0);
  const cents = Number((match[2] || "").padEnd(2, "0"));
  return yuan * 100 + cents;
}

function formatCents(cents) {
  const value = Number(cents || 0);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const yuan = Math.floor(abs / 100);
  const cent = String(abs % 100).padStart(2, "0");
  return `${sign}¥${yuan}.${cent}`;
}

function normalizeExpense(input = {}, members = []) {
  const ledgerMembers = uniqueMembers(members);
  const payer = normalizeMemberName(input.payer) || ledgerMembers[0] || "";
  const participants = uniqueMembers(input.participants && input.participants.length ? input.participants : ledgerMembers);
  const amountCents = Number(input.amountCents || 0) || parseAmountToCents(input.amount || input.amountText);
  return {
    id: String(input.id || createId("expense")),
    title: String(input.title || "").trim(),
    amountCents,
    amountText: formatCents(amountCents),
    payer,
    participants,
    participantsText: participants.join("、"),
    category: DEFAULT_CATEGORIES.indexOf(input.category) >= 0 ? input.category : "其他",
    note: String(input.note || "").trim(),
    noteText: String(input.note || "").trim() ? `· ${String(input.note || "").trim()}` : "",
    paidAt: String(input.paidAt || "").trim(),
    relatedRecordId: input.relatedRecordId ? String(input.relatedRecordId) : "",
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || ""
  };
}

function normalizeLedger(input = {}) {
  const members = uniqueMembers(input.members && input.members.length ? input.members : ["我"]);
  const expenses = (input.expenses || []).map((expense) => normalizeExpense(expense, members));
  return {
    id: String(input.id || createId("ledger")),
    title: String(input.title || "").trim(),
    city: String(input.city || "").trim(),
    startDate: String(input.startDate || "").trim(),
    endDate: String(input.endDate || "").trim(),
    members,
    note: String(input.note || "").trim(),
    expenses,
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || ""
  };
}

function getLedgers() {
  const raw = wx.getStorageSync(STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeLedger).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function setLedgers(ledgers) {
  const normalized = ledgers.map(normalizeLedger);
  wx.setStorageSync(STORAGE_KEY, normalized);
  return normalized;
}

function getLedgerById(id) {
  return getLedgers().find((ledger) => String(ledger.id) === String(id)) || null;
}

function addLedger(ledger) {
  const ledgers = getLedgers();
  const timestamp = nowIso();
  const nextLedger = normalizeLedger({
    ...ledger,
    id: createId("ledger"),
    createdAt: timestamp,
    updatedAt: timestamp
  });
  setLedgers([nextLedger].concat(ledgers));
  return nextLedger;
}

function updateLedger(id, patch) {
  let updated = null;
  const ledgers = getLedgers().map((ledger) => {
    if (String(ledger.id) !== String(id)) return ledger;
    updated = normalizeLedger({
      ...ledger,
      ...patch,
      id: ledger.id,
      createdAt: ledger.createdAt,
      updatedAt: nowIso()
    });
    return updated;
  });
  setLedgers(ledgers);
  return updated;
}

function deleteLedger(id) {
  const ledgers = getLedgers().filter((ledger) => String(ledger.id) !== String(id));
  setLedgers(ledgers);
  return ledgers;
}

function addExpense(ledgerId, expense) {
  const ledger = getLedgerById(ledgerId);
  if (!ledger) return null;
  const timestamp = nowIso();
  const nextExpense = normalizeExpense({
    ...expense,
    id: createId("expense"),
    createdAt: timestamp,
    updatedAt: timestamp
  }, ledger.members);
  const updated = updateLedger(ledgerId, {
    expenses: [nextExpense].concat(ledger.expenses)
  });
  return updated ? nextExpense : null;
}

function updateExpense(ledgerId, expenseId, patch) {
  const ledger = getLedgerById(ledgerId);
  if (!ledger) return null;
  let updatedExpense = null;
  const expenses = ledger.expenses.map((expense) => {
    if (String(expense.id) !== String(expenseId)) return expense;
    updatedExpense = normalizeExpense({
      ...expense,
      ...patch,
      id: expense.id,
      createdAt: expense.createdAt,
      updatedAt: nowIso()
    }, ledger.members);
    return updatedExpense;
  });
  updateLedger(ledgerId, { expenses });
  return updatedExpense;
}

function deleteExpense(ledgerId, expenseId) {
  const ledger = getLedgerById(ledgerId);
  if (!ledger) return null;
  return updateLedger(ledgerId, {
    expenses: ledger.expenses.filter((expense) => String(expense.id) !== String(expenseId))
  });
}

function getParticipantShares(amountCents, participants) {
  const count = participants.length;
  if (!count) return {};
  const base = Math.floor(amountCents / count);
  let remainder = amountCents - base * count;
  return participants.reduce((shares, member) => {
    const extra = remainder > 0 ? 1 : 0;
    shares[member] = base + extra;
    remainder -= extra;
    return shares;
  }, {});
}

function calculateLedgerSummary(ledgerInput) {
  const ledger = normalizeLedger(ledgerInput);
  const memberMap = ledger.members.reduce((map, member) => {
    map[member] = {
      name: member,
      paidCents: 0,
      shareCents: 0,
      balanceCents: 0,
      paidText: formatCents(0),
      shareText: formatCents(0),
      balanceText: formatCents(0)
    };
    return map;
  }, {});
  let totalCents = 0;
  const categoryMap = {};

  ledger.expenses.forEach((expense) => {
    totalCents += expense.amountCents;
    if (!categoryMap[expense.category]) {
      categoryMap[expense.category] = {
        category: expense.category,
        totalCents: 0,
        totalText: formatCents(0),
        count: 0
      };
    }
    categoryMap[expense.category].totalCents += expense.amountCents;
    categoryMap[expense.category].count += 1;
    if (!memberMap[expense.payer]) {
      memberMap[expense.payer] = {
        name: expense.payer,
        paidCents: 0,
        shareCents: 0,
        balanceCents: 0,
        paidText: formatCents(0),
        shareText: formatCents(0),
        balanceText: formatCents(0)
      };
    }
    memberMap[expense.payer].paidCents += expense.amountCents;
    const shares = getParticipantShares(expense.amountCents, expense.participants);
    Object.keys(shares).forEach((member) => {
      if (!memberMap[member]) {
        memberMap[member] = {
          name: member,
          paidCents: 0,
          shareCents: 0,
          balanceCents: 0,
          paidText: formatCents(0),
          shareText: formatCents(0),
          balanceText: formatCents(0)
        };
      }
      memberMap[member].shareCents += shares[member];
    });
  });

  const members = Object.keys(memberMap).map((name) => {
    const member = memberMap[name];
    member.balanceCents = member.paidCents - member.shareCents;
    member.paidText = formatCents(member.paidCents);
    member.shareText = formatCents(member.shareCents);
    member.balanceText = formatCents(member.balanceCents);
    return member;
  }).sort((a, b) => b.balanceCents - a.balanceCents);

  const categories = Object.keys(categoryMap).map((category) => {
    const item = categoryMap[category];
    item.totalText = formatCents(item.totalCents);
    return item;
  }).sort((a, b) => b.totalCents - a.totalCents);

  return {
    totalCents,
    totalText: formatCents(totalCents),
    averageCents: ledger.members.length ? Math.round(totalCents / ledger.members.length) : 0,
    averageText: formatCents(ledger.members.length ? Math.round(totalCents / ledger.members.length) : 0),
    expenseCount: ledger.expenses.length,
    members,
    categories
  };
}

function calculateSettlements(ledgerInput) {
  const summary = calculateLedgerSummary(ledgerInput);
  const debtors = summary.members
    .filter((member) => member.balanceCents < 0)
    .map((member) => ({ name: member.name, amount: -member.balanceCents }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = summary.members
    .filter((member) => member.balanceCents > 0)
    .map((member) => ({ name: member.name, amount: member.balanceCents }))
    .sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amountCents: amount,
        amountText: formatCents(amount),
        text: `${debtor.name} 给 ${creditor.name} ${formatCents(amount)}`
      });
    }
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
    return {
      ...clone(ledger),
      totalText: summary.totalText,
      expenseCount: summary.expenseCount,
      memberCount: ledger.members.length,
      settlementCount: calculateSettlements(ledger).length
    };
  });
}

module.exports = {
  DEFAULT_CATEGORIES,
  STORAGE_KEY,
  addExpense,
  addLedger,
  calculateLedgerSummary,
  calculateSettlements,
  deleteExpense,
  deleteLedger,
  formatCents,
  getLedgerById,
  getLedgerListItems,
  getLedgers,
  normalizeLedger,
  parseAmountToCents,
  setLedgers,
  updateExpense,
  updateLedger
};
