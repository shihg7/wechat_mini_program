const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const defaultMiniprogramRoot = path.join(projectRoot, "miniprogram");

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function normalizeAppPath(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty path`);
  const normalized = path.posix.normalize(value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""));
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`${label} escapes the Mini Program root: ${value}`);
  }
  return normalized;
}

function isWithin(relativePath, directory) {
  return relativePath === directory || relativePath.startsWith(`${directory}/`);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`cannot parse ${toPosix(path.relative(projectRoot, filePath))}: ${error.message}`);
  }
}

function collectMainPackageFiles(miniprogramRoot, subpackageRoots) {
  const files = [];

  function visit(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const filePath = path.join(directory, entry.name);
      const relativePath = toPosix(path.relative(miniprogramRoot, filePath));
      if (subpackageRoots.some((root) => isWithin(relativePath, root))) return;
      if (entry.isDirectory()) visit(filePath);
      else if (entry.isFile()) files.push(filePath);
    });
  }

  visit(miniprogramRoot);
  return files.sort();
}

function skipTrivia(source, start) {
  let index = start;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }
    if (source[index] === "/" && source[index + 1] === "/") {
      index = source.indexOf("\n", index + 2);
      if (index < 0) return source.length;
      continue;
    }
    if (source[index] === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      return end < 0 ? source.length : skipTrivia(source, end + 2);
    }
    break;
  }
  return index;
}

function decodeEscape(source, start) {
  const marker = source[start + 1];
  const simple = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", 0: "\0" };
  if (marker === "\n") return { end: start + 2, value: "" };
  if (marker === "\r") return { end: source[start + 2] === "\n" ? start + 3 : start + 2, value: "" };
  if (Object.prototype.hasOwnProperty.call(simple, marker)) return { end: start + 2, value: simple[marker] };
  if (marker === "x" && /^[0-9a-fA-F]{2}$/.test(source.slice(start + 2, start + 4))) {
    return { end: start + 4, value: String.fromCodePoint(parseInt(source.slice(start + 2, start + 4), 16)) };
  }
  if (marker === "u" && source[start + 2] === "{") {
    const close = source.indexOf("}", start + 3);
    const digits = close < 0 ? "" : source.slice(start + 3, close);
    if (/^[0-9a-fA-F]+$/.test(digits)) return { end: close + 1, value: String.fromCodePoint(parseInt(digits, 16)) };
  }
  if (marker === "u" && /^[0-9a-fA-F]{4}$/.test(source.slice(start + 2, start + 6))) {
    return { end: start + 6, value: String.fromCodePoint(parseInt(source.slice(start + 2, start + 6), 16)) };
  }
  return { end: Math.min(start + 2, source.length), value: marker || "" };
}

function skipTemplateExpression(source, start) {
  let depth = 1;
  let index = start;
  while (index < source.length && depth > 0) {
    index = skipTrivia(source, index);
    const character = source[index];
    if (character === "'" || character === '"' || character === "`") {
      index = readStringLiteral(source, index).end;
    } else {
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      index += 1;
    }
  }
  return index;
}

function readStringLiteral(source, start) {
  const quote = source[start];
  let index = start + 1;
  let value = "";
  let dynamic = false;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      const escape = decodeEscape(source, index);
      value += escape.value;
      index = escape.end;
      continue;
    }
    if (quote === "`" && character === "$" && source[index + 1] === "{") {
      dynamic = true;
      index = skipTemplateExpression(source, index + 2);
      continue;
    }
    if (character === quote) return { end: index + 1, value: dynamic ? null : value };
    value += character;
    index += 1;
  }
  return { end: source.length, value: null };
}

function isIdentifierStart(character) {
  return !!character && /[A-Za-z_$]/.test(character);
}

function isIdentifierPart(character) {
  return !!character && /[A-Za-z0-9_$]/.test(character);
}

function previousCodeCharacter(source, start) {
  let index = start;
  while (index >= 0 && /\s/.test(source[index])) index -= 1;
  return index >= 0 ? source[index] : "";
}

function findStaticRelativeRequires(source) {
  const requests = [];
  let index = 0;
  while (index < source.length) {
    index = skipTrivia(source, index);
    const character = source[index];
    if (character === "'" || character === '"' || character === "`") {
      index = readStringLiteral(source, index).end;
      continue;
    }
    if (!isIdentifierStart(character)) {
      index += 1;
      continue;
    }

    const identifierStart = index;
    index += 1;
    while (isIdentifierPart(source[index])) index += 1;
    if (source.slice(identifierStart, index) !== "require" || previousCodeCharacter(source, identifierStart - 1) === ".") continue;

    let cursor = skipTrivia(source, index);
    if (source[cursor] !== "(") continue;
    cursor = skipTrivia(source, cursor + 1);
    if (source[cursor] !== "'" && source[cursor] !== '"' && source[cursor] !== "`") continue;
    const literal = readStringLiteral(source, cursor);
    cursor = skipTrivia(source, literal.end);
    if (source[cursor] !== ")" || typeof literal.value !== "string") continue;
    if (/^\.{1,2}(?:\/|$)/.test(literal.value)) requests.push(literal.value);
    index = cursor + 1;
  }
  return requests;
}

function resolveRelativeJs(importer, request, mainJsFiles) {
  const target = path.resolve(path.dirname(importer), request);
  const extension = path.extname(target);
  const candidates = extension ? [target] : [`${target}.js`, path.join(target, "index.js")];
  return candidates.find((candidate) => mainJsFiles.has(path.normalize(candidate))) || null;
}

function analyzeMainPackage(miniprogramRoot = defaultMiniprogramRoot) {
  const appJsonPath = path.join(miniprogramRoot, "app.json");
  const app = readJson(appJsonPath);
  if (!Array.isArray(app.pages)) throw new Error("miniprogram/app.json must define a pages array");

  const subpackages = app.subPackages || app.subpackages || [];
  if (!Array.isArray(subpackages)) throw new Error("miniprogram/app.json subPackages must be an array");
  const subpackageRoots = subpackages.map((subpackage, index) => normalizeAppPath(subpackage.root, `subPackages[${index}].root`));
  const mainFiles = collectMainPackageFiles(miniprogramRoot, subpackageRoots);
  const mainJsFiles = new Set(mainFiles.filter((filePath) => filePath.endsWith(".js")).map(path.normalize));
  const roots = new Set();

  function addRoot(filePath, label) {
    const normalized = path.normalize(filePath);
    if (!mainJsFiles.has(normalized)) throw new Error(`${label} is missing from the main package: ${toPosix(path.relative(miniprogramRoot, filePath))}`);
    roots.add(normalized);
  }

  addRoot(path.join(miniprogramRoot, "app.js"), "app.js");
  app.pages.forEach((page, index) => {
    const pagePath = normalizeAppPath(page, `pages[${index}]`);
    if (subpackageRoots.some((root) => isWithin(pagePath, root))) throw new Error(`main page is inside a subpackage: ${pagePath}`);
    addRoot(path.join(miniprogramRoot, `${pagePath}.js`), `registered main page ${pagePath}`);
  });

  mainFiles.filter((filePath) => filePath.endsWith(".json") && filePath !== appJsonPath).forEach((filePath) => {
    const config = readJson(filePath);
    if (config.component === true) addRoot(filePath.slice(0, -5) + ".js", `main-package component ${toPosix(path.relative(miniprogramRoot, filePath))}`);
  });

  const reachable = new Set();
  const queue = Array.from(roots);
  while (queue.length) {
    const filePath = queue.shift();
    if (reachable.has(filePath)) continue;
    reachable.add(filePath);
    const source = fs.readFileSync(filePath, "utf8");
    findStaticRelativeRequires(source).forEach((request) => {
      const dependency = resolveRelativeJs(filePath, request, mainJsFiles);
      if (dependency && !reachable.has(dependency)) queue.push(dependency);
    });
  }

  const unreachable = Array.from(mainJsFiles).filter((filePath) => !reachable.has(filePath)).sort();
  return { mainJsFiles, reachable, roots, subpackageRoots, unreachable };
}

function checkMainPackageUsage() {
  const result = analyzeMainPackage();
  if (result.unreachable.length) {
    console.error("Unreachable main-package JS files:");
    result.unreachable.forEach((filePath) => console.error(`  - ${toPosix(path.relative(projectRoot, filePath))}`));
    console.error("Move subpackage-only code under its subpackage root or add a static relative require from the main runtime.");
    return false;
  }
  console.log(`Main-package usage check passed (${result.reachable.size} JS files, ${result.roots.size} runtime roots)`);
  return true;
}

if (require.main === module) {
  try {
    if (!checkMainPackageUsage()) process.exitCode = 1;
  } catch (error) {
    console.error(`Main-package usage check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { analyzeMainPackage, checkMainPackageUsage, findStaticRelativeRequires, resolveRelativeJs };
