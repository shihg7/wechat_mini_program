const { getRecords } = require("../../utils/hotelReviewStore");
const { buildTravelInsights, getAvailableYears } = require("../../utils/travelInsights");

const YEAR_LABEL = (year) => year === "all" ? "全部年份" : `${year} 年`;

Page({
  data: { records: [], years: ["all"], yearLabels: ["全部年份"], yearIndex: 0, selectedYear: "all", insights: null },
  onShow() { this.refresh(); },
  refresh() {
    const records = getRecords();
    const years = getAvailableYears(records);
    const selectedYear = years.indexOf(this.data.selectedYear) >= 0 ? this.data.selectedYear : "all";
    this.setData({ records, years, yearLabels: years.map(YEAR_LABEL), yearIndex: years.indexOf(selectedYear), selectedYear, insights: buildTravelInsights(records, selectedYear) });
  },
  onYearChange(event) {
    const yearIndex = Number(event.detail.value || 0);
    const selectedYear = this.data.years[yearIndex] || "all";
    this.setData({ yearIndex, selectedYear, insights: buildTravelInsights(this.data.records, selectedYear) });
  },
  goRecord(event) {
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/record/record?id=${id}` });
  },
  goPlace(event) {
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/place/detail?id=${id}` });
  }
});
