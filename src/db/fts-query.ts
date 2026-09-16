/**
 * Turn free text into a safe FTS5 MATCH expression.
 * - "quoted phrases" stay phrases
 * - every other token is quoted so FTS operators (AND, OR, NOT, *, :, ^) are literal
 * - tokens are joined with AND (implicit) or OR when `mode` is 'any'
 */
export type MatchMode = 'all' | 'any';

const PHRASE = /"([^"]+)"/g;

function quote(term: string): string {
  return `"${term.replace(/"/g, '""')}"`;
}

export function tokenize(query: string): { phrases: string[]; words: string[] } {
  const phrases: string[] = [];
  const rest = query.replace(PHRASE, (_m, phrase: string) => {
    if (phrase.trim()) phrases.push(phrase.trim());
    return ' ';
  });
  const words = rest
    .split(/[^\p{L}\p{N}'-]+/u)
    .map((w) => w.replace(/^[-']+|[-']+$/g, ''))
    .filter((w) => w.length > 0);
  return { phrases, words };
}

export function buildMatchExpression(query: string, mode: MatchMode = 'all'): string | null {
  const { phrases, words } = tokenize(query);
  const terms = [...phrases.map(quote), ...words.map(quote)];
  if (terms.length === 0) return null;
  return terms.join(mode === 'all' ? ' ' : ' OR ');
}
