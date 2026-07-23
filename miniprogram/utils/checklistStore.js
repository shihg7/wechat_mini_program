const { createId } = require("./id");

const STORAGE_KEY = "toolbox_checklists";
const DEFAULT_TEMPLATE_KEY = "blank";
const MAX_TITLE_LENGTH = 40;
const MAX_ITEM_LENGTH = 100;

const TEMPLATES = {
  blank: {
    key: "blank",
    label: "空白清单",
    defaultTitle: "新清单",
    items: []
  },
  travel: {
    key: "travel",
    label: "旅行打包",
    defaultTitle: "旅行打包清单",
    items: [
      "证件与签证",
      "机票或车票",
      "住宿预订信息",
      "钱包与银行卡",
      "手机与充电器",
      "换洗衣物",
      "洗漱用品",
      "常用药品",
      "雨具",
      "行李锁"
    ]
  }
};

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value, maxLength) {
  return String(value == null ? "" : value).trim().slice(0, maxLength);
}

function normalizeTemplateKey(value) {
  const key = String(value || DEFAULT_TEMPLATE_KEY).toLowerCase();
  if (key === "travel-packing" || key === "packing") return "travel";
  return TEMPLATES[key] ? key : DEFAULT_TEMPLATE_KEY;
}

function getTemplate(templateKey) {
  const key = normalizeTemplateKey(templateKey);
  const template = TEMPLATES[key];
  return {
    key: template.key,
    label: template.label,
    defaultTitle: template.defaultTitle,
    items: template.items.slice()
  };
}

function getTemplates() {
  return Object.keys(TEMPLATES).map(getTemplate);
}

function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const source = item && typeof item === "object" ? item : { text: item };
      const numericOrder = Number(source.order);
      return {
        item: {
          id: String(source.id || createId("checkitem")),
          text: cleanText(source.text, MAX_ITEM_LENGTH),
          done: source.done === true,
          order: Number.isFinite(numericOrder) ? numericOrder : index
        },
        sourceIndex: index
      };
    })
    .filter((entry) => entry.item.text)
    .sort((left, right) => left.item.order - right.item.order || left.sourceIndex - right.sourceIndex)
    .map((entry, order) => ({ ...entry.item, order }));
}

function normalizeChecklist(input = {}) {
  const templateKey = normalizeTemplateKey(input.templateKey);
  const createdAt = String(input.createdAt || input.updatedAt || nowIso());
  const title = cleanText(input.title, MAX_TITLE_LENGTH) || TEMPLATES[templateKey].defaultTitle;
  return {
    id: String(input.id || createId("checklist")),
    title,
    templateKey,
    items: normalizeItems(input.items),
    createdAt,
    updatedAt: String(input.updatedAt || createdAt)
  };
}

function getChecklists() {
  const raw = wx.getStorageSync(STORAGE_KEY);
  return (Array.isArray(raw) ? raw : [])
    .map(normalizeChecklist)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

function setChecklists(checklists) {
  const normalized = (Array.isArray(checklists) ? checklists : []).map(normalizeChecklist);
  wx.setStorageSync(STORAGE_KEY, normalized);
  return normalized;
}

function getChecklistById(checklistId) {
  const id = String(checklistId || "");
  return getChecklists().find((checklist) => checklist.id === id) || null;
}

function buildTemplateItems(template) {
  return template.items.map((text, order) => ({
    id: createId("checkitem"),
    text,
    done: false,
    order
  }));
}

function createChecklist(input = {}, templateKeyArgument) {
  const source = typeof input === "string"
    ? { title: input, templateKey: templateKeyArgument }
    : (input || {});
  const template = getTemplate(source.templateKey || templateKeyArgument);
  const timestamp = nowIso();
  const checklist = normalizeChecklist({
    id: createId("checklist"),
    title: source.title || template.defaultTitle,
    templateKey: template.key,
    items: Array.isArray(source.items) ? source.items : buildTemplateItems(template),
    createdAt: timestamp,
    updatedAt: timestamp
  });
  setChecklists([checklist].concat(getChecklists()));
  return checklist;
}

function mutateChecklist(checklistId, mutator) {
  const id = String(checklistId || "");
  const checklists = getChecklists();
  const index = checklists.findIndex((checklist) => checklist.id === id);
  if (index < 0) return null;

  const current = checklists[index];
  const patch = mutator(current);
  if (!patch) return current;

  const updated = normalizeChecklist({
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: nowIso()
  });
  checklists[index] = updated;
  setChecklists(checklists);
  return updated;
}

function updateChecklist(checklistId, patch = {}) {
  return mutateChecklist(checklistId, () => patch);
}

function renameChecklist(checklistId, title) {
  const cleanTitle = cleanText(title, MAX_TITLE_LENGTH);
  if (!cleanTitle) throw new Error("清单名称不能为空");
  return mutateChecklist(checklistId, (checklist) => (
    checklist.title === cleanTitle ? null : { title: cleanTitle }
  ));
}

function deleteChecklist(checklistId) {
  const id = String(checklistId || "");
  const checklists = getChecklists();
  const next = checklists.filter((checklist) => checklist.id !== id);
  if (next.length !== checklists.length) setChecklists(next);
  return next;
}

function applyTemplate(checklistId, templateKey) {
  const template = getTemplate(templateKey);
  return mutateChecklist(checklistId, (checklist) => {
    const existingText = new Set(checklist.items.map((item) => item.text.toLowerCase()));
    const additions = template.items
      .filter((text) => !existingText.has(text.toLowerCase()))
      .map((text, index) => ({
        id: createId("checkitem"),
        text,
        done: false,
        order: checklist.items.length + index
      }));
    if (!additions.length && checklist.templateKey === template.key) return null;
    return {
      templateKey: template.key,
      items: checklist.items.concat(additions)
    };
  });
}

function addItem(checklistId, text) {
  const cleanItemText = cleanText(text, MAX_ITEM_LENGTH);
  if (!cleanItemText) throw new Error("清单项不能为空");
  return mutateChecklist(checklistId, (checklist) => ({
    items: checklist.items.concat({
      id: createId("checkitem"),
      text: cleanItemText,
      done: false,
      order: checklist.items.length
    })
  }));
}

function updateItem(checklistId, itemId, patch = {}) {
  const id = String(itemId || "");
  return mutateChecklist(checklistId, (checklist) => {
    const target = checklist.items.find((item) => item.id === id);
    if (!target) return null;

    const nextItem = { ...target };
    if (Object.prototype.hasOwnProperty.call(patch, "text")) {
      const text = cleanText(patch.text, MAX_ITEM_LENGTH);
      if (!text) throw new Error("清单项不能为空");
      nextItem.text = text;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "done")) nextItem.done = patch.done === true;

    if (nextItem.text === target.text && nextItem.done === target.done) return null;
    return {
      items: checklist.items.map((item) => item.id === id ? nextItem : item)
    };
  });
}

function editItem(checklistId, itemId, text) {
  return updateItem(checklistId, itemId, { text });
}

function toggleItem(checklistId, itemId) {
  const checklist = getChecklistById(checklistId);
  const item = checklist && checklist.items.find((entry) => entry.id === String(itemId || ""));
  if (!item) return checklist;
  return updateItem(checklistId, item.id, { done: !item.done });
}

function deleteItem(checklistId, itemId) {
  const id = String(itemId || "");
  return mutateChecklist(checklistId, (checklist) => {
    if (!checklist.items.some((item) => item.id === id)) return null;
    return { items: checklist.items.filter((item) => item.id !== id) };
  });
}

function reorderItems(checklistId, orderedItemIds) {
  if (!Array.isArray(orderedItemIds)) throw new Error("项目顺序必须是 ID 数组");
  return mutateChecklist(checklistId, (checklist) => {
    const byId = new Map(checklist.items.map((item) => [item.id, item]));
    const seen = new Set();
    const reordered = [];
    orderedItemIds.forEach((itemId) => {
      const id = String(itemId);
      if (byId.has(id) && !seen.has(id)) {
        seen.add(id);
        reordered.push(byId.get(id));
      }
    });
    checklist.items.forEach((item) => {
      if (!seen.has(item.id)) reordered.push(item);
    });
    if (reordered.every((item, index) => item.id === checklist.items[index].id)) return null;
    return {
      items: reordered.map((item, order) => ({ ...item, order }))
    };
  });
}

function moveItem(checklistId, itemId, directionOrIndex) {
  const checklist = getChecklistById(checklistId);
  if (!checklist) return null;
  const currentIndex = checklist.items.findIndex((item) => item.id === String(itemId || ""));
  if (currentIndex < 0) return checklist;

  let targetIndex;
  if (directionOrIndex === "up") targetIndex = currentIndex - 1;
  else if (directionOrIndex === "down") targetIndex = currentIndex + 1;
  else targetIndex = Number(directionOrIndex);

  if (!Number.isInteger(targetIndex)) return checklist;
  targetIndex = Math.max(0, Math.min(checklist.items.length - 1, targetIndex));
  if (targetIndex === currentIndex) return checklist;

  const reordered = checklist.items.slice();
  const moved = reordered.splice(currentIndex, 1)[0];
  reordered.splice(targetIndex, 0, moved);
  return reorderItems(checklistId, reordered.map((item) => item.id));
}

function clearCompleted(checklistId) {
  return mutateChecklist(checklistId, (checklist) => {
    if (!checklist.items.some((item) => item.done)) return null;
    return { items: checklist.items.filter((item) => !item.done) };
  });
}

function getProgress(checklistOrId) {
  const checklist = typeof checklistOrId === "string"
    ? getChecklistById(checklistOrId)
    : checklistOrId;
  const items = checklist && Array.isArray(checklist.items) ? checklist.items : [];
  const total = items.length;
  const completed = items.filter((item) => item.done === true).length;
  return {
    total,
    completed,
    remaining: total - completed,
    percent: total ? Math.round(completed * 100 / total) : 0
  };
}

module.exports = {
  DEFAULT_TEMPLATE_KEY,
  MAX_ITEM_LENGTH,
  MAX_TITLE_LENGTH,
  STORAGE_KEY,
  TEMPLATES,
  addItem,
  applyTemplate,
  clearCompleted,
  createChecklist,
  createList: createChecklist,
  deleteChecklist,
  deleteItem,
  deleteList: deleteChecklist,
  editItem,
  getChecklistById,
  getChecklists,
  getListById: getChecklistById,
  getLists: getChecklists,
  getProgress,
  getTemplate,
  getTemplates,
  moveItem,
  normalizeChecklist,
  renameChecklist,
  renameList: renameChecklist,
  reorderItems,
  removeItem: deleteItem,
  setChecklists,
  toggleItem,
  updateChecklist,
  updateItem
};
