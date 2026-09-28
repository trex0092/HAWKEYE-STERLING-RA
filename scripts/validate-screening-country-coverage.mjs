import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MATRIX = path.join(ROOT, "data", "screening-country-coverage.json");
const SCOPE = path.join(ROOT, "data", "screening-scope.json");
const SANCTIONS = path.join(ROOT, "data", "sanctions-country-coverage.json");
const ADVERSE = path.join(ROOT, "scripts", "adverse-media.mjs");
const EXPECTED = 195;

function fail(msgs, msg) { msgs.push(msg); }

const scope = JSON.parse(fs.readFileSync(SCOPE, "utf8"));
const matrix = JSON.parse(fs.readFileSync(MATRIX, "utf8"));
const sanctionsRegister = JSON.parse(fs.readFileSync(SANCTIONS, "utf8"));
const adverseSource = fs.readFileSync(ADVERSE, "utf8");
const errors = [];

const localeStart = adverseSource.indexOf("export const LOCALES = [");
const localeEnd = adverseSource.indexOf("];", localeStart);
const localeBlock = localeStart >= 0 && localeEnd > localeStart
  ? adverseSource.slice(localeStart, localeEnd + 2)
  : "";
const glCodes = [...localeBlock.matchAll(/\bgl:\s*'([A-Z]{2})'/g)].map((m) => m[1]);
const aliases = { KR: "Republic of Korea", RU: "Russia", VN: "Vietnam", US: "United States", GB: "United Kingdom", TR: "Turkey" };
const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
const registerCountries = new Set(sanctionsRegister.countries.map((r) => r.country));
const editions = new Set(glCodes.map((code) => aliases[code] || displayNames.of(code)).filter((name) => registerCountries.has(name)));

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

    const sourceRow = sanctionsRegister.countries.find((r) => r.country === row.country);
    if (!sourceRow) {
      fail(errors, `${row.country}: missing from sanctions-country-coverage.json`);
    } else if (row.sanctions?.nationalStatus !== sourceRow.status) {
      fail(errors, `${row.country}: national sanctions status drift (${row.sanctions?.nationalStatus} != ${sourceRow.status})`);
    }
    if (row.adverseMedia?.dedicatedGoogleNewsEdition !== editions.has(row.country)) {
      fail(errors, `${row.country}: dedicated Google News edition drift`);
    }
  }
}

for (const key of ["sanctions", "adverseMedia", "pep"]) {
  const cfg = scope[key];
  if (!cfg || cfg.covered !== true || cfg.countryFilter !== false) {
    fail(errors, `${key}: must be configured as global coverage with countryFilter=false`);
  }
}

if (registerCountries.size !== EXPECTED) {
  fail(errors, `sanctions country universe must contain ${EXPECTED} unique countries, found ${registerCountries.size}`);
}
for (const country of registerCountries) {
  if (!matrix.countries.some((row) => row.country === country)) {
    fail(errors, `${country}: missing from screening-country-coverage.json`);
  }
}

const counts = matrix.counts || {};
const liveNationalScreened = sanctionsRegister.countries.filter((r) => r.status === "screened").length;
if (counts.nationalSanctionsScreened !== liveNationalScreened) {
  fail(errors, `nationalSanctionsScreened drift (${counts.nationalSanctionsScreened} != ${liveNationalScreened})`);
}
if (counts.dedicatedGoogleNewsEditions !== editions.size) {
  fail(errors, `dedicatedGoogleNewsEditions drift (${counts.dedicatedGoogleNewsEditions} != ${editions.size})`);
}
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
