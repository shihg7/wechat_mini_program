const { buildTravelInsights, getAvailableYears } = require("./travelInsights");
const { fileExists } = require("./mediaStore");
const { canvasToJpg, drawImageCover, drawWrappedText, loadImage, prepareCanvas, setText, writePdfFromJpgs } = require("./reportCanvas");
const { formatCents } = require("./tripLedgerStore");

const YEARBOOK_PREFS_KEY = "experience_yearbook_preferences";

function recordDate(record) { return String(record.stayDate || record.createdAt || ""); }

function loadYearbookPreferences(year) {
  const raw = wx.getStorageSync(YEARBOOK_PREFS_KEY);
  return raw && typeof raw === "object" ? raw[String(year)] || null : null;
}

function saveYearbookPreferences(year, preferences) {
  const raw = wx.getStorageSync(YEARBOOK_PREFS_KEY);
  const all = raw && typeof raw === "object" ? raw : {};
  all[String(year)] = JSON.parse(JSON.stringify(preferences));
  wx.setStorageSync(YEARBOOK_PREFS_KEY, all);
  return preferences;
}

function defaultPhotoIds(records) {
  const sorted = records.slice().sort((a, b) => Number(!!b.isRated) - Number(!!a.isRated) || Number(b.overallScore || 0) - Number(a.overallScore || 0));
  const byMonth = {};
  const ids = [];
  sorted.forEach((record) => {
    const month = recordDate(record).slice(0, 7);
    const photo = (record.photos || []).find((item) => fileExists(item.filePath));
    if (photo && !byMonth[month]) { byMonth[month] = true; ids.push(photo.id); }
  });
  sorted.forEach((record) => (record.photos || []).forEach((photo) => { if (ids.length < 24 && fileExists(photo.filePath) && ids.indexOf(photo.id) < 0) ids.push(photo.id); }));
  return ids.slice(0, 24);
}

function buildYearbook(records, ledgers, year, preferences = {}) {
  const completed = records.filter((record) => record.status !== "draft" && recordDate(record).slice(0, 4) === year);
  const photoMap = completed.reduce((map, record) => { (record.photos || []).forEach((photo) => { map[photo.id] = { ...photo, recordId: record.id, recordName: record.displayName, month: recordDate(record).slice(0, 7) }; }); return map; }, {});
  const photoIds = Array.isArray(preferences.photoIds) ? preferences.photoIds : defaultPhotoIds(completed);
  const photos = photoIds.map((id) => photoMap[id]).filter((photo) => photo && fileExists(photo.filePath)).slice(0, 24);
  const monthMap = {};
  completed.forEach((record) => { const month = recordDate(record).slice(0, 7) || `${year}-00`; if (!monthMap[month]) monthMap[month] = []; monthMap[month].push(record); });
  const months = Object.keys(monthMap).sort().map((month) => ({ month, label: month.endsWith("-00") ? "日期未填写" : `${Number(month.slice(5))} 月`, count: monthMap[month].length, records: monthMap[month].map((record) => ({ id: record.id, name: record.displayName, city: record.city, score: record.isRated ? record.overallScore : null })) }));
  const yearExpenses = (ledgers || []).reduce((items, ledger) => {
    const baseCurrency = String(ledger.baseCurrency || "CNY").toUpperCase();
    const expenses = (ledger.expenses || []).filter((expense) => String(expense.paidAt || "").slice(0, 4) === year).map((expense) => ({ ...expense, ledgerId: ledger.id, baseCurrency }));
    return items.concat(expenses);
  }, []);
  const totalsByCurrency = yearExpenses.reduce((totals, expense) => {
    totals[expense.baseCurrency] = Number(totals[expense.baseCurrency] || 0) + Number(expense.amountCents || 0);
    return totals;
  }, {});
  const currencyTotals = Object.keys(totalsByCurrency).sort().map((baseCurrency) => ({ baseCurrency, totalCents: totalsByCurrency[baseCurrency], totalText: formatCents(totalsByCurrency[baseCurrency], baseCurrency) }));
  const totalText = currencyTotals.length ? currencyTotals.map((item) => item.totalText).join(" + ") : formatCents(0, "CNY");
  return { year, title: preferences.title || `${year} 旅行回忆册`, insights: buildTravelInsights(records, year), months, photos, photoIds, includeAa: !!preferences.includeAa, aaSummary: { expenseCount: yearExpenses.length, currencyTotals, hasMixedCurrencies: currencyTotals.length > 1, totalCents: currencyTotals.length === 1 ? currencyTotals[0].totalCents : null, totalText } };
}

async function drawYearbookLong(page, model) {
  const shownPhotos = model.photos.slice(0, 12);
  const rows = Math.ceil(shownPhotos.length / 3);
  const height = Math.min(2600, 520 + rows * 120 + model.months.length * 48);
  const { canvas, ctx } = await prepareCanvas(page, "#yearbookCanvas", 375, height, 2);
  ctx.fillStyle = "#f4f1eb"; ctx.fillRect(0, 0, 375, height);
  ctx.fillStyle = "#172033"; ctx.fillRect(0, 0, 375, 210);
  setText(ctx, 11, "rgba(255,255,255,.65)", "600"); ctx.fillText("YEAR IN TRAVEL", 24, 28);
  setText(ctx, 31, "#ffffff", "700"); drawWrappedText(ctx, model.title, 24, 54, 300, 38, 2);
  setText(ctx, 12, "rgba(255,255,255,.75)"); ctx.fillText(`${model.insights.total} 次体验 · ${model.insights.cityTotal} 个城市 · 平均 ${model.insights.ratedTotal ? model.insights.averageScore : "--"}`, 24, 145);
  let y = 234;
  const bestItems = [model.insights.best.hotel && `酒店 ${model.insights.best.hotel.name}`, model.insights.best.restaurant && `餐厅 ${model.insights.best.restaurant.name}`, model.insights.best.breakfast && `早餐 ${model.insights.best.breakfast.name}`].filter(Boolean);
  setText(ctx, 14, "#172033", "700"); ctx.fillText("年度最佳", 24, y); y += 26;
  setText(ctx, 11, "#4d596c"); bestItems.forEach((item) => { y = drawWrappedText(ctx, item, 24, y, 327, 19, 2) + 4; });
  if (shownPhotos.length) { y += 10; setText(ctx, 14, "#172033", "700"); ctx.fillText("照片回顾", 24, y); y += 26; const width = 104; for (let index = 0; index < shownPhotos.length; index += 1) { try { const image = await loadImage(canvas, shownPhotos[index].filePath); drawImageCover(ctx, image, 24 + (index % 3) * 112, y + Math.floor(index / 3) * 120, width, 112); } catch (error) {} } y += rows * 120 + 10; }
  setText(ctx, 14, "#172033", "700"); ctx.fillText("年度时间线", 24, y); y += 27;
  model.months.forEach((month) => { setText(ctx, 11, "#2864d9", "700"); ctx.fillText(month.label, 24, y); setText(ctx, 11, "#263248"); ctx.fillText(`${month.count} 次 · ${month.records.slice(0, 2).map((record) => record.name).join("、")}`, 78, y); y += 23; });
  if (model.includeAa) { y += 8; setText(ctx, 11, "#667085"); ctx.fillText(`年度 AA 摘要：${model.aaSummary.expenseCount} 笔 · ${model.aaSummary.totalText}`, 24, y); }
  setText(ctx, 9, "#8a94a6"); ctx.fillText("分享版仅包含月份与聚合信息 · 本机生成", 24, height - 26);
  return canvasToJpg(page, canvas, 375, height, 2);
}

async function drawPdfPage(page, model, pageIndex, totalPages, content) {
  const { canvas, ctx } = await prepareCanvas(page, "#yearbookCanvas", 595, 842, 2);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 595, 842);
  setText(ctx, 10, "#667085", "600"); ctx.fillText(`${model.year} TRAVEL YEARBOOK`, 36, 28);
  setText(ctx, 23, "#172033", "700"); ctx.fillText(model.title, 36, 50);
  setText(ctx, 9, "#8a94a6"); ctx.fillText(`第 ${pageIndex}/${totalPages} 页`, 520, 30);
  let y = 100;
  if (content.type === "overview") {
    setText(ctx, 14, "#172033", "700"); ctx.fillText("年度概览", 36, y); y += 30;
    setText(ctx, 12, "#4d596c"); ctx.fillText(`${model.insights.total} 次体验 · ${model.insights.cityTotal} 个城市 · ${model.insights.revisitPlaceTotal} 个复访地点 · 平均 ${model.insights.ratedTotal ? model.insights.averageScore : "--"}`, 36, y); y += 35;
    [model.insights.best.hotel && `最佳酒店：${model.insights.best.hotel.name} ${model.insights.best.hotel.score}`, model.insights.best.restaurant && `最佳餐厅：${model.insights.best.restaurant.name} ${model.insights.best.restaurant.score}`, model.insights.best.breakfast && `最佳早餐：${model.insights.best.breakfast.name} ${model.insights.best.breakfast.score}`].filter(Boolean).forEach((line) => { ctx.fillText(line, 36, y); y += 24; });
    if (model.includeAa) { y += 10; ctx.fillText(`年度 AA：${model.aaSummary.expenseCount} 笔 · ${model.aaSummary.totalText}`, 36, y); }
  } else if (content.type === "timeline") {
    setText(ctx, 14, "#172033", "700"); ctx.fillText("月度时间线", 36, y); y += 30;
    content.months.forEach((month) => { setText(ctx, 12, "#2864d9", "700"); ctx.fillText(month.label, 36, y); setText(ctx, 11, "#4d596c"); y += 22; month.records.forEach((record) => { ctx.fillText(`${record.name} · ${record.city || "城市未填"}${record.score != null ? ` · ${record.score}` : ""}`, 60, y); y += 20; }); y += 10; });
  } else {
    setText(ctx, 14, "#172033", "700"); ctx.fillText("照片回顾", 36, y); y += 30;
    for (let index = 0; index < content.photos.length; index += 1) { try { const image = await loadImage(canvas, content.photos[index].filePath); const x = 36 + (index % 2) * 264; const py = y + Math.floor(index / 2) * 220; drawImageCover(ctx, image, x, py, 246, 190); setText(ctx, 10, "#667085"); ctx.fillText(content.photos[index].recordName, x, py + 194); } catch (error) {} }
  }
  setText(ctx, 9, "#8a94a6"); ctx.fillText("体验档案年度回忆册 · 本机生成", 36, 812);
  return canvasToJpg(page, canvas, 595, 842, 2);
}

async function renderYearbookPdf(page, model) {
  const contents = [{ type: "overview" }];
  for (let index = 0; index < model.months.length; index += 6) contents.push({ type: "timeline", months: model.months.slice(index, index + 6) });
  for (let index = 0; index < model.photos.length; index += 6) contents.push({ type: "photos", photos: model.photos.slice(index, index + 6) });
  const paths = [];
  for (let index = 0; index < contents.length; index += 1) paths.push(await drawPdfPage(page, model, index + 1, contents.length, contents[index]));
  return writePdfFromJpgs(paths, `${wx.env.USER_DATA_PATH}/travel-yearbook-${model.year}.pdf`);
}

module.exports = { YEARBOOK_PREFS_KEY, buildYearbook, defaultPhotoIds, drawYearbookLong, getAvailableYears, loadYearbookPreferences, renderYearbookPdf, saveYearbookPreferences };
