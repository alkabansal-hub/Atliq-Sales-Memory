# AtliQ Sales Memory Assistant (prototype)

Capstone 1 · AtliQ Sales & CRM Assistant · Step 5

**Live app:** https://atliq-sales-memory-blond.vercel.app/

**Demo video (about 5 min):** https://www.loom.com/share/31ddd6444b144675bfe1d92d92798a95

AtliQ's founders sell on the move. Client context sits in emails, meeting notes and calls, and the CRM (Kaizen) falls ~15 days behind, so follow-ups slip and cross-sells and revisits are forgotten. This assistant reads what already exists and turns it into **suggested CRM updates, reminders and a daily priority list**. The AI only suggests; a person checks everything, and nothing is ever sent to clients.

The CRM export (CSV) is treated as **what the CRM says**; the emails and meeting notes are **what actually happened**. The assistant compares the two and shows where the CRM is out of date. It is not a CRM itself.

## What it does

Three tabs, plus a small About page.

| Tab | What you get |
|---|---|
| **Pending follow-ups** | One row per client, most urgent first, with a status: Client waiting, Nudge client, Overdue, Due soon, “Give me a week” follow-up, Deal at risk, Cross-sell, Renewal, Revisit. Click a row for a short client summary, why it ranks there and the email sentence. Filter by owner; clients with no owner get an “Assign owner” dropdown. Click Done when handled. |
| **CRM check** | Compares the CRM with the emails and notes, in tabs: Wrong in the CRM (“CRM says X → emails say Y”), Blank fields, Last contact behind, Companies not in the CRM, Entered twice. For each row: Fix in CRM → update Kaizen → Mark as fixed, or Edit / Ignore. |
| **Quick note** | Type or speak (🎤, browser speech-to-text in Chrome/Edge) 2–3 lines after an unrecorded call. Its reminders appear on Pending follow-ups under that client, and its CRM changes appear on CRM check under "From your call notes". Asks which client if the note is unclear. |
| **About** | How it works, safety rules, test results and the log of every decision. |

## How it works

1. **Read** – `scripts/build-data.ts` parses the CRM export, 34 email threads and 16 notes, links each document to its client (company name in the title → contact email → lead ID), and **removes the editorial notes** (`*(...)*` lines saying what happened later). Those are kept only as the answer key for evals.
2. **Extract (AI)** – `scripts/analyze.ts` sends one document at a time, with only that client's CRM row, to an open model on **Groq** (`lib/llm.ts`). The model returns fixed fields: CRM updates, promises with dates, and signals (cross-sell, revisit, renewal, competitor, risk). Every item must quote its source; **anything whose quote is not found word-for-word in the document is dropped** (grounding check, sentence by sentence). Results are saved to `data/analysis.json`, so the deployed app does not call the AI on every page load.
3. **Rules (no AI)** – `lib/rules.ts`: reply reminder after 4 days of client silence, nudge after 4 days without a client reply, follow-up on day 9–10 after "give me a week" (the client's own rules). Ranking: urgent first → deal value → days since last contact. `lib/match.ts` finds missing leads and duplicates.
4. **Safety rules (no AI)** – `lib/crmcheck.ts`: a deal stage never moves backwards (a Won client writing again is a new deal; a Lost deal coming back is marked "deal reopened"); a lower deal value or a second service is flagged "needs a check".
5. **A person decides** – Done on follow-ups; Fix in CRM / Edit / Ignore, then Mark as fixed, on CRM check; Add to CRM for missing companies; Assign owner. Decisions are stored in the browser and listed in the decision log on About, ready to apply in Kaizen. There is no code path that writes to the CRM or sends messages.
6. **Quick note** – a note typed or spoken after a call goes to the AI live (`app/api/quick-note`). It is saved in the browser; its reminders join that client's row on Pending follow-ups (replacing the same older promise), and its CRM changes appear on CRM check under "From call notes".

## Run it locally

Requirements: Node.js 20+ (tested on Node 24).

```bash
npm install
cp .env.example .env.local      # then paste your free Groq key into .env.local
npm run data                    # rebuild data/dataset.json from data/raw (already included)
npm run analyze                 # run the AI over all documents (needs the key; ~3–5 min on the free tier)
npm run eval                    # print eval results in the terminal
npm run dev                     # open http://localhost:3000
npm run test-cases              # with the app running: 23 test cases, saved to data/test-results.json
```

- Get a free key at https://console.groq.com/keys. Never commit `.env.local`.
- `GROQ_MODEL` (default `qwen/qwen3.8-27b`) can be changed to any Groq chat model. The model is one setting; the PRD recommends Claude for production accuracy.
- Without a key the app still runs: it shows the saved analysis, or rule-based results if none exists. Only the Quick note page needs the key at runtime.

## Deploy (Vercel free plan)

1. Push this folder to a GitHub repository (without `.env.local`).
2. In Vercel: **Add New → Project**, import the repository, keep the defaults (Next.js).
3. In **Settings → Environment Variables** add `GROQ_API_KEY` (and optionally `GROQ_MODEL`), then deploy.

## Data

- `data/raw/` – the capstone dataset as provided (synthetic). "Today" is 10 Jul 2026 as defined in the dataset README.
- `data/dataset.json` – parsed documents and CRM records (editorial notes moved to `groundTruth`).
- `data/analysis.json` – saved AI output.
- Team (from the dataset README): Bhavin and Dhaval (founders), Karandeep (CEO), Jay (sales executive) own leads; Pranav (CTO) and Ayush (AI PM) appear on pre-sales work.
- The **sample quick notes** on the Quick note page were written by me to test the post-call feature, including an ambiguous-name case and a prompt-injection case. No other data was added.

## Guardrails (PRD Section 10)

- Grounded: every AI item carries a verified quote and a link to its source, with the sentence highlighted.
- Human-controlled: no automatic CRM writes, no client messages.
- Honest: confidence shown on every AI item; low confidence is marked "needs a check"; unclear dates are kept as words, not guessed.
- Injection-safe: document text is treated as data; test it with the sample note.
- No answer-key leakage: editorial notes never reach the AI.
- Free-tier friendly: AI results are cached; the quick-note API is rate-limited per visitor and limited to 2,000 characters.

## Project structure

```
app/                 pages (Pending follow-ups, CRM check, Quick note, About, source viewer)
app/api/quick-note   the only live AI endpoint
lib/parse.ts         dataset parsing, editorial-note removal
lib/match.ts         client linking, missing leads, duplicates (rules)
lib/rules.ts         reminders and ranking (rules)
lib/llm.ts           AI prompt, Groq call, grounding check
lib/crmcheck.ts      CRM vs evidence comparison, safety checks on suggestions
lib/evals.ts         evals against the answer key
scripts/             build-data, analyze, eval, test-cases
```
