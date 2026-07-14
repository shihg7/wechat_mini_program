const departureStore = require("../../utils/departureStore");
const tripStore = require("../../utils/tripStore");
const wishlistRepository = require("../../utils/repositories/wishlistRepository");
const ledgerRepository = require("../../utils/repositories/ledgerRepository");

function amountInput(cents) {
  const value = Number(cents || 0);
  if (!value) return "";
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

function emptyForm() {
  return {
    type: "hotel",
    name: "",
    city: "",
    address: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    peopleCount: 1,
    amountText: "",
    paymentStatus: "unpaid",
    bookingReference: "",
    cancellationDate: "",
    cancellationTime: "",
    contact: "",
    note: "",
    status: "upcoming",
    tripId: "",
    wishlistId: "",
    placeId: "",
    itineraryItemId: "",
    budgetExpenseId: "",
    ledgerId: "",
    ledgerExpenseId: "",
    recordId: ""
  };
}

function editableForm(booking) {
  return {
    ...booking,
    amountText: amountInput(booking.amountCents)
  };
}

function getTripItem(trip, itemId) {
  return trip && (trip.itineraryItems || []).find((item) => item.id === String(itemId || ""));
}

Page({
  data: {
    mode: "create",
    bookingId: "",
    readonly: false,
    missing: false,
    dirty: false,
    form: emptyForm(),
    bookingView: null,
    bookingTypes: departureStore.BOOKING_TYPES,
    paymentStatuses: departureStore.PAYMENT_STATUSES,
    bookingStatuses: departureStore.BOOKING_STATUSES,
    trips: [],
    ledgers: [],
    tripTitle: "",
    ledgerTitle: "",
    wishlistName: "",
    canCreateReview: true
  },

  onLoad(options = {}) {
    this.pendingWishlistId = String(options.wishlistId || "");
    this.pendingTripId = String(options.tripId || "");
    this.refreshLinks();
    if (options.id) this.loadBooking(options.id);
    else this.prepareCreate();
  },

  onShow() {
    this.refreshLinks();
    if (this.data.mode === "detail" && this.data.bookingId) this.loadBooking(this.data.bookingId);
  },

  onUnload() { this.setLeaveAlert(false); },

  refreshLinks() {
    this.setData({
      trips: tripStore.getTrips().filter((trip) => trip.status !== "archived"),
      ledgers: ledgerRepository.getLedgers ? ledgerRepository.getLedgers() : []
    });
  },

  prepareCreate() {
    let form = emptyForm();
    if (this.pendingTripId) form.tripId = this.pendingTripId;
    if (this.pendingWishlistId) {
      const item = wishlistRepository.getWishlistItem(this.pendingWishlistId);
      if (item) {
        form = {
          ...form,
          type: item.type,
          name: item.name,
          city: item.city,
          address: item.address,
          startDate: item.targetDate,
          amountText: String(item.budgetText || "").replace(/[¥￥,，\s]/g, ""),
          bookingReference: item.bookingReference,
          tripId: item.tripId || form.tripId,
          wishlistId: item.id,
          placeId: item.placeId,
          itineraryItemId: item.itineraryItemId,
          note: item.note
        };
      }
    }
    this.setData({ mode: "create", readonly: false, form, dirty: false });
    this.updateLinkedLabels(form);
    this.setLeaveAlert(false);
  },

  loadBooking(id) {
    const booking = departureStore.getBookingById(id);
    if (!booking) {
      this.setData({ missing: true, bookingView: null });
      wx.showToast({ title: "预订不存在", icon: "none" });
      return;
    }
    const form = editableForm(booking);
    this.setData({
      mode: "detail",
      bookingId: booking.id,
      readonly: true,
      missing: false,
      dirty: false,
      form,
      bookingView: departureStore.getBookingView(booking),
      canCreateReview: booking.type === "hotel" || booking.type === "restaurant"
    });
    this.updateLinkedLabels(form);
    this.setLeaveAlert(false);
  },

  updateLinkedLabels(form = this.data.form) {
    const trip = this.data.trips.find((item) => item.id === form.tripId);
    const ledger = this.data.ledgers.find((item) => item.id === form.ledgerId);
    const wishlist = form.wishlistId ? wishlistRepository.getWishlistItem(form.wishlistId) : null;
    this.setData({
      tripTitle: trip ? trip.title : "",
      ledgerTitle: ledger ? ledger.title : "",
      wishlistName: wishlist ? wishlist.name : ""
    });
  },

  setLeaveAlert(enabled) {
    if (enabled && wx.enableAlertBeforeUnload) wx.enableAlertBeforeUnload({ message: "预订内容尚未保存，确定离开吗？" });
    if (!enabled && wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
  },

  markDirty(patch) {
    this.setData({ ...patch, dirty: true });
    this.setLeaveAlert(true);
  },

  edit() {
    this.setData({ mode: "edit", readonly: false, dirty: false });
    this.setLeaveAlert(false);
  },

  goBack() { wx.navigateBack(); },

  onInput(event) {
    this.markDirty({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value });
  },

  onTypeTap(event) {
    if (this.data.readonly) return;
    this.markDirty({ "form.type": event.currentTarget.dataset.value });
  },

  onOptionTap(event) {
    if (this.data.readonly) return;
    const field = event.currentTarget.dataset.field;
    this.markDirty({ [`form.${field}`]: event.currentTarget.dataset.value });
  },

  onDateChange(event) { this.markDirty({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },
  onTimeChange(event) { this.markDirty({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value }); },

  onPeopleChange(event) {
    const value = Math.max(1, Math.min(99, Number(event.detail.value || 1)));
    this.markDirty({ "form.peopleCount": value });
  },

  save() {
    const cents = departureStore.parseMoneyToCents(this.data.form.amountText);
    if (Number.isNaN(cents)) return wx.showToast({ title: "金额最多保留两位小数", icon: "none" });
    try {
      const payload = { ...this.data.form, amountCents: cents };
      const booking = this.data.mode === "edit"
        ? departureStore.updateBooking(this.data.bookingId, payload)
        : departureStore.addBooking(payload);
      if (booking.wishlistId) {
        wishlistRepository.updateWishlistItem(booking.wishlistId, {
          status: "booked",
          bookingId: booking.id,
          bookingReference: booking.bookingReference,
          targetDate: booking.startDate,
          tripId: booking.tripId,
          itineraryItemId: booking.itineraryItemId
        });
      }
      this.setLeaveAlert(false);
      this.loadBooking(booking.id);
      wx.showToast({ title: "预订已保存", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }
  },

  openTrip() {
    if (!this.data.form.tripId) return this.addToTrip();
    wx.navigateTo({ url: `/pages/trip/detail?id=${this.data.form.tripId}` });
  },

  addToTrip() {
    const choices = this.data.trips.filter((trip) => trip.status !== "ended" && trip.status !== "archived");
    if (!choices.length) return wx.showToast({ title: "请先创建行程", icon: "none" });
    wx.showActionSheet({
      itemList: choices.map((trip) => trip.title),
      success: (result) => {
        const trip = choices[result.tapIndex];
        if (!trip) return;
        const current = departureStore.getBookingById(this.data.bookingId);
        const linkedTrip = current && tripStore.getTripById(current.tripId);
        if (linkedTrip && getTripItem(linkedTrip, current.itineraryItemId)) {
          return wx.navigateTo({ url: `/pages/trip/detail?id=${linkedTrip.id}` });
        }
        const type = current.type === "ticket" ? "attraction" : (tripStore.ITEM_TYPES.indexOf(current.type) >= 0 ? current.type : "custom");
        const date = current.startDate >= trip.startDate && current.startDate <= trip.endDate ? current.startDate : trip.startDate;
        const updatedTrip = tripStore.addItineraryItem(trip.id, {
          type,
          title: current.name,
          date,
          startTime: current.startTime,
          endTime: current.endTime,
          city: current.city,
          placeId: current.placeId,
          wishlistId: current.wishlistId,
          bookingId: current.id,
          bookingStatus: "booked",
          estimatedCents: current.amountCents,
          note: current.bookingReference ? `预订编号：${current.bookingReference}` : current.note
        });
        const itineraryItem = updatedTrip.itineraryItems[updatedTrip.itineraryItems.length - 1];
        const booking = departureStore.updateBooking(current.id, { tripId: trip.id, itineraryItemId: itineraryItem.id });
        if (booking.wishlistId) wishlistRepository.updateWishlistItem(booking.wishlistId, { status: "booked", bookingId: booking.id, tripId: trip.id, itineraryItemId: itineraryItem.id });
        this.loadBooking(booking.id);
        wx.showToast({ title: "已加入行程", icon: "success" });
      }
    });
  },

  addToBudget() {
    const booking = departureStore.getBookingById(this.data.bookingId);
    const trip = booking && tripStore.getTripById(booking.tripId);
    if (!trip) return wx.showToast({ title: "请先加入行程", icon: "none" });
    if (!(booking.amountCents > 0)) return wx.showToast({ title: "先补充预订金额", icon: "none" });
    if (booking.budgetExpenseId && (trip.personalExpenses || []).some((item) => item.id === booking.budgetExpenseId)) {
      return wx.navigateTo({ url: `/pages/trip/budget?id=${trip.id}` });
    }
    wx.showModal({
      title: "计入行程预算？",
      content: `${booking.name} · ${booking.amountText}`,
      confirmText: "计入预算",
      success: (result) => {
        if (!result.confirm) return;
        const updatedTrip = tripStore.addPersonalExpense(trip.id, {
          title: booking.name,
          originalAmountCents: booking.amountCents,
          category: booking.category,
          date: booking.startDate,
          currency: trip.baseCurrency,
          rate: 1,
          note: booking.bookingReference ? `预订编号：${booking.bookingReference}` : booking.note,
          bookingId: booking.id
        });
        const expense = updatedTrip.personalExpenses[updatedTrip.personalExpenses.length - 1];
        departureStore.updateBooking(booking.id, { budgetExpenseId: expense.id });
        this.loadBooking(booking.id);
        wx.showToast({ title: "已计入预算", icon: "success" });
      }
    });
  },

  addToLedger() {
    const choices = this.data.ledgers;
    if (!choices.length) return wx.showToast({ title: "请先创建 AA 账本", icon: "none" });
    const booking = departureStore.getBookingById(this.data.bookingId);
    const linkedLedger = choices.find((ledger) => ledger.id === booking.ledgerId);
    if (linkedLedger) return wx.navigateTo({ url: `/pages/ledger/detail/detail?id=${linkedLedger.id}&bookingId=${booking.id}` });
    if (booking.ledgerId) departureStore.updateBooking(booking.id, { ledgerId: "", ledgerExpenseId: "" });
    wx.showActionSheet({
      itemList: choices.map((ledger) => ledger.title || "未命名账本"),
      success: (result) => {
        const ledger = choices[result.tapIndex];
        if (!ledger) return;
        departureStore.updateBooking(booking.id, { ledgerId: ledger.id });
        this.loadBooking(booking.id);
        wx.navigateTo({ url: `/pages/ledger/detail/detail?id=${ledger.id}&bookingId=${booking.id}` });
      }
    });
  },

  recordVisit() {
    const booking = departureStore.getBookingById(this.data.bookingId);
    if (!booking || !this.data.canCreateReview) return;
    if (booking.recordId) return wx.navigateTo({ url: `/pages/record/record?id=${booking.recordId}` });
    wx.navigateTo({ url: `/pages/record/record?type=${booking.type}&bookingId=${booking.id}` });
  },

  remove() {
    wx.showModal({
      title: "删除预订？",
      content: "不会删除已经关联的行程、预算或 AA 支出。",
      confirmText: "删除",
      confirmColor: "#a34b32",
      success: (result) => {
        if (!result.confirm) return;
        this.setLeaveAlert(false);
        departureStore.deleteBooking(this.data.bookingId);
        wx.navigateBack();
      }
    });
  }
});
