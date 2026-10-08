// CRM Health Check: compares each CRM record with what the emails and notes say.
import type { Analysis, CrmRecord, Dataset } from "./types.ts";
import { daysBetween } from "./dates.ts";

export type Suggestion = {
  id: string;
  leadId: string;
  company: string;
  field: string;
  current: string;
  value: string;
  quote: string;
  docId: string;
  docDate: string;
  confidence: "high" | "medium" | "low";
  source: "ai" | "rule";
  note?: string; // e.g. "deal reopened"
};

const FIELD_LABEL: Record<string, string> = {
  status: "Stage",
  est_value_usd: "Deal value ($)",
  next_step: "Next step",
  service_interest: "Service",
  contact_name: "Contact name",
  contact_email: "Contact email",
  owner: "Owner",
  last_contact_date: "Last contact",
};
export const fieldLabel = (f: string) => FIELD_LABEL[f] ?? f;

// Plain-rule checks on an AI suggestion before it is shown, so a person is warned about the
// common mistakes: a second service replacing the first, or part of a deal replacing the total.
export function reviewUpdate(field: string, current: string, value: string, confidence: Suggestion["confidence"]) {
  const out = { value, confidence, note: undefined as string | undefined };
  if (field === "service_interest" && current && !value.toLowerCase().includes(current.toLowerCase())) {
    out.value = `${current} + ${value}`;
    out.note = "extra service";
  }
  const cur = Number(current), next = Number(value);
  if (field === "est_value_usd" && cur > 0 && next > 0 && next < cur) {
    out.confidence = "low";
    out.note = "lower than CRM: may be only part of the deal";
  }
  return out;
}

// Deal stages in order. A client who has already signed (Won) and comes back is a new deal,
// not a step back, so stage suggestions never move a record backwards.
const STAGE_ORDER: Record<string, number> = { New: 1, Contacted: 2, "Proposal Sent": 3, Negotiation: 4, Won: 5 };

const current = (r: CrmRecord, field: string) => (field === "next_step" ? r.next_followup_date || "" : ((r as Record<string, string>)[field] ?? ""));

export function crmSuggestions(ds: Dataset, an: Analysis): Suggestion[] {
  const out: Suggestion[] = [];
  for (const r of ds.crm) {
    const docs = ds.docs.filter((d) => d.leadIds.includes(r.lead_id) && !d.internal).sort((a, b) => b.date.localeCompare(a.date));
    // Rule: last contact date is older than the newest real client contact (email, call or meeting;
    // internal notes such as "Meridian — status?" don't count).
    const newest = docs.find((d) => d.kind === "email" || /call|meeting|demo|discovery|review|scribble|techsummit/i.test(d.title + d.id));
    if (newest && (!r.last_contact_date || newest.date > r.last_contact_date)) {
      out.push({ id: `rule:${r.lead_id}:last_contact`, leadId: r.lead_id, company: r.company, field: "last_contact_date", current: r.last_contact_date || "", value: newest.date, quote: newest.title, docId: newest.id, docDate: newest.date, confidence: "high", source: "rule" });
    }
    // AI: field updates found in the documents (newest document wins per field).
    const seen = new Set<string>();
    for (const d of docs) {
      for (const [i, u] of (an.docs[d.id]?.crmUpdates ?? []).entries()) {
        if (u.field === "last_contact_date" || seen.has(u.field)) continue;
        const cur = current(r, u.field);
        if (cur.trim().toLowerCase() === u.value.trim().toLowerCase()) continue;
        let note: string | undefined;
        if (u.field === "status") {
          if (cur === "Won") continue;
          if (cur === "Lost") note = "deal reopened";
          else if (STAGE_ORDER[cur] && STAGE_ORDER[u.value] && STAGE_ORDER[u.value] < STAGE_ORDER[cur]) continue;
        }
        seen.add(u.field);
        const checked = reviewUpdate(u.field, cur, u.value, u.confidence);
        out.push({ id: `ai:${d.id}:u${i}:${r.lead_id}`, leadId: r.lead_id, company: r.company, field: u.field, current: cur, value: checked.value, quote: u.quote, docId: d.id, docDate: d.date, confidence: checked.confidence, source: "ai", note: note ?? checked.note });
      }
    }
  }
  return out;
}

export type Gap = { leadId: string; company: string; status: string; owner: string; issues: string[] };

export function dataGaps(ds: Dataset): Gap[] {
  return ds.crm
    .map((r) => {
      const issues: string[] = [];
      const active = !["Won", "Lost"].includes(r.status);
      if (!r.status) issues.push("no stage");
      if (active && !r.next_followup_date) issues.push("no follow-up date");
      if (active && !r.est_value_usd) issues.push("no deal value");
      if (!r.owner) issues.push("no owner");
      if (!r.contact_email) issues.push("no contact email");
      if (active && r.last_contact_date && daysBetween(r.last_contact_date, ds.today) > 30) issues.push(`no contact logged for ${daysBetween(r.last_contact_date, ds.today)} days`);
      if (active && !r.last_contact_date) issues.push("no contact logged");
      return { leadId: r.lead_id, company: r.company, status: r.status || "—", owner: r.owner || "—", issues };
    })
    .filter((g) => g.issues.length);
}
