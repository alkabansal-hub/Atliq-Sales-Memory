import { dataset } from "@/lib/data.ts";
import NoteForm from "./note-form";

export default function QuickNotePage() {
  const clients = dataset.crm.map((r) => ({ leadId: r.lead_id, label: `${r.company} (${r.lead_id})${r.contact_name ? ` · ${r.contact_name}` : ""}` }));
  return (
    <>
      <h1>Quick note after a call</h1>
      <p className="lead">
        Most calls happen on the move and can’t be recorded. Type or speak two or three lines after the call. The assistant finds the client,
        puts the reminders on Pending follow-ups and the CRM changes on CRM check. If it can’t tell which client you mean, it asks instead of guessing.
      </p>
      <NoteForm clients={clients} today={dataset.today} />
    </>
  );
}
