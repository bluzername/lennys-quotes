import type { SearchIndex, SearchResult, QuoteResult } from '../data/types.js';
import { searchIndex } from '../data/indexer.js';
import { searchResultToQuote, formatQuotesForDisplay } from './quote-extractor.js';

/**
 * Phase identifiers for the multi-step search process
 */
export type SearchPhase = 'expand' | 'filter' | 'complete';

/**
 * Candidate quote for filtering phase
 */
export interface CandidateQuote {
  index: number;
  speaker: string;
  guest: string;
  episodeTitle: string;
  text: string;
  timestamp: string;
}

/**
 * Response structure for multi-phase search
 */
export interface SmartSearchResponse {
  phase: SearchPhase;

  // Phase: expand
  instruction?: string;
  originalQuery?: string;
  continueWith?: {
    tool: string;
    setParam: string;
    description: string;
  };

  // Phase: filter
  candidates?: CandidateQuote[];
  candidateCount?: number;

  // Phase: complete
  results?: string;
  resultCount?: number;
}

/**
 * Parameters for smart search
 */
export interface SmartSearchParams {
  query: string;
  guest?: string;
  limit?: number;
  minScore?: number;
  // Multi-phase parameters
  expandedTerms?: string[];
  selectedIndices?: number[];
}

/**
 * Internal storage for search session candidates
 * Key: hash of query + expanded terms
 */
const sessionCandidates = new Map<string, SearchResult[]>();

/**
 * Generate a session key for storing candidates
 */
function getSessionKey(query: string, expandedTerms: string[]): string {
  return `${query}::${expandedTerms.sort().join(',')}`;
}

/**
 * Phase 1: Generate query expansion instructions
 */
function handleExpandPhase(query: string): SmartSearchResponse {
  return {
    phase: 'expand',
    originalQuery: query,
    instruction: `Generate 5-7 alternative search terms or phrases related to "${query}".
Think about:
- Synonyms and related concepts
- How people might describe this topic differently
- Related problems or solutions
- Industry jargon vs. plain language

Return ONLY a JSON array of strings, like:
["term 1", "term 2", "term 3", "term 4", "term 5"]

Do not include any other text or explanation.`,
    continueWith: {
      tool: 'search_quotes',
      setParam: 'expanded_terms',
      description: 'Call search_quotes again with the same query and add expanded_terms parameter with your JSON array'
    }
  };
}

/**
 * Phase 2: Run multi-term search and generate filter instructions
 */
function handleFilterPhase(
  index: SearchIndex,
  query: string,
  expandedTerms: string[],
  options: { guest?: string; minScore?: number }
): SmartSearchResponse {
  const { guest, minScore = 0.05 } = options;

  // Combine original query with expanded terms
  const allTerms = [query, ...expandedTerms];

  // Search for each term and collect unique results
  const resultMap = new Map<string, SearchResult>();

  for (const term of allTerms) {
    const results = searchIndex(index, term, {
      guest,
      limit: 15, // Get more results per term
      minScore
    });

    for (const result of results) {
      // Use episode folder + timestamp as unique key
      const key = `${result.episode.folderName}:${result.segment.timestamp}`;

      // Keep the result with the highest score
      const existing = resultMap.get(key);
      if (!existing || result.score > existing.score) {
        resultMap.set(key, result);
      }
    }
  }

  // Convert to array and sort by score
  const allResults = Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 30); // Cap at 30 candidates

  if (allResults.length === 0) {
    return {
      phase: 'complete',
      results: `No quotes found for "${query}" even with expanded search terms. Try a different topic.`,
      resultCount: 0
    };
  }

  // Store candidates for phase 3
  const sessionKey = getSessionKey(query, expandedTerms);
  sessionCandidates.set(sessionKey, allResults);

  // Clean up old sessions (keep last 10)
  if (sessionCandidates.size > 10) {
    const keys = Array.from(sessionCandidates.keys());
    for (let i = 0; i < keys.length - 10; i++) {
      sessionCandidates.delete(keys[i]);
    }
  }

  // Format candidates for LLM review
  const candidates: CandidateQuote[] = allResults.map((result, idx) => ({
    index: idx,
    speaker: result.segment.speaker,
    guest: result.episode.guest,
    episodeTitle: result.episode.title,
    text: result.segment.text.slice(0, 400) + (result.segment.text.length > 400 ? '...' : ''),
    timestamp: result.segment.timestamp
  }));

  return {
    phase: 'filter',
    originalQuery: query,
    candidates,
    candidateCount: candidates.length,
    instruction: `Review these ${candidates.length} candidate quotes and select the ones that truly and directly discuss "${query}".

For each candidate, consider:
- Does it actually talk about ${query}, or just mention related words?
- Is the insight valuable and substantive?
- Would someone searching for "${query}" find this helpful?

Return ONLY a JSON array of the index numbers for the most relevant quotes (up to 5-7 best matches), ranked by relevance:
[2, 7, 0, 15, 11]

If none of the candidates are truly relevant, return an empty array: []

Do not include any other text or explanation.`,
    continueWith: {
      tool: 'search_quotes',
      setParam: 'selected_indices',
      description: 'Call search_quotes again with the same query, expanded_terms, and add selected_indices parameter with your JSON array'
    }
  };
}

/**
 * Phase 3: Return final filtered results
 */
function handleCompletePhase(
  index: SearchIndex,
  query: string,
  expandedTerms: string[],
  selectedIndices: number[],
  limit: number
): SmartSearchResponse {
  // Retrieve candidates from session storage
  const sessionKey = getSessionKey(query, expandedTerms);
  const candidates = sessionCandidates.get(sessionKey);

  if (!candidates) {
    return {
      phase: 'complete',
      results: `Session expired. Please start a new search for "${query}".`,
      resultCount: 0
    };
  }

  // Filter to selected indices
  const selectedResults = selectedIndices
    .filter(idx => idx >= 0 && idx < candidates.length)
    .slice(0, limit)
    .map(idx => candidates[idx]);

  if (selectedResults.length === 0) {
    return {
      phase: 'complete',
      results: `No relevant quotes found for "${query}" after filtering. The search returned candidates but none matched the topic closely enough.`,
      resultCount: 0
    };
  }

  // Convert to quotes and format
  const quotes: QuoteResult[] = selectedResults.map(result => {
    const segmentIndex = result.episode.segments.findIndex(
      s => s.timestamp === result.segment.timestamp && s.text === result.segment.text
    );
    return searchResultToQuote(result, segmentIndex);
  });

  const formatted = formatQuotesForDisplay(quotes);

  // Clean up session
  sessionCandidates.delete(sessionKey);

  return {
    phase: 'complete',
    results: `Found ${quotes.length} relevant quote(s) for "${query}":\n\n${formatted}`,
    resultCount: quotes.length
  };
}

/**
 * Main smart search function - handles all phases
 */
export function smartSearch(
  index: SearchIndex,
  params: SmartSearchParams
): SmartSearchResponse {
  const { query, guest, limit = 5, minScore = 0.05, expandedTerms, selectedIndices } = params;

  // Phase 3: We have selected indices - return final results
  if (expandedTerms && selectedIndices) {
    return handleCompletePhase(index, query, expandedTerms, selectedIndices, limit);
  }

  // Phase 2: We have expanded terms - run multi-search and ask for filtering
  if (expandedTerms) {
    return handleFilterPhase(index, query, expandedTerms, { guest, minScore });
  }

  // Phase 1: Initial query - ask for expansion
  return handleExpandPhase(query);
}

/**
 * Format the smart search response for MCP output
 */
export function formatSmartSearchResponse(response: SmartSearchResponse): string {
  if (response.phase === 'complete') {
    return response.results || 'No results found.';
  }

  const lines: string[] = [];

  if (response.phase === 'expand') {
    lines.push(`## 🔍 Search Query Expansion Needed\n`);
    lines.push(`**Original query:** "${response.originalQuery}"\n`);
    lines.push(`### Instructions\n`);
    lines.push(response.instruction || '');
    lines.push(`\n### Next Step\n`);
    lines.push(`${response.continueWith?.description}\n`);
    lines.push(`Example: \`search_quotes(query="${response.originalQuery}", expanded_terms=["term1", "term2", ...])\``);
  }

  if (response.phase === 'filter') {
    lines.push(`## 🎯 Found ${response.candidateCount} Candidates - Filtering Needed\n`);
    lines.push(`**Original query:** "${response.originalQuery}"\n`);
    lines.push(`### Candidate Quotes\n`);

    for (const candidate of response.candidates || []) {
      lines.push(`**[${candidate.index}]** ${candidate.speaker} (${candidate.guest})`);
      lines.push(`> ${candidate.text}`);
      lines.push('');
    }

    lines.push(`### Instructions\n`);
    lines.push(response.instruction || '');
    lines.push(`\n### Next Step\n`);
    lines.push(`${response.continueWith?.description}`);
  }

  return lines.join('\n');
}
