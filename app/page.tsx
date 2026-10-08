import { aiRan, analysis, items, leadById, TODAY } from "@/lib/data.ts";
import { rankReason } from "@/lib/rules.ts";
import { daysBetween, fmt } from "@/lib/dates.ts";
import TodayList, { type ClientGroup } from "./components/today-list";

const SELLERS = ["Bhavin", "Dhaval", "Karandeep", "Jay"];

export default function TodayPage() {
  // One row per client; items are already ranked, so the first item of each client leads.
  const groups = new Map<string, ClientGroup>();
  for (const i of items) {
    if (i.kind === "missing_lead") continue; // these are on the CRM check tab
    const key = i.leadId ?? i.company;
    const owner = (i.leadId && leadById(i.leadId)?.owner) || "Unassigned";
    if (!groups.has(key)) groups.set(key, { key, company: i.company, owner, value: i.value, items: [], rankWhy: rankReason(i, TODAY), summary: i.leadId ? analysis.accounts[i.leadId] : undefined });
    groups.get(key)!.items.push(i);
  }
  const list = [...groups.values()];
  const waiting = items.filter((i) => i.kind === "client_waiting").length;
  const overdue = items.filter((i) => i.kind === "commitment" && i.tier < 3 && i.due && daysBetween(i.due, TODAY) > 0).length;

  return (
    <>
      <h1>Pending follow-ups</h1>
      <p className="lead">
        {fmt(TODAY)} · <b>{waiting}</b> clients waiting for a reply · <b>{overdue}</b> promises overdue. Most urgent first: overdue or waiting → bigger deal → longer silence.
      </p>
      {!aiRan() && <div className="notice">AI analysis not run yet: showing rule-based reminders only.</div>}
      <TodayList groups={list} owners={SELLERS.concat("Unassigned")} today={TODAY} />
    </>
  );
}
