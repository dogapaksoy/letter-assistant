// Supabase Edge Function entry (Deno). The logic lives in src/server/extract-letter.ts
// and is bundled into ./handler.js by `npm run functions:build`; deno.json (also
// generated) maps the npm packages it imports.
import { createRequestHandler, depsFromEnv } from './handler.js';

declare const Deno: {
  env: { toObject(): Record<string, string> };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};

// Read the environment once at startup; secrets are set with `supabase secrets set`.
const deps = depsFromEnv(Deno.env.toObject());

Deno.serve(createRequestHandler(() => deps));
