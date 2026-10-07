import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const registry = readJson("data/worldwide-screening-sources.json");
const sanctionsCore = readJson("data/sanctions-sources.json").sources || [];
const sanctionsExtra = readJson("data/sanctions-extra.json").sources || [];
const adverse = readText("scripts/adverse-media.mjs");
const pepScript = readText("scripts/pep-worldwide.mjs");
const pepWorkflow = readText(".github/workflows/pep-worldwide.yml");
const countryMatrix = readJson("data/screening-country-coverage.json");
const errors = [];

function fail(msg) { errors.push(msg); }

const domains = registry.domains || {};
for (const key of ["sanctions", "adverseMedia", "pep"]) {
  if (!domains[key] || domains[key].required !== true) fail(key + ": required worldwide domain missing or disabled");
}

for (const source of domains.sanctions?.sources || []) {
  const found = sanctionsCore.find((s) => s.id === source.id) || sanctionsExtra.find((s) => s.id === source.id);
  if (!found) {
    fail("sanctions: required source missing: " + source.id);
    continue;
  }
  if (found.enabled === false) fail("sanctions: required source disabled: " + source.id);
  if (!found.url && !found.file) fail("sanctions: required source has no load target: " + source.id);
  /* The contract's fallback must be the one the loader honours (the
     registry entry's fallbackSourceId) and must itself be loadable. */
  const fb = source.fallbackSourceId || "";
  if (fb !== (found.fallbackSourceId || "")) {
    fail("sanctions: fallback for " + source.id + " differs between the contract (" + (fb || "none") + ") and the registry (" + (found.fallbackSourceId || "none") + ")");
  }
  if (fb) {
    const f = sanctionsCore.find((s) => s.id === fb) || sanctionsExtra.find((s) => s.id === fb);
    if (!f || f.enabled === false || (!f.url && !f.file)) fail("sanctions: declared fallback " + fb + " for " + source.id + " is missing, disabled or has no load target");
    else if (!(Number(f.minNames) > 0)) fail("sanctions: declared fallback " + fb + " for " + source.id + " has no minNames floor");
  }
}

const adverseNeedles = [
  ["google-news-rss", "https://news.google.com/rss/search"],
  ["gdelt-doc-2", "https://api.gdeltproject.org/api/v2/doc/doc"],
  ["bing-news-rss", "https://www.bing.com/news/search"]
];
for (const [id, needle] of adverseNeedles) {
  if (!adverse.includes(needle)) fail("adverse media: required worldwide backbone not wired: " + id);
}
if (!adverse.includes("checkAdverseMedia")) fail("adverse media: checkAdverseMedia implementation missing");
if (!adverse.includes("partial") || !adverse.includes("errored")) fail("adverse media: degradation semantics missing");

for (const needle of [
  "PEP (Worldwide — Wikidata)",
  "https://query.wikidata.org/sparql",
  "https://www.wikidata.org/w/api.php"
]) {
  if (!pepScript.includes(needle)) fail("PEP: worldwide harvester missing " + needle);
}
for (const needle of ["pep-worldwide-state", "data/pep-worldwide.json", "Harvest the worldwide PEP list from Wikidata"]) {
  if (!pepWorkflow.includes(needle)) fail("PEP: worldwide workflow missing " + needle);
}

const counts = countryMatrix.counts || {};
for (const [label, key] of [
  ["sanctions", "sanctionsCovered"],
  ["adverse media", "adverseMediaCovered"],
  ["PEP", "pepCovered"]
]) {
  if (counts[key] !== 195) fail(label + ": expected 195/195 screening scope, found " + String(counts[key]));
}

console.log("WORLDWIDE SCREENING AVAILABILITY");
console.log("--------------------------------");
console.log("Sanctions:     " + (errors.some((e) => e.startsWith("sanctions:")) ? "FAIL" : "AVAILABLE"));
console.log("Adverse media: " + (errors.some((e) => e.startsWith("adverse media:")) ? "FAIL" : "AVAILABLE"));
console.log("PEP:           " + (errors.some((e) => e.startsWith("PEP:")) ? "FAIL" : "AVAILABLE"));
console.log("Country scope: sanctions " + (counts.sanctionsCovered || 0) + "/195, adverse media " + (counts.adverseMediaCovered || 0) + "/195, PEP " + (counts.pepCovered || 0) + "/195");

if (errors.length) {
  console.error("");
  console.error("Worldwide screening availability FAILED");
  for (const e of errors) console.error("- " + e);
  process.exit(1);
}
console.log("");
console.log("Worldwide screening availability PASSED.");
