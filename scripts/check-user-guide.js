const fs = require("fs");
const path = require("path");

const { outputPath, renderUserGuide } = require("./generate-user-guide");

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
    console.log("user guide is in sync with packages/tools/help/helpContent.js");
    return true;
  }

  const line = firstDifferentLine(actual, expected);
  console.error(`docs/USER_GUIDE.md is out of date at line ${line}; run node scripts/generate-user-guide.js`);
  return false;
}

if (require.main === module && !checkUserGuide()) process.exitCode = 1;

module.exports = { checkUserGuide, firstDifferentLine };
