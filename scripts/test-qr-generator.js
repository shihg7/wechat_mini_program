const assert = require("assert");
const jsQR = require("./vendor/jsQR");
const generator = require("../miniprogram/packages/tools/utils/qrGenerator");

function decode(content) {
  const matrix = generator.createMatrix(content);
  const image = generator.matrixToImageData(matrix, 8);
  const result = jsQR(image.data, image.width, image.height, {
    inversionAttempts: "dontInvert"
  });
  assert(result, `QR should decode: ${content}`);
  return result.data;
}

[
  "https://example.com/path?q=toolbox",
  "离线工具箱：日期、换算、二维码",
  "line one\nline two"
].forEach((content) => {
  assert.strictEqual(decode(content), content);
});

const wifiPayload = generator.buildWifiPayload({
  hidden: true,
  password: 'p;a,s:s"\\word',
  security: "WPA",
  ssid: "Cafe;Guest"
});
assert.strictEqual(
  wifiPayload,
  'WIFI:T:WPA;S:Cafe\\;Guest;P:p\\;a\\,s\\:s\\"\\\\word;H:true;;'
);
assert.strictEqual(decode(wifiPayload), wifiPayload);
assert.strictEqual(
  generator.buildWifiPayload({ security: "nopass", ssid: "Open WiFi" }),
  "WIFI:T:nopass;S:Open WiFi;H:false;;"
);
assert.throws(() => generator.buildWifiPayload({ security: "WPA", ssid: "Private" }), /密码/);
assert.throws(() => generator.buildWifiPayload({ security: "WPA" }), /Wi-Fi 名称/);

assert.strictEqual(generator.utf8ByteLength("A中😀"), 8);
assert.doesNotThrow(() => generator.validateContent("a".repeat(generator.MAX_INPUT_BYTES)));
assert.throws(() => generator.validateContent("a".repeat(generator.MAX_INPUT_BYTES + 1)), /1000/);
assert.throws(() => generator.validateContent("   "), /请输入/);

const matrix = generator.createMatrix("finder pattern");
assert(matrix.count >= 21);
assert.strictEqual(matrix.modules[0][0], true);
const geometry = generator.getQrGeometry(matrix.count, 640);
assert.strictEqual(geometry.quietZone, 4);
assert.strictEqual(geometry.totalModules, matrix.count + 8);

console.log("QR generator tests passed (including independent decode verification)");
