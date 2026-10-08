"use client";

import Link from "next/link";
import { useState } from "react";
import { useDecisions } from "./decisions";
import { useNotes } from "./notes";

export type Change = {
  id: string;
  company: string;
  field: string;
  current: string;
  value: string;
  quote: string;
  docId: string;
  source?: string; // e.g. "email, 8 Jul"
  note?: string; // e.g. "deal reopened"
  confidence: "high" | "medium" | "low";
};

// Status after a decision. The app cannot see Kaizen, so the person closes the loop:
// "To fix in CRM" (agreed, not yet typed into Kaizen) -> "Fixed in CRM" (done in Kaizen). "Ignored" = AI was wrong.
function Status({ id }: { id: string }) {
  const { decisions, decide, undo } = useDecisions();
  const d = decisions[id];
  if (!d) return null;
  if (d.status === "rejected") return <span className="act"><span className="badge b-grey">Ignored</span> <button className="btn" onClick={() => undo(id)}>Undo</button></span>;
  if (d.status === "fixed") return <span className="act"><span className="badge b-green">Fixed in CRM ✓</span> <button className="btn" onClick={() => undo(id)}>Undo</button></span>;
  return (
    <span className="act">
      <span className="badge b-amber">To fix in CRM</span>
      <button className="btn good" onClick={() => decide(id, { ...d, status: "fixed" })}>Mark as fixed</button>
      <button className="btn" onClick={() => undo(id)}>Undo</button>
    </span>
  );
}

export function ChangeRow({ c, emailLabel = "Emails say" }: { c: Change; emailLabel?: string }) {
  const { decisions, decide } = useDecisions();
  const d = decisions[c.id];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(c.value);
  const label = `${c.company}: ${c.field} → ${val}`;
  return (
    <div className={`line${d ? " faded" : ""}`}>
      <div className="line-main" onClick={() => setOpen(!open)}>
        <span className="what" style={{ flex: 1 }}>
          <span><b>{c.company}</b> · {c.field}{c.note && <span className="badge b-amber" style={{ marginLeft: 6 }}>{c.note}</span>}{c.confidence === "low" && <span className="badge b-amber" style={{ marginLeft: 6 }}>needs a check</span>}</span>
          <span className="compare">
            {c.current ? <><span className="meta">CRM says:</span> <s>{c.current}</s></> : <span className="meta">Not filled in the CRM</span>}
            <span className="arrow">→</span>
            <span className="meta">{emailLabel}:</span>{" "}
            {editing && !d ? <input value={val} onClick={(e) => e.stopPropagation()} onChange={(e) => setVal(e.target.value)} /> : <b>{d?.value ?? val}</b>}
            {c.source && <span className="meta"> ({c.source})</span>}
          </span>
        </span>
        <span className="act" onClick={(e) => e.stopPropagation()}>
          {d ? <Status id={c.id} /> : (
            <>
              <button className="btn good" onClick={() => { decide(c.id, { status: "approved", value: val, label }); setEditing(false); }}>Fix in CRM</button>
              {editing
                ? <button className="btn" onClick={() => { setEditing(false); setVal(c.value); }}>Cancel</button>
                : <button className="btn" onClick={() => setEditing(true)}>Edit</button>}
              <button className="btn" onClick={() => { decide(c.id, { status: "rejected", label: `${c.company}: ${c.field} → ${c.value}` }); setEditing(false); setVal(c.value); }}>Ignore</button>
            </>
          )}
        </span>
      </div>
      {open && (
        <div className="line-more">
          <p className="quote">“{c.quote}” {c.docId && <Link href={`/sources/${c.docId}?q=${encodeURIComponent(c.quote.slice(0, 120))}`}>open source</Link>}</p>
          <p className="meta">Found by AI · {c.confidence} confidence</p>
        </div>
      )}
    </div>
  );
}

export function SimpleDecision({ id, label, yes, no, yesDone, noDone }: { id: string; label: string; yes: string; no: string; yesDone: string; noDone: string }) {
  const { decisions, decide, undo } = useDecisions();
  const d = decisions[id];
  if (d) return <span className="act"><span className={`badge ${d.status === "rejected" ? "b-grey" : "b-green"}`}>{d.status === "rejected" ? noDone : yesDone}</span> <button className="btn" onClick={() => undo(id)}>Undo</button></span>;
  return (
    <span className="act">
      <button className="btn good" onClick={() => decide(id, { status: "fixed", value: yesDone, label })}>{yes}</button>
      <button className="btn" onClick={() => decide(id, { status: "rejected", value: noDone, label })}>{no}</button>
    </span>
  );
}

export function FixAll({ ids, labels, text }: { ids: string[]; labels: string[]; text: string }) {
  const { decisions, decide, undo } = useDecisions();
  const all = ids.every((id) => decisions[id]);
  const fixed = ids.every((id) => decisions[id]?.status === "fixed");
  if (fixed) return <span className="act"><span className="badge b-green">All fixed in CRM ✓</span> <button className="btn" onClick={() => ids.forEach(undo)}>Undo</button></span>;
  return all ? (
    <span className="act">
      <span className="badge b-amber">To fix in CRM</span>
      <button className="btn good" onClick={() => ids.forEach((id) => decide(id, { ...decisions[id], status: "fixed" }))}>Mark all as fixed</button>
      <button className="btn" onClick={() => ids.forEach(undo)}>Undo</button>
    </span>
  ) : (
    <button className="btn good" onClick={() => ids.forEach((id, i) => decide(id, { status: "approved", label: labels[i] }))}>{text}</button>
  );
}

// CRM changes from call notes saved on the Quick note tab (kept in this browser).
function NoteChanges() {
  const { notes } = useNotes();
  const rows = notes.flatMap((n) => n.changes);
  return (
    <>
      <p className="meta">Calls you logged on the Quick note tab. These are not in the CRM yet.</p>
      <div className="lines">{rows.map((c) => <ChangeRow key={c.id} c={c} emailLabel="Your note says" />)}</div>
    </>
  );
}

type Tab = { key: string; label: string; count: number; tone?: string; body: React.ReactNode };

// One tab per kind of CRM problem. Call-note changes get their own tab when there are any.
export function CrmTabs({ tabs }: { tabs: Tab[] }) {
  const { notes } = useNotes();
  const noteCount = notes.reduce((n, x) => n + x.changes.length, 0);
  const all: Tab[] = noteCount ? [{ key: "notes", label: "From call notes", count: noteCount, body: <NoteChanges /> }, ...tabs] : tabs;
  const [active, setActive] = useState(tabs[0].key);
  const current = all.find((t) => t.key === active) ?? all[0];
  return (
    <>
      <div className="subtabs">
        {all.map((t) => (
          <button key={t.key} className={`subtab ${t.tone ?? ""}${t.key === current.key ? " on" : ""}`} onClick={() => setActive(t.key)}>
            {t.label} <span className="count">{t.count}</span>
          </button>
        ))}
      </div>
      {current.body}
    </>
  );
}
