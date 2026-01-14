import lunr from 'lunr';
import type { Episode, SearchIndex, SearchResult, TranscriptSegment } from './types.js';

/**
 * Normalize a guest name for consistent lookups
 */
function normalizeGuestName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

/**
 * Document structure for Lunr indexing
 */
interface LunrDocument {
  id: string;           // "folderName:segmentIndex"
  text: string;         // The segment text
  speaker: string;      // Who said it
  guest: string;        // Episode guest
  title: string;        // Episode title
}

/**
 * Build a search index from loaded episodes
 */
export function buildSearchIndex(episodes: Episode[]): SearchIndex {
  const episodesMap = new Map<string, Episode>();
  const guestToFolder = new Map<string, string>();
  const documents: LunrDocument[] = [];

  // Build maps and prepare documents for indexing
  for (const episode of episodes) {
    episodesMap.set(episode.folderName, episode);
    guestToFolder.set(normalizeGuestName(episode.guest), episode.folderName);

    // Add each segment as a searchable document
    for (let i = 0; i < episode.segments.length; i++) {
      const segment = episode.segments[i];
      documents.push({
        id: `${episode.folderName}:${i}`,
        text: segment.text,
        speaker: segment.speaker,
        guest: episode.guest,
        title: episode.title
      });
    }
  }

  console.error(`Building search index with ${documents.length} segments...`);

  // Build the Lunr index
  const lunrIndex = lunr(function() {
    this.ref('id');
    this.field('text', { boost: 10 });
    this.field('speaker', { boost: 3 });
    this.field('guest', { boost: 2 });
    this.field('title', { boost: 1 });

    // Add all documents
    for (const doc of documents) {
      this.add(doc);
    }
  });

  console.error('Search index built successfully');

  return {
    episodes: episodesMap,
    guestToFolder,
    lunrIndex
  };
}

/**
 * Search the index and return results with context
 */
export function searchIndex(
  index: SearchIndex,
  query: string,
  options: {
    guest?: string;
    limit?: number;
    minScore?: number;
  } = {}
): SearchResult[] {
  const { guest, limit = 10, minScore = 0.1 } = options;

  // Build the search query
  let searchQuery = query;
  if (guest) {
    const normalizedGuest = normalizeGuestName(guest);
    const folderName = index.guestToFolder.get(normalizedGuest);
    if (folderName) {
      // If we found the guest, filter by their folder
      searchQuery = `${query} guest:${guest}`;
    }
  }

  // Perform the search
  let results: lunr.Index.Result[];
  try {
    results = index.lunrIndex.search(searchQuery);
  } catch {
    // If the query fails (e.g., syntax error), try a simpler search
    try {
      // Escape special characters and try again
      const escapedQuery = query.replace(/[+\-:^~*]/g, '\\$&');
      results = index.lunrIndex.search(escapedQuery);
    } catch {
      // If still failing, return empty
      return [];
    }
  }

  // Convert Lunr results to our SearchResult format
  const searchResults: SearchResult[] = [];

  for (const result of results) {
    // Skip if below minimum score
    if (result.score < minScore) continue;

    // Parse the document ID
    const [folderName, segmentIndexStr] = result.ref.split(':');
    const segmentIndex = parseInt(segmentIndexStr, 10);

    const episode = index.episodes.get(folderName);
    if (!episode) continue;

    // If guest filter specified, check it matches
    if (guest) {
      const normalizedGuest = normalizeGuestName(guest);
      const normalizedEpisodeGuest = normalizeGuestName(episode.guest);
      if (!normalizedEpisodeGuest.includes(normalizedGuest) &&
          !normalizedGuest.includes(normalizedEpisodeGuest)) {
        continue;
      }
    }

    const segment = episode.segments[segmentIndex];
    if (!segment) continue;

    searchResults.push({
      segment,
      episode,
      score: result.score,
      matchedTerms: Object.keys(result.matchData.metadata)
    });

    // Stop if we've reached the limit
    if (searchResults.length >= limit) break;
  }

  return searchResults;
}

/**
 * Get all unique guests from the index
 */
export function getAllGuests(index: SearchIndex): Array<{
  guest: string;
  folderName: string;
  title: string;
  viewCount: number;
}> {
  const guests: Array<{
    guest: string;
    folderName: string;
    title: string;
    viewCount: number;
  }> = [];

  for (const episode of index.episodes.values()) {
    guests.push({
      guest: episode.guest,
      folderName: episode.folderName,
      title: episode.title,
      viewCount: episode.viewCount
    });
  }

  // Sort by guest name
  return guests.sort((a, b) => a.guest.localeCompare(b.guest));
}

/**
 * Get a random segment from the index, optionally filtered by topic
 */
export function getRandomSegment(
  index: SearchIndex,
  topic?: string
): SearchResult | null {
  if (topic) {
    // Search for the topic and pick a random result
    const results = searchIndex(index, topic, { limit: 50, minScore: 0.05 });
    if (results.length === 0) return null;
    return results[Math.floor(Math.random() * results.length)];
  }

  // Pick a random episode and random segment
  const episodes = Array.from(index.episodes.values());
  if (episodes.length === 0) return null;

  const episode = episodes[Math.floor(Math.random() * episodes.length)];

  // Filter to segments with substantial text (at least 100 chars)
  const goodSegments = episode.segments.filter(s => s.text.length >= 100);
  if (goodSegments.length === 0) return null;

  const segment = goodSegments[Math.floor(Math.random() * goodSegments.length)];

  return {
    segment,
    episode,
    score: 1,
    matchedTerms: []
  };
}
