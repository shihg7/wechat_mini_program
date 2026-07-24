const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pageRoot = path.join(root, "miniprogram", "packages", "tools", "huawei-sim");
const clipboard = [];
const toasts = [];
const modals = [];
let pageDefinition;

global.Page = (definition) => {
  pageDefinition = definition;
};
global.wx = {
  vibrateShort() {},
  showToast(options) {
    toasts.push(options);
  },
  showModal(options) {
    modals.push(options);
    options.success({ confirm: true, cancel: false });
  },
  setClipboardData(options) {
    clipboard.push(options.data);
    if (options.success) options.success();
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createPage() {
  delete require.cache[require.resolve(path.join(pageRoot, "index.js"))];
  require(path.join(pageRoot, "index.js"));
  const page = {};
  Object.keys(pageDefinition).forEach((key) => {
    page[key] = key === "data" ? clone(pageDefinition.data) : pageDefinition[key];
  });
  page.setData = function setData(patch, callback) {
    Object.assign(this.data, patch);
    if (callback) callback();
  };
  page.onLoad();
  return page;
}

function dataset(id, name = "id") {
  return { currentTarget: { dataset: { [name]: id } } };
}

function testMainFlow() {
  const page = createPage();
  assert.strictEqual(page.data.screen, "intro");
  assert(page.data.contentStats.termCount >= 48);
  assert(page.data.contentStats.eventCount >= 54);
  assert.strictEqual(page.data.contentStats.choicesPerRun, 15);
  page.startSimulation();
  assert.strictEqual(page.data.screen, "run");
  assert.strictEqual(page.data.runView.choices.length, 3);

  for (let index = 0; index < page.data.contentStats.choicesPerRun; index += 1) {
    const firstChoice = page.data.runView.choices[0];
    page.chooseOption(dataset(firstChoice.id));
    assert.strictEqual(page.data.runView.isFeedback, true);
    assert(page.data.runView.feedback.outcome);
    page.chooseOption(dataset(firstChoice.id));
    assert.strictEqual(page.run.history.length, index + 1, "duplicate taps must not settle twice");
    page.continueSimulation();
  }

  assert.strictEqual(page.data.screen, "result");
  assert(page.data.resultView.persona.title);
  assert.strictEqual(page.data.resultView.history.length, page.data.contentStats.choicesPerRun);
  page.copyResult();
  assert(clipboard.some((item) => item.includes("非官方情景模拟")));
  assert(toasts.some((item) => item.title === "模拟总结已复制"));

  page.restartSimulation();
  assert.strictEqual(page.data.screen, "run");
  assert.strictEqual(modals.length, 0, "completed simulations should restart directly");
  page.restartSimulation();
  assert.strictEqual(modals.length, 1, "active simulations should confirm before restart");
  page.backToIntro();
  assert.strictEqual(page.data.screen, "intro");
  assert.strictEqual(page.run, null);
}

function testGlossaryFlow() {
  const page = createPage();
  page.switchTab(dataset("glossary", "tab"));
  assert.strictEqual(page.data.activeTab, "glossary");
  page.onGlossaryInput({ detail: { value: "PBC" } });
  assert(page.data.glossaryResults.some((item) => item.id === "pbc"));
  page.selectGlossaryCategory(dataset("process"));
  assert(page.data.glossaryResults.every((item) => item.category === "process"));
  page.clearGlossarySearch();
  assert(page.data.glossaryResults.length > 0);
  assert(page.data.glossaryResults.every((item) => item.category === "process"));
  page.selectGlossaryCategory(dataset("network"));
  page.onGlossaryInput({ detail: { value: "B里靠前" } });
  assert(page.data.glossaryResults.some((item) => item.id === "b-front"));
  assert(page.data.glossaryResults.every((item) => item.sourceTone === "network"));
  page.copyGlossaryTerm(dataset(page.data.glossaryResults[0].id));
  assert(clipboard.some((item) => item.includes("：")));
  page.onGlossaryInput({ detail: { value: "完全不存在" } });
  assert.strictEqual(page.data.glossaryResults.length, 0);
  page.switchTab(dataset("simulation", "tab"));
  assert.strictEqual(page.data.activeTab, "simulation");
  page.onUnload();
  assert.strictEqual(page.run, null);
}

function testTemplateAndStyleGuards() {
  const wxml = fs.readFileSync(path.join(pageRoot, "index.wxml"), "utf8");
  const wxss = fs.readFileSync(path.join(pageRoot, "index.wxss"), "utf8");
  const config = JSON.parse(fs.readFileSync(path.join(pageRoot, "index.json"), "utf8"));
  assert(wxml.includes('class="choice-card"'));
  assert(wxml.includes('class="choice-text"'));
  assert(wxml.includes('class="content-scroll"'));
  assert(wxml.includes("非官方") || wxml.includes("{{disclaimer}}"));
  assert(wxml.includes("B里靠前"));
  assert(wxml.includes("五个阶段"));
  assert(wxml.includes("十五回合"));
  assert(!wxml.includes("四个阶段"));
  assert(!wxml.includes("十二回合"));
  assert(wxss.includes(".source-network"));
  assert(/\.hw-page\s*\{[\s\S]*?height:\s*100vh[\s\S]*?overflow:\s*hidden/.test(wxss));
  assert(/\.content-scroll\s*\{[\s\S]*?flex:\s*1[\s\S]*?height:\s*0/.test(wxss));
  assert(/\.choice-card\s*\{[\s\S]*?min-height:\s*126rpx[\s\S]*?height:\s*auto[\s\S]*?overflow:\s*visible/.test(wxss));
  assert(/\.choice-text\s*\{[\s\S]*?overflow:\s*visible[\s\S]*?text-overflow:\s*clip[\s\S]*?white-space:\s*normal[\s\S]*?word-break:\s*break-word/.test(wxss));
  assert(!/\.choice-text\s*\{[\s\S]*?-webkit-line-clamp/.test(wxss), "choice text must never be line-clamped");
  assert(!/\.choice-text\s*\{[\s\S]*?text-overflow:\s*ellipsis/.test(wxss), "choice text must never use ellipsis");
  assert.strictEqual(config.disableScroll, true);
  assert.strictEqual(config.usingComponents["ui-icon"], "/components/ui-icon/index");
}

testMainFlow();
testGlossaryFlow();
testTemplateAndStyleGuards();
console.log("huawei simulation page tests passed");
