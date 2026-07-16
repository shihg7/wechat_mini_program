const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const miniprogramRoot = path.join(root, "miniprogram");
const app = JSON.parse(fs.readFileSync(path.join(miniprogramRoot, "app.json"), "utf8"));
const pages = (app.pages || []).slice();

(app.subPackages || app.subpackages || []).forEach((subpackage) => {
  (subpackage.pages || []).forEach((page) => pages.push(`${subpackage.root}/${page}`));
});

assert.strictEqual(new Set(pages).size, pages.length, "app.json contains duplicate page routes");
pages.forEach((page) => {
  ["js", "json", "wxml", "wxss"].forEach((extension) => {
    const filePath = path.join(miniprogramRoot, `${page}.${extension}`);
    assert(fs.existsSync(filePath), `registered page is missing ${extension}: ${page}`);
  });
});

const registered = new Set(pages.map((page) => `/${page}`));
const routePattern = /["'`]\/(pages|packages)\/([A-Za-z0-9_./-]+)/g;
const sourceFiles = [];

function collect(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(filePath);
    else if (/\.(js|wxml)$/.test(entry.name)) sourceFiles.push(filePath);
  });
}

collect(miniprogramRoot);
sourceFiles.forEach((filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  let match;
  while ((match = routePattern.exec(source))) {
    const route = `/${match[1]}/${match[2]}`.replace(/\/$/, "");
    const cleanRoute = route.split("?")[0];
    if (/\.(png|jpe?g|gif|webp|svg)$/.test(cleanRoute)) continue;
    assert(registered.has(cleanRoute), `unregistered route ${cleanRoute} in ${path.relative(root, filePath)}`);
  }
});

const directStorePattern = /require\(["'](?:\.\.\/)+utils\/(hotelReviewStore|placeStore|wishlistStore|tripLedgerStore|tripStore|departureStore|wheelStore|mediaStore|formTemplateStore)["']\)/;
const pageScripts = new Set(pages.map((page) => path.join(miniprogramRoot, `${page}.js`)));
sourceFiles.filter((filePath) => pageScripts.has(filePath)).forEach((filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  assert(!directStorePattern.test(source), `page bypasses repository boundary: ${path.relative(root, filePath)}`);
});

console.log(`Mini Program route checks passed (${pages.length} pages)`);
