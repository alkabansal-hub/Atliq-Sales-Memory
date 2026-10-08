// Builds the action items and ranks them. Timing and ranking are plain rules (no AI), taken from
// the client meeting: nudge after 3–4 days of silence; follow up on day 9–10 after "give me a week".

import type { Analysis, CrmRecord, Dataset, Doc } from "./types.ts";
import { addDays, daysBetween } from "./dates.ts";
import { crmMatchesInText, findMissingLeads } from "./match.ts";

export const REPLY_RULE_DAYS = 4; // client message unanswered for this many days -> reminder
export const NUDGE_RULE_DAYS = 4; // our message unanswered by the client -> nudge
export const GIVE_ME_A_WEEK_DAYS = 9;
export const DUE_SOON_DAYS = 2;

export type ItemKind = "client_waiting" | "nudge" | "commitment" | "deadline" | "revisit" | "cross_sell" | "renewal" | "risk" | "missing_lead";

export type ActionItem = {
  id: string;
  kind: ItemKind;
  leadId: string | null;
  company: string;
  owner: string;
  value: number | null;
  title: string;
  why: string; // why it is on the list (shown to the user)
  due: string | null;
  lastContact: string | null;
  docId: string;
  quote: string;
  source: "rule" | "ai";
  confidence?: "high" | "medium" | "low";
  tier: 1 | 2 | 3;
};

const KIND_LABEL: Record<ItemKind, string> = {
  client_waiting: "Client waiting for reply",
  nudge: "Nudge client",
  commitment: "Promise to keep",
  deadline: "Deadline",
  revisit: "Revisit lost/paused deal",
  cross_sell: "Possible cross-sell",
  renewal: "Renewal",
  risk: "Deal at risk",
  missing_lead: "Lead not in CRM",
};
export const kindLabel = (k: ItemKind) => KIND_LABEL[k];

const value = (r?: CrmRecord) => (r && r.est_value_usd ? Number(r.est_value_usd) || null : null);

function ownerFor(doc: Doc, lead?: CrmRecord): string {
  if (lead?.owner) return lead.owner;
  const atliq = doc.messages.find((m) => m.fromAtliq);
  return atliq ? atliq.from.replace(/<.*>/, "").trim() : "Unassigned";
}

const firstSentence = (s: string) => (s.split(/(?<=[.?!])\s/)[0] ?? s).slice(0, 220);

export function buildItems(ds: Dataset, an: Analysis): ActionItem[] {
  const today = ds.today;
  const items: ActionItem[] = [];
  const leadOf = (doc: Doc) => ds.crm.find((r) => r.lead_id === doc.leadIds[0]);

  // ----- Rule-based reminders from email timing -----
  for (const doc of ds.docs) {
    if (doc.kind !== "email" || !doc.messages.length || doc.internal) continue;
    const lead = leadOf(doc);
    if (lead && (lead.status === "Lost") && daysBetween(doc.date, today) > 60) continue; // handled by revisit signals
    const last = doc.messages[doc.messages.length - 1];
    const since = daysBetween(last.date, today);
    const company = lead?.company ?? doc.companyInTitle;
    const base = { leadId: lead?.lead_id ?? null, company, owner: ownerFor(doc, lead), value: value(lead), lastContact: last.date, docId: doc.id, source: "rule" as const };

    if (!last.fromAtliq) {
      const weekAsk = /give (me|us) a week|get back to you next week/i.test(last.body);
      if (weekAsk) {
        const due = addDays(last.date, GIVE_ME_A_WEEK_DAYS);
        items.push({ ...base, id: `rule:${doc.id}:week`, kind: "deadline", title: `Follow up with ${company}`, why: `Client asked for a week on ${last.date}; rule: follow up on day ${GIVE_ME_A_WEEK_DAYS}–10`, due, quote: firstSentence(last.body), tier: 2 });
      } else if (since >= REPLY_RULE_DAYS) {
        items.push({ ...base, id: `rule:${doc.id}:reply`, kind: "client_waiting", title: `Reply to ${last.from.replace(/<.*>/, "").trim()} (${company})`, why: `Client’s last message is ${since} days old with no reply from AtliQ (rule: ${REPLY_RULE_DAYS} days)`, due: addDays(last.date, REPLY_RULE_DAYS), quote: firstSentence(last.body), tier: 1 });
      }
    } else if (since >= NUDGE_RULE_DAYS && lead?.status !== "Won") {
      const old = since > 120;
      items.push({
        ...base,
        id: `rule:${doc.id}:nudge`,
        kind: "nudge",
        title: old ? `Re-engage or close ${company}` : `Nudge ${company}`,
        why: old ? `No reply for ${since} days. Decide: one last nudge, or mark the deal closed` : `No reply from the client for ${since} days after AtliQ’s last message (rule: nudge after 3–4 days)`,
        due: addDays(last.date, NUDGE_RULE_DAYS),
        quote: firstSentence(last.body),
        tier: old ? 3 : 2,
      });
    }
  }

  // ----- AI findings (only items that passed the grounding check are stored) -----
  for (const doc of ds.docs) {
    const a = an.docs[doc.id];
    if (!a) continue;
    // Internal notes may name any client, so search the whole CRM for them.
    const rows = doc.internal ? ds.crm : ds.crm.filter((r) => doc.leadIds.includes(r.lead_id));
    // Notes such as internal pipeline reviews cover several clients: file each item under the client it names.
    const leadFor = (text: string): CrmRecord | undefined => {
      if (rows.length <= 1) return rows[0];
      return crmMatchesInText(text, rows)[0] ?? (doc.internal ? undefined : rows[0]);
    };
    const baseFor = (text: string) => {
      const lead = leadFor(text);
      const newerContact = lead
        ? ds.docs.filter((d) => d.leadIds.includes(lead.lead_id) && !d.internal && d.date > doc.date).map((d) => d.date).sort().pop()
        : undefined;
      return {
        newerContact,
        base: { leadId: lead?.lead_id ?? null, company: lead?.company ?? (doc.internal ? "Internal task" : doc.companyInTitle), owner: lead?.owner || "Unassigned", value: value(lead), lastContact: doc.date, docId: doc.id, source: "ai" as const },
      };
    };
    a.commitments.forEach((c, i) => {
      // Older promises may already have been kept if there was newer contact with the client.
      const { base, newerContact } = baseFor(`${c.what} ${c.quote}`);
      const overdue = c.due ? daysBetween(c.due, today) : null;
      const maybeDone = Boolean(newerContact && (!c.due || c.due < newerContact));
      const due = c.due ? (overdue! > 0 ? `Promised by ${c.due} — ${overdue} days overdue` : overdue === 0 ? "Due today" : `Due ${c.due}`) : `Promised${c.dueText ? ` (“${c.dueText}”)` : ""}, no date set`;
      items.push({
        ...base,
        owner: c.who && c.who !== "AtliQ" ? c.who : base.owner,
        id: `ai:${doc.id}:c${i}`,
        kind: "commitment",
        title: c.what,
        why: maybeDone ? `${due}. Newer contact since (${newerContact}), so check whether it was already done` : due,
        due: c.due,
        quote: c.quote,
        confidence: c.confidence,
        tier: maybeDone ? 3 : c.due && daysBetween(today, c.due) <= DUE_SOON_DAYS ? 1 : 2,
      });
    });
    a.signals.forEach((s, i) => {
      const kind: ItemKind = s.type === "cross_sell" ? "cross_sell" : s.type === "revisit" ? "revisit" : s.type === "renewal" ? "renewal" : "risk";
      if (s.type === "new_lead") return;
      const { base } = baseFor(`${s.detail} ${s.quote}`);
      // Signal dates are usually when it was mentioned, not a deadline, so signals are context, not top urgency.
      // Exception: a revisit whose date has arrived ("check back in Q2").
      const revisitDue = kind === "revisit" && s.date ? daysBetween(today, s.date) <= 0 : false;
      items.push({
        ...base,
        id: `ai:${doc.id}:s${i}`,
        kind,
        title: s.detail,
        why: s.date ? `${KIND_LABEL[kind]} — date ${s.date}` : KIND_LABEL[kind],
        due: s.date,
        quote: s.quote,
        confidence: s.confidence,
        tier: revisitDue ? 2 : kind === "risk" ? 2 : 3,
      });
    });
  }

  // ----- Leads that never reached the CRM -----
  for (const m of findMissingLeads(ds.docs)) {
    items.push({ id: `rule:missing:${m.docId}`, kind: "missing_lead", leadId: null, company: m.company, owner: "Unassigned", value: null, title: `Add ${m.company} to the CRM`, why: `Mentioned in “${m.title}” (${m.date}) but has no CRM record`, due: null, lastContact: m.date, docId: m.docId, quote: m.title, source: "rule", tier: 2 });
  }

  return rank(dedupe(items), today);
}

// Merge near-identical items for the same client (e.g. the same promise in an email and a meeting note).
const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
export function similar(a: string, b: string) {
  const A = tokens(a), B = tokens(b);
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / Math.max(1, Math.min(A.size, B.size)) >= 0.6;
}
function dedupe(items: ActionItem[]): ActionItem[] {
  const out: ActionItem[] = [];
  for (const it of [...items].sort((a, b) => (b.lastContact ?? "").localeCompare(a.lastContact ?? ""))) {
    if (it.source === "ai" && out.some((o) => o.source === "ai" && o.kind === it.kind && o.company === it.company && similar(o.title, it.title))) continue;
    out.push(it);
  }
  return out;
}

// Ranking rule: tier first (overdue/due in 2 days/client waiting), then deal value, then days since contact.
export function rank(items: ActionItem[], today: string): ActionItem[] {
  return [...items].sort((a, b) =>
    a.tier - b.tier ||
    (b.value ?? 0) - (a.value ?? 0) ||
    (a.due && b.due ? a.due.localeCompare(b.due) : a.due ? -1 : b.due ? 1 : 0) ||
    daysBetween(b.lastContact ?? today, today) - daysBetween(a.lastContact ?? today, today),
  );
}

export function rankReason(i: ActionItem, today: string): string {
  const parts: string[] = [];
  if (i.tier === 1) parts.push(i.kind === "client_waiting" ? "client is waiting" : "overdue or due within 2 days");
  if (i.value) parts.push(`$${(i.value / 1000).toFixed(0)}k deal`);
  if (i.lastContact) parts.push(i.lastContact === today ? "contacted today" : `last contact ${daysBetween(i.lastContact, today)} days ago`);
  return parts.join(" · ");
}
