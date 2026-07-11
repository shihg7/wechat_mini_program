const { getRecords } = require("../../utils/repositories/recordRepository");
const { getPlaces } = require("../../utils/repositories/placeRepository");
const { getWishlist } = require("../../utils/repositories/wishlistRepository");
const { buildTravelMapData, filterMapPoints, toMarkers } = require("../../utils/travelMap");

const FILTERS = [{ key: "all", label: "全部" }, { key: "hotel", label: "酒店" }, { key: "restaurant", label: "餐厅" }, { key: "visited", label: "已到访" }, { key: "wishlist", label: "想去" }];

Page({
  data: { filters: FILTERS, activeFilter: "all", allPoints: [], visiblePoints: [], missing: [], markers: [], selected: null, latitude: 31.2304, longitude: 121.4737, scale: 4 },
  onShow() { this.refresh(); },
  refresh() { const data = buildTravelMapData(getPlaces(), getRecords(), getWishlist()); this.setData({ allPoints: data.located, missing: data.missing }, () => this.applyFilter()); },
  applyFilter() { const visiblePoints = filterMapPoints(this.data.allPoints, this.data.activeFilter); const markers = toMarkers(visiblePoints); const updates = { visiblePoints, markers, selected: null }; if (visiblePoints.length) { updates.latitude = visiblePoints.reduce((sum, point) => sum + point.latitude, 0) / visiblePoints.length; updates.longitude = visiblePoints.reduce((sum, point) => sum + point.longitude, 0) / visiblePoints.length; } this.setData(updates, () => { if (visiblePoints.length && wx.createMapContext) wx.createMapContext("travelMap", this).includePoints({ points: visiblePoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude })), padding: [60, 40, 60, 40] }); }); },
  onFilter(event) { this.setData({ activeFilter: event.currentTarget.dataset.value }, () => this.applyFilter()); },
  onMarkerTap(event) { const marker = this.data.markers.find((item) => item.id === Number(event.detail.markerId)); const selected = marker && this.data.visiblePoints.find((point) => point.key === marker.pointKey); this.setData({ selected: selected || null }); },
  goSelected() { const item = this.data.selected; if (!item) return; wx.navigateTo({ url: item.entityType === "wishlist" ? `/pages/wishlist/edit?id=${item.entityId}` : `/pages/place/detail?id=${item.entityId}` }); },
  goMissing(event) { const type = event.currentTarget.dataset.type; const id = event.currentTarget.dataset.id; wx.navigateTo({ url: type === "wishlist" ? `/pages/wishlist/edit?id=${id}` : `/pages/place/detail?id=${id}` }); }
});
