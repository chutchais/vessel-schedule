import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const EXPIRES_AT = new Date("2026-08-28T23:59:59.999Z");
const ALLOWED_ADVISORIES = new Set([
  "GHSA-qx2v-qp2m-jg93",
  "GHSA-6g55-p6wh-862q",
  "GHSA-r28c-9q8g-f849",
]);

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

if (Date.now() > EXPIRES_AT.getTime()) fail("approved PostCSS exception expired on 2026-08-28");
if (packageVersion("node_modules/next/package.json") !== "16.2.12") fail("Next.js version moved outside approved 16.2.12 scope");
if (packageVersion("node_modules/next/node_modules/postcss/package.json") !== "8.4.31") fail("PostCSS version moved outside approved 8.4.31 scope");

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
const unexpectedPackages = Object.keys(vulnerabilities).filter((name) => name !== "postcss" && name !== "next");
if (unexpectedPackages.length) fail(`unexpected vulnerable runtime packages: ${unexpectedPackages.join(", ")}`);

const observedAdvisories = new Set();
for (const item of vulnerabilities.postcss?.via ?? []) {
  if (typeof item === "object" && item.url) {
    const match = item.url.match(/GHSA-[a-z0-9-]+/i);
    if (match) observedAdvisories.add(match[0]);
  }
}
if (observedAdvisories.size !== ALLOWED_ADVISORIES.size ||
    [...observedAdvisories].some((id) => !ALLOWED_ADVISORIES.has(id))) {
  fail(`audit advisory scope changed; observed ${[...observedAdvisories].sort().join(", ") || "none"}`);
}

console.log("[rb4-runtime] PASS");
console.log("[rb4-runtime] Next.js 16.2.12 / PostCSS 8.4.31 matches the approved exception");
console.log(`[rb4-runtime] exact advisories: ${[...ALLOWED_ADVISORIES].sort().join(", ")}`);
console.log("[rb4-runtime] Sharp, Prisma CLI, ESLint, runtime PostCSS imports, and CSS processing routes are absent");
console.log("[rb4-runtime] exception expires 2026-08-28");
