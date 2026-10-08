"use client";

import { useDecisions, type Decision } from "../components/decisions";

// Plain words for each stored status.
function words(id: string, d: Decision): [string, string] {
  if (id.startsWith("owner:")) return ["Owner assigned", "b-green"];
  if (d.status === "fixed") return [id.startsWith("lead:") ? "Added to CRM" : id.startsWith("dup:") ? "Same company" : "Fixed in CRM", "b-green"];
  if (d.status === "approved") return ["To fix in CRM", "b-amber"];
  if (d.status === "rejected") return [id.startsWith("dup:") ? "Different companies" : "Ignored", "b-grey"];
  if (d.status === "done") return ["Follow-up done", "b-green"];
  return [d.status, "b-grey"];
}

export default function AuditLog() {
  const { decisions, clear } = useDecisions();
  const rows = Object.entries(decisions).sort((a, b) => b[1].at.localeCompare(a[1].at));
  if (!rows.length) return <p className="meta">No decisions yet. Click “Done” on Pending follow-ups, or “Fix in CRM” / “Ignore” on CRM check, to see it here.</p>;
  return (
    <>
      <div className="tablewrap">
        <table>
          <thead><tr><th>When</th><th>Decision</th><th>What</th><th>Value</th></tr></thead>
          <tbody>
            {rows.map(([id, d]) => (
              <tr key={id}>
                <td className="meta">{new Date(d.at).toLocaleString()}</td>
                <td><span className={`badge ${words(id, d)[1]}`}>{words(id, d)[0]}</span></td>
                <td>{d.label}</td>
                <td>{d.value ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 8 }}><button className="btn" onClick={() => confirm("Clear all decisions in this browser?") && clear()}>Clear log</button></p>
    </>
  );
}
