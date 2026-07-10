function compact(value) {
  return JSON.parse(JSON.stringify(value));
}

function toPublicPlaceDto(place) {
  return compact({
    cloudPlaceId: place.cloudPlaceId || place.cloudId || "",
    type: place.type,
    name: place.name,
    city: place.city,
    area: place.area,
    aliases: place.aliases || []
  });
}

function toPublicReviewDto(record) {
  const publicPhotoIds = new Set(record.publicPhotoIds || []);
  return compact({
    publicReviewId: record.publicReviewId || "",
    cloudPlaceId: record.cloudPlaceId || "",
    recordType: record.recordType,
    placeName: record.placeName || record.displayName,
    city: record.city,
    visitMonth: record.visitMonth,
    overallScore: record.isRated ? record.overallScore : null,
    scores: record.isRated ? record.scores : {},
    selectedTags: record.selectedTags || {},
    customTags: record.customTags || [],
    publicNote: record.publicNote || "",
    photos: (record.photos || []).filter((photo) => publicPhotoIds.has(photo.id)).map((photo) => ({ id: photo.id, category: photo.category, caption: photo.caption }))
  });
}

function toPrivateSyncDto(record) {
  const copy = compact(record);
  delete copy.coverPhotoPath;
  copy.photos = (copy.photos || []).map((photo) => ({ ...photo, filePath: "" }));
  return copy;
}

module.exports = { toPrivateSyncDto, toPublicPlaceDto, toPublicReviewDto };
