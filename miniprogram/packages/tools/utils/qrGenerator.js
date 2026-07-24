const qrcode = require("../vendor/qrcode-generator");

const MAX_INPUT_BYTES = 1000;
const QUIET_ZONE_MODULES = 4;

qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];

function utf8ByteLength(value) {
  let length = 0;
  for (const character of String(value || "")) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x7f) length += 1;
    else if (codePoint <= 0x7ff) length += 2;
    else if (codePoint <= 0xffff) length += 3;
    else length += 4;
  }
  return length;
}

function validateContent(value) {
  const content = String(value || "");
  if (!content.trim()) throw new Error("请输入要生成二维码的内容");
  const byteLength = utf8ByteLength(content);
  if (byteLength > MAX_INPUT_BYTES) {
    throw new Error(`内容不能超过 ${MAX_INPUT_BYTES} 个 UTF-8 字节`);
  }
  return { byteLength, content };
}

function escapeWifiPart(value) {
  return String(value == null ? "" : value).replace(/([\\;,":])/g, "\\$1");
}

function buildWifiPayload(input = {}) {
  const ssid = String(input.ssid || "").trim();
  if (!ssid) throw new Error("请输入 Wi-Fi 名称");
  const security = ["WPA", "WEP", "nopass"].includes(input.security) ? input.security : "WPA";
  const password = String(input.password || "");
  if (security !== "nopass" && !password) throw new Error("请输入 Wi-Fi 密码");
  const fields = [
    `T:${security}`,
    `S:${escapeWifiPart(ssid)}`
  ];
  if (security !== "nopass") fields.push(`P:${escapeWifiPart(password)}`);
  fields.push(`H:${input.hidden ? "true" : "false"}`);
  return `WIFI:${fields.join(";")};;`;
}

function createMatrix(value) {
  const { content } = validateContent(value);
  try {
    const qr = qrcode(0, "M");
    qr.addData(content, "Byte");
    qr.make();
    const count = qr.getModuleCount();
    const modules = [];
    for (let row = 0; row < count; row += 1) {
      const line = [];
      for (let column = 0; column < count; column += 1) {
        line.push(qr.isDark(row, column));
      }
      modules.push(line);
    }
    return { count, modules };
  } catch (error) {
    throw new Error("内容过长，无法生成可扫描的二维码");
  }
}

function getQrGeometry(moduleCount, size) {
  const totalModules = moduleCount + QUIET_ZONE_MODULES * 2;
  const cellSize = size / totalModules;
  return {
    cellSize,
    moduleCount,
    offset: QUIET_ZONE_MODULES * cellSize,
    quietZone: QUIET_ZONE_MODULES,
    size,
    totalModules
  };
}

function drawMatrix(context, matrix, size) {
  const geometry = getQrGeometry(matrix.count, size);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#111111";
  matrix.modules.forEach((row, rowIndex) => {
    row.forEach((dark, columnIndex) => {
      if (!dark) return;
      const left = Math.floor(geometry.offset + columnIndex * geometry.cellSize);
      const top = Math.floor(geometry.offset + rowIndex * geometry.cellSize);
      const right = Math.ceil(geometry.offset + (columnIndex + 1) * geometry.cellSize);
      const bottom = Math.ceil(geometry.offset + (rowIndex + 1) * geometry.cellSize);
      context.fillRect(left, top, right - left, bottom - top);
    });
  });
  return geometry;
}

function matrixToImageData(matrix, moduleScale = 8) {
  const totalModules = matrix.count + QUIET_ZONE_MODULES * 2;
  const width = totalModules * moduleScale;
  const data = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const row = Math.floor(y / moduleScale) - QUIET_ZONE_MODULES;
      const column = Math.floor(x / moduleScale) - QUIET_ZONE_MODULES;
      const dark = row >= 0
        && row < matrix.count
        && column >= 0
        && column < matrix.count
        && matrix.modules[row][column];
      const color = dark ? 17 : 255;
      const index = (y * width + x) * 4;
      data[index] = color;
      data[index + 1] = color;
      data[index + 2] = color;
      data[index + 3] = 255;
    }
  }
  return { data, height: width, width };
}

module.exports = {
  MAX_INPUT_BYTES,
  QUIET_ZONE_MODULES,
  buildWifiPayload,
  createMatrix,
  drawMatrix,
  escapeWifiPart,
  getQrGeometry,
  matrixToImageData,
  utf8ByteLength,
  validateContent
};
