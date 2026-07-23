const assert = require("assert");
const fs = require("fs");
const path = require("path");

const memory = {};
const ui = {
  backCount: 0,
  modals: [],
  navigations: [],
  redirects: [],
  toasts: []
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

global.wx = {
  getStorageSync(key) {
    return clone(memory[key]);
  },
  setStorageSync(key, value) {
    memory[key] = clone(value);
  },
  showToast(options) {
    ui.toasts.push(options);
  },
  showModal(options) {
    ui.modals.push(options);
  },
  navigateTo(options) {
    ui.navigations.push(options.url);
  },
  navigateBack(options = {}) {
    ui.backCount += 1;
    if (options.fail && ui.failNextBack) {
      ui.failNextBack = false;
      options.fail();
    }
  },
  redirectTo(options) {
    ui.redirects.push(options.url);
  }
};

function setPath(target, pathText, value) {
  const parts = pathText.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    if (!cursor[part]) cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
}

function loadPage(modulePath) {
  let definition;
  global.Page = (config) => {
    definition = config;
  };
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  const page = {};
  Object.keys(definition).forEach((key) => {
    page[key] = key === "data" ? clone(definition.data) : definition[key];
  });
  page.setData = function setData(patch, callback) {
    Object.keys(patch).forEach((key) => setPath(this.data, key, patch[key]));
    if (callback) callback();
  };
  return page;
}

const store = require("../miniprogram/packages/tools/utils/careerGameStore");
store.setRuns([]);

const indexPage = loadPage("../miniprogram/packages/tools/career/index.js");
indexPage.onShow();
assert.strictEqual(indexPage.data.loading, false);
assert.strictEqual(indexPage.data.activeRun, null);
assert.strictEqual(indexPage.data.endingProgress.total, 12);

indexPage.startNew();
assert.strictEqual(ui.toasts.pop().title, "先输入你的昵称");

indexPage.onNicknameInput({ detail: { value: " 小码同学 " } });
indexPage.onNicknameBlur();
assert.strictEqual(indexPage.data.nickname, "小码同学");
indexPage.startNew();
assert.strictEqual(store.getActiveRun().playerName, "小码同学");
const firstRunId = store.getActiveRun().id;
assert.strictEqual(
  ui.navigations.pop(),
  `/packages/tools/career/play?id=${firstRunId}`,
  "new careers must bind the play page to a run id"
);

indexPage.onShow();
assert.strictEqual(indexPage.data.activeRun.runId, firstRunId);
indexPage.continueActive();
assert.strictEqual(ui.navigations.pop(), `/packages/tools/career/play?id=${firstRunId}`);
indexPage.openArchive();
assert.strictEqual(ui.navigations.pop(), "/packages/tools/career/archive");

indexPage.startNew();
const restartPrompt = ui.modals.pop();
assert(restartPrompt.content.includes("保留为中断记录"));
restartPrompt.success({ confirm: false });
assert.strictEqual(store.getActiveRun().id, firstRunId);
indexPage.startNew();
ui.modals.pop().success({ confirm: true });
const activeRun = store.getActiveRun();
assert.notStrictEqual(activeRun.id, firstRunId);
assert.strictEqual(store.getRunById(firstRunId).status, "interrupted");

const playPage = loadPage("../miniprogram/packages/tools/career/play.js");
playPage.onLoad({ id: activeRun.id });
assert.strictEqual(playPage.data.view.phase, "scene");
assert.strictEqual(playPage.data.runId, activeRun.id);
assert(playPage.data.view.stage.illustrationPath.endsWith("stage-01.svg"));

const initialHistoryLength = store.getRunById(activeRun.id).history.length;
const firstChoiceId = playPage.data.view.scene.choices[0].id;
playPage.chooseOption({ currentTarget: { dataset: { choiceId: firstChoiceId } } });
assert.strictEqual(playPage.data.view.phase, "outcome");
assert.strictEqual(store.getRunById(activeRun.id).history.length, initialHistoryLength + 1);
playPage.chooseOption({ currentTarget: { dataset: { choiceId: firstChoiceId } } });
assert.strictEqual(
  store.getRunById(activeRun.id).history.length,
  initialHistoryLength + 1,
  "a settled choice cannot be applied twice through the page"
);

let guard = 0;
while (playPage.data.view.phase !== "ending" && guard < 120) {
  if (playPage.data.view.phase === "scene") {
    const choiceId = playPage.data.view.scene.choices[0].id;
    playPage.chooseOption({ currentTarget: { dataset: { choiceId } } });
  } else {
    playPage.advance();
  }
  guard += 1;
}
assert(guard < 120, "page interactions should reach an ending");
assert.strictEqual(playPage.data.view.phase, "ending");
assert.strictEqual(playPage.data.missing, false, "completed run must remain visible by run id");
assert(store.getRunById(activeRun.id).endingId);

playPage.openArchive();
assert.strictEqual(ui.navigations.pop(), "/packages/tools/career/archive");
playPage.restartCareer();
const replayPrompt = ui.modals.pop();
assert(replayPrompt.content.includes("本次结局会保留"));
replayPrompt.success({ confirm: true });
assert.strictEqual(playPage.data.view.phase, "scene");
assert.notStrictEqual(playPage.data.runId, activeRun.id);

const missingPage = loadPage("../miniprogram/packages/tools/career/play.js");
missingPage.onLoad({ id: "missing-run" });
assert.strictEqual(missingPage.data.missing, true);
ui.failNextBack = true;
missingPage.returnToCareer();
assert.strictEqual(ui.redirects.pop(), "/packages/tools/career/index");

const archivePage = loadPage("../miniprogram/packages/tools/career/archive.js");
archivePage.onShow();
assert.strictEqual(archivePage.data.progress.total, 12);
assert(archivePage.data.runs.length >= 2);
const archiveId = archivePage.data.runs[0].id;
archivePage.toggleRun({ currentTarget: { dataset: { id: archiveId } } });
assert.strictEqual(archivePage.data.runs[0].expanded, true);
archivePage.toggleRun({ currentTarget: { dataset: { id: archiveId } } });
assert.strictEqual(archivePage.data.runs[0].expanded, false);

const careerDir = path.join(__dirname, "../miniprogram/packages/tools/career");
[
  "index.js", "index.json", "index.wxml", "index.wxss",
  "play.js", "play.json", "play.wxml", "play.wxss",
  "archive.js", "archive.json", "archive.wxml", "archive.wxss"
].forEach((fileName) => {
  assert(fs.existsSync(path.join(careerDir, fileName)), `missing career page file: ${fileName}`);
});
for (let index = 1; index <= 6; index += 1) {
  const fileName = `stage-${String(index).padStart(2, "0")}.svg`;
  assert(fs.existsSync(path.join(careerDir, "assets", fileName)), `missing stage art: ${fileName}`);
}

const indexWxml = fs.readFileSync(path.join(careerDir, "index.wxml"), "utf8");
const playWxml = fs.readFileSync(path.join(careerDir, "play.wxml"), "utf8");
const archiveWxml = fs.readFileSync(path.join(careerDir, "archive.wxml"), "utf8");
const playWxss = fs.readFileSync(path.join(careerDir, "play.wxss"), "utf8");
assert(indexWxml.includes("career-start-input"));
assert(indexWxml.includes("start-button"));
assert(indexWxml.includes("continue-button"));
assert(indexWxml.includes("archive-button"));
assert(playWxml.includes("fixed-status"));
assert(playWxml.includes("story-scroll"));
assert(playWxml.includes("fixed-actions"));
assert(playWxml.includes("choice-button"));
assert(playWxml.includes("advance-button"));
assert(playWxml.includes("ending-archive-button"));
assert(archiveWxml.includes("ending-item"));
assert(archiveWxml.includes("career-run-item"));
assert(playWxss.includes("height: 100vh"));
assert(playWxss.includes("overflow: hidden"));
assert(!playWxss.includes("linear-gradient"));
assert(!playWxss.includes("radial-gradient"));

console.log("career game page interaction tests passed");
