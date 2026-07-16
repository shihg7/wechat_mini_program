const TAU = Math.PI * 2;

function normalizeAngle(angle) {
  const value = Number(angle || 0) % TAU;
  return value < 0 ? value + TAU : value;
}

function shortestAngleDelta(current, previous) {
  let delta = normalizeAngle(current) - normalizeAngle(previous);
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return delta;
}

function winnerIndex(rotation, count) {
  if (!Number.isInteger(count) || count < 1) return -1;
  const slice = TAU / count;
  return Math.min(count - 1, Math.floor(normalizeAngle(-rotation) / slice));
}

function targetRotation(currentRotation, count, randomValue = Math.random(), minTurns = 5, maxTurns = 8) {
  const turns = minTurns + Math.floor(Math.max(0, Math.min(0.999999, randomValue)) * (maxTurns - minTurns + 1));
  const offset = Math.max(0, Math.min(0.999999, randomValue)) * TAU;
  return Number(currentRotation || 0) + turns * TAU + offset;
}

function stepVelocity(velocity, friction = 0.985, stopThreshold = 0.0015) {
  const next = Number(velocity || 0) * friction;
  return Math.abs(next) < stopThreshold ? 0 : next;
}

function truncateLabel(text, maxLength) {
  const value = String(text || "");
  return value.length > maxLength ? `${value.slice(0, Math.max(1, maxLength - 1))}…` : value;
}

module.exports = { TAU, normalizeAngle, shortestAngleDelta, stepVelocity, targetRotation, truncateLabel, winnerIndex };
