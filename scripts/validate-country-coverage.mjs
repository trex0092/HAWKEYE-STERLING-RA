import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const COVERAGE_FILE = path.join(ROOT, "data", "sanctions-country-coverage.json");
const EXPECTED_COUNTRY_COUNT = 195;
const VALID_STATUSES = [
  "not-researched",
  "identified",
  "pending",
  "assessed-not-loadable",
  "screened"
];

function fail(errors, message) {
  errors.push(message);
}

function loadCoverage() {
  if (!fs.existsSync(COVERAGE_FILE)) {
    throw new Error(`Missing coverage register: ${COVERAGE_FILE}`);
  }
  const parsed = JSON.parse(fs.readFileSync(COVERAGE_FILE, "utf8"));
  if (!parsed || !Array.isArray(parsed.countries)) {
    throw new Error("Coverage register must contain a countries array.");
  }
  return parsed;
}

function validate(register) {
  const errors = [];
  const counts = Object.fromEntries(VALID_STATUSES.map((status) => [status, 0]));
  const seen = new Set();
  const fatfPriority = [];

  for (const entry of register.countries) {
    const country = typeof entry.country === "string" ? entry.country.trim() : "";
    if (!country) {
      fail(errors, "Coverage entry is missing a country name.");
      continue;
    }
    if (seen.has(country)) {
      fail(errors, `Duplicate country entry: ${country}`);
    }
    seen.add(country);

    if (!VALID_STATUSES.includes(entry.status)) {
      fail(errors, `${country}: invalid status "${entry.status ?? ""}"`);
    } else {
      counts[entry.status] += 1;
    }

    if (!Array.isArray(entry.baseline) || entry.baseline.length === 0) {
      fail(errors, `${country}: baseline coverage is missing or empty`);
    }

    if (entry.status === "screened" && (!Array.isArray(entry.sources) || entry.sources.length === 0)) {
      fail(errors, `${country}: screened status requires at least one national source id`);
    }

    if (entry.fatf === "black" || entry.fatf === "grey") {
      fatfPriority.push({
        country,
        fatf: entry.fatf,
        status: entry.status
      });
    } else if (entry.fatf !== undefined) {
      fail(errors, `${country}: invalid FATF status "${entry.fatf}"`);
    }
  }

  if (register.countries.length !== EXPECTED_COUNTRY_COUNT) {
    fail(
      errors,
      `Expected ${EXPECTED_COUNTRY_COUNT} countries, found ${register.countries.length}`
    );
  }

  return { errors, counts, fatfPriority };
}

function printReport(register, result) {
  const { counts, fatfPriority } = result;
  const fatfGaps = fatfPriority.filter((entry) => entry.status !== "screened");

  console.log("HAWKEYE STERLING COUNTRY COVERAGE");
  console.log("--------------------------------");
  console.log(`Register updated:          ${register.updated ?? "unknown"}`);
  console.log(`Countries recorded:        ${register.countries.length}`);
  console.log(`Screened:                  ${counts.screened}`);
  console.log(`Identified:                ${counts.identified}`);
  console.log(`Pending:                   ${counts.pending}`);
  console.log(`Assessed not loadable:     ${counts["assessed-not-loadable"]}`);
  console.log(`Not researched:            ${counts["not-researched"]}`);
  console.log(`FATF black/grey total:     ${fatfPriority.length}`);
  console.log(`FATF priority gaps:        ${fatfGaps.length}`);

  if (fatfGaps.length > 0) {
    console.log("");
    console.log("FATF PRIORITY GAPS");
    console.log("------------------");
    for (const gap of fatfGaps) {
      console.log(`${gap.country}: FATF ${gap.fatf}, ${gap.status}`);
    }
  }
}

let register;
try {
  register = loadCoverage();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}

const result = validate(register);
printReport(register, result);

if (result.errors.length > 0) {
  console.error("");
  console.error("COUNTRY COVERAGE VALIDATION FAILED");
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("");
console.log("Country coverage validation passed.");
