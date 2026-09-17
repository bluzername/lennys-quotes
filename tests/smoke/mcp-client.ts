/**
 * End-to-end smoke test: spawn the server over stdio and exercise every tool.
 * Usage: LENNYS_DB=data/lennys.db tsx tests/smoke/mcp-client.ts
 */
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const dbPath = process.env.LENNYS_DB ?? path.join(root, 'data', 'lennys.db');

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', path.join(root, 'src', 'index.ts')],
  env: { ...process.env, LENNYS_DB: dbPath, LENNYS_OFFLINE: '1' } as Record<string, string>,
  stderr: 'pipe'
});
const client = new Client({ name: 'smoke', version: '0.0.0' });
const started = Date.now();
await client.connect(transport);
console.log(`connected in ${Date.now() - started}ms`);

const tools = await client.listTools();
console.log('tools:', tools.tools.map((t) => t.name).join(', '));
const searchSchema = tools.tools.find((t) => t.name === 'search_quotes')?.inputSchema as { properties?: Record<string, unknown> };
if (!searchSchema?.properties?.query) throw new Error('search_quotes schema missing query property');

function textOf(result: Awaited<ReturnType<typeof client.callTool>>): string {
  const content = result.content as Array<{ type: string; text?: string }>;
  return content.map((c) => c.text ?? '').join('\n');
}

const checks: Array<[string, Record<string, unknown>, (out: string) => boolean]> = [
  ['data_status', {}, (o) => /Episodes:\*\* \d{3}/.test(o)],
  ['search_quotes', { query: 'product-market fit', limit: 3 }, (o) => o.includes('Found 3 quote') && o.includes('youtube.com/watch?v=')],
  ['search_quotes', { query: '"talent density"', limit: 2 }, (o) => /talent density/i.test(o)],
  ['search_quotes', { query: 'design', guest: 'Chesky', limit: 2 }, (o) => o.includes('Brian Chesky')],
  ['search_quotes', { query: 'zzzzqqqq', limit: 2 }, (o) => o.startsWith('No quotes found')],
  ['list_guests', { sort_by: 'date', limit: 5 }, (o) => o.includes('5 episode(s)') && /\[\d{4}-\d{2}-\d{2}\]/.test(o)],
  ['list_guests', { search: 'Verna' }, (o) => (o.match(/Elena Verna/g) ?? []).length >= 2],
  ['get_episode', { guest: 'brian-chesky' }, (o) => o.includes('# Brian Chesky') && o.includes('**Published:** 2023-11-12')],
  ['get_episode', { guest: 'Roman Ugarte', include_transcript: true }, (o) => o.includes('(00:00:00)') && o.length > 20000],
  ['random_wisdom', {}, (o) => o.includes('Random wisdom')],
  ['random_wisdom', { topic: 'leadership' }, (o) => o.includes('Wisdom about')],
  ['search_quotes_smart', { query: 'imposter syndrome' }, (o) => o.includes('Step 1 of 3')],
  ['search_quotes_smart', { query: 'imposter syndrome', expanded_terms: ['self doubt', 'feeling like a fraud', 'confidence'] }, (o) => o.includes('Step 2 of 3') && o.includes('**[0]**')],
  ['search_quotes_smart', { query: 'imposter syndrome', expanded_terms: ['self doubt', 'feeling like a fraud', 'confidence'], selected_indices: [0, 2] }, (o) => o.includes('Found 2 relevant quote')]
];

let failed = 0;
for (const [name, args, ok] of checks) {
  const t = Date.now();
  const out = textOf(await client.callTool({ name, arguments: args }));
  const pass = ok(out);
  if (!pass) failed += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(args)} (${Date.now() - t}ms)${pass ? '' : `\n---\n${out.slice(0, 600)}\n---`}`);
}
await client.close();
if (failed > 0) {
  console.error(`${failed} smoke check(s) failed`);
  process.exit(1);
}
console.log('all smoke checks passed');
