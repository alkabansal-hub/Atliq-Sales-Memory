// Runs the AI over every document once and saves the results to data/analysis.json,
// so the deployed demo does not call the AI on every page load (free-tier friendly).
// Run: npm run analyze            (continues where it stopped)
//      npm run analyze -- --force (re-runs everything)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { aiConfigured, analyzeText, modelName, summarizeAccount } from "../lib/llm.ts";
import type { Analysis, Dataset } from "../lib/types.ts";

const DATA = join(import.meta.dirname, "..", "data");
const OUT = join(DATA, "analysis.json");
const force = process.argv.includes("--force");
const PAUSE_MS = Number(process.env.AI_PAUSE_MS ?? 2500); // stay under free-tier rate limits

if (!aiConfigured()) {
  console.error("GROQ_API_KEY is not set. Add it to .env.local (see README) and run again.");
  process.exit(1);
}

const ds = JSON.parse(readFileSync(join(DATA, "dataset.json"), "utf8")) as Dataset;
const empty: Analysis = { generatedAt: null, model: null, docs: {}, accounts: {} };
const analysis: Analysis = !force && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : empty;
const save = () => {
  analysis.generatedAt = new Date().toISOString();
  analysis.model = modelName();
  writeFileSync(OUT, JSON.stringify(analysis, null, 2));
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

console.log(`Model: ${modelName()} | documents: ${ds.docs.length}`);
let done = 0;
for (const doc of ds.docs) {
  if (analysis.docs[doc.id]) continue;
  const crm = ds.crm.filter((r) => doc.leadIds.includes(r.lead_id));
  try {
    analysis.docs[doc.id] = await analyzeText({ text: doc.text, date: doc.date, today: ds.today, crm, label: doc.kind === "email" ? "email thread" : "meeting / call note" });
    const a = analysis.docs[doc.id];
    console.log(`✓ ${doc.id}: ${a.crmUpdates.length} updates, ${a.commitments.length} commitments, ${a.signals.length} signals${a.dropped ? `, ${a.dropped} dropped (no matching quote)` : ""}`);
    done++;
    save();
  } catch (e) {
    console.error(`✗ ${doc.id}: ${(e as Error).message}`);
  }
  await sleep(PAUSE_MS);
}

// Short grounded summary per account, built only from that account's CRM row and document summaries.
for (const lead of ds.crm) {
  if (analysis.accounts[lead.lead_id] && !force) continue;
  const docs = ds.docs.filter((d) => d.leadIds.includes(lead.lead_id) && analysis.docs[d.id]);
  if (!docs.length) continue;
  const context = [
    `Today: ${ds.today}`,
    `CRM record: ${JSON.stringify(lead)}`,
    ...docs.map((d) => `${d.date} — ${d.title}: ${analysis.docs[d.id].summary}`),
  ].join("\n");
  try {
    analysis.accounts[lead.lead_id] = await summarizeAccount(context);
    console.log(`✓ summary ${lead.lead_id} ${lead.company}`);
    save();
  } catch (e) {
    console.error(`✗ summary ${lead.lead_id}: ${(e as Error).message}`);
  }
  await sleep(PAUSE_MS);
}

save();
console.log(`Finished. New documents analysed this run: ${done}. Saved to data/analysis.json`);
