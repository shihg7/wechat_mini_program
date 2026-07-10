const {
  getCityStats,
  getRecords,
  getSummary,
  getTagStats,
  getTimelineGroups,
  searchAndSortRecords
} = require("../../utils/hotelReviewStore");
const { getLedgerListItems } = require("../../utils/tripLedgerStore");
const { findPlaceSuggestions, getPlaceStats, getPlaces } = require("../../utils/placeStore");

const SORT_OPTIONS = [
  { label: "最近创建", value: "created_desc" },
  { label: "日期最新", value: "stay_desc" },
  { label: "评分最高", value: "score_desc" },
  { label: "评分最低", value: "score_asc" }
];

const VIEW_TABS = [
  { key: "records", label: "记录" },
  { key: "places", label: "地点" },
  { key: "timeline", label: "时间线" },
  { key: "cities", label: "城市" },
  { key: "tags", label: "标签" }
];

Page({
  data: {
    records: [],
    visibleRecords: [],
    timelineGroups: [],
    cityStats: [],
    tagStats: [],
    placeCards: [],
    selectedCity: "",
    cityRecords: [],
    keyword: "",
    activeView: "records",
    viewTabs: VIEW_TABS,
    activeType: "all",
    activeStatus: "all",
    activeTag: "",
    sortOptions: SORT_OPTIONS,
    sortLabels: SORT_OPTIONS.map((item) => item.label),
    sortMode: "created_desc",
    sortLabel: SORT_OPTIONS[0].label,
    hasActiveFilters: false,
    filterSummary: "",
    recentRecord: null,
    recentDraft: null,
    recentLedger: null,
    summary: {
      total: 0,
      hotelTotal: 0,
      restaurantTotal: 0,
      draftTotal: 0,
      publicTotal: 0,
      cityTotal: 0,
      averageScore: 0
    }
  },

  onShow() {
    this.refreshRecords();
  },

  refreshRecords() {
    getPlaces();
    const records = getRecords();
    const ledgers = getLedgerListItems();
    this.setData({
      records,
      summary: getSummary(records),
      recentRecord: records.find((record) => record.status !== "draft") || null,
      recentDraft: records.find((record) => record.status === "draft") || null,
      recentLedger: ledgers[0] || null
    });
    this.refreshVisibleRecords();
  },

  getVisibleRecords(records = this.data.records) {
    return searchAndSortRecords(records, {
      keyword: this.data.keyword,
      activeType: this.data.activeType,
      activeStatus: this.data.activeStatus,
      activeTag: this.data.activeTag,
      sortMode: this.data.sortMode
    });
  },

  getCityRecords(records, city) {
    return records.filter((record) => (record.city || "未填写城市") === city);
  },

  getFilterState() {
    const labels = [];
    const keyword = String(this.data.keyword || "").trim();
    if (keyword) labels.push(`搜索“${keyword}”`);
    if (this.data.activeType === "hotel") labels.push("酒店");
    if (this.data.activeType === "restaurant") labels.push("餐厅");
    if (this.data.activeStatus === "draft") labels.push("草稿");
    if (this.data.activeStatus === "completed") labels.push("已完成");
    if (this.data.activeTag) labels.push(`标签“${this.data.activeTag}”`);
    return {
      hasActiveFilters: labels.length > 0,
      filterSummary: labels.join(" · ")
    };
  },

  refreshVisibleRecords() {
    const visibleRecords = this.getVisibleRecords();
    const visibleIds = visibleRecords.reduce((map, record) => { map[record.placeId] = true; return map; }, {});
    const keyword = String(this.data.keyword || "").trim().toLowerCase();
    const hasRecordOnlyFilter = this.data.activeStatus !== "all" || !!this.data.activeTag;
    const placeCards = getPlaces().filter((place) => {
      if (this.data.activeType !== "all" && place.type !== this.data.activeType) return false;
      if (hasRecordOnlyFilter && !visibleIds[place.id]) return false;
      if (!keyword) return true;
      const placeText = [place.name, place.city, place.area, place.address].concat(place.aliases || []).join(" ").toLowerCase();
      return placeText.indexOf(keyword) >= 0 || !!visibleIds[place.id];
    }).map((place) => {
      const stats = getPlaceStats(place.id, this.data.records);
      return {
        ...place,
        ...stats,
        hasPossibleDuplicate: findPlaceSuggestions({ type: place.type, name: place.name, city: place.city }).some((item) => item.id !== place.id)
      };
    }).sort((a, b) => String(b.latestVisit && (b.latestVisit.stayDate || b.latestVisit.createdAt) || "").localeCompare(String(a.latestVisit && (a.latestVisit.stayDate || a.latestVisit.createdAt) || "")));
    const cityStats = getCityStats(visibleRecords);
    const selectedCity = this.data.selectedCity
      && cityStats.some((item) => item.city === this.data.selectedCity)
      ? this.data.selectedCity
      : "";
    this.setData({
      visibleRecords,
      timelineGroups: getTimelineGroups(visibleRecords),
      cityStats,
      tagStats: getTagStats(visibleRecords),
      placeCards,
      selectedCity,
      cityRecords: selectedCity ? this.getCityRecords(visibleRecords, selectedCity) : [],
      ...this.getFilterState()
    });
  },

  onViewChange(event) {
    this.setData({ activeView: event.currentTarget.dataset.view });
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
    this.refreshVisibleRecords();
  },

  onTypeFilter(event) {
    this.setData({ activeType: event.currentTarget.dataset.type });
    this.refreshVisibleRecords();
  },

  onStatusFilter(event) {
    const status = event.currentTarget.dataset.status;
    this.setData({ activeStatus: this.data.activeStatus === status ? "all" : status });
    this.refreshVisibleRecords();
  },

  onTagFilter(event) {
    const tag = event.currentTarget.dataset.tag || "";
    this.setData({
      activeTag: this.data.activeTag === tag ? "" : tag,
      activeView: "records"
    });
    this.refreshVisibleRecords();
  },

  clearFilters() {
    this.setData({
      keyword: "",
      activeType: "all",
      activeStatus: "all",
      activeTag: "",
      selectedCity: ""
    });
    this.refreshVisibleRecords();
  },

  onSortChange(event) {
    const index = Number(event.detail.value || 0);
    const option = this.data.sortOptions[index] || this.data.sortOptions[0];
    this.setData({ sortMode: option.value, sortLabel: option.label });
    this.refreshVisibleRecords();
  },

  goCreate(event) {
    const type = event.currentTarget.dataset.type || "hotel";
    wx.navigateTo({ url: `/pages/record/record?type=${type}` });
  },

  goQuickCreate() {
    wx.showActionSheet({
      itemList: ["快速记录酒店", "快速记录餐厅"],
      success: (res) => {
        const type = res.tapIndex === 1 ? "restaurant" : "hotel";
        wx.navigateTo({ url: `/pages/record/record?type=${type}&quick=1` });
      }
    });
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pages/record/record?id=${event.currentTarget.dataset.id}` });
  },

  goPlace(event) {
    wx.navigateTo({ url: `/pages/place/detail?id=${event.currentTarget.dataset.id}` });
  },

  goLedgers() {
    wx.switchTab({ url: "/pages/ledger/index/index" });
  },

  goLedgerDetail(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) {
      this.goLedgers();
      return;
    }
    wx.navigateTo({ url: `/pages/ledger/detail/detail?id=${id}` });
  },

  goDataManagement() {
    wx.navigateTo({ url: "/pages/data/index" });
  },

  selectCity(event) {
    const city = event.currentTarget.dataset.city || "";
    const selectedCity = this.data.selectedCity === city ? "" : city;
    this.setData({
      selectedCity,
      cityRecords: selectedCity ? this.getCityRecords(this.data.visibleRecords, selectedCity) : []
    });
  }
});
