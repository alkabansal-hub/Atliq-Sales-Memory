"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { rankReason, similar, type ActionItem } from "@/lib/rules.ts";
import { daysBetween } from "@/lib/dates.ts";
import { useDecisions } from "./decisions";
import { useNotes, type SavedNote } from "./notes";

export type ClientGroup = { key: string; company: string; owner: string; value: number | null; items: ActionItem[]; rankWhy: string; summary?: string };

const money = (v: number | null) => (v ? `$${Math.round(v / 1000)}k` : "");
const src = (i: ActionItem) => (i.docId ? `/sources/${i.docId}?q=${encodeURIComponent(i.quote.slice(0, 120))}` : "/quick-note");
const srcLabel = (i: ActionItem) => (i.docId ? "open source" : "your call note");
const shortDate = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// Adds reminders from saved call notes to the client's row. A logged call also answers
// "client waiting" / "nudge" items for that client, so those drop to "probably handled".
function mergeNotes(groups: ClientGroup[], notes: SavedNote[], today: string): ClientGroup[] {
  if (!notes.length) return groups;
  const out = groups.map((g) => ({ ...g, items: [...g.items] }));
  for (const n of [...notes].reverse()) {
    let g = out.find((x) => x.key === n.leadId);
    if (!g) { g = { key: n.leadId, company: n.company, owner: n.owner, value: n.value, items: [], rankWhy: "" }; out.push(g); }
    g.items = g.items.map((i) =>
      (i.kind === "client_waiting" || i.kind === "nudge") && i.tier < 3
        ? { ...i, tier: 3, why: `Probably handled: you logged a call on ${shortDate(n.date)}. ${i.why}` }
        : i);
    for (const r of n.reminders) {
      // The same promise from an older email is replaced by the newer date from the call.
      g.items = g.items.map((i) =>
        i.docId && (i.kind === "commitment" || i.kind === "deadline") && i.tier < 3 && similar(i.title, r.what)
          ? { ...i, tier: 3, why: `Updated by your call note (${shortDate(n.date)}). Was: ${i.why}` }
          : i);
      const tier = r.due && daysBetween(today, r.due) <= 2 ? 1 : 2;
      g.items.push({
        id: r.id, kind: "commitment", leadId: n.leadId, company: n.company, owner: n.owner, value: n.value, title: r.what,
        why: `From your call note (${shortDate(n.date)}) · ${r.due ? `due ${shortDate(r.due)}` : r.dueText ? `“${r.dueText}”` : "no date"}`,
        due: r.due, lastContact: n.date, docId: "", quote: r.quote, source: "ai", confidence: "high", tier,
      });
    }
    // Within the same urgency, the newest information (your call note) leads.
    g.items.sort((a, b) => a.tier - b.tier || Number(Boolean(a.docId)) - Number(Boolean(b.docId)) || (a.due ?? "9999").localeCompare(b.due ?? "9999"));
    g.rankWhy = rankReason(g.items[0], today);
  }
  return out
    .map((g, i) => ({ g, i }))
    .sort((a, b) => a.g.items[0].tier - b.g.items[0].tier || a.i - b.i)
    .map((x) => x.g);
}

// One short status per item, so the list can be scanned: the founder's rules first, then the AI hints.
function statusOf(i: ActionItem, today: string, done: boolean): [string, string] {
  if (done) return ["Done", "b-green"];
  if (i.tier === 3 && (i.kind === "client_waiting" || i.kind === "nudge" || i.kind === "commitment" || i.kind === "deadline")) return ["Check if done", "b-grey"];
  switch (i.kind) {
    case "client_waiting": return ["Client waiting", "b-red"];
    case "nudge": return ["Nudge client", "b-amber"];
    case "commitment":
    case "deadline":
      if (i.id.endsWith(":week")) return ["“Give me a week” follow-up", "b-amber"];
      return i.due && i.due < today ? ["Overdue", "b-red"] : ["Due soon", "b-amber"];
    case "risk": return ["Deal at risk", "b-red"];
    case "revisit": return ["Revisit", "b-grey"];
    case "cross_sell": return ["Cross-sell", "b-green"];
    case "renewal": return ["Renewal", "b-green"];
    default: return ["To check", "b-grey"];
  }
}

// Owner picker for clients with no owner in the CRM. The choice is kept in this browser and logged,
// ready to be set in Kaizen; the CRM itself is not changed.
function Assign({ g, sellers }: { g: ClientGroup; sellers: string[] }) {
  const { decisions, decide, undo } = useDecisions();
  const id = `owner:${g.key}`;
  const chosen = decisions[id]?.value ?? "";
  return (
    <select
      className={`assign${chosen ? " set" : ""}`}
      value={chosen}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => (e.target.value ? decide(id, { status: "approved", value: e.target.value, label: `${g.company}: assign owner → ${e.target.value}` }) : undo(id))}
    >
      <option value="">Assign owner…</option>
      {sellers.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function Row({ g, n, today, sellers }: { g: ClientGroup; n: number; today: string; sellers: string[] }) {
  const [open, setOpen] = useState(false);
  const { decisions, decide, undo } = useDecisions();
  const top = g.items[0];
  const done = decisions[top.id];
  return (
    <div className={`line${done ? " faded" : ""}`}>
      <div className="line-main" onClick={() => setOpen(!open)}>
        <span className="num">{n}</span>
        <span className="who">
          <b>{g.company}</b>
          <span className="meta">{g.value ? <span className="deal">{money(g.value)}</span> : null}{g.value ? " · " : ""}{g.owner === "Unassigned" ? <Assign g={g} sellers={sellers} /> : g.owner}</span>
        </span>
        <span className="what">
          {top.title}
          <span className="meta">{top.why}</span>
        </span>
        <span className="status"><span className={`badge ${statusOf(top, today, Boolean(done))[1]}`}>{statusOf(top, today, Boolean(done))[0]}</span></span>
        <span className="act" onClick={(e) => e.stopPropagation()}>
          {done ? <button className="btn" onClick={() => undo(top.id)}>Undo</button> : <button className="btn good" onClick={() => decide(top.id, { status: "done", label: `${g.company}: ${top.title}` })}>Done</button>}
        </span>
      </div>
      {open && (
        <div className="line-more">
          {g.summary && <p className="summary"><b>About this client:</b> {g.summary}</p>}
          <p className="meta">Why this rank: {g.rankWhy}{!top.docId ? " · from your call note" : top.source === "ai" ? ` · found by AI (${top.confidence} confidence)` : " · found by a rule"}</p>
          <p className="quote">“{top.quote}” <Link href={src(top)}>{srcLabel(top)}</Link></p>
          {g.items.length > 1 && (
            <>
              <p style={{ marginTop: 10 }}><b>Also for {g.company}</b></p>
              <ul className="also">
                {g.items.slice(1).map((i) => (
                  <li key={i.id} className={decisions[i.id] ? "faded" : ""}>
                    <span className={`badge ${statusOf(i, today, Boolean(decisions[i.id]))[1]}`}>{statusOf(i, today, Boolean(decisions[i.id]))[0]}</span> {i.title} <span className="meta">— {i.why} · <Link href={src(i)}>{i.docId ? "source" : "your call note"}</Link></span>{" "}
                    {decisions[i.id] ? <button className="btn" onClick={() => undo(i.id)}>Undo</button> : <button className="btn" onClick={() => decide(i.id, { status: "done", label: `${g.company}: ${i.title}` })}>Done</button>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TodayList({ groups: base, owners, today }: { groups: ClientGroup[]; owners: string[]; today: string }) {
  const { notes } = useNotes();
  const groups = useMemo(() => mergeNotes(base, notes, today), [base, notes, today]);
  const { decisions } = useDecisions();
  const [owner, setOwner] = useState("Everyone");
  const sellers = owners.filter((o) => o !== "Unassigned");
  const ownerOf = (g: ClientGroup) => (g.owner === "Unassigned" ? decisions[`owner:${g.key}`]?.value ?? "Unassigned" : g.owner);
  const [more, setMore] = useState(false);
  const list = groups.filter((g) => owner === "Everyone" || ownerOf(g) === owner);
  const shown = more ? list : list.slice(0, 10);
  return (
    <>
      <div className="row" style={{ margin: "6px 0 12px" }}>
        <span className="meta">Show for</span>
        <select value={owner} onChange={(e) => setOwner(e.target.value)}>
          {["Everyone", ...owners].map((o) => <option key={o}>{o}</option>)}
        </select>
        <span className="meta">· click a row for details</span>
      </div>
      <div className="lines">
        <div className="line-head">
          <span className="num">#</span>
          <span className="who">Client</span>
          <span className="what">What to do</span>
          <span className="status">Status</span>
          <span className="act-head" />
        </div>
        {shown.map((g, i) => <Row key={g.key} g={g} n={i + 1} today={today} sellers={sellers} />)}
        {!list.length && <p className="meta" style={{ padding: 14 }}>Nothing to do.</p>}
      </div>
      {list.length > 10 && <button className="btn" style={{ marginTop: 10 }} onClick={() => setMore(!more)}>{more ? "Show top 10" : `Show all ${list.length}`}</button>}
    </>
  );
}
