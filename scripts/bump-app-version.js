// Erhöht buildNumber (immer) und optional die Versionsnummer in app.config.ts
// Verwendung: node scripts/bump-app-version.js [build|patch|minor]
const fs = require("fs");
const path = require("path");

const bump = process.argv[2] || "build";
const configPath = path.join(__dirname, "..", "app.config.ts");
let src = fs.readFileSync(configPath, "utf8");

const versionMatch = src.match(/version:\s*"(\d+)\.(\d+)\.(\d+)"/);
const buildMatch = src.match(/buildNumber:\s*"(\d+)"/);
if (!versionMatch || !buildMatch) {
  console.error("version oder buildNumber in app.config.ts nicht gefunden");
  process.exit(1);
}

let [_, major, minor, patch] = versionMatch.map(Number);
const oldVersion = `${major}.${minor}.${patch}`;
if (bump === "patch") patch += 1;
if (bump === "minor") { minor += 1; patch = 0; }
const newVersion = `${major}.${minor}.${patch}`;

const newBuild = Number(buildMatch[1]) + 1;

src = src.replace(/version:\s*"\d+\.\d+\.\d+"/, `version: "${newVersion}"`);
src = src.replace(/buildNumber:\s*"\d+"/, `buildNumber: "${newBuild}"`);
fs.writeFileSync(configPath, src);

console.log(`Version: ${oldVersion} -> ${newVersion}, Build: ${buildMatch[1]} -> ${newBuild}`);
