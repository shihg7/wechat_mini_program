const { buildPdf } = require("../../../utils/pdfReport");

function prepareCanvas(page, selector, width, height, scale = 2) {
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery().in(page).select(selector).fields({ node: true, size: true }).exec((result) => {
      const canvas = result && result[0] && result[0].node;
      if (!canvas) return reject(new Error("报告画布不可用"));
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      resolve({ canvas, ctx, width, height, scale });
    });
  });
}

function setText(ctx, size, color = "#172033", weight = "normal") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px sans-serif`;
  ctx.textBaseline = "top";
}

function wrapText(ctx, text, maxWidth) {
  const source = String(text || "");
  const lines = [];
  let line = "";
  for (const char of source) {
    const next = line + char;
    if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = char; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 8) {
  const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => ctx.fillText(index === maxLines - 1 && wrapText(ctx, text, maxWidth).length > maxLines ? `${line.slice(0, -1)}…` : line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function loadImage(canvas, path) {
  return new Promise((resolve, reject) => {
    const image = canvas.createImage();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = path;
  });
}

function drawImageCover(ctx, image, x, y, width, height) {
  const ratio = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / ratio;
  const sourceHeight = height / ratio;
  const sourceX = Math.max(0, (image.width - sourceWidth) / 2);
  const sourceY = Math.max(0, (image.height - sourceHeight) / 2);
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function canvasToJpg(page, canvas, width, height, scale = 2) {
  return new Promise((resolve, reject) => wx.canvasToTempFilePath({ canvas, fileType: "jpg", quality: 0.92, destWidth: width * scale, destHeight: height * scale, success: (result) => resolve(result.tempFilePath), fail: reject }, page));
}

function writePdfFromJpgs(paths, filePath) {
  const fs = wx.getFileSystemManager();
  const bytes = buildPdf(paths.map((path) => fs.readFileSync(path)));
  fs.writeFileSync(filePath, bytes.buffer, "binary");
  return filePath;
}

module.exports = { canvasToJpg, drawImageCover, drawWrappedText, loadImage, prepareCanvas, setText, wrapText, writePdfFromJpgs };
