// Shared types. Kept to plain type declarations so Node can run the scripts directly.

export type CrmRecord = {
  lead_id: string;
  company: string;
  contact_name: string;
  contact_email: string;
  source: string;
  service_interest: string;
  status: string;
  est_value_usd: string;
  owner: string;
  created_date: string;
  last_contact_date: string;
  next_followup_date: string;
  notes: string;
};

export type Message = {
  from: string;
  fromEmail: string;
  to: string;
  date: string; // YYYY-MM-DD
  subject?: string;
  body: string;
  fromAtliq: boolean;
};

export type Doc = {
  id: string; // file name without extension
  kind: "email" | "note";
  file: string;
  title: string;
  date: string; // date of the latest message (emails) or of the note
  text: string; // full text WITHOUT editorial notes; this is all the AI ever sees
  messages: Message[]; // emails only
  companyInTitle: string; // company name read from the title
  leadIds: string[]; // linked CRM records
  internal: boolean; // internal AtliQ notes (pipeline reviews etc.)
};

// Editorial "what happened later" notes. Used only to grade the assistant (evals), never as AI input.
export type GroundTruth = Record<string, string[]>;

export type Dataset = {
  today: string;
  crm: CrmRecord[];
  docs: Doc[];
  groundTruth: GroundTruth;
};

export type Confidence = "high" | "medium" | "low";

export type CrmUpdate = {
  field: "status" | "est_value_usd" | "next_step" | "service_interest" | "contact_name" | "contact_email" | "owner" | "last_contact_date";
  value: string;
  quote: string;
  confidence: Confidence;
};

export type Commitment = {
  who: string; // who owes it (AtliQ side)
  what: string;
  due: string | null; // YYYY-MM-DD
  dueText: string; // the original words, e.g. "next week"
  quote: string;
  confidence: Confidence;
};

export type Signal = {
  type: "cross_sell" | "revisit" | "renewal" | "competitor" | "risk" | "new_lead";
  detail: string;
  date: string | null; // e.g. revisit date
  quote: string;
  confidence: Confidence;
};

export type DocAnalysis = {
  summary: string;
  crmUpdates: CrmUpdate[];
  commitments: Commitment[];
  signals: Signal[];
  dropped: number; // items removed because their quote was not found in the source (grounding check)
};

export type Analysis = {
  generatedAt: string | null;
  model: string | null;
  docs: Record<string, DocAnalysis>;
  accounts: Record<string, string>; // lead_id -> short grounded summary
};
