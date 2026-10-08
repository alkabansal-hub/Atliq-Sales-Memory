import Link from "next/link";
import { analysis, dataset, docById, duplicates, leadById, missingLeads } from "@/lib/data.ts";
import { crmSuggestions, fieldLabel } from "@/lib/crmcheck.ts";
import { daysBetween, fmt } from "@/lib/dates.ts";
import { ChangeRow, CrmTabs, FixAll, SimpleDecision } from "../components/crm-list";

const docLabel = (id: string) => {
  const d = docById(id);
  return d ? `${d.kind}, ${fmt(d.date)}` : "";
};

const gap = (s: { current: string; value: string }) => (!s.current ? 9999 : daysBetween(s.current, s.value));

export default function CrmCheckPage() {
  const all = crmSuggestions(dataset, analysis);
  const changes = all
    .filter((s) => s.source === "ai")
    .map((s) => ({ id: s.id, company: s.company, field: fieldLabel(s.field), current: s.current, value: s.value, quote: s.quote, docId: s.docId, source: docLabel(s.docId), note: s.note, confidence: s.confidence }));
  const wrong = changes.filter((c) => c.current);
  const missing = changes.filter((c) => !c.current);
  const dates = all.filter((s) => s.source === "rule").sort((a, b) => gap(b) - gap(a));
  const outOfDate = new Set([...all.map((s) => s.leadId), ...duplicates.flatMap((g) => g.leadIds)]).size;

  return (
    <>
      <h1>CRM check</h1>
      <p className="lead">The CRM compared with the emails and call notes. Where they don’t match, the CRM is out of date. Click a row to see the email sentence.</p>
      <div className="notice">
        <b>{outOfDate} of {dataset.crm.length} clients are out of date in the CRM</b>, and {missingLeads.length} companies that wrote to AtliQ are not in the CRM at all.
        For each row: click “Fix in CRM”, update Kaizen, then click “Mark as fixed”. This app never changes the CRM itself.
      </div>

      <CrmTabs
        tabs={[
          {
            key: "wrong", label: "Wrong in the CRM", count: wrong.length, tone: "h-red",
            body: (
              <>
                <p className="meta">The CRM says one thing, the latest email or note says another.</p>
                <div className="lines">
                  {wrong.map((c) => <ChangeRow key={c.id} c={c} />)}
                  {!wrong.length && <p className="meta" style={{ padding: 14 }}>Nothing found (run the AI analysis).</p>}
                </div>
              </>
            ),
          },
          {
            key: "blank", label: "Blank fields", count: missing.length, tone: "h-amber",
            body: (
              <>
                <p className="meta">The client is in the CRM, but a field is empty. The emails or notes have the answer.</p>
                <div className="lines">
                  {missing.map((c) => <ChangeRow key={c.id} c={c} />)}
                  {!missing.length && <p className="meta" style={{ padding: 14 }}>Nothing found.</p>}
                </div>
              </>
            ),
          },
          {
            key: "dates", label: "Last contact behind", count: dates.length,
            body: (
              <>
                <div className="row spread" style={{ marginBottom: 8 }}>
                  <p className="meta">The CRM shows an older last-contact date than the latest email or call.</p>
                  <FixAll ids={dates.map((d) => d.id)} labels={dates.map((d) => `${d.company}: last contact → ${d.value}`)} text="Fix all in CRM" />
                </div>
                <div className="lines">
                  {dates.map((d) => (
                    <div className="line" key={d.id}>
                      <div className="line-main" style={{ cursor: "default" }}>
                        <span className="what inline" style={{ flex: 1 }}>
                          <b>{d.company}</b> · {d.current ? <><span className="meta">CRM says:</span> {fmt(d.current)}</> : <span className="meta">No date in the CRM</span>}
                          <span className="arrow">→</span>
                          <span className="meta">last {docById(d.docId)?.kind ?? "contact"}:</span> <b>{fmt(d.value)}</b>{" "}
                          {d.current && <span className="badge b-amber">{daysBetween(d.current, d.value)} days behind</span>}{" "}
                          <Link href={`/sources/${d.docId}`} className="meta">source</Link>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ),
          },
          {
            key: "missing", label: "Companies not in the CRM", count: missingLeads.length,
            body: (
              <>
                <p className="meta">These companies wrote to AtliQ but have no CRM record at all.</p>
                <div className="lines">
                  {missingLeads.map((m) => (
                    <div className="line" key={m.docId}>
                      <div className="line-main">
                        <span className="what" style={{ flex: 1 }}>
                          <b>{m.company}</b>
                          <span className="meta">{fmt(m.date)} · {m.contacts.join(", ") || "no contact details"} · <Link href={`/sources/${m.docId}`}>source</Link></span>
                        </span>
                        <SimpleDecision id={`lead:${m.docId}`} label={`Add ${m.company} to CRM`} yes="Add to CRM" no="Ignore" yesDone="Added to CRM ✓" noDone="Ignored" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ),
          },
          {
            key: "twice", label: "Entered twice", count: duplicates.length,
            body: (
              <>
                <p className="meta">Never merged automatically. Check, then merge in Kaizen.</p>
                <div className="lines">
                  {duplicates.map((g) => (
                    <div className="line" key={g.leadIds.join()}>
                      <div className="line-main">
                        <span className="what" style={{ flex: 1 }}>
                          <b>{g.leadIds.map((id) => `${leadById(id)?.company} (${id}, ${leadById(id)?.owner || "no owner"})`).join("  vs  ")}</b>
                          <span className="meta">{g.reason}</span>
                        </span>
                        <SimpleDecision id={`dup:${g.leadIds.join(",")}`} label={`Duplicate check: ${g.leadIds.join(" / ")}`} yes="Same company" no="Different" yesDone="Same company: merge in Kaizen" noDone="Different companies" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ),
          },
        ]}
      />
    </>
  );
}
