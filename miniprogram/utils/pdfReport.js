const { getCategories, getRecordTitle } = require("./hotelScore");
const { calculateLedgerSummary, calculateSettlements } = require("./tripLedgerStore");
const { PRIVATE_MODE, createPrivacyCopy } = require("./privacyPolicy");

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const SCALE = 2;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCanvas(page) {
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery()
      .in(page)
      .select("#pdfCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res && res[0] && res[0].node;
        if (!canvas) {
          reject(new Error("PDF canvas not found"));
          return;
        }
        canvas.width = PAGE_WIDTH * SCALE;
        canvas.height = PAGE_HEIGHT * SCALE;
        const ctx = canvas.getContext("2d");
        ctx.scale(SCALE, SCALE);
        resolve({ canvas, ctx });
      });
  });
}

function canvasToJpg(page, canvas, index) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      fileType: "jpg",
      quality: 0.92,
      destWidth: PAGE_WIDTH * SCALE,
      destHeight: PAGE_HEIGHT * SCALE,
      success: (res) => resolve({ path: res.tempFilePath, index }),
      fail: reject
    }, page);
  });
}

function clearPage(ctx) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
}

function setText(ctx, size, color = "#172033", weight = "normal") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px sans-serif`;
  ctx.textBaseline = "top";
}

function wrapText(ctx, text, maxWidth) {
  const source = String(text || "未填写");
  const lines = [];
  let line = "";
  for (let i = 0; i < source.length; i += 1) {
    const next = line + source[i];
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = source[i];
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 20) {
  const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function drawRule(ctx, y) {
  ctx.strokeStyle = "#e4e8ef";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, y);
  ctx.lineTo(PAGE_WIDTH - MARGIN, y);
  ctx.stroke();
}

function drawPageFooter(ctx, pageNumber, privacyLabel) {
  setText(ctx, 10, "#8a94a6");
  ctx.fillText(`隐私版本：${privacyLabel}`, MARGIN, PAGE_HEIGHT - 28);
  ctx.fillText(`第 ${pageNumber} 页`, PAGE_WIDTH - MARGIN - 44, PAGE_HEIGHT - 28);
}

function drawHeader(ctx, title, pageNumber, privacyLabel) {
  setText(ctx, 11, "#667085", "600");
  ctx.fillText("EXPERIENCE REVIEW REPORT", MARGIN, 28);
  setText(ctx, 24, "#172033", "700");
  drawWrappedText(ctx, title, MARGIN, 48, CONTENT_WIDTH - 70, 30, 2);
  drawPageFooter(ctx, pageNumber, privacyLabel);
  drawRule(ctx, 92);
  return 112;
}

function drawSummaryPage(ctx, records, summary, pageNumber, privacyLabel) {
  clearPage(ctx);
  let y = drawHeader(ctx, "体验档案测评报告", pageNumber, privacyLabel);
  setText(ctx, 14, "#172033", "700");
  ctx.fillText("整体概览", MARGIN, y);
  y += 28;

  setText(ctx, 13, "#4d596c");
  ctx.fillText(`全部记录：${summary.total} 条`, MARGIN, y);
  ctx.fillText(`平均评分：${summary.averageScore}`, MARGIN + 180, y);
  y += 26;
  ctx.fillText(`酒店：${summary.hotelTotal || 0} 条`, MARGIN, y);
  ctx.fillText(`米其林餐厅：${summary.restaurantTotal || 0} 条`, MARGIN + 180, y);
  y += 26;
  ctx.fillText(`公开预备：${summary.publicTotal || 0} 条`, MARGIN, y);
  ctx.fillText(`草稿：${summary.draftTotal || 0} 条`, MARGIN + 180, y);
  y += 26;
  ctx.fillText(`最高评分：${summary.bestRecordName || summary.bestHotelName || "暂无"}`, MARGIN, y);
  y += 26;
  ctx.fillText(`最近记录：${summary.latestRecordName || summary.latestHotelName || "暂无"}`, MARGIN, y);
  y += 34;
  drawRule(ctx, y);
  y += 22;

  setText(ctx, 14, "#172033", "700");
  ctx.fillText("记录列表", MARGIN, y);
  y += 28;

  records.slice(0, 18).forEach((record, index) => {
    setText(ctx, 12, "#172033", "700");
    ctx.fillText(`${index + 1}. ${record.typeLabel || "酒店"} · ${getRecordTitle(record)}`, MARGIN, y);
    setText(ctx, 11, "#667085");
    ctx.fillText(`${record.city || "未填写城市"} · ${record.stayDate || "未填写日期"} · ${record.isRated ? `${record.overallScore}分` : "未评分"} · ${record.visibilityLabel || "私密"}`, MARGIN, y + 19);
    y += 46;
  });

  if (records.length > 18) {
    setText(ctx, 11, "#8a94a6");
    ctx.fillText(`另有 ${records.length - 18} 条记录见后续详情页`, MARGIN, y);
  }
}

function drawLedgerSummaryPage(ctx, ledgers, pageNumber, privacyLabel) {
  clearPage(ctx);
  let y = drawHeader(ctx, "旅行账本结算摘要", pageNumber, privacyLabel);
  const expenseCount = ledgers.reduce((sum, ledger) => sum + ledger.expenses.length, 0);
  setText(ctx, 13, "#4d596c");
  ctx.fillText(`账本：${ledgers.length} 本`, MARGIN, y);
  ctx.fillText(`支出：${expenseCount} 笔`, MARGIN + 180, y);
  y += 34;

  ledgers.slice(0, 8).forEach((ledger, index) => {
    const summary = calculateLedgerSummary(ledger);
    const settlements = calculateSettlements(ledger);
    setText(ctx, 13, "#172033", "700");
    ctx.fillText(`${index + 1}. ${ledger.title || "未命名账本"}`, MARGIN, y);
    setText(ctx, 11, "#667085");
    ctx.fillText(`${ledger.city || "未填写城市"} · ${ledger.members.length} 人 · ${summary.expenseCount} 笔 · ${summary.totalText}`, MARGIN, y + 20);
    y += 43;
    setText(ctx, 10.5, "#4d596c");
    const settlementText = settlements.length
      ? settlements.map((item) => item.text).join("；")
      : "当前无需转账";
    y = drawWrappedText(ctx, `结算：${settlementText}`, MARGIN + 12, y, CONTENT_WIDTH - 12, 16, 2) + 16;
    drawRule(ctx, y - 7);
  });
  if (ledgers.length > 8) {
    setText(ctx, 11, "#8a94a6");
    ctx.fillText(`另有 ${ledgers.length - 8} 本账本未在摘要页展开`, MARGIN, y);
  }
}

function drawMetricRows(ctx, record, y) {
  getCategories(record.recordType).forEach((category) => {
    const categoryScores = record.scores[category.key] || {};
    const tags = (record.selectedTags[category.key] || []).join("、") || "未选择标签";
    setText(ctx, 13, "#172033", "700");
    ctx.fillText(category.title, MARGIN, y);
    setText(ctx, 12, "#2864d9", "700");
    const values = category.metrics.map((metric) => Number(categoryScores[metric.key] || 0));
    const average = Math.round((values.reduce((sum, item) => sum + item, 0) / values.length) * 10) / 10;
    ctx.fillText(`${average}分`, PAGE_WIDTH - MARGIN - 42, y);
    y += 22;

    setText(ctx, 10.5, "#4d596c");
    category.metrics.forEach((metric, index) => {
      const x = MARGIN + (index % 2) * 250;
      const offsetY = Math.floor(index / 2) * 18;
      ctx.fillText(`${metric.label}: ${categoryScores[metric.key] || 0}`, x, y + offsetY);
    });
    y += 40;
    setText(ctx, 10.5, "#667085");
    y = drawWrappedText(ctx, `标签：${tags}`, MARGIN, y, CONTENT_WIDTH, 16, 2) + 10;
  });
  return y;
}

function drawRecordPage(ctx, record, pageNumber, privacyLabel) {
  clearPage(ctx);
  let y = drawHeader(ctx, `${record.typeLabel || "酒店"} · ${getRecordTitle(record)}`, pageNumber, privacyLabel);
  setText(ctx, 12, "#4d596c");
  ctx.fillText(`城市/地区：${record.city || "未填写"}`, MARGIN, y);
  ctx.fillText(`${record.recordType === "restaurant" ? "用餐日期" : "入住日期"}：${record.stayDate || "未填写"}`, MARGIN + 250, y);
  y += 24;
  ctx.fillText(`标准地点名：${record.placeName || getRecordTitle(record)}`, MARGIN, y);
  ctx.fillText(`公开状态：${record.visibilityLabel || "私密"}`, MARGIN + 250, y);
  y += 24;
  if (record.recordType === "restaurant") {
    ctx.fillText(`菜系：${record.cuisine || "未填写"}`, MARGIN, y);
    ctx.fillText(`米其林等级：${record.michelinLevel || "未填写"}`, MARGIN + 250, y);
    y += 24;
    ctx.fillText(`餐段：${record.mealPeriod || "未填写"}`, MARGIN, y);
    ctx.fillText(`人均/套餐：${record.priceRange || "未填写"}`, MARGIN + 250, y);
  } else {
    ctx.fillText(`房型：${record.roomType || "未填写"}`, MARGIN, y);
    ctx.fillText(`会员等级：${record.memberLevel || "未填写"}`, MARGIN + 250, y);
  }
  y += 30;

  setText(ctx, 22, "#172033", "700");
  ctx.fillText(record.isRated ? `${record.overallScore}分` : "未评分", MARGIN, y);
  setText(ctx, 12, "#667085");
  ctx.fillText(record.verdict, MARGIN + 82, y + 8);
  y += 40;
  drawRule(ctx, y);
  y += 22;

  if (record.isRated) {
    y = drawMetricRows(ctx, record, y);
  } else {
    setText(ctx, 12, "#667085");
    ctx.fillText("这条草稿尚未完成维度评分。", MARGIN, y);
    y += 34;
  }
  drawRule(ctx, y);
  y += 20;
  setText(ctx, 13, "#172033", "700");
  ctx.fillText("公开摘要", MARGIN, y);
  y += 24;
  setText(ctx, 11, "#4d596c");
  y = drawWrappedText(ctx, record.publicNote || "未填写", MARGIN, y, CONTENT_WIDTH, 17, 5) + 18;
  setText(ctx, 13, "#172033", "700");
  ctx.fillText("私密备注", MARGIN, y);
  y += 24;
  setText(ctx, 11, "#4d596c");
  drawWrappedText(ctx, record.privateNote || record.note || "未填写", MARGIN, y, CONTENT_WIDTH, 17, 8);
}

async function renderReportPages(page, canvas, ctx, records, summary, ledgers, privacyMode) {
  const jpgPages = [];
  const privacyLabel = privacyMode === "redacted" ? "脱敏版" : "私人版";

  drawSummaryPage(ctx, records, summary, 1, privacyLabel);
  await sleep(80);
  jpgPages.push(await canvasToJpg(page, canvas, 1));

  let pageOffset = 1;
  if (ledgers.length) {
    drawLedgerSummaryPage(ctx, ledgers, 2, privacyLabel);
    await sleep(60);
    jpgPages.push(await canvasToJpg(page, canvas, 2));
    pageOffset += 1;
  }

  for (let i = 0; i < records.length; i += 1) {
    drawRecordPage(ctx, records[i], i + 1 + pageOffset, privacyLabel);
    await sleep(50);
    jpgPages.push(await canvasToJpg(page, canvas, i + 1 + pageOffset));
  }

  return jpgPages;
}

function ascii(text) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = text.charCodeAt(i) & 255;
  }
  return bytes;
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function toUint8Array(buffer) {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

function buildPdf(imageBuffers) {
  const objects = [];
  const pageIds = [];
  const parts = [ascii("%PDF-1.4\n")];
  const offsets = [0];

  imageBuffers.forEach((imageBuffer, index) => {
    const imageId = 3 + index * 3;
    const contentId = imageId + 1;
    const pageId = imageId + 2;
    const imageBytes = toUint8Array(imageBuffer);
    const imageName = `Im${index + 1}`;
    const content = `q\n${PAGE_WIDTH} 0 0 ${PAGE_HEIGHT} 0 0 cm\n/${imageName} Do\nQ\n`;

    objects[imageId] = [
      ascii(`<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH * SCALE} /Height ${PAGE_HEIGHT * SCALE} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`),
      imageBytes,
      ascii("\nendstream")
    ];
    objects[contentId] = ascii(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    objects[pageId] = ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[1] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);

  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = parts.reduce((sum, part) => sum + part.length, 0);
    parts.push(ascii(`${id} 0 obj\n`));
    if (Array.isArray(objects[id])) {
      parts.push(...objects[id]);
    } else {
      parts.push(objects[id]);
    }
    parts.push(ascii("\nendobj\n"));
  }

  const xrefOffset = parts.reduce((sum, part) => sum + part.length, 0);
  const maxObjectId = objects.length - 1;
  let xref = `xref\n0 ${maxObjectId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxObjectId; id += 1) {
    xref += `${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(ascii(xref));
  return concatBytes(parts);
}

function readFileArrayBuffer(filePath) {
  return wx.getFileSystemManager().readFileSync(filePath);
}

async function exportHotelReport({ page, records, summary, ledgers = [], privacyMode = PRIVATE_MODE }) {
  const protectedData = createPrivacyCopy({ records, ledgers }, privacyMode);
  const { canvas, ctx } = await getCanvas(page);
  const jpgPages = await renderReportPages(page, canvas, ctx, protectedData.records, summary, protectedData.ledgers, privacyMode);
  const imageBuffers = jpgPages.map((item) => readFileArrayBuffer(item.path));
  const pdfBytes = buildPdf(imageBuffers);
  const filePath = `${wx.env.USER_DATA_PATH}/hotel-review-report.pdf`;

  wx.getFileSystemManager().writeFileSync(filePath, pdfBytes.buffer, "binary");
  await new Promise((resolve, reject) => {
    wx.openDocument({
      filePath,
      fileType: "pdf",
      showMenu: true,
      success: resolve,
      fail: reject
    });
  });
  return filePath;
}

module.exports = {
  PRIVATE_MODE,
  exportHotelReport
};
