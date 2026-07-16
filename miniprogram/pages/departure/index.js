const departureStore = require("../../utils/repositories/departureRepository");
const tripStore = require("../../utils/repositories/tripRepository");

Page({
  data: {
    activeTab: "bookings",
    statusFilter: "upcoming",
    bookings: [],
    visibleBookings: [],
    overview: { upcomingCount: 0, urgentCount: 0, completedCount: 0, nextBooking: null, checklist: { total: 0, completed: 0, percent: 0 } },
    trips: [],
    tripOptions: [{ id: "general", title: "通用清单" }],
    selectedTripId: "general",
    selectedTripIndex: 0,
    checklistItems: [],
    checklistSummary: { total: 0, completed: 0, remaining: 0, percent: 0 },
    newTaskTitle: "",
    newTaskOwner: ""
  },

  onLoad(options = {}) {
    this.requestedTripId = String(options.tripId || "");
    if (options.tab === "checklist") this.setData({ activeTab: "checklist" });
  },

  onShow() { this.refresh(); },

  refresh() {
    const trips = tripStore.getTrips().filter((trip) => trip.status !== "archived");
    const tripOptions = [{ id: "general", title: "通用清单" }].concat(trips.map((trip) => ({ id: trip.id, title: trip.title })));
    let selectedTripId = this.requestedTripId || this.data.selectedTripId || "general";
    if (!tripOptions.some((item) => item.id === selectedTripId)) selectedTripId = tripOptions[0].id;
    this.requestedTripId = "";
    const selectedTripIndex = Math.max(0, tripOptions.findIndex((item) => item.id === selectedTripId));
    const bookings = departureStore.getBookings().map((booking) => {
      const view = departureStore.getBookingView(booking);
      const trip = trips.find((item) => item.id === booking.tripId);
      return { ...view, tripTitle: trip ? trip.title : "" };
    });
    const allChecklistItems = departureStore.getChecklistItems();
    const checklistItems = allChecklistItems.filter((item) => item.tripId === selectedTripId);
    this.setData({
      trips,
      tripOptions,
      selectedTripId,
      selectedTripIndex,
      bookings,
      overview: departureStore.getDepartureOverview(bookings, allChecklistItems),
      checklistItems,
      checklistSummary: departureStore.getChecklistSummary(checklistItems)
    });
    this.refreshVisibleBookings();
  },

  refreshVisibleBookings() {
    const filter = this.data.statusFilter;
    this.setData({ visibleBookings: this.data.bookings.filter((item) => filter === "all" || item.status === filter) });
  },

  changeTab(event) { this.setData({ activeTab: event.currentTarget.dataset.tab }); },

  filterStatus(event) {
    this.setData({ statusFilter: event.currentTarget.dataset.status });
    this.refreshVisibleBookings();
  },

  createBooking() { wx.navigateTo({ url: "/pages/departure/edit" }); },
  openBooking(event) { wx.navigateTo({ url: `/pages/departure/edit?id=${event.currentTarget.dataset.id}` }); },

  onTripChange(event) {
    const selectedTripIndex = Number(event.detail.value || 0);
    const selected = this.data.tripOptions[selectedTripIndex] || this.data.tripOptions[0];
    const checklistItems = departureStore.getChecklistItems({ tripId: selected.id });
    this.setData({
      selectedTripIndex,
      selectedTripId: selected.id,
      checklistItems,
      checklistSummary: departureStore.getChecklistSummary(checklistItems)
    });
  },

  seedChecklist() {
    departureStore.seedChecklist(this.data.selectedTripId);
    this.refresh();
    wx.showToast({ title: "清单已补齐", icon: "success" });
  },

  onTaskInput(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },

  addTask() {
    try {
      departureStore.addChecklistItem({ tripId: this.data.selectedTripId, title: this.data.newTaskTitle, owner: this.data.newTaskOwner, category: "自定义" });
      this.setData({ newTaskTitle: "", newTaskOwner: "" });
      this.refresh();
    } catch (error) { wx.showToast({ title: error.message || "无法添加", icon: "none" }); }
  },

  toggleTask(event) {
    departureStore.toggleChecklistItem(event.currentTarget.dataset.id);
    this.refresh();
  },

  taskActions(event) {
    const id = event.currentTarget.dataset.id;
    const task = this.data.checklistItems.find((item) => item.id === id);
    if (!task) return;
    wx.showActionSheet({
      itemList: ["编辑内容", "修改负责人", "删除任务"],
      success: (result) => {
        if (result.tapIndex === 2) return this.removeTask(id);
        const field = result.tapIndex === 1 ? "owner" : "title";
        wx.showModal({
          title: field === "owner" ? "修改负责人" : "编辑任务",
          editable: true,
          placeholderText: task[field] || (field === "owner" ? "可留空" : "任务内容"),
          success: (modalResult) => {
            if (!modalResult.confirm) return;
            try { departureStore.updateChecklistItem(id, { [field]: modalResult.content }); this.refresh(); }
            catch (error) { wx.showToast({ title: error.message, icon: "none" }); }
          }
        });
      }
    });
  },

  removeTask(id) {
    wx.showModal({
      title: "删除任务？",
      content: "删除后不会影响预订或行程。",
      confirmText: "删除",
      confirmColor: "#a34b32",
      success: (result) => { if (result.confirm) { departureStore.deleteChecklistItem(id); this.refresh(); } }
    });
  }
});
