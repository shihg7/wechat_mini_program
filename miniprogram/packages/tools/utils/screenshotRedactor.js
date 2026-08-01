const DEFAULT_EFFECT = Object.freeze({
  type: "mosaic",
  strength: 12,
  color: "#182230"
});
const MIN_REDACTION_STRENGTH = 8;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeRect(rect) {
  const x1 = clamp(Math.min(Number(rect.x) || 0, (Number(rect.x) || 0) + (Number(rect.width) || 0)), 0, 1);
  const y1 = clamp(Math.min(Number(rect.y) || 0, (Number(rect.y) || 0) + (Number(rect.height) || 0)), 0, 1);
  const x2 = clamp(Math.max(Number(rect.x) || 0, (Number(rect.x) || 0) + (Number(rect.width) || 0)), 0, 1);
  const y2 = clamp(Math.max(Number(rect.y) || 0, (Number(rect.y) || 0) + (Number(rect.height) || 0)), 0, 1);
  return {
    x: round(x1),
    y: round(y1),
    width: round(Math.max(0, x2 - x1)),
    height: round(Math.max(0, y2 - y1))
  };
}

function normalizeMaskRegion(region, imageSize) {
  const width = Math.max(1, Number(imageSize && imageSize.width) || 1);
  const height = Math.max(1, Number(imageSize && imageSize.height) || 1);
  const input = region && region.rect ? region.rect : region || {};
  const isPixelRect = Math.abs(Number(input.x) || 0) > 1
    || Math.abs(Number(input.y) || 0) > 1
    || Math.abs(Number(input.width) || 0) > 1
    || Math.abs(Number(input.height) || 0) > 1;
  const rect = normalizeRect(isPixelRect ? {
    x: (Number(input.x) || 0) / width,
    y: (Number(input.y) || 0) / height,
    width: (Number(input.width) || 0) / width,
    height: (Number(input.height) || 0) / height
  } : input);
  return {
    id: String(region && region.id || "mask"),
    source: region && region.source === "auto" ? "auto" : "manual",
    targetType: ["avatar", "name", "title", "custom"].includes(region && region.targetType)
      ? region.targetType
      : "custom",
    effect: {
      type: ["mosaic", "blur", "solid"].includes(region && region.effect && region.effect.type)
        ? region.effect.type
        : DEFAULT_EFFECT.type,
      strength: clamp(Math.round(Number(region && region.effect && region.effect.strength) || DEFAULT_EFFECT.strength), MIN_REDACTION_STRENGTH, 40),
      color: /^#[0-9a-f]{6}$/i.test(region && region.effect && region.effect.color || "")
        ? region.effect.color.toLowerCase()
        : DEFAULT_EFFECT.color
    },
    rect,
    confidence: clamp(Number(region && region.confidence) || 0, 0, 1),
    enabled: !region || region.enabled !== false
  };
}

function rectIntersection(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function rectIoU(a, b) {
  const intersection = rectIntersection(a, b);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function colorDistance(first, second) {
  return (
    Math.abs(first[0] - second[0])
    + Math.abs(first[1] - second[1])
    + Math.abs(first[2] - second[2])
  ) / 3;
}

function regionStats(imageData, x, y, regionWidth, regionHeight) {
  const { data, width, height } = imageData;
  const left = clamp(Math.round(x), 0, width - 1);
  const top = clamp(Math.round(y), 0, height - 1);
  const right = clamp(Math.round(x + regionWidth), left + 1, width);
  const bottom = clamp(Math.round(y + regionHeight), top + 1, height);
  const stride = Math.max(1, Math.floor(Math.min(right - left, bottom - top) / 20));
  let count = 0;
  const rgb = [0, 0, 0];
  let sum = 0;
  let squared = 0;
  let edges = 0;
  let edgeChecks = 0;

  for (let py = top; py < bottom; py += stride) {
    for (let px = left; px < right; px += stride) {
      const index = (py * width + px) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = r * 0.299 + g * 0.587 + b * 0.114;
      rgb[0] += r;
      rgb[1] += g;
      rgb[2] += b;
      sum += luminance;
      squared += luminance * luminance;
      count += 1;

      const nextX = Math.min(right - 1, px + stride);
      const nextY = Math.min(bottom - 1, py + stride);
      if (nextX !== px || nextY !== py) {
        const horizontalIndex = (py * width + nextX) * 4;
        const verticalIndex = (nextY * width + px) * 4;
        const horizontal = data[horizontalIndex] * 0.299 + data[horizontalIndex + 1] * 0.587 + data[horizontalIndex + 2] * 0.114;
        const vertical = data[verticalIndex] * 0.299 + data[verticalIndex + 1] * 0.587 + data[verticalIndex + 2] * 0.114;
        if (Math.abs(horizontal - luminance) > 18) edges += 1;
        if (Math.abs(vertical - luminance) > 18) edges += 1;
        edgeChecks += 2;
      }
    }
  }

  const mean = count ? sum / count : 0;
  const variance = count ? Math.max(0, squared / count - mean * mean) : 0;
  return {
    edgeRatio: edgeChecks ? edges / edgeChecks : 0,
    meanRgb: rgb.map((value) => count ? value / count : 0),
    standardDeviation: Math.sqrt(variance)
  };
}

function mergeStats(stats) {
  const valid = stats.filter(Boolean);
  if (!valid.length) return { edgeRatio: 0, meanRgb: [0, 0, 0], standardDeviation: 0 };
  return {
    edgeRatio: valid.reduce((total, item) => total + item.edgeRatio, 0) / valid.length,
    meanRgb: [0, 1, 2].map((channel) => (
      valid.reduce((total, item) => total + item.meanRgb[channel], 0) / valid.length
    )),
    standardDeviation: valid.reduce((total, item) => total + item.standardDeviation, 0) / valid.length
  };
}

function surroundingStats(imageData, x, y, size, side) {
  const padding = Math.max(3, Math.round(size * 0.18));
  const strips = [
    regionStats(imageData, x, y - padding, size, padding),
    regionStats(imageData, x, y + size, size, padding)
  ];
  if (side === "left") {
    strips.push(regionStats(imageData, x - padding, y, padding, size));
  } else {
    strips.push(regionStats(imageData, x + size, y, padding, size));
  }
  return mergeStats(strips);
}

function avatarOuterBackground(imageData, x, y, size, side) {
  const sampleWidth = Math.max(3, Math.round(size * 0.22));
  return dominantRegionColor(imageData, {
    x: side === "left" ? Math.max(0, x - sampleWidth) : x + size,
    y: y - size * 0.08,
    width: sampleWidth,
    height: size * 1.16
  });
}

function pixelRgb(imageData, x, y) {
  const px = clamp(Math.round(x), 0, imageData.width - 1);
  const py = clamp(Math.round(y), 0, imageData.height - 1);
  const index = (py * imageData.width + px) * 4;
  return [imageData.data[index], imageData.data[index + 1], imageData.data[index + 2]];
}

function averageBoundaryContrast(imageData, x, y, size, side) {
  const inset = Math.max(1, Math.round(size * 0.06));
  const outside = Math.max(2, Math.round(size * 0.1));
  const samples = Math.max(8, Math.round(size / 3));
  const values = { bottom: 0, inner: 0, outer: 0, top: 0 };
  for (let index = 0; index < samples; index += 1) {
    const ratio = 0.18 + index / Math.max(1, samples - 1) * 0.64;
    const horizontal = x + size * ratio;
    const vertical = y + size * ratio;
    values.top += colorDistance(
      pixelRgb(imageData, horizontal, y + inset),
      pixelRgb(imageData, horizontal, y - outside)
    );
    values.bottom += colorDistance(
      pixelRgb(imageData, horizontal, y + size - inset),
      pixelRgb(imageData, horizontal, y + size + outside)
    );
    const outerInside = side === "left" ? x + inset : x + size - inset;
    const outerOutside = side === "left" ? x - outside : x + size + outside;
    const innerInside = side === "left" ? x + size - inset : x + inset;
    const innerOutside = side === "left" ? x + size + outside : x - outside;
    values.outer += colorDistance(
      pixelRgb(imageData, outerInside, vertical),
      pixelRgb(imageData, outerOutside, vertical)
    );
    values.inner += colorDistance(
      pixelRgb(imageData, innerInside, vertical),
      pixelRgb(imageData, innerOutside, vertical)
    );
  }
  Object.keys(values).forEach((key) => { values[key] /= samples; });
  const ordered = Object.values(values).sort((first, second) => second - first);
  return {
    mean: ordered.reduce((total, value) => total + value, 0) / ordered.length,
    strongSides: ordered.filter((value) => value >= 13).length,
    thirdStrongest: ordered[2] || 0
  };
}

function foregroundOccupancy(imageData, x, y, width, height, background, threshold = 26) {
  const left = clamp(Math.round(x), 0, imageData.width - 1);
  const top = clamp(Math.round(y), 0, imageData.height - 1);
  const right = clamp(Math.round(x + width), left + 1, imageData.width);
  const bottom = clamp(Math.round(y + height), top + 1, imageData.height);
  const stride = Math.max(1, Math.floor(Math.min(right - left, bottom - top) / 24));
  let foreground = 0;
  let total = 0;
  for (let py = top; py < bottom; py += stride) {
    for (let px = left; px < right; px += stride) {
      if (colorDistance(pixelRgb(imageData, px, py), background) >= threshold) foreground += 1;
      total += 1;
    }
  }
  return total ? foreground / total : 0;
}

function dominantRegionColor(imageData, search) {
  const left = clamp(Math.floor(search.x), 0, imageData.width - 1);
  const top = clamp(Math.floor(search.y), 0, imageData.height - 1);
  const right = clamp(Math.ceil(search.x + search.width), left + 1, imageData.width);
  const bottom = clamp(Math.ceil(search.y + search.height), top + 1, imageData.height);
  const stride = Math.max(1, Math.floor(Math.min(right - left, bottom - top) / 18));
  const buckets = new Map();
  for (let y = top; y < bottom; y += stride) {
    for (let x = left; x < right; x += stride) {
      const color = pixelRgb(imageData, x, y);
      const key = color.map((value) => Math.round(value / 16)).join(":");
      const bucket = buckets.get(key) || { count: 0, sums: [0, 0, 0] };
      bucket.count += 1;
      color.forEach((value, channel) => { bucket.sums[channel] += value; });
      buckets.set(key, bucket);
    }
  }
  let dominant = null;
  buckets.forEach((bucket) => {
    if (!dominant || bucket.count > dominant.count) dominant = bucket;
  });
  if (!dominant) return [0, 0, 0];
  return dominant.sums.map((value) => value / dominant.count);
}

function findHorizontalBoundary(imageData, range, options = {}) {
  const { width, height } = imageData;
  const stripHeight = Math.max(3, Math.round(width * 0.012));
  const step = Math.max(1, Math.round(stripHeight * 0.4));
  const laneWidth = Math.max(8, Math.round(width * 0.18));
  const minimumTransition = Number(options.minimumTransition) || 18;
  const minimumLaneTransition = Number(options.minimumLaneTransition) || 12;
  const reference = options.reference || null;
  let best = null;

  for (let y = Math.max(stripHeight, Math.round(range.start)); y <= Math.min(height - stripHeight, Math.round(range.end)); y += step) {
    const above = regionStats(imageData, 0, y - stripHeight, width, stripHeight);
    const below = regionStats(imageData, 0, y, width, stripHeight);
    const transition = colorDistance(above.meanRgb, below.meanRgb);
    const leftTransition = colorDistance(
      regionStats(imageData, 0, y - stripHeight, laneWidth, stripHeight).meanRgb,
      regionStats(imageData, 0, y, laneWidth, stripHeight).meanRgb
    );
    const rightTransition = colorDistance(
      regionStats(imageData, width - laneWidth, y - stripHeight, laneWidth, stripHeight).meanRgb,
      regionStats(imageData, width - laneWidth, y, laneWidth, stripHeight).meanRgb
    );
    const laneTransition = Math.min(leftTransition, rightTransition);
    if (transition < minimumTransition || laneTransition < minimumLaneTransition) continue;

    const referenceDistance = reference ? colorDistance(below.meanRgb, reference.meanRgb) : 0;
    if (reference && referenceDistance > (options.maximumReferenceDistance || 30)) continue;
    const score = transition * 0.58
      + laneTransition * 0.42
      - referenceDistance * 0.24
      - Math.max(0, below.standardDeviation - 42) * 0.06;
    if (!best || score > best.score) best = { y, score, stripHeight };
  }
  return best;
}

function detectChatContentBounds(imageData) {
  const { width, height } = imageData;
  const defaultTop = Math.max(0, Math.round(width * (height >= width * 1.2 ? 0.19 : 0.12)));
  const defaultBottom = Math.max(defaultTop, height - Math.round(width * 0.05));
  if (height < width * 1.2) return { top: defaultTop, bottom: defaultBottom };

  const topBoundary = findHorizontalBoundary(imageData, {
    start: width * 0.1,
    end: Math.min(height * 0.3, width * 0.36)
  }, {
    minimumTransition: 26,
    minimumLaneTransition: 20
  });

  const referenceHeight = Math.max(4, Math.round(width * 0.045));
  const bottomReference = regionStats(
    imageData,
    width * 0.08,
    Math.max(0, height - referenceHeight),
    width * 0.84,
    referenceHeight
  );
  const bottomBoundary = findHorizontalBoundary(imageData, {
    start: Math.max(defaultTop + width * 0.5, height - width * 0.48),
    end: height - width * 0.045
  }, {
    minimumTransition: 10,
    minimumLaneTransition: 8,
    maximumReferenceDistance: 28,
    reference: bottomReference
  });

  const top = topBoundary
    ? Math.max(defaultTop, Math.round(topBoundary.y + topBoundary.stripHeight * 0.55))
    : defaultTop;
  const bottom = bottomBoundary
    ? Math.min(defaultBottom, Math.round(bottomBoundary.y - bottomBoundary.stripHeight * 0.25))
    : defaultBottom;
  return {
    top,
    bottom: Math.max(top + Math.round(width * 0.12), bottom)
  };
}

function scoreMessageArea(imageData, search, background) {
  const stats = regionStats(imageData, search.x, search.y, search.width, search.height);
  const occupancy = foregroundOccupancy(
    imageData,
    search.x,
    search.y,
    search.width,
    search.height,
    background
  );
  const colorScore = clamp(colorDistance(stats.meanRgb, background) / 42, 0, 1);
  const edgeScore = clamp((stats.edgeRatio - 0.008) / 0.16, 0, 1);
  const occupancyScore = clamp((occupancy - 0.008) / 0.18, 0, 1);
  return colorScore * 0.25 + edgeScore * 0.3 + occupancyScore * 0.45;
}

function messageEvidence(imageData, x, y, size, side, background) {
  const gap = Math.max(2, size * 0.12);
  const laneInset = imageData.width * 0.135;
  const contentEdge = side === "left"
    ? Math.max(x + size, laneInset) + gap
    : Math.min(x, imageData.width - laneInset) - gap;
  const availableWidth = side === "left" ? imageData.width - contentEdge : contentEdge;
  const broadWidth = Math.max(1, Math.min(imageData.width * 0.3, availableWidth));
  const nearWidth = Math.max(1, Math.min(size * 1.05, broadWidth));
  const broadLeft = side === "left" ? contentEdge : contentEdge - broadWidth;
  const nearLeft = side === "left" ? broadLeft : contentEdge - nearWidth;
  const top = y - size * 0.06;
  const height = size * 1.12;
  const broadScore = scoreMessageArea(imageData, {
    x: broadLeft,
    y: top,
    width: broadWidth,
    height
  }, background);
  const attachmentScore = scoreMessageArea(imageData, {
    x: nearLeft,
    y: top,
    width: nearWidth,
    height
  }, background);
  return {
    attachmentScore,
    score: broadScore * 0.42 + attachmentScore * 0.58
  };
}

// A valid avatar needs visual content, square boundaries, and an adjacent message area.
function scoreAvatarWindow(imageData, x, y, size, side) {
  const inside = regionStats(imageData, x, y, size, size);
  const outside = surroundingStats(imageData, x, y, size, side);
  const boundary = averageBoundaryContrast(imageData, x, y, size, side);
  const contrastScore = clamp((colorDistance(inside.meanRgb, outside.meanRgb) - 5) / 52, 0, 1);
  const varianceScore = clamp((inside.standardDeviation - 7) / 42, 0, 1);
  const edgeScore = clamp((inside.edgeRatio - 0.018) / 0.23, 0, 1);
  const textureScore = varianceScore * 0.58 + edgeScore * 0.42;
  const boundaryScore = clamp((boundary.mean - 6) / 35, 0, 1);
  const compactnessScore = clamp((inside.standardDeviation - outside.standardDeviation + 8) / 38, 0, 1);
  const message = messageEvidence(imageData, x, y, size, side, avatarOuterBackground(imageData, x, y, size, side));
  if (message.attachmentScore < 0.08) return 0;
  const contentScore = message.score;
  let score = contrastScore * 0.25
    + textureScore * 0.2
    + boundaryScore * 0.24
    + compactnessScore * 0.11
    + contentScore * 0.2;
  if (boundary.strongSides < 2) score -= 0.22;
  else if (boundary.strongSides < 3) score -= 0.15;
  if (boundary.thirdStrongest < 24) score -= 0.2;
  if (contentScore < 0.12) score -= 0.18;
  if (message.attachmentScore < 0.14) score -= 0.16;
  if (outside.standardDeviation > 48 && contrastScore < 0.25) score -= 0.12;
  return clamp(score, 0, 1);
}

function suppressOverlaps(candidates, limit) {
  const accepted = [];
  candidates
    .slice()
    .sort((a, b) => {
      const scoreDifference = b.score - a.score;
      if (Math.abs(scoreDifference) > 0.035) return scoreDifference;
      return b.rect.width - a.rect.width || scoreDifference || a.rect.y - b.rect.y;
    })
    .forEach((candidate) => {
      if (accepted.length >= limit) return;
      if (accepted.some((item) => {
        if (item.side !== candidate.side) return false;
        const firstCenterX = item.rect.x + item.rect.width / 2;
        const firstCenterY = item.rect.y + item.rect.height / 2;
        const secondCenterX = candidate.rect.x + candidate.rect.width / 2;
        const secondCenterY = candidate.rect.y + candidate.rect.height / 2;
        const sameAvatarBand = Math.abs(firstCenterX - secondCenterX) < 0.055
          && Math.abs(firstCenterY - secondCenterY) < Math.max(item.rect.height, candidate.rect.height) * 1.25;
        return rectIoU(item.rect, candidate.rect) > 0.2 || sameAvatarBand;
      })) return;
      accepted.push(candidate);
    });
  return accepted.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
}

function detectAvatarCandidates(imageData, options) {
  const { width, height } = imageData;
  const sizes = [0.084, 0.094, 0.104].map((ratio) => Math.max(12, Math.round(width * ratio)));
  const threshold = Number(options.avatarThreshold) || 0.5;
  const contentBounds = detectChatContentBounds(imageData);
  const candidates = [];

  sizes.forEach((size) => {
    const xPositions = {
      left: [0.025, 0.035].map((ratio) => Math.round(width * ratio)),
      right: [0.025, 0.035].map((ratio) => Math.round(width - width * ratio - size))
    };
    const startY = contentBounds.top;
    const endY = Math.max(startY, contentBounds.bottom - size);
    const step = Math.max(3, Math.round(size * 0.24));

    Object.keys(xPositions).forEach((side) => {
      xPositions[side].forEach((x) => {
        for (let y = startY; y <= endY; y += step) {
          const score = scoreAvatarWindow(imageData, x, y, size, side);
          if (score < threshold) continue;
          candidates.push({
            rect: { x: x / width, y: y / height, width: size / width, height: size / height },
            score,
            side
          });
        }
      });
    });
  });

  return suppressOverlaps(candidates, Number(options.maxAvatars) || 32);
}

function findSparseTextBounds(imageData, search, background, options = {}) {
  const left = clamp(Math.floor(search.x), 0, imageData.width - 1);
  const top = clamp(Math.floor(search.y), 0, imageData.height - 1);
  const right = clamp(Math.ceil(search.x + search.width), left + 1, imageData.width);
  const bottom = clamp(Math.ceil(search.y + search.height), top + 1, imageData.height);
  const threshold = Math.max(20, Number(options.threshold) || 0);
  const rows = [];
  for (let y = top; y < bottom; y += 1) {
    let rowCount = 0;
    let rowMinX = right;
    let rowMaxX = left;
    for (let x = left; x < right; x += 1) {
      const current = pixelRgb(imageData, x, y);
      const foreground = colorDistance(current, background);
      if (foreground < threshold) continue;
      const edge = Math.max(
        colorDistance(current, pixelRgb(imageData, x + 1, y)),
        colorDistance(current, pixelRgb(imageData, x, y + 1))
      );
      if (edge < 9 && foreground < threshold * 1.8) continue;
      rowCount += 1;
      rowMinX = Math.min(rowMinX, x);
      rowMaxX = Math.max(rowMaxX, x);
    }
    const maximumRowFill = (right - left) * (options.maxRowRatio || 0.58);
    if (rowCount >= 2 && rowCount <= maximumRowFill) {
      rows.push({ count: rowCount, maxX: rowMaxX, minX: rowMinX, y });
    }
  }
  const groups = [];
  rows.forEach((row) => {
    const current = groups[groups.length - 1];
    if (!current || row.y - current.lastY > 3) {
      groups.push({ count: row.count, lastY: row.y, maxX: row.maxX, minX: row.minX, minY: row.y });
      return;
    }
    current.count += row.count;
    current.lastY = row.y;
    current.minX = Math.min(current.minX, row.minX);
    current.maxX = Math.max(current.maxX, row.maxX);
  });
  const searchArea = Math.max(1, (right - left) * (bottom - top));
  const candidates = groups.map((group) => ({
    ...group,
    height: group.lastY - group.minY + 1,
    ratio: group.count / searchArea,
    width: group.maxX - group.minX + 1
  })).filter((group) => (
    group.ratio >= (options.minRatio || 0.006)
    && group.ratio <= (options.maxRatio || 0.24)
    && group.width >= Math.max(3, (right - left) * 0.04)
    && group.height >= Math.max(3, (bottom - top) * 0.12)
    && group.height <= (bottom - top) * 0.68
  )).sort((first, second) => second.count - first.count || first.minY - second.minY);
  if (!candidates.length) return null;
  const best = candidates[0];
  return { x: best.minX, y: best.minY, width: best.width, height: best.height, ratio: best.ratio };
}

function detectNameRegion(imageData, avatar) {
  const width = imageData.width;
  const avatarX = avatar.rect.x * width;
  const avatarY = avatar.rect.y * imageData.height;
  const avatarSize = avatar.rect.width * width;
  const outside = surroundingStats(imageData, avatarX, avatarY, avatarSize, avatar.side);
  const gap = width * 0.025;
  const searchWidth = width * 0.32;
  const search = {
    x: avatar.side === "left" ? avatarX + avatarSize + gap : avatarX - gap - searchWidth,
    y: avatarY - width * 0.03,
    width: searchWidth,
    height: width * 0.075
  };
  const backgroundSearch = {
    x: search.x,
    y: avatarY - width * 0.02,
    width: search.width,
    height: width * 0.035
  };
  const background = dominantRegionColor(imageData, backgroundSearch);
  const bounds = findSparseTextBounds(imageData, search, background, {
    maxRatio: 0.2,
    threshold: 22 + Math.min(18, outside.standardDeviation * 0.45)
  });
  if (!bounds) return null;
  if (bounds.y > avatarY + width * 0.022) return null;
  if (bounds.width > width * 0.26) return null;
  const paddingX = width * 0.012;
  const paddingY = width * 0.008;
  return {
    side: avatar.side,
    targetType: "name",
    confidence: clamp(0.55 + avatar.score * 0.22, 0, 0.82),
    rect: normalizeRect({
      x: (bounds.x - paddingX) / width,
      y: (bounds.y - paddingY) / imageData.height,
      width: (bounds.width + paddingX * 2) / width,
      height: (bounds.height + paddingY * 2) / imageData.height
    })
  };
}

function detectTitleRegion(imageData) {
  const { width, height } = imageData;
  const fullScreenshot = height >= width * 1.2;
  const search = {
    x: width * 0.2,
    y: width * (fullScreenshot ? 0.105 : 0.018),
    width: width * 0.6,
    height: width * (fullScreenshot ? 0.115 : 0.12)
  };
  const sideStats = mergeStats([
    regionStats(imageData, width * 0.06, search.y, width * 0.1, search.height),
    regionStats(imageData, width * 0.84, search.y, width * 0.1, search.height)
  ]);
  const background = dominantRegionColor(imageData, search);
  const bounds = findSparseTextBounds(imageData, search, background, {
    maxRatio: 0.28,
    minRatio: 0.003,
    threshold: 20 + Math.min(16, sideStats.standardDeviation * 0.35)
  });
  if (bounds) {
    const center = (bounds.x + bounds.width / 2) / width;
    if (center >= 0.34 && center <= 0.66 && bounds.width <= width * 0.48) {
      const paddingX = width * 0.035;
      const paddingY = width * 0.014;
      return {
        side: "center",
        targetType: "title",
        confidence: 0.76,
        rect: normalizeRect({
          x: (bounds.x - paddingX) / width,
          y: (bounds.y - paddingY) / height,
          width: (bounds.width + paddingX * 2) / width,
          height: (bounds.height + paddingY * 2) / height
        })
      };
    }
  }
  const fallbackTop = width * (fullScreenshot ? 0.12 : 0.03);
  return {
    side: "center",
    targetType: "title",
    confidence: 0.38,
    rect: normalizeRect({
      x: 0.24,
      y: fallbackTop / height,
      width: 0.52,
      height: Math.min(height, width * 0.09) / height
    })
  };
}

function mergeNearbyRegions(regions) {
  const merged = [];
  regions.forEach((region) => {
    const existing = merged.find((item) => (
      item.targetType === region.targetType
      && item.side === region.side
      && rectIoU(item.rect, region.rect) > 0.42
    ));
    if (!existing) {
      merged.push({ ...region, rect: { ...region.rect } });
      return;
    }
    if (region.confidence > existing.confidence) {
      existing.rect = { ...region.rect };
      existing.confidence = region.confidence;
    }
  });
  return merged;
}

function detectChatIdentityRegions(imageData, options = {}) {
  if (!imageData || !Number.isInteger(imageData.width) || !Number.isInteger(imageData.height)) {
    throw new Error("需要有效的图像数据");
  }
  if (!imageData.data || imageData.data.length < imageData.width * imageData.height * 4) {
    throw new Error("图像像素数据不完整");
  }

  const { width, height } = imageData;
  const avatars = detectAvatarCandidates(imageData, options);
  const rawRegions = [];

  if (options.includeTitle !== false && height >= width * 0.45) {
    rawRegions.push(detectTitleRegion(imageData));
  }

  avatars.forEach((avatar) => {
    const paddingX = 0.008;
    const paddingY = width * 0.008 / height;
    const avatarRect = normalizeRect({
      x: avatar.rect.x - paddingX,
      y: avatar.rect.y - paddingY,
      width: avatar.rect.width + paddingX * 2,
      height: avatar.rect.height + paddingY * 2
    });
    rawRegions.push({
      side: avatar.side,
      targetType: "avatar",
      confidence: clamp(0.5 + avatar.score * 0.48, 0, 0.98),
      rect: avatarRect
    });

    const name = detectNameRegion(imageData, avatar);
    if (name) rawRegions.push(name);
  });

  return mergeNearbyRegions(rawRegions).map((region, index) => normalizeMaskRegion({
    id: `auto-${region.targetType}-${index + 1}`,
    source: "auto",
    targetType: region.targetType,
    effect: options.effect || DEFAULT_EFFECT,
    rect: region.rect,
    confidence: region.confidence,
    enabled: true
  }, { width, height }));
}

function pixelRect(rect, width, height) {
  const normalized = normalizeRect(rect);
  const left = clamp(Math.floor(normalized.x * width), 0, width);
  const top = clamp(Math.floor(normalized.y * height), 0, height);
  const right = clamp(Math.ceil((normalized.x + normalized.width) * width), left, width);
  const bottom = clamp(Math.ceil((normalized.y + normalized.height) * height), top, height);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function parseHexColor(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(value || "");
  const hex = match ? match[1] : "182230";
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 255];
}

function sortRegionsForPrivacy(regions) {
  const priority = { mosaic: 0, blur: 1, solid: 2 };
  return (regions || [])
    .map((region, index) => ({ index, region }))
    .filter((item) => item.region && item.region.enabled !== false)
    .sort((first, second) => {
      const firstPriority = priority[first.region.effect && first.region.effect.type] || 0;
      const secondPriority = priority[second.region.effect && second.region.effect.type] || 0;
      return firstPriority - secondPriority || first.index - second.index;
    })
    .map((item) => item.region);
}

function applySolid(data, imageWidth, rect, color) {
  const rgba = parseHexColor(color);
  for (let y = rect.top; y < rect.bottom; y += 1) {
    for (let x = rect.left; x < rect.right; x += 1) {
      const index = (y * imageWidth + x) * 4;
      data[index] = rgba[0];
      data[index + 1] = rgba[1];
      data[index + 2] = rgba[2];
      data[index + 3] = rgba[3];
    }
  }
}

function applyMosaic(data, imageWidth, rect, strength) {
  const blockSize = Math.max(2, Math.round(strength));
  for (let top = rect.top; top < rect.bottom; top += blockSize) {
    for (let left = rect.left; left < rect.right; left += blockSize) {
      const right = Math.min(rect.right, left + blockSize);
      const bottom = Math.min(rect.bottom, top + blockSize);
      const totals = [0, 0, 0, 0];
      let count = 0;
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const index = (y * imageWidth + x) * 4;
          totals[0] += data[index];
          totals[1] += data[index + 1];
          totals[2] += data[index + 2];
          totals[3] += data[index + 3];
          count += 1;
        }
      }
      const rgba = totals.map((total) => Math.round(total / Math.max(1, count)));
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const index = (y * imageWidth + x) * 4;
          data[index] = rgba[0];
          data[index + 1] = rgba[1];
          data[index + 2] = rgba[2];
          data[index + 3] = rgba[3];
        }
      }
    }
  }
}

function applyBlur(data, imageWidth, rect, strength) {
  const radius = clamp(Math.round(strength / 3), 1, 12);
  const source = new Uint8ClampedArray(data);
  const regionWidth = rect.width;
  const regionHeight = rect.height;
  const stride = regionWidth + 1;
  const integrals = [0, 1, 2].map(() => new Float64Array((regionWidth + 1) * (regionHeight + 1)));

  for (let y = 1; y <= regionHeight; y += 1) {
    const sums = [0, 0, 0];
    for (let x = 1; x <= regionWidth; x += 1) {
      const sourceIndex = ((rect.top + y - 1) * imageWidth + rect.left + x - 1) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        sums[channel] += source[sourceIndex + channel];
        integrals[channel][y * stride + x] = integrals[channel][(y - 1) * stride + x] + sums[channel];
      }
    }
  }

  for (let y = 0; y < regionHeight; y += 1) {
    for (let x = 0; x < regionWidth; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(regionWidth - 1, x + radius);
      const top = Math.max(0, y - radius);
      const bottom = Math.min(regionHeight - 1, y + radius);
      const area = (right - left + 1) * (bottom - top + 1);
      const destination = ((rect.top + y) * imageWidth + rect.left + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const integral = integrals[channel];
        const total = integral[(bottom + 1) * stride + right + 1]
          - integral[top * stride + right + 1]
          - integral[(bottom + 1) * stride + left]
          + integral[top * stride + left];
        data[destination + channel] = Math.round(total / area);
      }
    }
  }
}

function applyMaskEffects(imageData, regions) {
  if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
    throw new Error("需要有效的图像数据");
  }
  const result = {
    data: new Uint8ClampedArray(imageData.data),
    width: imageData.width,
    height: imageData.height
  };
  sortRegionsForPrivacy(regions).forEach((input) => {
    const region = normalizeMaskRegion(input, result);
    const rect = pixelRect(region.rect, result.width, result.height);
    if (!rect.width || !rect.height) return;
    if (region.effect.type === "solid") {
      applySolid(result.data, result.width, rect, region.effect.color);
    } else if (region.effect.type === "blur") {
      applyBlur(result.data, result.width, rect, region.effect.strength);
    } else {
      applyMosaic(result.data, result.width, rect, region.effect.strength);
    }
  });
  return result;
}

function mapCanvasPointToImage(point, transform, imageSize) {
  const scale = Math.max(0.000001, Number(transform && transform.scale) || 1);
  const x = ((Number(point && point.x) || 0) - (Number(transform && transform.offsetX) || 0)) / scale;
  const y = ((Number(point && point.y) || 0) - (Number(transform && transform.offsetY) || 0)) / scale;
  const width = Math.max(1, Number(imageSize && imageSize.width) || 1);
  const height = Math.max(1, Number(imageSize && imageSize.height) || 1);
  return {
    x: clamp(x, 0, width),
    y: clamp(y, 0, height),
    normalizedX: clamp(x / width, 0, 1),
    normalizedY: clamp(y / height, 0, 1)
  };
}

function fitImageToViewport(imageSize, viewport) {
  const imageWidth = Math.max(1, Number(imageSize && imageSize.width) || 1);
  const imageHeight = Math.max(1, Number(imageSize && imageSize.height) || 1);
  const viewportWidth = Math.max(1, Number(viewport && viewport.width) || 1);
  const viewportHeight = Math.max(1, Number(viewport && viewport.height) || 1);
  const scale = Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight);
  return {
    baseScale: scale,
    scale,
    offsetX: (viewportWidth - imageWidth * scale) / 2,
    offsetY: (viewportHeight - imageHeight * scale) / 2
  };
}

module.exports = {
  DEFAULT_EFFECT,
  MIN_REDACTION_STRENGTH,
  applyMaskEffects,
  detectChatIdentityRegions,
  fitImageToViewport,
  mapCanvasPointToImage,
  normalizeMaskRegion,
  normalizeRect,
  rectIoU,
  sortRegionsForPrivacy
};
