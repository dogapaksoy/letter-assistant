# Evaluation set

> **All letters currently in this folder are SYNTHETIC.** They are fictional letters written for testing. They are not real documents, and every name, address, reference number, IBAN and tax number in them is invented. Synthetic files start with `synthetic-` and carry `synthetic: true` in both the letter's front matter and the ground-truth JSON.

## Layout

```
eval/
  letters/        letter text as the extraction pipeline will see it (OCR / PDF text output)
  ground-truth/   hand-written expected results, one JSON per letter
  results/        eval run outputs (git-ignored)
```

Letters are plain UTF-8 text with a YAML front matter block (`--- ... ---`). The eval runner **strips the front matter** before passing the text to the pipeline, so the synthetic notice never reaches the LLM.

The synthetic letters are clean text. They do not test OCR noise. Once an OCR provider is chosen, add rendered PDF/photo versions and OCR-noisy variants.

## Ground-truth format

| Field                                             | Meaning                                                                                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `synthetic`                                       | `true` for invented letters, `false` for real anonymized ones                                                                                       |
| `id`, `letter_file`, `sender_type`, `letter_date` | identification                                                                                                                                      |
| `summary_points[]`                                | key points (`en`, `tr`, `source_quote`)                                                                                                             |
| `deadlines[]`                                     | `id`, `kind`, `date` (ISO or `null`), optional `time`, `description`, `source_quote`                                                                |
| `actions[]`                                       | `id`, `type` (`required` / `conditional` / `optional`), optional `condition`, `description`, optional `items[]`, `related_deadline`, `source_quote` |
| `non_deadline_dates[]`                            | dates in the letter that are **not** deadlines; used to measure false positives                                                                     |
| `eval_notes`                                      | what the letter is designed to test                                                                                                                 |

Deadline `kind` values:

- `due_date`: a fixed date by which something must happen
- `appointment`: a fixed date and time to attend
- `expiry`: something stops being valid on that date
- `recurring`: first `date` plus a `recurrence` description
- `relative`: no fixed date in the letter (e.g. "within 14 days of receipt"). `date` is `null`. `expected_behavior: "flag_uncertain"` means the app must show the rule and must not present a computed date as certain.

Every `source_quote` must appear **verbatim** in the letter body (after front matter is stripped). The eval runner should check this before scoring.

## Comparing runs

Only compare runs whose results report the same model (`models` in the results JSON, printed at the end of each run). Model aliases can move silently: requests for `gemini-3.5-flash` were answered by `gemini-3.5-flash` until 2026-10-09 and by `gemini-3.6-flash` on 2026-10-11. For a prompt change, run the old and the new prompt on the same day, with the same model and language.

## Adding real letters

Real letters must be anonymized **before** they are added to this folder. Replace every:

- name, address, phone number, e-mail address
- reference number (Aktenzeichen, Steuernummer, Versichertennummer, BG-Nummer, Beitragsnummer)
- IBAN, BIC, date of birth, signature

with obviously fake values (`Musterstadt`, `000/000/00000`, `DE00 0000 ...`). Keep dates, amounts and wording intact, because they are what the eval measures. Set `synthetic: false` and do not use the `synthetic-` prefix.

Never commit an original, unredacted letter, not even temporarily: git history keeps it.
