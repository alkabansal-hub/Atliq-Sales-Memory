// Loads the prepared dataset and the saved AI analysis (bundled with the app, so it works on Vercel).
import datasetJson from "../data/dataset.json";
import analysisJson from "../data/analysis.json";
import type { Analysis, Dataset, Doc } from "./types.ts";
import { buildItems } from "./rules.ts";
import { findDuplicates, findMissingLeads } from "./match.ts";

export const dataset = datasetJson as unknown as Dataset;
export const analysis = analysisJson as unknown as Analysis;
export const TODAY = dataset.today;

export const aiRan = () => Boolean(analysis.generatedAt && Object.keys(analysis.docs).length);

export const items = buildItems(dataset, analysis);
export const duplicates = findDuplicates(dataset.crm);
export const missingLeads = findMissingLeads(dataset.docs);

export const leadById = (id: string) => dataset.crm.find((r) => r.lead_id === id);
export const docById = (id: string) => dataset.docs.find((d) => d.id === id);
export const docsForLead = (id: string): Doc[] => dataset.docs.filter((d) => d.leadIds.includes(id));

export const money = (v: number | string | null | undefined) => {
  const n = typeof v === "string" ? Number(v) : v;
  return n ? `$${Math.round(n / 1000)}k` : "—";
};
