// Turns a short note typed after an unrecorded call into suggestions. Suggestions only:
// nothing is saved to the CRM here.
import { dataset } from "@/lib/data.ts";
import { guessLeads } from "@/lib/match.ts";
import { aiConfigured, analyzeText } from "@/lib/llm.ts";

const MAX_CHARS = 2000;
const hits = new Map<string, number[]>(); // simple per-visitor limit to protect the free AI tier

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 20) return Response.json({ error: "Too many notes in a short time. Please wait a few minutes." }, { status: 429 });

  let body: { text?: unknown; leadId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 10) return Response.json({ error: "Please write a little more about the call." }, { status: 400 });
  if (text.length > MAX_CHARS) return Response.json({ error: `Please keep the note under ${MAX_CHARS} characters.` }, { status: 400 });

  const chosen = typeof body.leadId === "string" && body.leadId ? dataset.crm.find((r) => r.lead_id === body.leadId) : undefined;
  const candidates = chosen ? [chosen] : guessLeads(text, dataset.crm);
  if (!chosen && candidates.length !== 1) {
    return Response.json({
      needsClient: true,
      message: candidates.length ? "This note could match more than one CRM record. Please pick the client." : "I couldn’t tell which client this is about. Please pick the client.",
      candidates: candidates.map((r) => ({ leadId: r.lead_id, company: r.company, contact: r.contact_name })),
    });
  }
  if (!aiConfigured()) return Response.json({ error: "AI is not configured on this server (GROQ_API_KEY missing)." }, { status: 503 });

  recent.push(now);
  hits.set(ip, recent);
  const lead = candidates[0];
  try {
    const analysis = await analyzeText({ text, date: dataset.today, today: dataset.today, crm: [lead], label: "quick note typed by the seller after a call" });
    return Response.json({ lead: { leadId: lead.lead_id, company: lead.company, status: lead.status, est_value_usd: lead.est_value_usd, owner: lead.owner, service_interest: lead.service_interest, contact_name: lead.contact_name, contact_email: lead.contact_email, next_followup_date: lead.next_followup_date, last_contact_date: lead.last_contact_date }, analysis });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
