module.exports = {
  name: "hotel-scorecard",
  routes: {
    home: "/pages/index/index"
  },
  selectors: {
    hotelNameInput: ".input",
    saveButton: ".primary",
    resetButton: ".secondary"
  },
  waits: {
    launch: 1200
  },
  extractAssistantReply() {
    return "";
  }
};
