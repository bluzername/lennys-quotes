/**
 * Represents a segment of a podcast transcript with speaker and timestamp info
 */
export interface TranscriptSegment {
  speaker: string;
  timestamp: string;        // "00:01:27"
  timestampSeconds: number; // 87
  text: string;
}

/**
 * Represents a complete podcast episode with metadata and transcript
 */
export interface Episode {
  guest: string;
  title: string;
  youtubeUrl: string;
  videoId: string;
  description: string;
  durationSeconds: number;
  duration: string;
  viewCount: number;
  channel: string;
  segments: TranscriptSegment[];
  rawText: string;
  folderName: string; // The folder name (e.g., "brian-chesky")
}

/**
 * Search result with relevance score
 */
export interface SearchResult {
  segment: TranscriptSegment;
  episode: Episode;
  score: number;
  matchedTerms: string[];
}

/**
 * Quote response format for MCP tool output
 */
export interface QuoteResult {
  text: string;
  speaker: string;
  guest: string;
  episodeTitle: string;
  timestamp: string;
  youtubeUrl: string;
  contextBefore?: string;
  contextAfter?: string;
  relevanceScore: number;
}

/**
 * Search index for fast lookups
 */
export interface SearchIndex {
  episodes: Map<string, Episode>;       // folderName -> Episode
  guestToFolder: Map<string, string>;   // normalized guest name -> folderName
  lunrIndex: lunr.Index;
}

// Re-export lunr types
import type lunr from 'lunr';
