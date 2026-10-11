// Writes src/lib/dev-samples.ts from the synthetic eval letters (front matter removed),
// so the dev-only paste screen can offer them as samples.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dir = join(root, 'eval', 'letters');
const samples = readdirSync(dir)
  .filter((file) => file.startsWith('synthetic-') && file.endsWith('.txt'))
  .sort()
  .map((file) => ({
    id: file.replace(/^synthetic-|\.txt$/g, ''),
    text: readFileSync(join(dir, file), 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''),
  }));

writeFileSync(
  join(root, 'src', 'lib', 'dev-samples.ts'),
  `// GENERATED from eval/letters (front matter removed). SYNTHETIC letters with invented
// data, for trying the app in development (paste screen) without OCR. Regenerate with:
// node scripts/build-dev-samples.mjs

export const DEV_SAMPLE_LETTERS: readonly { id: string; text: string }[] = ${JSON.stringify(samples, null, 2)};
`,
);
console.log(`Wrote ${samples.length} samples to src/lib/dev-samples.ts`);
