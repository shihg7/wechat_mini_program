function keyFor(type, id) { return `${type}:${id}`; }
function hasCoordinates(point) { return point.latitude !== null && point.latitude !== "" && point.longitude !== null && point.longitude !== "" && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude)); }

function applyOffsets(points) {
  const groups = {};
  points.forEach((point) => { const key = `${Number(point.latitude).toFixed(5)}:${Number(point.longitude).toFixed(5)}`; if (!groups[key]) groups[key] = []; groups[key].push(point); });
  Object.keys(groups).forEach((key) => groups[key].forEach((point, index) => { if (index) { const angle = index * 2.399; point.latitude += Math.sin(angle) * 0.00012; point.longitude += Math.cos(angle) * 0.00012; } }));
  return points;
}

function buildTravelMapData(places, records, wishlist) {
  const pointMap = {};
  const placeMap = (places || []).reduce((map, place) => { map[place.id] = place; return map; }, {});
  (records || []).filter((record) => record.status !== "draft").forEach((record) => {
    const place = placeMap[record.placeId];
    if (!place) return;
    const key = keyFor("place", place.id);
    if (!pointMap[key]) pointMap[key] = { key, entityType: "place", entityId: place.id, type: place.type, name: place.name, city: place.city, latitude: place.latitude, longitude: place.longitude, visited: true, wished: false, visitCount: 0, scores: [] };
    pointMap[key].visitCount += 1;
    if (record.isRated) pointMap[key].scores.push(Number(record.overallScore || 0));
  });
  (wishlist || []).filter((item) => item.status !== "visited").forEach((item) => {
    const place = item.placeId && placeMap[item.placeId];
    const key = place ? keyFor("place", place.id) : keyFor("wish", item.id);
    if (!pointMap[key]) pointMap[key] = { key, entityType: place ? "place" : "wishlist", entityId: place ? place.id : item.id, type: item.type, name: place ? place.name : item.name, city: place ? place.city : item.city, latitude: place ? place.latitude : item.latitude, longitude: place ? place.longitude : item.longitude, visited: false, wished: true, visitCount: 0, scores: [] };
    pointMap[key].wished = true;
  });
  const all = Object.keys(pointMap).map((key) => {
    const point = pointMap[key];
    point.averageScore = point.scores.length ? Math.round(point.scores.reduce((sum, score) => sum + score, 0) / point.scores.length * 10) / 10 : 0;
    point.status = point.visited ? "visited" : "wishlist";
    point.statusLabel = point.visited ? "已到访" : "想去";
    point.typeLabel = point.type === "restaurant" ? "餐厅" : "酒店";
    return point;
  });
  const located = applyOffsets(all.filter(hasCoordinates).map((point) => ({ ...point, latitude: Number(point.latitude), longitude: Number(point.longitude) })));
  const missing = all.filter((point) => !hasCoordinates(point));
  return { located, missing };
}

function filterMapPoints(points, filter) {
  if (!filter || filter === "all") return points.slice();
  if (filter === "hotel" || filter === "restaurant") return points.filter((point) => point.type === filter);
  return points.filter((point) => point.status === filter);
}

function toMarkers(points) {
  return points.map((point, index) => ({ id: index + 1, latitude: point.latitude, longitude: point.longitude, title: point.name, iconPath: "/pages/index/logo.png", width: 28, height: 28, callout: { content: `${point.typeLabel} · ${point.name}\n${point.statusLabel}${point.averageScore ? ` · ${point.averageScore} 分` : ""}`, display: "BYCLICK", padding: 8, borderRadius: 4, bgColor: point.status === "visited" ? "#172033" : "#a34b32", color: "#ffffff", fontSize: 12 }, pointKey: point.key }));
}

module.exports = { buildTravelMapData, filterMapPoints, toMarkers };
