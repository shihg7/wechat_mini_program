const MEMBER_STATUSES = ["active", "archived"];
const TRANSFER_STATUSES = ["confirmed", "void"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!value) return true;
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validatePositiveCents(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) return `${field}必须是大于 0 的整数分`;
  return "";
}

function validateLedger(ledger) {
  const errors = [];
  if (!ledger || typeof ledger !== "object") return ["账本数据无效"];
  if (ledger.schemaVersion !== 2) errors.push("schemaVersion 必须为 2");
  if (!Array.isArray(ledger.members) || !ledger.members.length) errors.push("至少需要一个成员");
  if (!isValidDate(ledger.startDate)) errors.push("开始日期无效");
  if (!isValidDate(ledger.endDate)) errors.push("结束日期无效");
  if (ledger.startDate && ledger.endDate && ledger.startDate > ledger.endDate) errors.push("结束日期不能早于开始日期");

  const memberIds = new Set();
  const memberNames = new Set();
  (ledger.members || []).forEach((member, index) => {
    if (!member || typeof member !== "object") {
      errors.push(`成员 ${index + 1} 无效`);
      return;
    }
    if (!String(member.id || "").trim()) errors.push(`成员 ${index + 1} 缺少 id`);
    if (!String(member.name || "").trim()) errors.push(`成员 ${index + 1} 缺少名称`);
    if (!MEMBER_STATUSES.includes(member.status)) errors.push(`成员 ${member.name || index + 1} 状态无效`);
    if (memberIds.has(member.id)) errors.push(`成员 id 重复: ${member.id}`);
    if (memberNames.has(member.name)) errors.push(`成员名称重复: ${member.name}`);
    memberIds.add(member.id);
    memberNames.add(member.name);
  });
  if ((ledger.members || []).length && !(ledger.members || []).some((member) => member.status === "active")) {
    errors.push("至少需要一个当前成员");
  }

  (ledger.expenses || []).forEach((expense, index) => {
    const label = `支出 ${index + 1}`;
    const amountError = validatePositiveCents(expense.amountCents, `${label}金额`);
    if (amountError) errors.push(amountError);
    if (!memberIds.has(expense.payerId)) errors.push(`${label}付款人引用无效`);
    if (!Array.isArray(expense.participantIds) || !expense.participantIds.length) errors.push(`${label}至少需要一个参与人`);
    const uniqueIds = new Set(expense.participantIds || []);
    if (uniqueIds.size !== (expense.participantIds || []).length) errors.push(`${label}参与人重复`);
    uniqueIds.forEach((id) => {
      if (!memberIds.has(id)) errors.push(`${label}参与人引用无效: ${id}`);
    });
    if (!isValidDate(expense.paidAt)) errors.push(`${label}日期无效`);
  });

  (ledger.transfers || []).forEach((transfer, index) => {
    const label = `转账 ${index + 1}`;
    const amountError = validatePositiveCents(transfer.amountCents, `${label}金额`);
    if (amountError) errors.push(amountError);
    if (!memberIds.has(transfer.fromMemberId)) errors.push(`${label}付款成员引用无效`);
    if (!memberIds.has(transfer.toMemberId)) errors.push(`${label}收款成员引用无效`);
    if (transfer.fromMemberId === transfer.toMemberId) errors.push(`${label}不能转给自己`);
    if (!TRANSFER_STATUSES.includes(transfer.status)) errors.push(`${label}状态无效`);
    if (!isValidDate(transfer.transferredAt)) errors.push(`${label}日期无效`);
  });
  return errors;
}

function assertValidLedger(ledger) {
  const errors = validateLedger(ledger);
  if (errors.length) {
    const error = new Error(errors.join("；"));
    error.code = "INVALID_LEDGER";
    error.validationErrors = errors;
    throw error;
  }
  return ledger;
}

module.exports = {
  MEMBER_STATUSES,
  TRANSFER_STATUSES,
  assertValidLedger,
  isValidDate,
  validateLedger,
  validatePositiveCents
};
