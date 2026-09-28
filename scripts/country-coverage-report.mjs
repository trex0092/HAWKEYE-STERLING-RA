import fs from "node:fs";
import path from "node:path";
import { LOCALES } from "./adverse-media.mjs";

const ROOT = process.cwd();
const REGISTER_PATH = path.join(ROOT, "data", "sanctions-country-coverage.json");
const OUTPUT_PATH = path.join(ROOT, "docs", "generated", "country-coverage-gaps.md");
const STATUS_ORDER = new Map([["not-researched",0],["pending",1],["identified",2],["assessed-not-loadable",3],["screened",4]]);
const REGION_ALIASES = { KR: "Republic of Korea", RU: "Russia", VN: "Vietnam", US: "United States", GB: "United Kingdom", TR: "Turkey" };

function readRegister() {
  const register = JSON.parse(fs.readFileSync(REGISTER_PATH, "utf8"));
  if (!Array.isArray(register.countries)) throw new Error("sanctions-country-coverage.json must contain a countries array");
  return register;
}
function editionCountries(register) {
  const valid = new Set(register.countries.map((row) => row.country));
  const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  const countries = new Set();
  for (const locale of LOCALES) {
    if (!locale || typeof locale.gl !== "string") continue;
    const name = REGION_ALIASES[locale.gl] || displayNames.of(locale.gl);
    if (valid.has(name)) countries.add(name);
  }
  return countries;
}
function partialNote(row) { return /partial research/i.test(row.note || "") ? "yes" : ""; }
function sortRows(rows) {
  return [...rows].sort((a,b) => (STATUS_ORDER.get(a.status) ?? 99) - (STATUS_ORDER.get(b.status) ?? 99) || a.country.localeCompare(b.country, "en"));
}
function table(headers, rows) {
  const out = ["| " + headers.join(" | ") + " |", "|" + headers.map(() => "---").join("|") + "|"];
  for (const row of rows) out.push("| " + row.map((cell) => String(cell ?? "").replaceAll("|", "\\|")).join(" | ") + " |");
  return out.join("\n");
}
export function buildCountryCoverageReport(register = readRegister()) {
  const editions = editionCountries(register);
  const fatf = sortRows(register.countries.filter((row) => row.fatf === "black" || row.fatf === "grey"));
  const nonFatfNotResearched = register.countries.filter((row) => row.status === "not-researched" && !row.fatf).sort((a,b) => a.country.localeCompare(b.country, "en"));
  const nonFatfKnown = sortRows(register.countries.filter((row) => !row.fatf && (row.status === "identified" || row.status === "pending")));
  const mlroGated = sortRows(register.countries.filter((row) => row.requiresMlroPolicyDecision === true));
  const noEdition = register.countries.filter((row) => !editions.has(row.country)).map((row) => row.country).sort((a,b) => a.localeCompare(b, "en"));
  const statusCounts = Object.create(null);
  for (const row of register.countries) statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
  const out = [];
  out.push("# HAWKEYE-STERLING-RA: country coverage gaps (195 countries)", "");
  out.push("Generated from `data/sanctions-country-coverage.json` and the `LOCALES` matrix in `scripts/adverse-media.mjs`. Register updated: " + (register.updated || "unknown") + ".", "");
  out.push("## How to read this", "");
  out.push("- **Sanctions status** is the register's own status. `not-researched` = no outcome recorded (" + (statusCounts["not-researched"] || 0) + "). `identified` = list known, file not verified (" + (statusCounts.identified || 0) + "). `pending` = candidate recorded, not loaded (" + (statusCounts.pending || 0) + "). `assessed-not-loadable` = researched, cannot be loaded (" + (statusCounts["assessed-not-loadable"] || 0) + "). `screened` = national list loaded (" + (statusCounts.screened || 0) + ").");
  out.push("- **AM edition** = whether a dedicated Google News country edition exists in the adverse-media matrix. `no` does not mean zero adverse-media coverage: GDELT and Bing News sweeps are global and name-scoped.");
  out.push("- **Partial note** = a not-researched country that already has a partial research note in the register.");
  out.push("- **PEP** is intentionally omitted per country because the current PEP artifact's country field is not reliable enough for a defensible country-by-country statement.");
  out.push("- UN consolidated list screening is independent of these national-list statuses.", "");
  out.push("## Priority: FATF black/grey list countries (" + fatf.length + ")", "");
  out.push(table(["Country","FATF","Sanctions status","AM edition","Partial note"], fatf.map((row) => [row.country,row.fatf,row.status,editions.has(row.country) ? "yes" : "no",partialNote(row)])), "");
  out.push("## Sanctions: " + (statusCounts["not-researched"] || 0) + " not researched (not FATF-flagged first)", "");
  out.push(table(["Country","AM edition","Partial note"], nonFatfNotResearched.map((row) => [row.country,editions.has(row.country) ? "yes" : "no",partialNote(row)])), "");
  out.push("## Sanctions: list known but file not verified (" + (statusCounts.identified || 0) + ") and pending (" + (statusCounts.pending || 0) + ")", "");
  out.push(table(["Country","Status","AM edition"], nonFatfKnown.map((row) => [row.country,row.status,editions.has(row.country) ? "yes" : "no"])), "");
  out.push("## MLRO policy decision required (" + mlroGated.length + ")", "");\n  out.push(table(["Country","Sanctions status","FATF"], mlroGated.map((row) => [row.country,row.status,row.fatf || ""])), "");\n  out.push("## Adverse media: " + noEdition.length + " countries with no dedicated Google News edition", "");
  out.push(noEdition.join(", "), "");
  out.push("## Regeneration", "");
  out.push("Run `npm run coverage:report` to print this report, `npm run coverage:report:write` to refresh it, or `npm run coverage:report:check` to fail on drift.", "");
  return out.join("\n");
}
const report = buildCountryCoverageReport();
if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, "utf8") : "";
  if (current !== report) {
    console.error("Country coverage report is stale. Regenerate with: npm run coverage:report:write");
    process.exit(1);
  }
  console.log("Country coverage report is current.");
} else if (process.argv.includes("--write")) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, report, "utf8");
  console.log("Wrote " + path.relative(ROOT, OUTPUT_PATH));
} else {
  process.stdout.write(report);
}
