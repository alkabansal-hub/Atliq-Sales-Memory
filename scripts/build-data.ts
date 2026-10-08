// Reads data/raw (the capstone dataset) and writes data/dataset.json.
// Run: node scripts/build-data.ts

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDoc, parseCsv } from "../lib/parse.ts";
import { linkDoc } from "../lib/match.ts";
import type { Dataset, Doc, GroundTruth } from "../lib/types.ts";

const RAW = join(import.meta.dirname, "..", "data", "raw");
const TODAY = "2026-07-10"; // "today" as defined by the dataset README

const crm = parseCsv(readFileSync(join(RAW, "crm_export.csv"), "utf8"));
const docs: Doc[] = [];
const groundTruth: GroundTruth = {};

for (const [folder, kind] of [["emails", "email"], ["meeting_notes", "note"]] as const) {
  for (const file of readdirSync(join(RAW, folder)).filter((f) => f.endsWith(".md")).sort()) {
    const { doc, notes } = buildDoc(file, kind, readFileSync(join(RAW, folder, file), "utf8"));
    doc.leadIds = linkDoc(doc, crm);
    docs.push(doc);
    if (notes.length) groundTruth[doc.id] = notes;
  }
}

docs.sort((a, b) => a.date.localeCompare(b.date));
const dataset: Dataset = { today: TODAY, crm, docs, groundTruth };
writeFileSync(join(import.meta.dirname, "..", "data", "dataset.json"), JSON.stringify(dataset, null, 2));

console.log(`CRM records: ${crm.length}, documents: ${docs.length}, with ground-truth notes: ${Object.keys(groundTruth).length}`);
for (const d of docs) console.log(`${d.id.padEnd(48)} ${d.kind.padEnd(5)} ${(d.internal ? "[internal]" : d.companyInTitle).padEnd(28)} -> ${d.leadIds.join(",") || "NOT IN CRM"}`);
