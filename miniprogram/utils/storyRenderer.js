const { fileExists } = require("./mediaStore");
const { getCategoryScores } = require("./hotelScore");
const { canvasToJpg, drawImageCover, drawWrappedText, loadImage, prepareCanvas, setText } = require("./reportCanvas");

const STORY_PREFS_KEY = "experience_story_drafts";
const LAYOUTS = [
  { key: "archive", label: "简洁档案" },
  { key: "photo", label: "照片叙事" },
  { key: "score", label: "评分报告" }
];

function loadStoryPreferences(recordId) {
  const raw = wx.getStorageSync(STORY_PREFS_KEY);
  return raw && typeof raw === "object" ? raw[String(recordId)] || null : null;
}

function saveStoryPreferences(recordId, preferences) {
  const raw = wx.getStorageSync(STORY_PREFS_KEY);
  const all = raw && typeof raw === "object" ? raw : {};
  all[String(recordId)] = JSON.parse(JSON.stringify(preferences));
  wx.setStorageSync(STORY_PREFS_KEY, all);
  return preferences;
}

function buildStoryModel(record, preferences = {}) {
  const selectedIds = Array.isArray(preferences.photoIds) ? preferences.photoIds : (record.photos || []).slice(0, 6).map((photo) => photo.id);
  const photoMap = (record.photos || []).reduce((map, photo) => { map[photo.id] = photo; return map; }, {});
  const photos = selectedIds.map((id) => photoMap[id]).filter((photo) => photo && fileExists(photo.filePath)).slice(0, 6);
  const options = { showCity: true, showMonth: true, showScore: true, showCategories: true, showTags: true, showSummary: true, ...(preferences.options || {}) };
  const tags = Object.keys(record.selectedTags || {}).reduce((items, key) => items.concat(record.selectedTags[key] || []), []).concat(record.customTags || []);
  return {
    recordId: record.id,
    title: String(preferences.title || record.displayName || record.placeName || "旅行体验").trim(),
    typeLabel: record.typeLabel,
    layout: LAYOUTS.some((item) => item.key === preferences.layout) ? preferences.layout : "archive",
    photos,
    options,
    city: options.showCity ? record.city : "",
    month: options.showMonth ? (record.visitMonth || String(record.stayDate || "").slice(0, 7)) : "",
    score: options.showScore && record.isRated ? record.overallScore : null,
    categoryScores: options.showCategories && record.isRated ? getCategoryScores(record.scores, record.recordType) : {},
    tags: options.showTags ? tags.slice(0, 10) : [],
    summary: options.showSummary ? (record.publicNote || record.verdict || "") : ""
  };
}

async function renderStory(page, model) {
  const photoHeight = model.layout === "photo" ? 220 : 170;
  const rows = Math.ceil(model.photos.length / 2);
  const height = Math.min(2600, 470 + rows * photoHeight + (model.summary ? 100 : 0));
  const { canvas, ctx } = await prepareCanvas(page, "#storyCanvas", 375, height, 2);
  ctx.fillStyle = "#f4f1eb"; ctx.fillRect(0, 0, 375, height);
  ctx.fillStyle = "#172033"; ctx.fillRect(0, 0, 375, 155);
  setText(ctx, 10, "rgba(255,255,255,.65)", "600"); ctx.fillText("TRAVEL EXPERIENCE", 24, 24);
  setText(ctx, 28, "#ffffff", "700"); let y = drawWrappedText(ctx, model.title, 24, 45, 280, 34, 2);
  setText(ctx, 11, "rgba(255,255,255,.75)"); ctx.fillText([model.typeLabel, model.city, model.month].filter(Boolean).join(" · "), 24, Math.max(118, y + 4));
  if (model.score != null) { setText(ctx, 34, "#ffffff", "700"); ctx.fillText(String(model.score), 315, 53); }
  y = 175;
  const gap = 8; const imageWidth = (327 - gap) / 2;
  for (let index = 0; index < model.photos.length; index += 1) {
    try {
      const image = await loadImage(canvas, model.photos[index].filePath);
      const x = 24 + (index % 2) * (imageWidth + gap);
      const imageY = y + Math.floor(index / 2) * photoHeight;
      drawImageCover(ctx, image, x, imageY, imageWidth, photoHeight - gap);
    } catch (error) { /* A missing image is omitted from the final story. */ }
  }
  y += rows * photoHeight + 18;
  if (Object.keys(model.categoryScores).length) {
    setText(ctx, 13, "#172033", "700"); ctx.fillText("分类评分", 24, y); y += 26;
    Object.keys(model.categoryScores).forEach((key) => { setText(ctx, 11, "#4d596c"); ctx.fillText(key, 24, y); ctx.fillStyle = "#d9dee8"; ctx.fillRect(88, y + 3, 210, 8); ctx.fillStyle = "#2864d9"; ctx.fillRect(88, y + 3, 21 * model.categoryScores[key], 8); setText(ctx, 11, "#172033", "700"); ctx.fillText(String(model.categoryScores[key]), 315, y - 2); y += 22; });
  }
  if (model.tags.length) { setText(ctx, 11, "#2864d9", "600"); y = drawWrappedText(ctx, model.tags.join(" · "), 24, y + 4, 327, 18, 3) + 10; }
  if (model.summary) { setText(ctx, 12, "#263248"); drawWrappedText(ctx, model.summary, 24, y, 327, 20, 5); }
  setText(ctx, 9, "#8a94a6"); ctx.fillText("由体验档案在本机生成", 24, height - 26);
  return canvasToJpg(page, canvas, 375, height, 2);
}

module.exports = { LAYOUTS, STORY_PREFS_KEY, buildStoryModel, loadStoryPreferences, renderStory, saveStoryPreferences };
