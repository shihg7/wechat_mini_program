let sequence = 0;

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createId(prefix = "id") {
  sequence = (sequence + 1) % 1000000;
  const random = Math.floor(Math.random() * 0x100000000).toString(36);
  return `${prefix}_${Date.now().toString(36)}_${sequence.toString(36)}_${random}`;
}

function createStableId(prefix, seed) {
  return `${prefix}_${hashText(seed)}`;
}

module.exports = {
  createId,
  createStableId
};
