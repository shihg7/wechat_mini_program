const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const IMAGE_SCALE = 2;

function ascii(text) {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 255;
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
  if (!Array.isArray(imageBuffers) || !imageBuffers.length) {
    throw new Error("PDF 至少需要一页图片");
  }

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
      ascii(`<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH * IMAGE_SCALE} /Height ${PAGE_HEIGHT * IMAGE_SCALE} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`),
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
    if (Array.isArray(objects[id])) parts.push(...objects[id]);
    else parts.push(objects[id]);
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

module.exports = { buildPdf };
