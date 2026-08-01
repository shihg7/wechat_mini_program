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

function fillRect(image, left, top, width, height, color) {
  for (let y = Math.max(0, top); y < Math.min(image.height, top + height); y += 1) {
    for (let x = Math.max(0, left); x < Math.min(image.width, left + width); x += 1) {
      const index = (y * image.width + x) * 4;
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = 255;
    }
  }
}

function paintTextBars(image, left, top, widths, color) {
  widths.forEach((width, index) => {
    fillRect(image, left, top + index * 3, width, 1, color);
  });
}

function paintChatMessage(image, options) {
  const size = options.avatarSize || Math.round(image.width * 0.1);
  const margin = options.avatarMargin || Math.round(image.width * 0.035);
  const gap = Math.round(image.width * 0.025);
  const leftSide = options.side !== "right";
  const avatarLeft = leftSide ? margin : image.width - margin - size;
  if (options.avatarColor) {
    fillRect(image, avatarLeft, options.y, size, size, options.avatarColor);
  } else {
    paintNoisySquare(image, avatarLeft, options.y, size, options.seed || options.y + 7);
  }

  const bubbleWidth = options.bubbleWidth || Math.round(image.width * 0.3);
  const bubbleTop = options.y + (options.name ? Math.round(image.width * 0.055) : 0);
  const bubbleHeight = Math.round(image.width * 0.12);
  const bubbleLeft = leftSide
    ? avatarLeft + size + gap
    : avatarLeft - gap - bubbleWidth;
  fillRect(image, bubbleLeft, bubbleTop, bubbleWidth, bubbleHeight, options.bubbleColor || [255, 255, 255]);
  paintTextBars(image, bubbleLeft + 5, bubbleTop + 6, [bubbleWidth - 12, Math.max(8, bubbleWidth - 28)], [75, 79, 86]);

  if (options.name) {
    const nameWidth = Math.round(image.width * 0.12);
    const nameLeft = leftSide ? avatarLeft + size + gap : avatarLeft - gap - nameWidth;
    paintTextBars(image, nameLeft, options.y + 1, [nameWidth, Math.round(nameWidth * 0.62)], [102, 109, 119]);
  }
  return {
    avatar: { x: avatarLeft / image.width, y: options.y / image.height, width: size / image.width, height: size / image.height },
    hasName: Boolean(options.name),
    side: options.side || "left"
  };
}

function paintWallpaperNoise(image, amplitude, seed = 31) {
  let value = seed;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      value = (value * 1664525 + 1013904223) >>> 0;
      const delta = (value & 255) / 255 * amplitude - amplitude / 2;
      const index = (y * image.width + x) * 4;
      image.data[index] = Math.round(225 + delta);
      image.data[index + 1] = Math.round(229 + delta);
      image.data[index + 2] = Math.round(233 + delta);
    }
  }
}

function paintHeaderTitle(image, dark = false) {
  const color = dark ? [232, 235, 239] : [35, 39, 45];
  const top = Math.round(image.width * 0.145);
  const left = Math.round(image.width * 0.43);
  paintTextBars(image, left, top, [Math.round(image.width * 0.14), Math.round(image.width * 0.1)], color);
}

function paintInputToolbar(image, top, dark = false) {
  const background = dark ? [38, 43, 50] : [248, 249, 250];
  const field = dark ? [25, 30, 36] : [255, 255, 255];
  const divider = dark ? [72, 78, 86] : [210, 214, 219];
  const icon = dark ? [225, 229, 234] : [45, 50, 57];
  const iconSize = Math.round(image.width * 0.1);
  const margin = Math.round(image.width * 0.03);
  fillRect(image, 0, top, image.width, image.height - top, background);
  fillRect(image, 0, top, image.width, 2, divider);
  fillRect(image, Math.round(image.width * 0.18), top + 8, Math.round(image.width * 0.58), iconSize, field);
  fillRect(image, margin, top + 10, iconSize, iconSize, background);
  fillRect(image, margin + 5, top + 15, iconSize - 10, iconSize - 10, icon);
  fillRect(image, image.width - margin - iconSize, top + 10, iconSize, iconSize, background);
  paintNoisySquare(image, image.width - margin - iconSize + 5, top + 15, iconSize - 10, 901);
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
  paintHeaderTitle(image);
  const expected = [
    paintChatMessage(image, { side: "left", y: 90, name: true, seed: 3 }),
    paintChatMessage(image, { side: "right", y: 170, seed: 11, bubbleColor: [149, 236, 105] }),
    paintChatMessage(image, { side: "left", y: 260, name: true, seed: 7 }),
    paintChatMessage(image, { side: "right", y: 430, seed: 19, bubbleColor: [149, 236, 105] })
  ];

  const regions = redactor.detectChatIdentityRegions(image);
  const avatars = regions.filter((region) => region.targetType === "avatar");
  const names = regions.filter((region) => region.targetType === "name");
  assert(regions.some((region) => region.targetType === "title"), "top title candidate should be included");
  assert(avatars.some((region) => region.rect.x < 0.2), "left avatar should be detected");
  assert(avatars.some((region) => region.rect.x > 0.75), "right avatar should be detected");
  assert.strictEqual(avatars.length, 4, "one structured chat row should produce one avatar candidate");
  expected.forEach((message) => {
    assert(
      avatars.some((avatar) => redactor.rectIoU(avatar.rect, message.avatar) >= 0.58),
      `avatar at ${message.avatar.y} should be localized instead of broadly guessed`
    );
  });
  assert.strictEqual(names.length, 2, "only rows with text-like group names should produce name candidates");
  assert(names.every((region) => region.rect.x < 0.5), "private right-side bubbles must not become name candidates");
  assert(names.every((region) => region.rect.width < 0.24), "name masks should fit detected text instead of covering a fixed wide strip");
  assert(regions.every((region) => region.source === "auto" && region.enabled));
  assert(regions.every((region) => region.rect.x >= 0 && region.rect.y >= 0));
  assert(regions.every((region) => region.rect.x + region.rect.width <= 1.000001));
  assert(regions.every((region) => region.rect.y + region.rect.height <= 1.000001));

  const secondPass = redactor.detectChatIdentityRegions(image);
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

  paintHeaderTitle(flatDark, true);
  paintChatMessage(flatDark, { side: "left", y: 110, name: true, seed: 13, bubbleColor: [48, 56, 68] });
  paintChatMessage(flatDark, { side: "left", y: 380, seed: 17, bubbleColor: [48, 56, 68] });
  const oneSided = redactor.detectChatIdentityRegions(flatDark);
  const oneSidedAvatars = oneSided.filter((region) => region.targetType === "avatar");
  assert(oneSidedAvatars.length >= 2);
  assert(oneSidedAvatars.every((region) => region.rect.x < 0.2), "one-sided chats should not invent right-side avatars");

  const longChat = makeImage(180, 2400);
  paintHeaderTitle(longChat);
  [120, 540, 1010, 1810].forEach((y, index) => paintChatMessage(longChat, {
    side: index % 2 ? "right" : "left",
    y,
    name: index % 2 === 0,
    seed: index + 23,
    bubbleColor: index % 2 ? [149, 236, 105] : [255, 255, 255]
  }));
  const longRegions = redactor.detectChatIdentityRegions(longChat);
  const longAvatars = longRegions.filter((region) => region.targetType === "avatar");
  assert(longAvatars.length >= 4, "long screenshots should retain candidates across the full image height");
  assert(longAvatars.some((region) => region.rect.y > 0.7), "bottom candidates in long screenshots must not be dropped");

  const capped = redactor.detectChatIdentityRegions(longChat, { maxAvatars: 2 });
  assert(capped.filter((region) => region.targetType === "avatar").length <= 2, "avatar cap should be respected");

  const distractors = makeImage(240, 720);
  paintHeaderTitle(distractors);
  fillRect(distractors, 42, 100, 160, 120, [255, 255, 255]);
  paintNoisySquare(distractors, 46, 105, 90, 91);
  fillRect(distractors, 35, 300, 170, 80, [149, 236, 105]);
  paintTextBars(distractors, 44, 320, [120, 90, 135], [57, 63, 70]);
  const distractorRegions = redactor.detectChatIdentityRegions(distractors);
  assert.strictEqual(
    distractorRegions.filter((region) => region.targetType === "avatar").length,
    0,
    "message images and bubbles outside avatar lanes must not be mistaken for avatars"
  );

  const privateChat = makeImage(240, 720);
  paintHeaderTitle(privateChat);
  paintChatMessage(privateChat, { side: "left", y: 120, seed: 71 });
  paintChatMessage(privateChat, { side: "right", y: 260, seed: 73, bubbleColor: [149, 236, 105] });
  const privateRegions = redactor.detectChatIdentityRegions(privateChat);
  assert.strictEqual(privateRegions.filter((region) => region.targetType === "avatar").length, 2);
  assert.strictEqual(privateRegions.filter((region) => region.targetType === "name").length, 0, "private bubbles should not create fake names");

  const rightGroupMessage = makeImage(240, 720);
  paintHeaderTitle(rightGroupMessage);
  paintChatMessage(rightGroupMessage, {
    side: "right",
    y: 220,
    name: true,
    seed: 79,
    bubbleColor: [149, 236, 105]
  });
  const rightGroupRegions = redactor.detectChatIdentityRegions(rightGroupMessage);
  assert.strictEqual(rightGroupRegions.filter((region) => region.targetType === "name").length, 1, "a real right-side group name should remain supported");

  const solidAvatar = makeImage(240, 720);
  paintHeaderTitle(solidAvatar);
  const solidExpected = paintChatMessage(solidAvatar, {
    side: "left",
    y: 180,
    avatarColor: [47, 128, 237],
    bubbleColor: [255, 255, 255]
  });
  const solidRegions = redactor.detectChatIdentityRegions(solidAvatar);
  assert(
    solidRegions.some((region) => region.targetType === "avatar" && redactor.rectIoU(region.rect, solidExpected.avatar) >= 0.55),
    "flat-color avatars should be detected from square boundaries and message context"
  );

  const wallpaper = makeImage(240, 720);
  paintWallpaperNoise(wallpaper, 18);
  paintHeaderTitle(wallpaper);
  fillRect(wallpaper, 42, 130, 150, 45, [255, 255, 255]);
  fillRect(wallpaper, 58, 330, 140, 50, [149, 236, 105]);
  const wallpaperRegions = redactor.detectChatIdentityRegions(wallpaper);
  assert.strictEqual(
    wallpaperRegions.filter((region) => region.targetType === "avatar").length,
    0,
    "textured wallpaper plus bubbles must not create edge-lane avatar guesses"
  );
}

function testChatChromeAndRemoteBubbleExclusion() {
  const image = makeImage(300, 900, [97, 171, 216, 255]);
  paintHeaderTitle(image);
  const expected = paintChatMessage(image, {
    side: "left",
    y: 690,
    name: true,
    seed: 809,
    bubbleColor: [255, 255, 255]
  });
  fillRect(image, 210, 691, 1, 1, [20, 25, 31]);
  paintInputToolbar(image, 780);

  const regions = redactor.detectChatIdentityRegions(image);
  const avatars = regions.filter((region) => region.targetType === "avatar");
  const names = regions.filter((region) => region.targetType === "name");
  assert.strictEqual(avatars.length, 1, "voice, emoji, and add controls in the input toolbar must be excluded");
  assert.strictEqual(names.length, 1, "a sparse wallpaper edge must not stretch a real name beyond its text");
  assert(names[0].rect.width < 0.2, "the name mask should remain fitted to the nearby text");
  assert(redactor.rectIoU(avatars[0].rect, expected.avatar) >= 0.55, "the final real avatar above the toolbar must remain detected");
  assert(avatars.every((region) => (region.rect.y + region.rect.height) * image.height < 780));

  const remoteBubble = makeImage(300, 900, [120, 178, 211, 255]);
  paintHeaderTitle(remoteBubble);
  paintNoisySquare(remoteBubble, 10, 430, 30, 977);
  fillRect(remoteBubble, 112, 430, 150, 48, [149, 236, 105]);
  paintTextBars(remoteBubble, 125, 442, [105, 82], [60, 68, 74]);
  assert.strictEqual(
    redactor.detectChatIdentityRegions(remoteBubble).filter((region) => region.targetType === "avatar").length,
    0,
    "a distant message must not validate an unrelated edge image as an avatar"
  );
}

function testMixedChatLayouts() {
  const image = makeImage(300, 1200, [238, 240, 243, 255]);
  fillRect(image, 95, 2, 110, 20, [18, 20, 24]);
  paintHeaderTitle(image);
  const inputs = [
    { side: "left", y: 105, name: true, avatarSize: 25, avatarMargin: 8, seed: 101 },
    { side: "right", y: 225, avatarSize: 28, avatarMargin: 10, seed: 103, bubbleColor: [149, 236, 105] },
    { side: "left", y: 370, avatarSize: 31, avatarMargin: 11, seed: 107 },
    { side: "right", y: 555, avatarSize: 25, avatarMargin: 8, seed: 109, bubbleColor: [149, 236, 105] },
    { side: "left", y: 760, name: true, avatarSize: 28, avatarMargin: 10, seed: 113 },
    { side: "right", y: 980, avatarSize: 31, avatarMargin: 11, seed: 127, bubbleColor: [149, 236, 105] }
  ];
  const expected = inputs.map((input) => paintChatMessage(image, input));
  const regions = redactor.detectChatIdentityRegions(image);
  const avatars = regions.filter((region) => region.targetType === "avatar");
  const names = regions.filter((region) => region.targetType === "name");
  expected.forEach((message) => {
    assert(
      avatars.some((avatar) => redactor.rectIoU(avatar.rect, message.avatar) >= 0.46),
      `mixed layout avatar at ${message.avatar.y} should be found`
    );
  });
  assert.strictEqual(avatars.length, expected.length, "mixed avatar sizes and margins should not create duplicates");
  assert.strictEqual(names.length, inputs.filter((input) => input.name).length, "only explicit group-name rows should be masked");
  const title = regions.find((region) => region.targetType === "title");
  assert(title && title.rect.y * image.height > 25, "status-bar shapes must not be selected as the chat title");
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
testChatChromeAndRemoteBubbleExclusion();
testMixedChatLayouts();
testPixelEffects();
testPrivacyStrengthAndDisabledMasks();
testInvalidInputs();
console.log("screenshot redactor algorithm tests passed");
