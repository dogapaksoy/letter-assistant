# Letter Assistant

A mobile app that helps immigrants and international students in Germany understand official German letters. The user photographs or uploads a letter and gets, in Turkish or English, a short summary, the deadlines and a checklist of actions. Every item links to the exact passage in the letter, and items whose passage cannot be found are flagged.

The app is a comprehension aid, **not legal advice**.

## How it works

```
app (Expo)  ──POST──▶  extract-letter (Supabase Edge Function, Frankfurt)
                         1. text: PDF text layer (unpdf) or OCR (provider not chosen yet)
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
- `LLM_APPROVED_FOR_PERSONAL_DATA=true`: only after choosing an EU, no-training LLM configuration (see `CLAUDE.md` privacy rules).

### Rate limiting

The function limits analyses per client and in total per hour (defaults: 10 per client, 200 overall; see `supabase/functions/.env.example`). Clients are identified by a keyed, daily-changing hash of their IP address; IPs are never stored. Required in production mode, optional in dev mode. Needs the `rate_limit` migration and a `RATE_LIMIT_SECRET`.

## Open decisions before real users

- **OCR provider** for photos and scanned PDFs (until then the function answers `ocr_not_configured` for photos; digital PDFs work).
- **EU, no-training LLM configuration** for personal data.
- **Privacy policy** review: `docs/privacy-policy.md` is a draft.
