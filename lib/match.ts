// Links documents to CRM records and finds gaps (missing leads, duplicates). Plain rules, no AI.

import type { CrmRecord, Doc } from "./types.ts";

export const companyKey = (company: string) =>
  company.toLowerCase().replace(/[^a-z0-9& ]/g, " ").trim().split(/\s+/)[0] ?? "";

const words = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9&]+/g, " ")} `;

// CRM records whose company key appears as a word in the given text.
export function crmMatchesInText(text: string, crm: CrmRecord[]): CrmRecord[] {
  const w = words(text);
  return crm.filter((r) => {
    const k = companyKey(r.company);
    return k.length > 2 && w.includes(` ${k} `);
  });
}

export function linkDoc(doc: Doc, crm: CrmRecord[]): string[] {
  if (doc.internal) {
    // Internal notes mention several deals by lead ID.
    return [...new Set(doc.text.match(/L-1\d{3}/g) ?? [])];
  }
  // 1. Company named in the title (handles "Nimbus Lending — referral from PayTrack" correctly).
  const byTitle = crmMatchesInText(doc.companyInTitle, crm);
  if (byTitle.length) return byTitle.map((r) => r.lead_id);
  // 2. Exact contact email.
  const emails = new Set(doc.messages.map((m) => m.fromEmail).filter(Boolean));
  const byEmail = crm.filter((r) => r.contact_email && emails.has(r.contact_email.toLowerCase()));
  if (byEmail.length && doc.kind === "email" && !doc.companyInTitle) return byEmail.map((r) => r.lead_id);
  return [];
}

export type MissingLead = { company: string; docId: string; date: string; contacts: string[]; title: string };

export function findMissingLeads(docs: Doc[]): MissingLead[] {
  return docs
    .filter((d) => !d.internal && d.leadIds.length === 0 && d.companyInTitle)
    .map((d) => ({
      company: d.companyInTitle,
      docId: d.id,
      date: d.date,
      title: d.title,
      contacts: [...new Set(d.messages.filter((m) => !m.fromAtliq).map((m) => `${m.from}`))],
    }));
}

export type DuplicateGroup = { leadIds: string[]; company: string; reason: string };

export function findDuplicates(crm: CrmRecord[]): DuplicateGroup[] {
  const groups = new Map<string, CrmRecord[]>();
  for (const r of crm) {
    const domain = r.contact_email.split("@")[1]?.toLowerCase();
    const key = domain && !/gmail|yahoo|outlook/.test(domain) ? `d:${domain}` : `k:${companyKey(r.company)}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const byKey = new Map<string, CrmRecord[]>();
  for (const r of crm) byKey.set(companyKey(r.company), [...(byKey.get(companyKey(r.company)) ?? []), r]);
  const out = new Map<string, DuplicateGroup>();
  for (const [k, rows] of [...groups, ...byKey]) {
    if (rows.length < 2) continue;
    const ids = rows.map((r) => r.lead_id).sort();
    const sig = ids.join(",");
    if (out.has(sig)) continue;
    const sameEmail = new Set(rows.map((r) => r.contact_email.toLowerCase())).size === 1;
    const reason = sameEmail
      ? `Same contact email (${rows[0].contact_email}) on ${rows.length} records`
      : k.startsWith("d:")
        ? `Same email domain (${k.slice(2)}) and similar company names`
        : `Similar company names: ${rows.map((r) => r.company).join(" / ")}`;
    out.set(sig, { leadIds: ids, company: rows[0].company, reason });
  }
  return [...out.values()];
}

// For quick notes: guess which client the note is about.
export function guessLeads(text: string, crm: CrmRecord[]): CrmRecord[] {
  const byCompany = crmMatchesInText(text, crm);
  if (byCompany.length) return byCompany;
  const w = words(text);
  return crm.filter((r) => {
    const first = r.contact_name.toLowerCase().replace(/^dr\.?\s+/, "").split(/\s+/)[0];
    return first && first.length > 2 && w.includes(` ${first} `);
  });
}
