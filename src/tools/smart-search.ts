import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { searchQuotes } from '../db/queries.js';
import { formatHits } from '../format/quotes.js';
import type { Hit } from '../types.js';
import { READ_ONLY, text, type ToolContext } from './context.js';

const TOOL = 'search_quotes_smart';
const MAX_CANDIDATES = 30;
const PER_TERM = 15;
const MAX_SESSIONS = 10;
const PREVIEW_CHARS = 400;

/** Candidate sets from phase 2, keyed by query + expanded terms, so phase 3 can pick from them. */
const sessions = new Map<string, Hit[]>();

function sessionKey(query: string, terms: string[]): string {
  return `${query}::${[...terms].sort().join(',')}`;
}

function remember(key: string, hits: Hit[]): void {
  sessions.set(key, hits);
  while (sessions.size > MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest === undefined) break;
    sessions.delete(oldest);
  }
}

export function expandPhase(query: string): string {
  return [
    '## Step 1 of 3: expand the query',
    `Original query: "${query}"`,
    '',
    'Generate 5-7 alternative search terms or short phrases for this topic: synonyms, adjacent concepts, jargon and plain-language variants.',
    `Then call \`${TOOL}\` again with the same query and \`expanded_terms\` set to that list.`
  ].join('\n');
}

export function collectCandidates(ctx: ToolContext, query: string, terms: string[], guest?: string): Hit[] {
  const byKey = new Map<string, Hit>();
  for (const term of [query, ...terms]) {
    for (const hit of searchQuotes(ctx.db, term, { guest, limit: PER_TERM })) {
      const key = `${hit.episode.slug}:${hit.segment.idx}`;
      const existing = byKey.get(key);
      if (!existing || hit.score > existing.score) byKey.set(key, hit);
    }
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, MAX_CANDIDATES);
}

export function filterPhase(query: string, candidates: Hit[]): string {
  const lines = [
    `## Step 2 of 3: pick the relevant candidates (${candidates.length})`,
    `Original query: "${query}"`,
    ''
  ];
  candidates.forEach((hit, i) => {
    const preview = hit.segment.text.length > PREVIEW_CHARS ? `${hit.segment.text.slice(0, PREVIEW_CHARS)}...` : hit.segment.text;
    lines.push(`**[${i}]** ${hit.segment.speaker} (${hit.episode.guest})`, `> ${preview}`, '');
  });
  lines.push(
    `Select the candidates that directly and substantively discuss "${query}" (up to 7, best first).`,
    `Then call \`${TOOL}\` again with the same query, the same \`expanded_terms\`, and \`selected_indices\` set to those index numbers. Use an empty list if none fit.`
  );
  return lines.join('\n');
}

export function registerSmartSearchTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    TOOL,
    {
      title: 'Smart search (3 steps)',
      description:
        "Higher-recall search for nuanced topics where wording varies (e.g. 'imposter syndrome', 'saying no to stakeholders'). Three calls: (1) query only, you get asked to expand it; (2) add expanded_terms, you get candidates; (3) add selected_indices, you get the final quotes. For simple keyword lookups use search_quotes instead.",
      inputSchema: {
        query: z.string().min(1).describe('The topic to find quotes about'),
        guest: z.string().optional().describe('Only quotes from episodes with this guest'),
        limit: z.number().int().min(1).max(10).default(5).describe('Maximum number of final quotes'),
        expanded_terms: z.array(z.string()).optional().describe('Step 2: the alternative search terms you generated'),
        selected_indices: z.array(z.number().int()).optional().describe('Step 3: candidate indices you judged relevant')
      },
      annotations: READ_ONLY
    },
    async ({ query, guest, limit, expanded_terms, selected_indices }) => {
      if (!expanded_terms) return text(expandPhase(query));

      const key = sessionKey(query, expanded_terms);
      if (!selected_indices) {
        const candidates = collectCandidates(ctx, query, expanded_terms, guest);
        if (candidates.length === 0) return text(`No quotes found for "${query}" even with expanded terms. Try a different topic.`);
        remember(key, candidates);
        return text(filterPhase(query, candidates));
      }

      const candidates = sessions.get(key) ?? collectCandidates(ctx, query, expanded_terms, guest);
      sessions.delete(key);
      const chosen = selected_indices
        .filter((i) => i >= 0 && i < candidates.length)
        .slice(0, limit)
        .map((i) => candidates[i]!);
      if (chosen.length === 0) return text(`No candidates were selected as relevant for "${query}".`);
      return text(`Found ${chosen.length} relevant quote(s) for "${query}":\n\n${formatHits(chosen)}`);
    }
  );
}
