const tripStore = require("../../utils/tripStore");
const GROUPS = [{ key: "active", label: "进行中" }, { key: "upcoming", label: "即将开始" }, { key: "ended", label: "已结束" }, { key: "archived", label: "已归档" }];

Page({
  data: { trips: [], groups: [], allTripCount: 0, keyword: "", activeStatus: "all", hasActiveFilters: false, statuses: [{ key: "all", label: "全部" }].concat(GROUPS) },
  onShow() { this.load(); },
  load() {
    const keyword = this.data.keyword.trim().toLowerCase();
    const source = tripStore.getTrips();
    const trips = source.filter((trip) => (this.data.activeStatus === "all" || trip.status === this.data.activeStatus) && (!keyword || [trip.title, trip.cities.join("、"), trip.note].join(" ").toLowerCase().indexOf(keyword) >= 0));
    const groups = GROUPS.map((group) => ({ ...group, items: trips.filter((trip) => trip.status === group.key).map((trip) => { const planCount = trip.itineraryItems.length; const doneCount = trip.itineraryItems.filter((item) => item.bookingStatus === "visited" || item.bookingStatus === "completed").length; return { ...trip, statusLabel: group.label, dateText: `${trip.startDate} 至 ${trip.endDate}`, cityText: trip.cities.join("、") || "目的地待定", planCount, progressText: planCount ? `${doneCount}/${planCount} 已完成` : "等待安排行程", budgetText: trip.budgetTotalCents ? tripStore.money(trip.budgetTotalCents) : "未设预算" }; }) })).filter((group) => group.items.length);
    this.setData({ trips, groups, allTripCount: source.length, hasActiveFilters: !!keyword || this.data.activeStatus !== "all" });
  },
  search(event) { this.setData({ keyword: event.detail.value }, () => this.load()); },
  filterStatus(event) { this.setData({ activeStatus: event.currentTarget.dataset.status }, () => this.load()); },
  clearFilters() { this.setData({ keyword: "", activeStatus: "all" }, () => this.load()); },
  createTrip() { wx.navigateTo({ url: "/pages/trip/edit" }); },
  openTrip(event) { wx.navigateTo({ url: `/pages/trip/detail?id=${event.currentTarget.dataset.id}` }); }
});
