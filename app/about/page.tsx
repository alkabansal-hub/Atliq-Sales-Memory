import { analysis, aiRan, dataset, items } from "@/lib/data.ts";
import { runEvals } from "@/lib/evals.ts";
import AuditLog from "./audit-log";
import ReviewScore from "./review-score";

export default function AboutPage() {
  const evals = runEvals(dataset, analysis, items);
  return (
    <>
      <h1>About</h1>
      <p className="lead">
        The assistant reads AtliQ’s CRM, client emails, meeting notes and quick notes after calls, and suggests updates and reminders.
        <b> The AI only suggests; a person checks everything. Nothing is ever sent to clients.</b>
      </p>

      <h2>How it works</h2>
      <div className="flow">
        <div className="step">
          <span className="tag t-none">No AI</span>
          <b><span className="n">1</span> Collect</b>
          <p>Takes the CRM export (40 clients), 34 email threads and 16 meeting notes, and links each one to its client.</p>
        </div>
        <span className="arrow-big">→</span>
        <div className="step">
          <span className="tag t-ai">AI</span>
          <b><span className="n">2</span> Read</b>
          <p>The AI reads each email or note and picks out CRM changes, promises with dates, and hints like cross-sell. Each one must quote the exact sentence, or it is thrown away.</p>
        </div>
        <span className="arrow-big">→</span>
        <div className="step">
          <span className="tag t-none">No AI</span>
          <b><span className="n">3</span> Compare &amp; sort</b>
          <p>Compares the CRM with the emails to find what is wrong or missing. Simple rules decide who needs a follow-up and in what order.</p>
        </div>
        <span className="arrow-big">→</span>
        <div className="step">
          <span className="tag t-you">You</span>
          <b><span className="n">4</span> Decide</b>
          <p>A person checks each item, fixes it in Kaizen and marks it done. The app never changes the CRM or messages clients.</p>
        </div>
      </div>

      <h3>What you see</h3>
      <div className="flow outputs">
        <div className="step"><b>Pending follow-ups</b><p>One row per client, most urgent first. Status: client waiting, nudge, overdue, “give me a week”.</p></div>
        <div className="step"><b>CRM check</b><p>What is wrong, blank or missing in the CRM, with the email as proof. Fix in CRM, then mark as fixed.</p></div>
        <div className="step"><b>Quick note</b><p>After a call, type or speak 2–3 lines. Its reminders go to Pending follow-ups and its changes to CRM check.</p></div>
      </div>

      <h3>The follow-up rules (no AI)</h3>
      <div className="tablewrap">
        <table>
          <tbody>
            <tr><td><span className="badge b-red">Client waiting</span></td><td>The client wrote and AtliQ has not replied for 4 days.</td></tr>
            <tr><td><span className="badge b-amber">Nudge client</span></td><td>AtliQ wrote and the client has not replied for 4 days.</td></tr>
            <tr><td><span className="badge b-amber">“Give me a week”</span></td><td>The client asked for a week: follow up on day 9–10.</td></tr>
            <tr><td><b>Order</b></td><td>Overdue or waiting first, then bigger deal, then longer silence.</td></tr>
          </tbody>
        </table>
      </div>
      <p className="meta">AI model: {aiRan() ? analysis.model : "not run yet"} on Groq (free tier).</p>

      <h2>Safety rules</h2>
      <ul className="steps">
        <li>Every AI suggestion must quote its source word for word, or it is removed.</li>
        <li>A deal stage never moves backwards. A lower deal value or a second service gets a “needs a check” warning.</li>
        <li>No automatic CRM changes and no messages to clients.</li>
        <li>If unsure, it says so (“needs a check”) or asks which client you mean.</li>
        <li>Instructions hidden inside emails are ignored.</li>
        <li>The dataset’s “what happened later” notes are hidden from the AI and used only to test it.</li>
      </ul>

      <h2>Test results</h2>
      <p className="meta">Checked against the dataset’s answer key. Targets from the PRD.</p>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Test</th><th>Result</th><th>Target met?</th></tr></thead>
          <tbody>
            {evals.map((e) => (
              <tr key={e.name}>
                <td><b>{e.name}</b><div className="meta">{e.what}</div></td>
                <td>{e.score}</td>
                <td>{e.pass === null ? "—" : e.pass ? "✓ Yes" : "✗ No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReviewScore />

      <h2>Decision log (this browser)</h2>
      <AuditLog />
    </>
  );
}
