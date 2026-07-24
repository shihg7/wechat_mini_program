const dateCalculator = require("../utils/dateCalculator");

const MODES = [
  { id: "interval", label: "日期间隔" },
  { id: "offset", label: "日期推算" },
  { id: "countdown", label: "倒数日" }
];

Page({
  data: {
    countdown: {},
    countdownCopy: "",
    countdownTarget: "",
    endDate: "",
    interval: {},
    intervalCopy: "",
    mode: "interval",
    modes: MODES,
    offsetAmount: "7",
    offsetBase: "",
    offsetCopy: "",
    offsetDirection: "after",
    offsetResult: "",
    offsetUnit: "natural",
    startDate: "",
    today: ""
  },

  onLoad() {
    const today = dateCalculator.getLocalToday();
    this.setData({
      countdownTarget: dateCalculator.addNaturalDays(today, 30),
      endDate: dateCalculator.addNaturalDays(today, 7),
      offsetBase: today,
      startDate: today,
      today
    });
    this.refreshAll();
  },

  switchMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode });
  },

  onStartDateChange(event) {
    this.setData({ startDate: event.detail.value });
    this.refreshInterval();
  },

  onEndDateChange(event) {
    this.setData({ endDate: event.detail.value });
    this.refreshInterval();
  },

  swapIntervalDates() {
    this.setData({
      endDate: this.data.startDate,
      startDate: this.data.endDate
    });
    this.refreshInterval();
  },

  onOffsetBaseChange(event) {
    this.setData({ offsetBase: event.detail.value });
    this.refreshOffset();
  },

  onOffsetAmountInput(event) {
    const value = String(event.detail.value || "").replace(/[^\d]/g, "").slice(0, 5);
    this.setData({ offsetAmount: value });
    this.refreshOffset();
  },

  setOffsetDirection(event) {
    this.setData({ offsetDirection: event.currentTarget.dataset.direction });
    this.refreshOffset();
  },

  setOffsetUnit(event) {
    this.setData({ offsetUnit: event.currentTarget.dataset.unit });
    this.refreshOffset();
  },

  onCountdownTargetChange(event) {
    this.setData({ countdownTarget: event.detail.value });
    this.refreshCountdown();
  },

  refreshAll() {
    this.refreshInterval();
    this.refreshOffset();
    this.refreshCountdown();
  },

  refreshInterval() {
    try {
      const interval = dateCalculator.getInterval(this.data.startDate, this.data.endDate);
      this.setData({
        interval,
        intervalCopy: dateCalculator.buildIntervalCopy(this.data.startDate, this.data.endDate, interval)
      });
    } catch (error) {
      this.setData({ interval: {}, intervalCopy: "" });
    }
  },

  refreshOffset() {
    const amount = Number(this.data.offsetAmount);
    if (!this.data.offsetAmount || !Number.isInteger(amount)) {
      this.setData({ offsetCopy: "", offsetResult: "" });
      return;
    }
    const signedAmount = this.data.offsetDirection === "before" ? -amount : amount;
    try {
      const offsetResult = this.data.offsetUnit === "workday"
        ? dateCalculator.addWorkdays(this.data.offsetBase, signedAmount)
        : dateCalculator.addNaturalDays(this.data.offsetBase, signedAmount);
      this.setData({
        offsetCopy: dateCalculator.buildOffsetCopy(
          this.data.offsetBase,
          signedAmount,
          this.data.offsetUnit,
          offsetResult
        ),
        offsetResult
      });
    } catch (error) {
      this.setData({ offsetCopy: "", offsetResult: "" });
    }
  },

  refreshCountdown() {
    try {
      const countdown = dateCalculator.getCountdown(this.data.countdownTarget, this.data.today);
      this.setData({
        countdown,
        countdownCopy: dateCalculator.buildCountdownCopy(
          this.data.countdownTarget,
          this.data.today,
          countdown
        )
      });
    } catch (error) {
      this.setData({ countdown: {}, countdownCopy: "" });
    }
  },

  copyResult() {
    const copyMap = {
      countdown: this.data.countdownCopy,
      interval: this.data.intervalCopy,
      offset: this.data.offsetCopy
    };
    const data = copyMap[this.data.mode];
    if (!data) {
      wx.showToast({ icon: "none", title: "暂无可复制结果" });
      return;
    }
    wx.setClipboardData({ data });
  }
});
