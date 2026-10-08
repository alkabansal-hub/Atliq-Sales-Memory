"use client";

import { useDecisions } from "../components/decisions";

// Suggestion precision as judged by the reviewer: approved / (approved + rejected) for AI suggestions.
export default function ReviewScore() {
  const { decisions } = useDecisions();
  const ai = Object.entries(decisions).filter(([id, d]) => (id.startsWith("ai:") || id.startsWith("note:")) && (d.status === "approved" || d.status === "fixed" || d.status === "rejected"));
  const ok = ai.filter(([, d]) => d.status !== "rejected").length;
  const pct = ai.length ? Math.round((ok / ai.length) * 100) : null;
  return (
    <div className="card">
      <div className="row spread">
        <h3>Suggestion precision (human review)</h3>
        <div className="row">
          <b>{pct === null ? "—" : `${ok} / ${ai.length} (${pct}%)`}</b>
          <span className={`badge ${pct === null ? "b-grey" : pct >= 85 ? "b-green" : "b-red"}`}>{pct === null ? "review needed" : pct >= 85 ? "meets target" : "below target"}</span>
        </div>
      </div>
      <p className="meta">
        Share of AI suggestions marked “Fix in CRM” (not “Ignore”) on the CRM check tab. Target: ≥ 85%. Calculated from your own decisions in this browser.
      </p>
    </div>
  );
}
