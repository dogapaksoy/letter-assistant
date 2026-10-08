// Runs the extraction pipeline on the eval set and scores it.
// Usage: npm run eval -- [--provider gemini|mistral|anthropic] [--lang tr|en] [--only <case-id>]
// API keys go in .env.eval (see .env.eval.example). SYNTHETIC letters only: real letters
// are refused unless --allow-real-data is passed for an EU, no-training configuration.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { extractFromLetter, type ExtractionOutcome } from '../../src/core/extraction/pipeline';
import type { OutputLanguage } from '../../src/core/extraction/prompt';
import { createAnthropicProvider } from '../../src/core/llm/anthropic';
import { createGeminiProvider } from '../../src/core/llm/gemini';
import { createMistralProvider } from '../../src/core/llm/mistral';
import type { LlmProvider } from '../../src/core/llm/types';
import { type EvalCase, loadEvalCases } from './ground-truth';
import { type JudgeMatch, judgeMatches } from './judge';
import { withPacing } from './paced';
import {
  type DeadlineScore,
  type MatchScore,
  ratio,
  scoreDatedDeadlines,
  scoreMatches,
} from './score';

interface CaseResult {
  id: string;
  synthetic: boolean;
  outcome: ExtractionOutcome;
  deadlines?: DeadlineScore;
  relative?: MatchScore & { matches: JudgeMatch[] };
  actions?: MatchScore & { requiredExpected: number; requiredFound: number; matches: JudgeMatch[] };
  verification?: { verified: number; total: number };
  judgeError?: string;
}

const { values } = parseArgs({
  options: {
    provider: { type: 'string' },
    lang: { type: 'string', default: 'en' },
    only: { type: 'string' },
    'allow-real-data': { type: 'boolean', default: false },
  },
});
const language = values.lang as OutputLanguage;
if (language !== 'en' && language !== 'tr') {
  console.error('--lang must be "en" or "tr"');
  process.exit(1);
}

const root = join(__dirname, '../..');
const cases = loadEvalCases(join(root, 'eval')).filter(
  (c) => !values.only || c.truth.id === values.only,
);
if (cases.length === 0) {
  console.error('No eval cases found.');
  process.exit(1);
}

const realCases = cases.filter((c) => !c.truth.synthetic);
if (realCases.length > 0 && !values['allow-real-data']) {
  console.error(
    `Refusing to send ${realCases.length} non-synthetic letter(s) to an LLM provider.\n` +
      'Use --only to pick synthetic cases, or pass --allow-real-data ONLY with a paid, EU, ' +
      'no-training provider configuration (CLAUDE.md privacy rules).',
  );
  process.exit(1);
}

const KEY_VARS = {
  gemini: 'GEMINI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
} as const;
type ProviderName = keyof typeof KEY_VARS;
const hasKey = (name: ProviderName) => Boolean(process.env[KEY_VARS[name]]?.trim());

const providerName = (values.provider ??
  (Object.keys(KEY_VARS) as ProviderName[]).find(hasKey) ??
  'gemini') as ProviderName;
if (!(providerName in KEY_VARS)) {
  console.error('--provider must be "gemini", "mistral" or "anthropic"');
  process.exit(1);
}
if (!hasKey(providerName)) {
  console.error(
    `${KEY_VARS[providerName]} is not set. Copy .env.eval.example to .env.eval and put your key there.`,
  );
  process.exit(1);
}

const PROVIDERS: Record<ProviderName, () => LlmProvider> = {
  gemini: createGeminiProvider,
  mistral: createMistralProvider,
  anthropic: createAnthropicProvider,
};
// Free tiers (gemini, mistral) allow only a few requests per minute.
const provider = withPacing(PROVIDERS[providerName](), {
  minIntervalMs: providerName === 'anthropic' ? 0 : 12_000,
  retryDelaysMs: [20_000, 40_000, 60_000, 60_000],
  onRetry: (attempt, delayMs, error) =>
    process.stdout.write(`[${error.message}; retry ${attempt} in ${delayMs / 1000}s] `),
});

async function runCase(c: EvalCase): Promise<CaseResult> {
  const outcome = await extractFromLetter({ provider, letterText: c.letterText, language });
  const result: CaseResult = { id: c.truth.id, synthetic: c.truth.synthetic, outcome };
  if (!outcome.ok) return result;

  const { extraction } = outcome;
  const items = [...extraction.summary, ...extraction.deadlines, ...extraction.actions];
  result.verification = {
    verified: items.filter((i) => i.verification.status === 'verified').length,
    total: items.length,
  };
  result.deadlines = scoreDatedDeadlines(c.truth, extraction.deadlines);

  try {
    const expectedRelative = c.truth.deadlines.filter((d) => d.kind === 'relative');
    const predictedRelative = extraction.deadlines.filter((d) => d.kind === 'relative');
    const relativeMatches = await judgeMatches(
      provider,
      expectedRelative.map((d) => ({ id: d.id, text: d.description[language] })),
      predictedRelative.map((d) => d.value),
    );
    result.relative = {
      ...scoreMatches(
        expectedRelative.map((d) => d.id),
        predictedRelative.length,
        relativeMatches,
      ),
      matches: relativeMatches,
    };

    const actionMatches = await judgeMatches(
      provider,
      c.truth.actions.map((a) => ({
        id: a.id,
        text: (a.condition ? `${a.condition[language]}: ` : '') + a.description[language],
      })),
      extraction.actions.map((a) => (a.condition ? `${a.condition}: ` : '') + a.value),
    );
    const required = c.truth.actions.filter((a) => a.type === 'required').map((a) => a.id);
    result.actions = {
      ...scoreMatches(
        c.truth.actions.map((a) => a.id),
        extraction.actions.length,
        actionMatches,
      ),
      requiredExpected: required.length,
      requiredFound: actionMatches.filter(
        (m) => required.includes(m.expectedId) && m.predictedIndex !== null,
      ).length,
      matches: actionMatches,
    };
  } catch (error) {
    result.judgeError = error instanceof Error ? error.message : 'judge failed';
  }
  return result;
}

function sum(results: CaseResult[], pick: (r: CaseResult) => number | undefined): number {
  return results.reduce((total, r) => total + (pick(r) ?? 0), 0);
}

function reviewMarkdown(results: CaseResult[]): string {
  const lines = [
    '# Judge review',
    '',
    'Spot-check the LLM judge: for each expected item, is the decision right?',
    '',
  ];
  for (const r of results) {
    if (!r.outcome.ok) continue;
    const c = cases.find((x) => x.truth.id === r.id)!;
    const extraction = r.outcome.extraction;
    lines.push(`## ${r.id}`, '');
    const sections: [string, JudgeMatch[] | undefined, { id: string; text: string }[], string[]][] =
      [
        [
          'Relative deadlines',
          r.relative?.matches,
          c.truth.deadlines
            .filter((d) => d.kind === 'relative')
            .map((d) => ({ id: d.id, text: d.description[language] })),
          extraction.deadlines.filter((d) => d.kind === 'relative').map((d) => d.value),
        ],
        [
          'Actions',
          r.actions?.matches,
          c.truth.actions.map((a) => ({ id: a.id, text: a.description[language] })),
          extraction.actions.map((a) => a.value),
        ],
      ];
    for (const [title, matches, expected, predicted] of sections) {
      if (!matches || expected.length === 0) continue;
      lines.push(
        `### ${title}`,
        '',
        '| Expected | Matched prediction | Judge reason |',
        '|---|---|---|',
      );
      for (const m of matches) {
        const exp = expected.find((e) => e.id === m.expectedId);
        const pred = m.predictedIndex === null ? '— (no match)' : predicted[m.predictedIndex];
        lines.push(`| ${m.expectedId}: ${exp?.text ?? ''} | ${pred ?? ''} | ${m.reason} |`);
      }
      const used = new Set(matches.map((m) => m.predictedIndex));
      const extras = predicted.filter((_, i) => !used.has(i));
      if (extras.length > 0)
        lines.push('', `Unmatched predictions: ${extras.map((e) => `"${e}"`).join('; ')}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

async function main() {
  console.log(`Running ${cases.length} case(s), language=${language}, provider=${provider.name}\n`);
  const results: CaseResult[] = [];
  for (const c of cases) {
    process.stdout.write(`- ${c.truth.id} ... `);
    const r = await runCase(c);
    results.push(r);
    console.log(
      r.outcome.ok
        ? r.judgeError
          ? `ok (judge failed: ${r.judgeError})`
          : 'ok'
        : `FAILED (${r.outcome.error}${r.outcome.detail ? `: ${r.outcome.detail}` : ''})`,
    );
  }

  const ok = results.filter((r) => r.outcome.ok);
  console.log('\nResults');
  console.table(
    results.map((r) => ({
      case: r.id,
      parsed: r.outcome.ok ? 'yes' : r.outcome.error,
      'dated deadlines': r.deadlines
        ? ratio(r.deadlines.datedFound, r.deadlines.datedExpected)
        : '-',
      'wrong dates': r.deadlines?.wrongDates ?? '-',
      'relative flagged': r.relative ? ratio(r.relative.found, r.relative.expected) : '-',
      'required actions': r.actions
        ? ratio(r.actions.requiredFound, r.actions.requiredExpected)
        : '-',
      'all actions': r.actions ? ratio(r.actions.found, r.actions.expected) : '-',
      'extra actions': r.actions?.extra ?? '-',
      'quotes verified': r.verification
        ? ratio(r.verification.verified, r.verification.total)
        : '-',
    })),
  );

  console.log('Totals');
  console.log(`  parsed:              ${ratio(ok.length, results.length)}`);
  console.log(
    `  dated deadlines:     ${ratio(
      sum(ok, (r) => r.deadlines?.datedFound),
      sum(ok, (r) => r.deadlines?.datedExpected),
    )}`,
  );
  console.log(
    `  wrong dates:         ${sum(ok, (r) => r.deadlines?.wrongDates)} (distractors: ${sum(ok, (r) => r.deadlines?.distractorDates)})`,
  );
  console.log(
    `  relative flagged:    ${ratio(
      sum(ok, (r) => r.relative?.found),
      sum(ok, (r) => r.relative?.expected),
    )}`,
  );
  console.log(
    `  required actions:    ${ratio(
      sum(ok, (r) => r.actions?.requiredFound),
      sum(ok, (r) => r.actions?.requiredExpected),
    )}`,
  );
  console.log(
    `  all actions:         ${ratio(
      sum(ok, (r) => r.actions?.found),
      sum(ok, (r) => r.actions?.expected),
    )}`,
  );
  console.log(`  extra actions:       ${sum(ok, (r) => r.actions?.extra)}`);
  console.log(
    `  quotes verified:     ${ratio(
      sum(ok, (r) => r.verification?.verified),
      sum(ok, (r) => r.verification?.total),
    )}`,
  );
  console.log(
    `  dropped items:       ${sum(ok, (r) => (r.outcome.ok ? r.outcome.dropped.summary + r.outcome.dropped.deadlines + r.outcome.dropped.actions : 0))}`,
  );

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(root, 'eval', 'results');
  mkdirSync(outDir, { recursive: true });
  const promptVersion = results[0]?.outcome.promptVersion;
  const models = [...new Set(ok.map((r) => (r.outcome.ok ? r.outcome.model : '')))];
  writeFileSync(
    join(outDir, `${stamp}.json`),
    JSON.stringify({ language, promptVersion, models, results }, null, 2),
  );
  writeFileSync(join(outDir, `${stamp}-judge-review.md`), reviewMarkdown(results));
  console.log(`\nModel(s): ${models.join(', ')} | prompt: ${promptVersion}`);
  console.log(`Saved eval/results/${stamp}.json and ${stamp}-judge-review.md`);

  if (ok.length === 0) {
    console.error('\nNo letter could be processed; see the "parsed" column for the reason.');
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
