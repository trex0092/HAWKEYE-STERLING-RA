import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MATRIX = path.join(ROOT, "data", "screening-country-coverage.json");
const SCOPE = path.join(ROOT, "data", "screening-scope.json");
const EXPECTED = 195;

function fail(msgs, msg) { msgs.push(msg); }

const scope = JSON.parse(fs.readFileSync(SCOPE, "utf8"));
const matrix = JSON.parse(fs.readFileSync(MATRIX, "utf8"));
const errors = [];

if (scope.expectedCountries !== EXPECTED) {
  fail(errors, `screening-scope expectedCountries must be ${EXPECTED}`);
}
if (!Array.isArray(matrix.countries)) {
  fail(errors, "screening-country-coverage.json must contain countries[]");
} else {
  if (matrix.countries.length !== EXPECTED) {
    fail(errors, `expected ${EXPECTED} countries, found ${matrix.countries.length}`);
  }
  const seen = new Set();
  for (const row of matrix.countries) {
    if (!row || typeof row.country !== "string" || !row.country.trim()) {
      fail(errors, "country row missing country name");
      continue;
    }
    if (seen.has(row.country)) fail(errors, `duplicate country row: ${row.country}`);
    seen.add(row.country);
    if (row.sanctions?.covered !== true) fail(errors, `${row.country}: sanctions coverage is not true`);
    if (row.adverseMedia?.covered !== true) fail(errors, `${row.country}: adverse-media coverage is not true`);
    if (row.pep?.covered !== true) fail(errors, `${row.country}: PEP coverage is not true`);
  }
}

for (const key of ["sanctions", "adverseMedia", "pep"]) {
  const cfg = scope[key];
  if (!cfg || cfg.covered !== true || cfg.countryFilter !== false) {
    fail(errors, `${key}: must be configured as global coverage with countryFilter=false`);
  }
}

const counts = matrix.counts || {};
for (const [label, key] of [
  ["sanctions", "sanctionsCovered"],
  ["adverse media", "adverseMediaCovered"],
  ["PEP", "pepCovered"]
]) {
  if (counts[key] !== EXPECTED) fail(errors, `${label}: expected ${EXPECTED}/${EXPECTED}, got ${counts[key] ?? "missing"}`);
}

console.log("HAWKEYE STERLING 195-COUNTRY SCREENING GATE");
console.log("-------------------------------------------");
console.log(`Sanctions:     ${counts.sanctionsCovered ?? 0}/${EXPECTED}`);
console.log(`Adverse media: ${counts.adverseMediaCovered ?? 0}/${EXPECTED}`);
console.log(`PEP:           ${counts.pepCovered ?? 0}/${EXPECTED}`);
console.log("");
console.log(`National sanctions lists loaded: ${counts.nationalSanctionsScreened ?? 0}/${EXPECTED}`);
console.log(`Dedicated Google News editions:  ${counts.dedicatedGoogleNewsEditions ?? 0}/${EXPECTED}`);
console.log("Depth metrics above do not reduce the global screening-scope pass.");

if (errors.length) {
  console.error("");
  console.error("195-country screening gate FAILED");
  for (const e of errors) console.error("- " + e);
  process.exit(1);
}
console.log("");
console.log("195-country screening gate PASSED.");
