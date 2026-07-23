const { HELP_SECTIONS } = require("./helpContent");

function searchableText(section) {
  const stepText = (section.steps || []).map((item) => `${item.title} ${item.text}`).join(" ");
  return [section.navTitle, section.title, section.subtitle, section.intro, section.keywords || "", stepText, ...(section.tips || [])]
    .join(" ")
    .toLowerCase();
}

function pageSection(section) {
  const result = { ...section };
  delete result.entry;
  delete result.guide;
  return result;
}

const SECTIONS = HELP_SECTIONS.map((section) => {
  const content = pageSection(section);
  return { ...content, searchText: searchableText(content) };
});

function visibleSections(keyword, expandedSections) {
  const normalized = String(keyword || "").trim().toLowerCase();
  return SECTIONS
    .filter((section) => !normalized || section.searchText.indexOf(normalized) >= 0)
    .map((section) => ({ ...section, expanded: !!expandedSections[section.id] }));
}

Page({
  data: {
    keyword: "",
    sections: SECTIONS,
    visibleSections: visibleSections("", { quick: true }),
    expandedSections: { quick: true },
    allExpanded: false,
    scrollTarget: ""
  },

  applyView(keyword, expandedSections) {
    const visible = visibleSections(keyword, expandedSections);
    this.setData({
      keyword,
      expandedSections,
      visibleSections: visible,
      allExpanded: !!visible.length && visible.every((section) => section.expanded)
    });
  },

  onSearchInput(event) {
    const keyword = event.detail.value || "";
    const matches = visibleSections(keyword, {});
    const expandedSections = { ...this.data.expandedSections };
    if (keyword.trim()) matches.forEach((section) => { expandedSections[section.id] = true; });
    this.applyView(keyword, expandedSections);
  },

  clearSearch() {
    this.applyView("", { quick: true });
  },

  toggleSection(event) {
    const id = event.currentTarget.dataset.id;
    const expandedSections = { ...this.data.expandedSections, [id]: !this.data.expandedSections[id] };
    this.applyView(this.data.keyword, expandedSections);
  },

  jumpToSection(event) {
    const id = event.currentTarget.dataset.id;
    const expandedSections = { ...this.data.expandedSections, [id]: true };
    this.applyView("", expandedSections);
    this.setData({ scrollTarget: `help-${id}` });
    setTimeout(() => this.setData({ scrollTarget: "" }), 450);
  },

  toggleAll() {
    const nextExpanded = !this.data.allExpanded;
    const expandedSections = { ...this.data.expandedSections };
    this.data.visibleSections.forEach((section) => { expandedSections[section.id] = nextExpanded; });
    this.applyView(this.data.keyword, expandedSections);
  },

  openFeature(event) {
    const url = event.currentTarget.dataset.url;
    if (!url) return;
    wx.navigateTo({ url });
  }
});
