import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { analysis, dataset, docById, leadById } from "@/lib/data.ts";
import { fmt } from "@/lib/dates.ts";

function highlight(text: string, q: string) {
  if (!q) return text;
  const clean = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const t = clean(text);
  const needle = clean(q).split(/\.\.\.|…/)[0].trim();
  const at = t.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0 || needle.length < 4) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

export function generateStaticParams() {
  return dataset.docs.map((d) => ({ id: d.id }));
}

export default function SourcePage(props: PageProps<"/sources/[id]">) {
  return (
    <Suspense fallback={<p className="meta">Loading…</p>}>
      <Source {...props} />
    </Suspense>
  );
}

async function Source({ params, searchParams }: PageProps<"/sources/[id]">) {
  const { id } = await params;
  const q = (await searchParams).q;
  const doc = docById(id);
  if (!doc) notFound();
  const a = analysis.docs[doc.id];
  return (
    <>
      <p className="meta"><Link href="/">← Back to Pending follow-ups</Link></p>
      <h1>{doc.title}</h1>
      <p className="lead">
        {doc.kind === "email" ? "Email thread" : "Meeting / call note"} · latest date {fmt(doc.date)} · linked to{" "}
        {doc.leadIds.length
          ? doc.leadIds.map((l, i) => (
              <span key={l}>{i > 0 && ", "}{leadById(l)?.company} ({l})</span>
            ))
          : "no CRM record (possible new lead)"}
      </p>
      {a?.summary && <div className="card"><b>AI summary:</b> {a.summary}</div>}
      <div className="docText">{highlight(doc.text, typeof q === "string" ? q : "")}</div>
      <p className="meta" style={{ marginTop: 8 }}>
        This is exactly what the AI was given. The dataset’s editorial notes (what happened later) are removed and used only to grade the assistant on the Evals page.
      </p>
    </>
  );
}
