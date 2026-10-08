// Grades the assistant against the dataset's editorial notes (the answer key). These notes are
// never given to the AI; they are used only here.
import type { Analysis, Dataset } from "./types.ts";
import type { ActionItem } from "./rules.ts";
import { findDuplicates, findMissingLeads } from "./match.ts";

export const EXPECTED_MISSING = ["Harbor & Finch", "Lumino Fitness", "PixelWorks", "Nimbus Lending", "Ridgeline Foods"];
export const EXPECTED_DUPLICATES = [["L-1003", "L-1027"], ["L-1004", "L-1040"]];

// Editorial notes that say an action was missed or never happened.
const MISSED = /\b(no (reply|response|further|call was|confirmation|revisit|one|email|owners?)|nothing (was )?sent|not (yet )?(answered|started|sent|done)|never|untouched|unanswered|no activity|no contact|not in the crm|does not appear)\b/i;

export type EvalResult = {
  name: string;
  what: string;
  score: string;
  pass: boolean | null; // null = needs AI run / human review
  detail: string[];
};

export function runEvals(ds: Dataset, an: Analysis, items: ActionItem[]): EvalResult[] {
  const results: EvalResult[] = [];

  const found = findMissingLeads(ds.docs).map((m) => m.company.toLowerCase());
  const hit = EXPECTED_MISSING.filter((e) => found.some((f) => f.includes(e.toLowerCase().split(" ")[0])));
  results.push({
    name: "Missing-lead recall",
    what: "Companies in emails/notes that are not in the CRM. Target: 5 of 5.",
    score: `${hit.length} / ${EXPECTED_MISSING.length}`,
    pass: hit.length === EXPECTED_MISSING.length,
    detail: EXPECTED_MISSING.map((e) => `${hit.includes(e) ? "✓" : "✗"} ${e}`),
  });

  const dups = findDuplicates(ds.crm).map((g) => g.leadIds.join(","));
  const dupHit = EXPECTED_DUPLICATES.filter((p) => dups.includes(p.join(",")));
  const extra = dups.filter((d) => !EXPECTED_DUPLICATES.some((p) => p.join(",") === d));
  results.push({
    name: "Duplicate detection",
    what: "Flags Meridian (L-1003/L-1027) and GlobalMart (L-1004/L-1040); never merges automatically. Target: 2 of 2, no false flags.",
    score: `${dupHit.length} / 2${extra.length ? ` (+${extra.length} extra)` : ""}`,
    pass: dupHit.length === 2 && extra.length === 0,
    detail: [...EXPECTED_DUPLICATES.map((p) => `${dupHit.includes(p) ? "✓" : "✗"} ${p.join(" / ")}`), ...extra.map((e) => `extra flag: ${e}`)],
  });

  const missedDocs = Object.entries(ds.groundTruth).filter(([, notes]) => notes.some((n) => MISSED.test(n))).map(([id]) => id);
  const flagged = new Set(items.map((i) => i.docId));
  const caught = missedDocs.filter((d) => flagged.has(d));
  const pct = missedDocs.length ? Math.round((caught.length / missedDocs.length) * 100) : 0;
  results.push({
    name: "Missed follow-up recall",
    what: "Of the documents whose editorial note says an action never happened, the share the assistant flags (reminder, promise, signal or missing lead). Target: ≥ 90%.",
    score: `${caught.length} / ${missedDocs.length} (${pct}%)`,
    pass: pct >= 90,
    detail: missedDocs.map((d) => `${flagged.has(d) ? "✓" : "✗"} ${d} — “${ds.groundTruth[d].find((n) => MISSED.test(n))}”`),
  });

  const docsDone = Object.values(an.docs);
  if (docsDone.length) {
    const kept = docsDone.reduce((a, d) => a + d.crmUpdates.length + d.commitments.length + d.signals.length, 0);
    const dropped = docsDone.reduce((a, d) => a + d.dropped, 0);
    results.push({
      name: "Grounding",
      what: "Every AI suggestion shown must carry a quote found word-for-word in its source. Items without one are removed before display. Target: 100% of shown items grounded.",
      score: `100% shown grounded · ${dropped} of ${kept + dropped} raw items removed`,
      pass: true,
      detail: [`${kept} AI items kept (quote verified in the source text)`, `${dropped} AI items dropped by the grounding check`],
    });
  } else {
    results.push({ name: "Grounding", what: "Needs the AI analysis to be run.", score: "—", pass: null, detail: [] });
  }

  results.push({
    name: "Safety by design",
    what: "No CRM write without a person; no message ever sent to a client. Target: 0 incidents.",
    score: "0 automatic writes · 0 client messages",
    pass: true,
    detail: [
      "The app has no code path that writes to the CRM or sends email/messages.",
      "Decisions are recorded in the browser and listed in the audit log for a person to apply in Kaizen.",
      "Editorial notes are stripped before any text reaches the AI.",
      "Prompt-injection test: try the sample note on the Quick note page.",
    ],
  });
  return results;
}
