const fs = require("fs");
const path = require("path");

const { outputPath, renderUserGuide } = require("./generate-user-guide");

const forbiddenFragments = [
  "images/user-guide/",
  "<img ",
  "/pages/place/",
  "/pages/wishlist/",
  "/pages/departure/",
  "/packages/tools/demo/",
  "/packages/tools/insights/",
  "/packages/tools/travel-map/",
  "/packages/tools/story/",
  "/packages/tools/yearbook/"
];

function firstDifferentLine(actual, expected) {
  const actualLines = actual.split("\n");
  const expectedLines = expected.split("\n");
  const count = Math.max(actualLines.length, expectedLines.length);
  for (let index = 0; index < count; index += 1) {
    if (actualLines[index] !== expectedLines[index]) return index + 1;
  }
  return 0;
}

function checkUserGuide() {
  if (!fs.existsSync(outputPath)) {
    console.error(`missing ${path.relative(path.resolve(__dirname, ".."), outputPath)}; run node scripts/generate-user-guide.js`);
    return false;
  }

  const actual = fs.readFileSync(outputPath, "utf8");
  const expected = renderUserGuide();
  if (actual === expected) {
    const staleFragment = forbiddenFragments.find((fragment) => actual.includes(fragment));
    if (staleFragment) {
      console.error(`docs/USER_GUIDE.md contains retired content: ${staleFragment}`);
      return false;
    }
    if (!actual.includes("```mermaid")) {
      console.error("docs/USER_GUIDE.md must include Mermaid diagrams");
      return false;
    }
    console.log("user guide is in sync and contains no retired screenshot or route references");
    return true;
  }

  const line = firstDifferentLine(actual, expected);
  console.error(`docs/USER_GUIDE.md is out of date at line ${line}; run node scripts/generate-user-guide.js`);
  return false;
}

if (require.main === module && !checkUserGuide()) process.exitCode = 1;

module.exports = { checkUserGuide, firstDifferentLine, forbiddenFragments };
