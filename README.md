# Letter Assistant

A mobile app that helps immigrants and international students in Germany understand official German letters. The user photographs or uploads a letter and gets, in Turkish or English, a short summary, the deadlines and a checklist of actions. Every item links to the exact passage in the letter, and items whose passage cannot be found are flagged.

The app is a comprehension aid, **not legal advice**.

## Status

**Prototype, not released.** The MVP code is complete and runs end to end, but only with synthetic test letters. It is not ready for real letters yet (see [Missing before real users](#missing-before-real-users)).

### What works

- Upload a photo (camera or library) or a PDF.
- Summary, deadlines and an action checklist, in Turkish or English.
- Every item links to its source passage: highlighted in the letter text, and on the photo when OCR word positions are available.
- Code (not the LLM) checks every quote against the letter text, tolerating OCR noise. Unverified and low-confidence items are shown with a plain-language warning.
- Users can report a wrong item. Reports are anonymous and contain no letter content.
- Add a deadline to the device calendar, with reminders.
- Backend: a Supabase Edge Function in Frankfurt, with rate limiting and an explicit data mode (synthetic-only vs. approved for personal data).
- CI on every PR: lint, formatting, type checks, Jest and node tests, and a Deno check of the edge function.

### Measured quality

From the eval set in `eval/` (2026-10-20, prompt `extraction-v4`, model `gemini-3.6-flash`, Turkish output, 5 synthetic letters):

| Check                                 | Result                    |
| ------------------------------------- | ------------------------- |
| Deadlines with a date                 | 8/8 found, no wrong dates |
| Source quotes verified                | 48/48                     |
| Relative deadlines ("within 14 days") | 3/3 (4 letters judged)    |
| Required actions                      | 10/10 (4 letters judged)  |

These letters are synthetic and clean text. Accuracy on real letters, on OCR output from photos and for English output has **not** been measured yet.

### Missing before real users

- **OCR for photos:** needs an Azure AI Document Intelligence resource in an EU region (`OCR_PROVIDER=azure`, `AZURE_DI_ENDPOINT`, `AZURE_DI_KEY`; see `supabase/functions/.env.example`). Until then photos and scanned PDFs return `ocr_not_configured`; PDFs with a text layer work. The adapter is unit-tested but has not run against a real resource.
- **Multi-page letters on the free OCR tier:** Azure's free tier (F0) analyzes only the first two pages of a request. The app does not warn about this yet, so a deadline on page 3 could be missed silently.
- **An EU, no-training LLM configuration:** the backend currently runs with a free-tier LLM in synthetic-only mode. Real letters must not be processed until this is in place and `LLM_APPROVED_FOR_PERSONAL_DATA=true` is set.
- **Privacy policy:** `docs/privacy-policy.md` is a draft and needs a legal review.
- **Real test letters:** anonymized real letters with ground truth, to measure accuracy beyond synthetic examples.
- **Store release:** EAS build profiles and app identifiers are ready; Apple Developer and Google Play accounts are not set up.

Not planned for the MVP: drafting replies, chat or follow-up questions, payments, more than two output languages, sharing features.

## How it works

```
app (Expo)  ──POST──▶  extract-letter (Supabase Edge Function, Frankfurt)
                         1. text: PDF text layer (unpdf) or OCR (Azure AI Document Intelligence)
                         2. LLM (adapter: Gemini / Mistral / Anthropic) returns JSON
                         3. Zod validation, item by item
                         4. code checks every source_quote against the text
             ◀──JSON──   items + verification + the letter text (kept in memory only)
```

| Folder                                    | What it contains                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/core/`                               | Platform-independent logic: schema, parsing, quote verification, prompts, LLM and text-extraction adapters |
| `src/server/`                             | The edge function's request handler (web `Request`/`Response`, tested in Jest)                             |
| `src/app/`, `src/components/`, `src/lib/` | The Expo app: screens, UI components, API client, i18n, calendar, corrections                              |
| `supabase/`                               | Supabase config, the `extract-letter` function entry and database migrations                               |
| `eval/`                                   | Synthetic test letters with hand-written ground truth                                                      |
| `scripts/`                                | Eval runner and the function build script                                                                  |

## Development

Requirements: Node 24 (see `.nvmrc`), an Expo account for Expo Go.

```bash
npm install
cp .env.example .env          # Supabase URL + publishable key
npx expo start                # scan the QR code with Expo Go
```

Checks (all run in CI):

```bash
npm run lint
npm run format:check
npm run typecheck
npm test                      # Jest
npm run test:node             # node:test (PDF extraction)
npm run functions:check       # bundles the edge function and type-checks it with Deno
```

### Evaluation

```bash
cp .env.eval.example .env.eval   # an LLM key; free tiers are for synthetic letters only
npm run eval                     # all letters; --lang tr, --only <case-id>, --provider <name>
```

Results go to `eval/results/` (git-ignored), including a judge review table to spot-check the LLM judge. Any change to prompts or extraction logic must be measured before merging; put the before/after numbers in the PR description. The runner refuses non-synthetic letters unless `--allow-real-data` is passed.

### Running the edge function locally

```bash
cp supabase/functions/.env.example supabase/functions/.env   # then fill it in
npm run functions:dev            # http://localhost:8000
```

## Deploying the backend

One-time setup (project in **Central EU (Frankfurt)**):

```bash
npx supabase login --no-browser   # prints a link; open it, then paste the code
npx supabase link --project-ref <your-project-ref>
npx supabase db push                                   # creates correction_reports
npx supabase secrets set --env-file supabase/functions/.env
npm run functions:deploy
```

The function refuses requests until its data mode is set explicitly:

- `DEV_MODE_SYNTHETIC_ONLY=true`: for development with a free-tier LLM that may train on inputs. The app shows a "test letters only" banner.
- `LLM_APPROVED_FOR_PERSONAL_DATA=true`: only after choosing an LLM configuration that processes data in the EU and does not train on submitted letters.

### Rate limiting

The function limits analyses per client and in total per hour (defaults: 10 per client, 200 overall; see `supabase/functions/.env.example`). Clients are identified by a keyed, daily-changing hash of their IP address; IPs are never stored. Required in production mode, optional in dev mode. Needs the `rate_limit` migration and a `RATE_LIMIT_SECRET`.
