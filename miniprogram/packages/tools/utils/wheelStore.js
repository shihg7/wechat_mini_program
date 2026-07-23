const { createId } = require("../../../utils/id");

const STORAGE_KEY = "toolbox_wheels";
const MAX_OPTIONS = 50;
const MAX_OPTION_LENGTH = 24;
const MAX_HISTORY = 50;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso() { return new Date().toISOString(); }

function normalizeOption(input = {}) {
  return { id: String(input.id || createId("option")), text: String(input.text || "").trim().slice(0, MAX_OPTION_LENGTH), enabled: input.enabled !== false };
}

function parseOptions(text) {
  const seen = {};
  return String(text || "").split(/[\n，,]+/).map((item) => item.trim().slice(0, MAX_OPTION_LENGTH)).filter((item) => {
    const key = item.toLowerCase();
    if (!item || seen[key]) return false;
    seen[key] = true;
    return true;
  }).slice(0, MAX_OPTIONS);
}

function normalizeWheel(input = {}) {
  const options = (input.options || []).map(normalizeOption).filter((item) => item.text).slice(0, MAX_OPTIONS);
  const history = (input.history || []).map((item) => ({ id: String(item.id || createId("result")), optionId: String(item.optionId || ""), optionText: String(item.optionText || "").trim(), spunAt: String(item.spunAt || nowIso()) })).slice(0, MAX_HISTORY);
  return { id: String(input.id || createId("wheel")), title: String(input.title || "未命名转盘").trim().slice(0, 30) || "未命名转盘", options, history, createdAt: input.createdAt || nowIso(), updatedAt: input.updatedAt || "" };
}

function getWheels() { const raw = wx.getStorageSync(STORAGE_KEY); return (Array.isArray(raw) ? raw : []).map(normalizeWheel).sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))); }
function setWheels(items) { const wheels = items.map(normalizeWheel); wx.setStorageSync(STORAGE_KEY, wheels); return wheels; }
function getWheelById(id) { return getWheels().find((item) => item.id === String(id)) || null; }
function createWheel(input = {}) { const wheel = normalizeWheel({ ...input, id: createId("wheel"), createdAt: nowIso(), updatedAt: nowIso() }); setWheels([wheel].concat(getWheels())); return wheel; }
function updateWheel(id, patch) { let updated = null; const wheels = getWheels().map((item) => { if (item.id !== String(id)) return item; updated = normalizeWheel({ ...item, ...patch, id: item.id, createdAt: item.createdAt, updatedAt: nowIso() }); return updated; }); if (updated) setWheels(wheels); return updated; }
function deleteWheel(id) { const next = getWheels().filter((item) => item.id !== String(id)); setWheels(next); return next; }

function addOptions(id, text) {
  const wheel = getWheelById(id); if (!wheel) return null;
  const existing = new Set(wheel.options.map((item) => item.text.toLowerCase()));
  const additions = parseOptions(text).filter((item) => !existing.has(item.toLowerCase())).map((item) => normalizeOption({ text: item }));
  return updateWheel(id, { options: wheel.options.concat(additions).slice(0, MAX_OPTIONS) });
}
function updateOption(wheelId, optionId, text) { const wheel = getWheelById(wheelId); if (!wheel) return null; const value = String(text || "").trim().slice(0, MAX_OPTION_LENGTH); if (!value) throw new Error("选项不能为空"); if (wheel.options.some((item) => item.id !== String(optionId) && item.text.toLowerCase() === value.toLowerCase())) throw new Error("选项不能重复"); return updateWheel(wheelId, { options: wheel.options.map((item) => item.id === String(optionId) ? { ...item, text: value } : item) }); }
function removeOption(wheelId, optionId) { const wheel = getWheelById(wheelId); if (!wheel) return null; const target = wheel.options.find((item) => item.id === String(optionId)); if (target && target.enabled && wheel.options.filter((item) => item.enabled).length <= 2) throw new Error("至少保留两个启用选项"); return updateWheel(wheelId, { options: wheel.options.filter((item) => item.id !== String(optionId)) }); }
function toggleOption(wheelId, optionId) { const wheel = getWheelById(wheelId); if (!wheel) return null; const target = wheel.options.find((item) => item.id === String(optionId)); if (!target) return wheel; if (target.enabled && wheel.options.filter((item) => item.enabled).length <= 2) throw new Error("至少保留两个启用选项"); return updateWheel(wheelId, { options: wheel.options.map((item) => item.id === target.id ? { ...item, enabled: !item.enabled } : item) }); }
function moveOption(wheelId, optionId, direction) { const wheel = getWheelById(wheelId); if (!wheel) return null; const options = wheel.options.slice(); const index = options.findIndex((item) => item.id === String(optionId)); const next = direction === "up" ? index - 1 : index + 1; if (index < 0 || next < 0 || next >= options.length) return wheel; const swap = options[index]; options[index] = options[next]; options[next] = swap; return updateWheel(wheelId, { options }); }
function recordResult(wheelId, optionId) { const wheel = getWheelById(wheelId); if (!wheel) return null; const option = wheel.options.find((item) => item.id === String(optionId)); if (!option) return null; const entry = { id: createId("result"), optionId: option.id, optionText: option.text, spunAt: nowIso() }; updateWheel(wheelId, { history: [entry].concat(wheel.history).slice(0, MAX_HISTORY) }); return entry; }
function clearHistory(wheelId) { return updateWheel(wheelId, { history: [] }); }

module.exports = { MAX_HISTORY, MAX_OPTIONS, MAX_OPTION_LENGTH, STORAGE_KEY, addOptions, clearHistory, createWheel, deleteWheel, getWheelById, getWheels, moveOption, normalizeWheel, parseOptions, recordResult, removeOption, setWheels, toggleOption, updateOption, updateWheel };
