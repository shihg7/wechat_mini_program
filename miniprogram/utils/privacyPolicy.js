const PRIVATE_MODE = "private";
const REDACTED_MODE = "redacted";

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function anonymizeLedgers(ledgers) {
  const globalNames = [];
  const memberName = (member) => String(member && typeof member === "object" ? member.name : member || "");
  (ledgers || []).forEach((ledger) => {
    (ledger.members || []).map(memberName).forEach((name) => {
      if (globalNames.indexOf(name) < 0) globalNames.push(name);
    });
    (ledger.expenses || []).forEach((expense) => {
      [expense.payer].concat(expense.participants || []).forEach((name) => {
        if (name && globalNames.indexOf(name) < 0) globalNames.push(name);
      });
    });
  });
  const aliases = globalNames.reduce((map, name, index) => {
    map[name] = `成员${index + 1}`;
    return map;
  }, {});

  return (ledgers || []).map((ledger) => ({
    ...ledger,
    members: (ledger.members || []).map((member) => (
      member && typeof member === "object"
        ? { ...member, name: aliases[memberName(member)] || "成员" }
        : aliases[memberName(member)] || "成员"
    )),
    memberRecords: Array.isArray(ledger.memberRecords)
      ? ledger.memberRecords.map((member) => ({ ...member, name: aliases[memberName(member)] || "成员" }))
      : ledger.memberRecords,
    activeMemberNames: Array.isArray(ledger.activeMemberNames)
      ? ledger.activeMemberNames.map((name) => aliases[name] || "成员")
      : ledger.activeMemberNames,
    expenses: (ledger.expenses || []).map((expense) => ({
      ...expense,
      payer: aliases[expense.payer] || "成员",
      participants: (expense.participants || []).map((name) => aliases[name] || "成员"),
      participantsText: (expense.participants || []).map((name) => aliases[name] || "成员").join("、"),
      note: "",
      noteText: ""
    })),
    transfers: (ledger.transfers || []).map((transfer) => ({
      ...transfer,
      from: aliases[transfer.from] || transfer.from,
      to: aliases[transfer.to] || transfer.to
    }))
  }));
}

function redactRecords(records) {
  return (records || []).map((record) => ({
    ...record,
    stayDate: record.visitMonth || String(record.stayDate || "").slice(0, 7),
    memberLevel: "",
    priceRange: "",
    note: "",
    privateNote: "",
    cloudRecordId: "",
    publicReviewId: "",
    placeId: "",
    address: "",
    latitude: null,
    longitude: null
  }));
}

function createPrivacyCopy(input = {}, mode = PRIVATE_MODE) {
  const copied = clone({
    records: input.records || [],
    places: input.places || [],
    ledgers: input.ledgers || []
  });
  if (mode !== REDACTED_MODE) return copied;
  return {
    records: redactRecords(copied.records),
    places: copied.places.map((place) => ({ ...place, address: "", latitude: null, longitude: null, cloudPlaceId: "" })),
    ledgers: anonymizeLedgers(copied.ledgers)
  };
}

module.exports = {
  PRIVATE_MODE,
  REDACTED_MODE,
  createPrivacyCopy
};
