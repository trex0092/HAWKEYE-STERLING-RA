#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const commit = String(process.env.COMMIT_REF || process.env.GITHUB_SHA || "").trim();
if (!/^[0-9a-f]{40}$/i.test(commit)) {
  console.error("netlify-deploy-meta: COMMIT_REF/GITHUB_SHA is missing or invalid");
  process.exit(1);
}

const branch = String(process.env.BRANCH || process.env.HEAD || "main").trim();
const context = String(process.env.CONTEXT || "unknown").trim();

const out = {
  commit,
  branch,
  context,
  generatedBy: "scripts/netlify-deploy-meta.mjs"
};

mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
writeFileSync(
  path.join(process.cwd(), "data", "deploy-meta.json"),
  JSON.stringify(out, null, 2) + "\n",
  "utf8"
);
console.log("netlify-deploy-meta: wrote data/deploy-meta.json for " + commit);
