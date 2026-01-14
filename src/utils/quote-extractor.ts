import type { Episode, QuoteResult, SearchResult } from '../data/types.js';
import { buildYouTubeUrl } from './youtube.js';

/**
 * Get context (previous and next segments) for a search result
 */
function getContext(episode: Episode, segmentIndex: number): {
  contextBefore?: string;
  contextAfter?: string;
} {
  const segments = episode.segments;

  // Find the index of this segment
  let idx = segmentIndex;
  if (idx < 0 || idx >= segments.length) {
    // Try to find by matching
    idx = segments.findIndex(s =>
      s.timestamp === episode.segments[segmentIndex]?.timestamp
    );
  }

  if (idx < 0) return {};

  const contextBefore = idx > 0
    ? segments[idx - 1].text.slice(-200) // Last 200 chars
    : undefined;

  const contextAfter = idx < segments.length - 1
    ? segments[idx + 1].text.slice(0, 200) // First 200 chars
    : undefined;

  return { contextBefore, contextAfter };
}

/**
 * Convert a SearchResult to a QuoteResult for output
 */
export function searchResultToQuote(
  result: SearchResult,
  segmentIndex?: number
): QuoteResult {
  const { segment, episode, score } = result;

  // Find segment index if not provided
  let idx = segmentIndex;
  if (idx === undefined) {
    idx = episode.segments.findIndex(s =>
      s.timestamp === segment.timestamp && s.text === segment.text
    );
  }

  const context = idx !== undefined && idx >= 0
    ? getContext(episode, idx)
    : {};

  return {
    text: segment.text,
    speaker: segment.speaker,
    guest: episode.guest,
    episodeTitle: episode.title,
    timestamp: segment.timestamp,
    youtubeUrl: buildYouTubeUrl(episode.videoId, segment.timestampSeconds),
    ...context,
    relevanceScore: score
  };
}

/**
 * Format quotes for display
 */
export function formatQuotesForDisplay(quotes: QuoteResult[]): string {
  if (quotes.length === 0) {
    return 'No matching quotes found.';
  }

  const lines: string[] = [];

  for (let i = 0; i < quotes.length; i++) {
    const quote = quotes[i];
    lines.push(`**${i + 1}. ${quote.speaker}** (${quote.guest} - "${quote.episodeTitle}")`);
    lines.push(`> ${quote.text.slice(0, 500)}${quote.text.length > 500 ? '...' : ''}`);
    lines.push(`[Watch at ${quote.timestamp}](${quote.youtubeUrl})`);
    lines.push('');
  }

  return lines.join('\n');
}
