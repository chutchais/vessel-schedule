import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function fail(message) {
  throw new Error(`[rb4-runtime] ${message}`);
}

function packageVersion(path) {
  return JSON.parse(readFileSync(path, "utf8")).version;
}

function dependencyNames(tree, names = new Set()) {
  for (const [name, value] of Object.entries(tree?.dependencies ?? {})) {
    names.add(name);
    dependencyNames(value, names);
  }
  return names;
}

function sourceFiles(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(?:js|jsx|mjs|cjs|ts|tsx)$/.test(entry) && !/\.test\.[^.]+$/.test(entry)) files.push(path);
  }
  return files;
}

if (packageVersion("node_modules/next/package.json") !== "16.3.0") fail("Next.js version moved outside verified 16.3.0 scope");
if (packageVersion("node_modules/postcss/package.json") !== "8.5.23") fail("PostCSS version moved outside patched 8.5.23 scope");
if (packageVersion("node_modules/nanoid/package.json") !== "3.3.17") fail("nanoid version moved outside patched 3.3.17 scope");

const ls = spawnSync("npm", ["ls", "--omit=dev", "--all", "--json", "sharp", "prisma", "eslint"], { encoding: "utf8" });
const runtimeDependencies = dependencyNames(JSON.parse(ls.stdout || "{}"));
for (const forbidden of ["sharp", "prisma", "eslint"]) {
  if (runtimeDependencies.has(forbidden)) fail(`${forbidden} exists in the runtime artifact`);
}

const runtimeFiles = ["app", "components", "lib"].flatMap(sourceFiles);
for (const path of runtimeFiles) {
  const source = readFileSync(path, "utf8");
  if (/(?:from\s+|require\(|import\()\s*['"]postcss['"]/.test(source)) fail(`runtime PostCSS import found in ${path}`);
  if (/route\.[jt]s$/.test(path) && /(text\/css|sourceMappingURL|css.{0,30}(upload|formData|process))/is.test(source)) {
    fail(`possible CSS upload/processing route found in ${path}`);
  }
}

const audit = spawnSync("npm", ["audit", "--omit=dev", "--omit=optional", "--audit-level=low", "--json"], { encoding: "utf8" });
let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  fail(`npm audit did not return valid JSON: ${audit.stderr.trim() || "unknown error"}`);
}
const vulnerabilities = report.vulnerabilities ?? {};
const vulnerablePackages = Object.keys(vulnerabilities);
if (vulnerablePackages.length) fail(`vulnerable runtime packages: ${vulnerablePackages.join(", ")}`);

console.log("[rb4-runtime] PASS");
console.log("[rb4-runtime] Next.js 16.3.0 / PostCSS 8.5.23 / nanoid 3.3.17 are pinned to patched versions");
console.log("[rb4-runtime] no production dependency advisories detected");
console.log("[rb4-runtime] Sharp, Prisma CLI, ESLint, runtime PostCSS imports, and CSS processing routes are absent");
console.log("[rb4-runtime] the temporary PostCSS exception is resolved; fail-closed controls remain active");
