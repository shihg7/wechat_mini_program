const checklistStore = require("../../utils/checklistStore");

const EMPTY_PROGRESS = { total: 0, completed: 0, remaining: 0, percent: 0 };

Page({
  data: {
    checklists: [],
    checklistTitles: [],
    checklistIndex: 0,
    checklist: null,
    progress: EMPTY_PROGRESS,
    newItemText: ""
  },

  onLoad(options = {}) {
    this.loadChecklists(options.id);
  },

  loadChecklists(preferredId) {
    const checklists = checklistStore.getChecklists();
    let checklistIndex = checklists.findIndex((item) => item.id === String(preferredId || ""));
    if (checklistIndex < 0) checklistIndex = 0;
    const source = checklists[checklistIndex] || null;
    const checklist = source ? {
      ...source,
      templateLabel: source.templateKey === "travel" ? "旅行模板" : "空白清单",
      items: source.items.map((item, index) => ({
        ...item,
        canMoveUp: index > 0,
        canMoveDown: index < source.items.length - 1
      }))
    } : null;
    this.setData({
      checklists,
      checklistTitles: checklists.map((item) => item.title),
      checklistIndex,
      checklist,
      progress: checklist ? checklistStore.getProgress(checklist) : EMPTY_PROGRESS
    });
  },

  onChecklistChange(event) {
    const index = Number(event.detail.value || 0);
    const checklist = this.data.checklists[index];
    if (checklist) this.loadChecklists(checklist.id);
  },

  chooseTemplate() {
    wx.showActionSheet({
      itemList: ["空白清单", "旅行打包清单"],
      success: (result) => this.promptCreate(result.tapIndex === 1 ? "travel" : "blank")
    });
  },

  createBlank() {
    this.promptCreate("blank");
  },

  createTravel() {
    this.promptCreate("travel");
  },

  promptCreate(templateKey) {
    const template = checklistStore.getTemplate(templateKey);
    wx.showModal({
      title: template.key === "travel" ? "新建旅行打包清单" : "新建空白清单",
      editable: true,
      placeholderText: template.defaultTitle,
      confirmText: "创建",
      success: (result) => {
        if (!result.confirm) return;
        const checklist = checklistStore.createChecklist({
          title: result.content || template.defaultTitle,
          templateKey: template.key
        });
        this.setData({ newItemText: "" });
        this.loadChecklists(checklist.id);
      }
    });
  },

  renameChecklist() {
    if (!this.data.checklist) return;
    wx.showModal({
      title: "重命名清单",
      editable: true,
      placeholderText: this.data.checklist.title,
      confirmText: "保存",
      success: (result) => {
        if (!result.confirm) return;
        try {
          checklistStore.renameChecklist(
            this.data.checklist.id,
            result.content || this.data.checklist.title
          );
          this.loadChecklists(this.data.checklist.id);
        } catch (error) {
          wx.showToast({ title: error.message, icon: "none" });
        }
      }
    });
  },

  deleteChecklist() {
    if (!this.data.checklist) return;
    const checklistId = this.data.checklist.id;
    wx.showModal({
      title: "删除这个清单？",
      content: "清单和其中的项目将一起删除，且无法恢复。",
      confirmText: "删除",
      confirmColor: "#a34b32",
      success: (result) => {
        if (!result.confirm) return;
        checklistStore.deleteChecklist(checklistId);
        this.setData({ newItemText: "" });
        this.loadChecklists();
        wx.showToast({ title: "已删除", icon: "success" });
      }
    });
  },

  onNewItemInput(event) {
    this.setData({ newItemText: event.detail.value });
  },

  addItem() {
    if (!this.data.checklist) return;
    try {
      checklistStore.addItem(this.data.checklist.id, this.data.newItemText);
      this.setData({ newItemText: "" });
      this.loadChecklists(this.data.checklist.id);
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  toggleItem(event) {
    if (!this.data.checklist) return;
    checklistStore.toggleItem(this.data.checklist.id, event.currentTarget.dataset.id);
    this.loadChecklists(this.data.checklist.id);
  },

  editItem(event) {
    if (!this.data.checklist) return;
    const item = this.data.checklist.items.find((entry) => entry.id === event.currentTarget.dataset.id);
    if (!item) return;
    wx.showModal({
      title: "编辑清单项",
      editable: true,
      placeholderText: item.text,
      confirmText: "保存",
      success: (result) => {
        if (!result.confirm) return;
        try {
          checklistStore.editItem(
            this.data.checklist.id,
            item.id,
            result.content || item.text
          );
          this.loadChecklists(this.data.checklist.id);
        } catch (error) {
          wx.showToast({ title: error.message, icon: "none" });
        }
      }
    });
  },

  showItemActions(event) {
    if (!this.data.checklist) return;
    const item = this.data.checklist.items.find((entry) => entry.id === event.currentTarget.dataset.id);
    if (!item) return;

    const actions = [{ label: "编辑", key: "edit" }];
    if (item.canMoveUp) actions.push({ label: "上移", key: "up" });
    if (item.canMoveDown) actions.push({ label: "下移", key: "down" });
    actions.push({ label: "删除", key: "delete" });

    wx.showActionSheet({
      itemList: actions.map((action) => action.label),
      success: (result) => {
        const action = actions[result.tapIndex];
        if (!action) return;
        if (action.key === "edit") {
          this.editItem({ currentTarget: { dataset: { id: item.id } } });
          return;
        }
        if (action.key === "delete") {
          this.confirmDeleteItem(item);
          return;
        }
        checklistStore.moveItem(this.data.checklist.id, item.id, action.key);
        this.loadChecklists(this.data.checklist.id);
      }
    });
  },

  confirmDeleteItem(item) {
    wx.showModal({
      title: "删除清单项？",
      content: item.text,
      confirmText: "删除",
      confirmColor: "#a34b32",
      success: (result) => {
        if (!result.confirm || !this.data.checklist) return;
        checklistStore.deleteItem(this.data.checklist.id, item.id);
        this.loadChecklists(this.data.checklist.id);
      }
    });
  },

  clearCompleted() {
    if (!this.data.checklist || !this.data.progress.completed) return;
    wx.showModal({
      title: "清除已完成项目？",
      content: `将移除 ${this.data.progress.completed} 个已完成项目。`,
      confirmText: "清除",
      confirmColor: "#a34b32",
      success: (result) => {
        if (!result.confirm || !this.data.checklist) return;
        checklistStore.clearCompleted(this.data.checklist.id);
        this.loadChecklists(this.data.checklist.id);
        wx.showToast({ title: "已清除", icon: "success" });
      }
    });
  }
});
