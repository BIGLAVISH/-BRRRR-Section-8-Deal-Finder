const fs = require("fs");
const required = [
  "index.html",
  "app.js",
  "styles.css",
  "daily-pull.js",
  "package.json",
  "data/sources.json",
  "data/sample_source.csv",
  ".github/workflows/daily.yml"
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error("Missing:", file);
    process.exit(1);
  }
}

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (pkg.dependencies && Object.keys(pkg.dependencies).length) {
  console.error("This clean package should have zero dependencies.");
  process.exit(1);
}

console.log("Smoke test passed.");
