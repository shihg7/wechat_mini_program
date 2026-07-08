module.exports = {
  name: "hotel-scorecard-smoke",
  steps: [
    { type: "ensure-home" },
    { type: "observe", name: "home" },
    { type: "read-current-page" }
  ]
};
