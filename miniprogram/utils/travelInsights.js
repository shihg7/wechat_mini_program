const { getAllRecordTags } = require("./hotelReviewStore");
const { getCategoryScores, roundScore } = require("./hotelScore");

function recordDate(record) {
  return String(record.stayDate || record.createdAt || "");
}

function isCompleted(record) {
  return record.status !== "draft";
}

function isRated(record) {
  return isCompleted(record) && record.isRated;
}

function getAvailableYears(records) {
  const years = records.filter(isCompleted).reduce((result, record) => {
    const year = recordDate(record).slice(0, 4);
    if (/^\d{4}$/.test(year) && result.indexOf(year) < 0) result.push(year);
    return result;
  }, []).sort((a, b) => b.localeCompare(a));
  return ["all"].concat(years);
}

function bestBy(records, scoreFor) {
  if (!records.length) return null;
  return records.reduce((best, record) => {
    const score = Number(scoreFor(record) || 0);
    return !best || score > best.score ? { id: record.id, name: record.displayName, city: record.city, score } : best;
  }, null);
}

function countRanking(records, valueFor, limit = 6) {
  const counts = {};
  records.forEach((record) => {
    (valueFor(record) || []).filter(Boolean).forEach((value) => { counts[value] = (counts[value] || 0) + 1; });
  });
  const rows = Object.keys(counts).map((name) => ({ name, count: counts[name] })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
  const max = rows.length ? rows[0].count : 1;
  return rows.map((row) => ({ ...row, percent: Math.round(row.count / max * 100) }));
}

function buildMonthTrend(records, year) {
  const counts = {};
  records.forEach((record) => {
    const month = recordDate(record).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) counts[month] = (counts[month] || 0) + 1;
  });
  let keys;
  if (year !== "all") keys = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  else keys = Object.keys(counts).sort().slice(-12);
  const max = Math.max(1, ...keys.map((key) => counts[key] || 0));
  return keys.map((key) => ({ key, label: year === "all" ? key : `${Number(key.slice(5))}月`, count: counts[key] || 0, percent: Math.round((counts[key] || 0) / max * 100) }));
}

function buildRevisitTrends(records) {
  const groups = {};
  records.filter(isRated).forEach((record) => {
    const key = record.placeId || `record:${record.id}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  });
  return Object.keys(groups).map((key) => {
    const visits = groups[key].sort((a, b) => recordDate(a).localeCompare(recordDate(b)));
    if (visits.length < 2) return null;
    const latest = visits[visits.length - 1];
    const previous = visits[visits.length - 2];
    const delta = roundScore(latest.overallScore - previous.overallScore);
    return { placeId: latest.placeId, name: latest.displayName, visitCount: visits.length, latestScore: latest.overallScore, delta };
  }).filter(Boolean).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.visitCount - a.visitCount).slice(0, 8);
}

function buildTravelInsights(records, selectedYear = "all") {
  const completed = records.filter(isCompleted).filter((record) => selectedYear === "all" || recordDate(record).slice(0, 4) === selectedYear);
  const rated = completed.filter(isRated);
  const totalScore = rated.reduce((sum, record) => sum + Number(record.overallScore || 0), 0);
  const placeCounts = completed.reduce((map, record) => { if (record.placeId) map[record.placeId] = (map[record.placeId] || 0) + 1; return map; }, {});
  const hotels = rated.filter((record) => record.recordType !== "restaurant");
  const restaurants = rated.filter((record) => record.recordType === "restaurant");
  const categoryBest = (key) => bestBy(hotels, (record) => getCategoryScores(record.scores, "hotel")[key]);
  const scoreTrend = rated.slice().sort((a, b) => recordDate(a).localeCompare(recordDate(b))).slice(-12).map((record) => ({ id: record.id, name: record.displayName, date: recordDate(record).slice(0, 10), score: record.overallScore, percent: Math.round(record.overallScore * 10) }));
  return {
    selectedYear,
    total: completed.length,
    ratedTotal: rated.length,
    hotelTotal: completed.filter((record) => record.recordType !== "restaurant").length,
    restaurantTotal: completed.filter((record) => record.recordType === "restaurant").length,
    cityTotal: new Set(completed.map((record) => record.city).filter(Boolean)).size,
    revisitPlaceTotal: Object.keys(placeCounts).filter((key) => placeCounts[key] > 1).length,
    averageScore: rated.length ? roundScore(totalScore / rated.length) : 0,
    best: {
      hotel: bestBy(hotels, (record) => record.overallScore),
      restaurant: bestBy(restaurants, (record) => record.overallScore),
      lounge: categoryBest("lounge"),
      breakfast: categoryBest("breakfast"),
      pool: categoryBest("pool")
    },
    cityRanking: countRanking(completed, (record) => [record.city || "未填写城市"]),
    tagRanking: countRanking(completed, getAllRecordTags),
    monthTrend: buildMonthTrend(completed, selectedYear),
    scoreTrend,
    revisitTrends: buildRevisitTrends(completed)
  };
}

module.exports = { buildTravelInsights, getAvailableYears };
