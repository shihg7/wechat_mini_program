const { calculateLedgerSummary, calculateSettlements, formatCents, normalizeLedger } = require("./tripLedgerStore");
const { buildPdf } = require("./pdfBuilder");
const { createPrivacyCopy, PRIVATE_MODE, REDACTED_MODE } = require("./privacyPolicy");

const WIDTH = 595;
const HEIGHT = 842;
const SCALE = 2;
const MARGIN = 36;
const EXPORT_SCHEMA_VERSION = 2;
const SINGLE_CURRENCY_MODE = "single";

function currencyMetadata(ledger) {
  const baseCurrency = String(ledger.baseCurrency || "CNY").toUpperCase();
  return {
    mode: SINGLE_CURRENCY_MODE,
    baseCurrency,
    exchangeRateConversion: false,
    note: `本账本仅使用 ${baseCurrency}，金额按原值记录，未进行汇率换算`
  };
}

function canvasFor(page) {
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery().in(page).select("#ledgerExportCanvas").fields({ node: true, size: true }).exec((result) => {
      const canvas = result && result[0] && result[0].node;
      if (!canvas) return reject(new Error("导出画布不可用"));
      canvas.width = WIDTH * SCALE;
      canvas.height = HEIGHT * SCALE;
      const ctx = canvas.getContext("2d");
      ctx.scale(SCALE, SCALE);
      resolve({ canvas, ctx });
    });
  });
}

function setText(ctx, size, color = "#172033", weight = "normal") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px sans-serif`;
  ctx.textBaseline = "top";
}

function shorten(text, length = 32) {
  const value = String(text || "");
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function memberNameMap(ledger) {
  return (ledger.members || []).reduce((map, member) => { map[member.id] = member.name; return map; }, {});
}

function drawLedgerPage(ctx, ledger, expenses, pageNumber, totalPages, privacyMode, firstPage) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  setText(ctx, 10, "#667085", "600");
  ctx.fillText("AA LEDGER SETTLEMENT", MARGIN, 26);
  setText(ctx, 23, "#172033", "700");
  ctx.fillText(shorten(ledger.title || "未命名账本", 26), MARGIN, 46);
  setText(ctx, 10, "#8a94a6");
  ctx.fillText(`${privacyMode === REDACTED_MODE ? "分享版" : "私人版"} · 第 ${pageNumber}/${totalPages} 页`, WIDTH - 150, 30);
  ctx.strokeStyle = "#e4e8ef";
  ctx.beginPath(); ctx.moveTo(MARGIN, 84); ctx.lineTo(WIDTH - MARGIN, 84); ctx.stroke();
  let y = 104;
  const summary = calculateLedgerSummary(ledger);
  const names = memberNameMap(ledger);
  if (firstPage) {
    setText(ctx, 13, "#4d596c");
    ctx.fillText(`总支出 ${summary.totalText}`, MARGIN, y);
    ctx.fillText(`${summary.expenseCount} 笔 · ${(ledger.members || []).length} 位 · ${ledger.baseCurrency} 单币种`, MARGIN + 210, y);
    y += 30;
    setText(ctx, 14, "#172033", "700"); ctx.fillText("成员净额", MARGIN, y); y += 25;
    summary.members.slice(0, 8).forEach((member) => {
      setText(ctx, 11, "#4d596c");
      ctx.fillText(shorten(member.name, 12), MARGIN, y);
      ctx.fillText(`已付 ${member.paidText}  应摊 ${member.shareText}`, MARGIN + 110, y);
      setText(ctx, 11, member.balanceCents >= 0 ? "#1f7a55" : "#a34b32", "700");
      ctx.fillText(member.balanceText, WIDTH - MARGIN - 72, y);
      y += 20;
    });
    y += 8;
    setText(ctx, 14, "#172033", "700"); ctx.fillText("推荐转账", MARGIN, y); y += 25;
    const settlements = calculateSettlements(ledger);
    setText(ctx, 11, "#4d596c");
    if (!settlements.length) { ctx.fillText("当前已经结清", MARGIN, y); y += 24; }
    else settlements.slice(0, 8).forEach((item) => { ctx.fillText(shorten(item.text, 42), MARGIN, y); y += 19; });
    y += 10;
  }
  setText(ctx, 14, "#172033", "700"); ctx.fillText("支出明细", MARGIN, y); y += 25;
  expenses.forEach((expense) => {
    setText(ctx, 11.5, "#172033", "700");
    ctx.fillText(shorten(expense.title || "未命名支出", 22), MARGIN, y);
    ctx.fillText(formatCents(expense.amountCents, ledger.baseCurrency), WIDTH - MARGIN - 72, y);
    y += 18;
    setText(ctx, 10, "#667085");
    const payer = names[expense.payerId] || expense.payer || "未知";
    ctx.fillText(shorten(`${expense.category} · ${payer}付款 · ${expense.splitModeLabel || "人均"} · ${expense.paidAt || "日期未填"}`, 58), MARGIN, y);
    y += 23;
    ctx.strokeStyle = "#edf0f4"; ctx.beginPath(); ctx.moveTo(MARGIN, y); ctx.lineTo(WIDTH - MARGIN, y); ctx.stroke(); y += 10;
  });
  setText(ctx, 9.5, "#8a94a6");
  ctx.fillText(`单币种 ${ledger.baseCurrency} · 金额按原值导出 · 不含汇率换算`, MARGIN, HEIGHT - 26);
}

function toJpg(page, canvas) {
  return new Promise((resolve, reject) => wx.canvasToTempFilePath({ canvas, fileType: "jpg", quality: 0.92, destWidth: WIDTH * SCALE, destHeight: HEIGHT * SCALE, success: (result) => resolve(result.tempFilePath), fail: reject }, page));
}

function protectedLedger(ledger, mode) {
  return createPrivacyCopy({ ledgers: [normalizeLedger(ledger)] }, mode).ledgers[0];
}

async function renderLedgerPages(page, ledger, privacyMode) {
  const safeLedger = protectedLedger(ledger, privacyMode);
  const chunks = [];
  const source = safeLedger.expenses || [];
  if (!source.length) chunks.push([]);
  else for (let index = 0; index < source.length; index += 12) chunks.push(source.slice(index, index + 12));
  const { canvas, ctx } = await canvasFor(page);
  const paths = [];
  for (let index = 0; index < chunks.length; index += 1) {
    drawLedgerPage(ctx, safeLedger, chunks[index], index + 1, chunks.length, privacyMode, index === 0);
    paths.push(await toJpg(page, canvas));
  }
  return { ledger: safeLedger, paths };
}

async function exportLedgerImage(options) {
  const rendered = await renderLedgerPages(options.page, options.ledger, options.privacyMode || REDACTED_MODE);
  return rendered.paths[0];
}

async function exportLedgerPdf(options) {
  const rendered = await renderLedgerPages(options.page, options.ledger, options.privacyMode || PRIVATE_MODE);
  const buffers = rendered.paths.map((path) => wx.getFileSystemManager().readFileSync(path));
  const bytes = buildPdf(buffers);
  const filePath = `${wx.env.USER_DATA_PATH}/aa-ledger-${options.privacyMode === REDACTED_MODE ? "share" : "private"}.pdf`;
  wx.getFileSystemManager().writeFileSync(filePath, bytes.buffer, "binary");
  return filePath;
}

function exportLedgerJson(ledger, privacyMode = PRIVATE_MODE) {
  const safeLedger = protectedLedger(ledger, privacyMode);
  const payload = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    type: "aa-ledger-export",
    privacyMode,
    exportedAt: new Date().toISOString(),
    currency: currencyMetadata(safeLedger),
    ledger: safeLedger,
    summary: calculateLedgerSummary(safeLedger),
    settlements: calculateSettlements(safeLedger)
  };
  const filePath = `${wx.env.USER_DATA_PATH}/aa-ledger-${privacyMode === REDACTED_MODE ? "share" : "private"}.json`;
  wx.getFileSystemManager().writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}

module.exports = { EXPORT_SCHEMA_VERSION, PRIVATE_MODE, REDACTED_MODE, SINGLE_CURRENCY_MODE, exportLedgerImage, exportLedgerJson, exportLedgerPdf };
