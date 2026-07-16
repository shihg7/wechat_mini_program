const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const targets = [path.join(root, "miniprogram"), path.join(root, "scripts")];

function collect(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((files, entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return files.concat(collect(filePath, extension));
    if (entry.isFile() && entry.name.endsWith(extension)) files.push(filePath);
    return files;
  }, []);
}

const files = targets.reduce((items, directory) => items.concat(collect(directory, ".js")), []);
files.forEach((filePath) => {
  const result = spawnSync(process.execPath, ["--check", filePath], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${filePath}\n`);
    process.exit(result.status || 1);
  }
});

const jsonFiles = collect(path.join(root, "miniprogram"), ".json");
jsonFiles.forEach((filePath) => {
  try {
    JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    process.stderr.write(`JSON parse failed: ${filePath}\n${error.message}\n`);
    process.exit(1);
  }
});

console.log(`Source syntax checks passed (${files.length} JS, ${jsonFiles.length} JSON)`);
