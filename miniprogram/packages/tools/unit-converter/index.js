const unitConverter = require("../utils/unitConverter");

const DEFAULT_UNITS = {
  area: ["m2", "ft2"],
  data: ["gb", "gib"],
  length: ["m", "ft"],
  mass: ["kg", "lb"],
  speed: ["kmh", "mph"],
  temperature: ["c", "f"],
  time: ["h", "min"],
  volume: ["l", "gal"]
};

function categoryData(category) {
  return {
    id: category.id,
    name: category.name,
    note: category.note || "",
    units: category.units.map((unit) => ({ id: unit.id, name: unit.name }))
  };
}

Page({
  data: {
    categories: unitConverter.CATEGORIES.map(categoryData),
    category: categoryData(unitConverter.CATEGORIES[0]),
    categoryId: "length",
    error: "",
    fromIndex: 0,
    inputValue: "1",
    result: "",
    resultCopy: "",
    toIndex: 1
  },

  onLoad() {
    this.selectCategoryById("length");
  },

  selectCategory(event) {
    this.selectCategoryById(event.currentTarget.dataset.category);
  },

  selectCategoryById(categoryId) {
    const category = this.data.categories.find((item) => item.id === categoryId);
    const defaults = DEFAULT_UNITS[categoryId];
    const fromIndex = Math.max(0, category.units.findIndex((unit) => unit.id === defaults[0]));
    const toIndex = Math.max(0, category.units.findIndex((unit) => unit.id === defaults[1]));
    this.setData({ category, categoryId, fromIndex, toIndex });
    this.calculate();
  },

  onInput(event) {
    this.setData({ inputValue: event.detail.value });
    this.calculate();
  },

  onFromUnitChange(event) {
    this.setData({ fromIndex: Number(event.detail.value) });
    this.calculate();
  },

  onToUnitChange(event) {
    this.setData({ toIndex: Number(event.detail.value) });
    this.calculate();
  },

  swapUnits() {
    this.setData({
      fromIndex: this.data.toIndex,
      inputValue: this.data.result || this.data.inputValue,
      toIndex: this.data.fromIndex
    });
    this.calculate();
  },

  calculate() {
    const category = this.data.category;
    if (!category.units || !category.units.length) return;
    const fromUnit = category.units[this.data.fromIndex];
    const toUnit = category.units[this.data.toIndex];
    try {
      const conversion = unitConverter.convert(
        this.data.categoryId,
        this.data.inputValue,
        fromUnit.id,
        toUnit.id
      );
      this.setData({
        error: "",
        result: unitConverter.formatNumber(conversion.result),
        resultCopy: unitConverter.buildCopyText(conversion)
      });
    } catch (error) {
      this.setData({ error: error.message, result: "", resultCopy: "" });
    }
  },

  copyResult() {
    if (!this.data.resultCopy) {
      wx.showToast({ icon: "none", title: this.data.error || "暂无可复制结果" });
      return;
    }
    wx.setClipboardData({ data: this.data.resultCopy });
  }
});
