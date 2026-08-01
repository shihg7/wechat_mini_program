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

function regionStats(imageData, x, y, size) {
  const { data, width, height } = imageData;
  const left = clamp(Math.round(x), 0, width - 1);
  const top = clamp(Math.round(y), 0, height - 1);
  const right = clamp(Math.round(x + size), left + 1, width);
  const bottom = clamp(Math.round(y + size), top + 1, height);
  const stride = Math.max(1, Math.floor(size / 18));
  let count = 0;
  let sum = 0;
  let squared = 0;
  let colorful = 0;
  let edges = 0;
  let edgeChecks = 0;

  for (let py = top; py < bottom; py += stride) {
    for (let px = left; px < right; px += stride) {
      const index = (py * width + px) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = r * 0.299 + g * 0.587 + b * 0.114;
      sum += luminance;
      squared += luminance * luminance;
      colorful += Math.max(r, g, b) - Math.min(r, g, b);
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
    colorfulness: count ? colorful / count : 0,
    edgeRatio: edgeChecks ? edges / edgeChecks : 0,
    mean,
    standardDeviation: Math.sqrt(variance)
  };
}

function scoreAvatarWindow(stats) {
  const varianceScore = clamp((stats.standardDeviation - 9) / 45, 0, 1);
  const edgeScore = clamp((stats.edgeRatio - 0.035) / 0.28, 0, 1);
  const colorScore = clamp(stats.colorfulness / 85, 0, 1);
  return varianceScore * 0.52 + edgeScore * 0.36 + colorScore * 0.12;
}

function suppressOverlaps(candidates, limit) {
  const accepted = [];
  candidates
    .slice()
    .sort((a, b) => b.score - a.score || a.rect.y - b.rect.y)
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
  const sizes = [0.084, 0.102, 0.12].map((ratio) => Math.max(12, Math.round(width * ratio)));
  const threshold = Number(options.avatarThreshold) || 0.46;
  const candidates = [];

  sizes.forEach((size) => {
    const xPositions = {
      left: [0.022, 0.036, 0.05].map((ratio) => Math.round(width * ratio)),
      right: [0.022, 0.036, 0.05].map((ratio) => Math.round(width - width * ratio - size))
    };
    const startY = Math.max(0, Math.round(width * 0.16));
    const endY = Math.max(startY, height - Math.round(width * 0.05) - size);
    const step = Math.max(5, Math.round(size * 0.3));

    Object.keys(xPositions).forEach((side) => {
      xPositions[side].forEach((x) => {
        for (let y = startY; y <= endY; y += step) {
          const stats = regionStats(imageData, x, y, size);
          const score = scoreAvatarWindow(stats);
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

  return suppressOverlaps(candidates, Number(options.maxAvatars) || 24);
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
  const titleHeight = Math.min(height, width * 0.105);
  const titleTop = Math.min(Math.max(0, width * 0.028), Math.max(0, height - titleHeight));

  if (options.includeTitle !== false && height >= width * 0.45) {
    rawRegions.push({
      side: "center",
      targetType: "title",
      confidence: 0.64,
      rect: normalizeRect({
        x: 0.22,
        y: titleTop / height,
        width: 0.56,
        height: titleHeight / height
      })
    });
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

    const nameWidth = 0.31;
    const nameHeight = Math.min(height, width * 0.055) / height;
    rawRegions.push({
      side: avatar.side,
      targetType: "name",
      confidence: clamp(0.36 + avatar.score * 0.42, 0, 0.82),
      rect: normalizeRect({
        x: avatar.side === "left"
          ? avatarRect.x + avatarRect.width + 0.012
          : avatarRect.x - nameWidth - 0.012,
        y: avatarRect.y - width * 0.004 / height,
        width: nameWidth,
        height: nameHeight
      })
    });
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
