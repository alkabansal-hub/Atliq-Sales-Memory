// Turns the raw dataset (markdown emails and notes, CRM CSV) into structured data.
// Editorial lines like "*(No reply sent as of 2026-07-10.)*" are removed from the text and kept
// separately as ground truth for evals. They are never shown to the AI.

import type { CrmRecord, Doc, Message } from "./types.ts";

const EDITORIAL = /\*\(([\s\S]*?)\)\*/g;

export function splitEditorial(raw: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  const text = raw.replace(EDITORIAL, (_m, inner: string) => {
    notes.push(inner.trim());
    return "";
  });
  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), notes };
}

export function parseCsv(csv: string): CrmRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && csv[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [header, ...data] = rows;
  return data.map((r) => {
    const rec = Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])) as CrmRecord;
    for (const k of ["created_date", "last_contact_date", "next_followup_date"] as const) rec[k] = isoDate(rec[k]);
    return rec;
  });
}

// Accepts YYYY-MM-DD or DD-MM-YYYY / DD/MM/YYYY (the file may have been re-saved in Excel).
export function isoDate(s: string): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s;
}

export const isAtliq = (email: string) => /@atliq\.com$/i.test(email.trim());

function field(block: string, name: string): string {
  const m = block.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`));
  return m ? m[1].trim() : "";
}

function emailOf(s: string): string {
  const m = s.match(/<([^>]+)>/) ?? s.match(/([\w.+-]+@[\w.-]+)/);
  return m ? m[1].trim().toLowerCase() : "";
}

export function parseEmailMessages(text: string): Message[] {
  const blocks = text.split(/\n---\n/);
  const msgs: Message[] = [];
  for (const b of blocks) {
    const from = field(b, "From");
    const date = field(b, "Date").slice(0, 10);
    if (!from || !date) continue;
    const lines = b.split("\n");
    const lastHeader = lines.reduce((acc, l, i) => (/^\*\*(From|To|Cc|Date|Subject):\*\*/.test(l) ? i : acc), -1);
    const body = lines.slice(lastHeader + 1).join("\n").trim();
    const fromEmail = emailOf(from);
    msgs.push({ from, fromEmail, to: field(b, "To"), date, subject: field(b, "Subject") || undefined, body, fromAtliq: isAtliq(fromEmail) });
  }
  return msgs;
}

// Company name as written in the title, e.g. "# Email Thread: Nimbus Lending — referral from PayTrack" -> "Nimbus Lending"
export function companyFromTitle(title: string): string {
  let t = title.replace(/^#\s*/, "");
  t = t.replace(/^(Email Thread|Email):\s*/i, "");
  t = t.replace(/^(Meeting Notes|Notes|call)\s*[—-]\s*/i, "");
  t = t.split(" — ")[0];
  t = t.split(",")[0].split(" (")[0];
  t = t.replace(/\?+/g, "").replace(/\b\d{1,2}\/\d{1,2}\b/g, "").replace(/\b(intro call|demo|call|status)\b.*$/i, "");
  return t.trim();
}

const NOT_A_CLIENT = /^(internal|techsummit)/i;

export function buildDoc(file: string, kind: "email" | "note", raw: string): { doc: Doc; notes: string[] } {
  const { text, notes } = splitEditorial(raw);
  const title = (text.split("\n")[0] ?? "").replace(/^#\s*/, "").trim();
  const messages = kind === "email" ? parseEmailMessages(text) : [];
  const fileDate = file.slice(0, 10);
  const date = messages.length ? messages[messages.length - 1].date : fileDate;
  const companyInTitle = companyFromTitle(title);
  const id = file.replace(/\.md$/, "");
  return {
    doc: { id, kind, file, title, date, text, messages, companyInTitle, leadIds: [], internal: NOT_A_CLIENT.test(companyInTitle) },
    notes,
  };
}
