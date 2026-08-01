const assert = require("assert");
const redactor = require("../miniprogram/packages/tools/utils/screenshotRedactor");

function makeImage(width, height, color = [242, 244, 247, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = color[0];
    data[index + 1] = color[1];
    data[index + 2] = color[2];
    data[index + 3] = color[3];
  }
  return { data, width, height };
}

function paintNoisySquare(image, left, top, size, seed) {
  let value = seed;
  for (let y = top; y < top + size; y += 1) {
    for (let x = left; x < left + size; x += 1) {
      value = (value * 1664525 + 1013904223) >>> 0;
      const index = (y * image.width + x) * 4;
      image.data[index] = value & 255;
      image.data[index + 1] = value >>> 8 & 255;
      image.data[index + 2] = value >>> 16 & 255;
      image.data[index + 3] = 255;
    }
  }
}

function pixel(image, x, y) {
  return Array.from(image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));
}

function testNormalizationAndMapping() {
  const region = redactor.normalizeMaskRegion({
    id: "pixel",
    rect: { x: 80, y: 40, width: -60, height: 120 },
    effect: { type: "solid", color: "#ffffff", strength: 1 }
  }, { width: 100, height: 100 });
  assert.deepStrictEqual(region.rect, { x: 0.2, y: 0.4, width: 0.6, height: 0.6 });
  assert.strictEqual(region.effect.strength, 2);

  const mapped = redactor.mapCanvasPointToImage(
    { x: 70, y: 55 },
    { scale: 0.5, offsetX: 20, offsetY: 5 },
    { width: 200, height: 200 }
  );
  assert.strictEqual(mapped.x, 100);
  assert.strictEqual(mapped.y, 100);
  assert.strictEqual(mapped.normalizedX, 0.5);
  assert.strictEqual(mapped.normalizedY, 0.5);

  const fit = redactor.fitImageToViewport({ width: 1000, height: 2000 }, { width: 300, height: 400 });
  assert.strictEqual(fit.scale, 0.2);
  assert.strictEqual(fit.offsetX, 50);
  assert.strictEqual(fit.offsetY, 0);
}

function testChatCandidateDetection() {
  const image = makeImage(240, 720);
  paintNoisySquare(image, 9, 90, 24, 3);
  paintNoisySquare(image, 9, 260, 24, 7);
  paintNoisySquare(image, 207, 170, 24, 11);
  paintNoisySquare(image, 207, 430, 24, 19);

  const regions = redactor.detectChatIdentityRegions(image, { avatarThreshold: 0.4 });
  const avatars = regions.filter((region) => region.targetType === "avatar");
  const names = regions.filter((region) => region.targetType === "name");
  assert(regions.some((region) => region.targetType === "title"), "top title candidate should be included");
  assert(avatars.some((region) => region.rect.x < 0.2), "left avatar should be detected");
  assert(avatars.some((region) => region.rect.x > 0.75), "right avatar should be detected");
  assert(avatars.length <= 8, "nearby scan windows should collapse into a small candidate set");
  assert(names.length >= 2, "avatar candidates should produce adjacent name candidates");
  assert(regions.every((region) => region.source === "auto" && region.enabled));
  assert(regions.every((region) => region.rect.x >= 0 && region.rect.y >= 0));
  assert(regions.every((region) => region.rect.x + region.rect.width <= 1.000001));
  assert(regions.every((region) => region.rect.y + region.rect.height <= 1.000001));

  const secondPass = redactor.detectChatIdentityRegions(image, { avatarThreshold: 0.4 });
  assert.deepStrictEqual(secondPass, regions, "same pixels should produce stable candidates");
}

function testPixelEffects() {
  const image = makeImage(12, 12, [10, 20, 30, 255]);
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 12; x += 1) {
      const index = (y * 12 + x) * 4;
      image.data[index] = x * 20;
      image.data[index + 1] = y * 20;
      image.data[index + 2] = (x + y) * 10;
    }
  }
  const originalOutside = pixel(image, 1, 1);
  const result = redactor.applyMaskEffects(image, [
    {
      id: "solid",
      enabled: true,
      rect: { x: 0.25, y: 0.25, width: 0.25, height: 0.25 },
      effect: { type: "solid", color: "#ffffff", strength: 8 }
    },
    {
      id: "mosaic",
      enabled: true,
      rect: { x: 0.5, y: 0.25, width: 0.25, height: 0.25 },
      effect: { type: "mosaic", strength: 3 }
    },
    {
      id: "blur",
      enabled: true,
      rect: { x: 0.25, y: 0.6, width: 0.5, height: 0.25 },
      effect: { type: "blur", strength: 6 }
    }
  ]);

  assert.notStrictEqual(result.data, image.data, "effects should return a copy");
  assert.deepStrictEqual(pixel(result, 1, 1), originalOutside, "pixels outside masks must remain unchanged");
  assert.deepStrictEqual(pixel(result, 3, 3), [255, 255, 255, 255]);
  assert.deepStrictEqual(pixel(result, 6, 3), pixel(result, 8, 5), "one mosaic block should use one averaged color");
  assert.notDeepStrictEqual(pixel(result, 5, 8), pixel(image, 5, 8), "blur should change pixels inside its region");
  assert.deepStrictEqual(pixel(image, 3, 3), [60, 60, 60, 255], "source pixels must remain intact");
}

function testInvalidInputs() {
  assert.throws(() => redactor.detectChatIdentityRegions({ width: 10, height: 10, data: [] }), /不完整/);
  assert.throws(() => redactor.applyMaskEffects(null, []), /有效/);
}

testNormalizationAndMapping();
testChatCandidateDetection();
testPixelEffects();
testInvalidInputs();
console.log("screenshot redactor algorithm tests passed");
