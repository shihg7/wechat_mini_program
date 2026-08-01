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

function edgeEnergy(image, left, top, width, height) {
  let energy = 0;
  let count = 0;
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width - 1; x += 1) {
      energy += Math.abs(pixel(image, x, y)[0] - pixel(image, x + 1, y)[0]);
      count += 1;
    }
  }
  return count ? energy / count : 0;
}

function distinctRgbCount(image, left, top, width, height) {
  const colors = new Set();
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      colors.add(pixel(image, x, y).slice(0, 3).join(","));
    }
  }
  return colors.size;
}

function testNormalizationAndMapping() {
  const region = redactor.normalizeMaskRegion({
    id: "pixel",
    rect: { x: 80, y: 40, width: -60, height: 120 },
    effect: { type: "solid", color: "#ffffff", strength: 1 }
  }, { width: 100, height: 100 });
  assert.deepStrictEqual(region.rect, { x: 0.2, y: 0.4, width: 0.6, height: 0.6 });
  assert.strictEqual(region.effect.strength, redactor.MIN_REDACTION_STRENGTH);

  const mapped = redactor.mapCanvasPointToImage(
    { x: 70, y: 55 },
    { scale: 0.5, offsetX: 20, offsetY: 5 },
    { width: 200, height: 200 }
  );
  assert.strictEqual(mapped.x, 100);
  assert.strictEqual(mapped.y, 100);
  assert.strictEqual(mapped.normalizedX, 0.5);
  assert.strictEqual(mapped.normalizedY, 0.5);

  const clamped = redactor.mapCanvasPointToImage(
    { x: -500, y: 900 },
    { scale: 2, offsetX: 10, offsetY: 10 },
    { width: 100, height: 100 }
  );
  assert.deepStrictEqual(clamped, { x: 0, y: 100, normalizedX: 0, normalizedY: 1 });

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

function testDetectionVariants() {
  const flatLight = makeImage(240, 720);
  const flatDark = makeImage(240, 720, [31, 38, 49, 255]);
  assert.deepStrictEqual(
    redactor.detectChatIdentityRegions(flatLight, { includeTitle: false }),
    [],
    "flat chat backgrounds should not create avatar false positives"
  );
  assert.strictEqual(redactor.detectChatIdentityRegions(flatDark).length, 1, "a dark empty chat should only suggest the title");

  paintNoisySquare(flatDark, 9, 110, 24, 13);
  paintNoisySquare(flatDark, 9, 380, 24, 17);
  const oneSided = redactor.detectChatIdentityRegions(flatDark, { avatarThreshold: 0.4 });
  const oneSidedAvatars = oneSided.filter((region) => region.targetType === "avatar");
  assert(oneSidedAvatars.length >= 2);
  assert(oneSidedAvatars.every((region) => region.rect.x < 0.2), "one-sided chats should not invent right-side avatars");

  const longChat = makeImage(180, 2400);
  [120, 540, 1010, 1810].forEach((y, index) => paintNoisySquare(longChat, index % 2 ? 155 : 7, y, 18, index + 23));
  const longRegions = redactor.detectChatIdentityRegions(longChat, { avatarThreshold: 0.4 });
  const longAvatars = longRegions.filter((region) => region.targetType === "avatar");
  assert(longAvatars.length >= 4, "long screenshots should retain candidates across the full image height");
  assert(longAvatars.some((region) => region.rect.y > 0.7), "bottom candidates in long screenshots must not be dropped");

  const capped = redactor.detectChatIdentityRegions(longChat, { avatarThreshold: 0.4, maxAvatars: 2 });
  assert(capped.filter((region) => region.targetType === "avatar").length <= 2, "avatar cap should be respected");
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

function testPrivacyStrengthAndDisabledMasks() {
  const image = makeImage(48, 24);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      const value = (x * 37 + y * 53) % 256;
      image.data[index] = value;
      image.data[index + 1] = 255 - value;
      image.data[index + 2] = x * 11 % 256;
    }
  }

  const disabled = redactor.applyMaskEffects(image, [{
    id: "disabled",
    enabled: false,
    rect: { x: 0, y: 0, width: 1, height: 1 },
    effect: { type: "solid", color: "#ffffff", strength: 30 }
  }]);
  assert.deepStrictEqual(Array.from(disabled.data), Array.from(image.data), "disabled regions must not alter pixels");

  const mosaic = redactor.applyMaskEffects(image, [{
    id: "mosaic",
    rect: { x: 0, y: 0, width: 0.5, height: 1 },
    effect: { type: "mosaic", strength: 1 }
  }]);
  const originalColors = distinctRgbCount(image, 0, 0, 24, 24);
  const mosaicColors = distinctRgbCount(mosaic, 0, 0, 24, 24);
  assert(mosaicColors < originalColors / 4, "minimum mosaic strength should substantially reduce local detail");

  const blur = redactor.applyMaskEffects(image, [{
    id: "blur",
    rect: { x: 0.5, y: 0, width: 0.5, height: 1 },
    effect: { type: "blur", strength: 1 }
  }]);
  assert(
    edgeEnergy(blur, 24, 0, 24, 24) < edgeEnergy(image, 24, 0, 24, 24) * 0.65,
    "minimum blur strength should materially lower edge detail"
  );

  const overlapping = redactor.applyMaskEffects(image, [
    {
      id: "solid-first",
      rect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      effect: { type: "solid", color: "#182230", strength: 12 }
    },
    {
      id: "mosaic-second",
      rect: { x: 0.5, y: 0.25, width: 0.4, height: 0.5 },
      effect: { type: "mosaic", strength: 8 }
    }
  ]);
  assert.deepStrictEqual(pixel(overlapping, 25, 10), [24, 34, 48, 255], "solid masks should win in overlapping areas");
}

function testInvalidInputs() {
  assert.throws(() => redactor.detectChatIdentityRegions({ width: 10, height: 10, data: [] }), /不完整/);
  assert.throws(() => redactor.applyMaskEffects(null, []), /有效/);
}

testNormalizationAndMapping();
testChatCandidateDetection();
testDetectionVariants();
testPixelEffects();
testPrivacyStrengthAndDisabledMasks();
testInvalidInputs();
console.log("screenshot redactor algorithm tests passed");
