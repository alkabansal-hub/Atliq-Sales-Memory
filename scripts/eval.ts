// Prints the eval results in the terminal. Run: npm run eval
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildItems } from "../lib/rules.ts";
import { runEvals } from "../lib/evals.ts";
import type { Analysis, Dataset } from "../lib/types.ts";

const DATA = join(import.meta.dirname, "..", "data");
const ds = JSON.parse(readFileSync(join(DATA, "dataset.json"), "utf8")) as Dataset;
const an = JSON.parse(readFileSync(join(DATA, "analysis.json"), "utf8")) as Analysis;
for (const r of runEvals(ds, an, buildItems(ds, an))) {
  console.log(`\n${r.pass === null ? "…" : r.pass ? "PASS" : "FAIL"}  ${r.name}: ${r.score}`);
  for (const d of r.detail) console.log(`   ${d}`);
}
