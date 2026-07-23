const tripStore = require("../../utils/tripStore");

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function phaseFor(trip, today) {
  if (trip.endDate < today) return { label: "已结束", tone: "past" };
  if (trip.startDate <= today) return { label: "进行中", tone: "current" };
  return { label: "待出发", tone: "future" };
}

function searchText(trip) {
  const itemText = trip.items.map((item) => [item.title, item.location, item.note].join(" ")).join(" ");
  return [trip.title, trip.destination, trip.note, itemText].join(" ").toLowerCase();
}

Page({
  data: {
    trips: [],
    allTripCount: 0,
    keyword: "",
    hasActiveSearch: false
  },

  onShow() {
    this.load();
  },

  load() {
    const keyword = this.data.keyword.trim().toLowerCase();
    const today = localDate();
    const source = tripStore.getTrips();
    const trips = source
      .filter((trip) => !keyword || searchText(trip).indexOf(keyword) >= 0)
      .map((trip) => {
        const phase = phaseFor(trip, today);
        return {
          ...trip,
          dateText: `${trip.startDate} 至 ${trip.endDate}`,
          destinationText: trip.destination || "目的地待定",
          dayCount: tripStore.dateRange(trip.startDate, trip.endDate).length,
          itemCount: trip.items.length,
          phaseLabel: phase.label,
          phaseTone: phase.tone
        };
      });
    this.setData({
      trips,
      allTripCount: source.length,
      hasActiveSearch: !!keyword
    });
  },

  search(event) {
    this.setData({ keyword: event.detail.value }, () => this.load());
  },

  clearSearch() {
    this.setData({ keyword: "" }, () => this.load());
  },

  createTrip() {
    wx.navigateTo({ url: "/pages/trip/edit" });
  },

  openTrip(event) {
    wx.navigateTo({ url: `/pages/trip/detail?id=${event.currentTarget.dataset.id}` });
  }
});
