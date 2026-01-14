#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadAllTranscripts } from './data/loader.js';
import { buildSearchIndex, searchIndex, getAllGuests, getRandomSegment } from './data/indexer.js';
import { searchResultToQuote, formatQuotesForDisplay } from './utils/quote-extractor.js';
import { buildYouTubeUrl } from './utils/youtube.js';
import { smartSearch, formatSmartSearchResponse } from './utils/smart-search.js';
import type { SearchIndex } from './data/types.js';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory - look in multiple places
function findDataDir(): string {
  const possiblePaths = [
    path.join(__dirname, '..', 'data', 'transcripts'),
    path.join(__dirname, '..', '..', 'data', 'transcripts'),
    path.join(process.cwd(), 'data', 'transcripts')
  ];

  for (const p of possiblePaths) {
    try {
      const fs = require('fs');
      if (fs.existsSync(p)) {
        return p;
      }
    } catch {}
  }

  return possiblePaths[0]; // Return first as default
}

/**
 * Main MCP server setup
 */
async function main() {
  console.error("Starting Lenny's Podcast Wisdom MCP Server...");

  // Load and index transcripts
  const dataDir = findDataDir();
  console.error(`Loading transcripts from: ${dataDir}`);

  const episodes = await loadAllTranscripts(dataDir);
  if (episodes.length === 0) {
    console.error('ERROR: No transcripts found! Make sure to clone the transcripts repository first.');
    console.error('Run: git clone https://github.com/ChatPRD/lennys-podcast-transcripts.git data/transcripts');
    process.exit(1);
  }

  const index = buildSearchIndex(episodes);

  // Create MCP server
  const server = new McpServer({
    name: 'lennys-podcast-wisdom',
    version: '1.0.0'
  });

  // Register tools
  registerSearchQuotesTool(server, index);
  registerSmartSearchTool(server, index);
  registerListGuestsTool(server, index);
  registerGetEpisodeTool(server, index);
  registerRandomWisdomTool(server, index);

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('MCP Server ready and listening on stdio');
}

/**
 * search_quotes - Search for product management quotes by topic
 */
function registerSearchQuotesTool(server: McpServer, index: SearchIndex) {
  server.tool(
    'search_quotes',
    "Search Lenny's Podcast for product management wisdom. Returns relevant quotes with YouTube timestamps.",
    {
      query: z.string().describe('Search query - topic, keyword, or phrase (e.g., "product-market fit", "hiring", "growth")'),
      guest: z.string().optional().describe('Filter by guest name (e.g., "Brian Chesky")'),
      limit: z.number().min(1).max(20).default(5).describe('Maximum number of quotes to return'),
      min_score: z.number().min(0).max(1).default(0.1).describe('Minimum relevance score (0-1)')
    },
    async ({ query, guest, limit, min_score }) => {
      const results = searchIndex(index, query, {
        guest,
        limit,
        minScore: min_score
      });

      if (results.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `No quotes found for "${query}". Try a different search term or remove the guest filter.`
          }]
        };
      }

      const quotes = results.map((r, i) => {
        // Extract segment index from the search
        const segmentIndex = index.episodes.get(r.episode.folderName)?.segments.findIndex(
          s => s.timestamp === r.segment.timestamp && s.text === r.segment.text
        );
        return searchResultToQuote(r, segmentIndex);
      });

      const formatted = formatQuotesForDisplay(quotes);

      return {
        content: [{
          type: 'text' as const,
          text: `Found ${quotes.length} quote(s) for "${query}":\n\n${formatted}`
        }]
      };
    }
  );
}

/**
 * search_quotes_smart - Multi-phase intelligent search with LLM-assisted expansion and filtering
 */
function registerSmartSearchTool(server: McpServer, index: SearchIndex) {
  server.tool(
    'search_quotes_smart',
    `Intelligent multi-phase search for Lenny's Podcast quotes. This tool uses a 3-phase approach:

Phase 1 (Expansion): Call with just a query. The tool returns instructions to generate expanded search terms.
Phase 2 (Search & Filter): Call again with expanded_terms. The tool searches all terms and returns candidates for you to filter.
Phase 3 (Complete): Call again with selected_indices. The tool returns the final filtered results.

Use this for nuanced searches where the exact terminology might vary (e.g., "creative block", "imposter syndrome", "product-market fit").`,
    {
      query: z.string().describe('Search query - the topic you want to find quotes about'),
      guest: z.string().optional().describe('Filter by guest name (e.g., "Brian Chesky")'),
      limit: z.number().min(1).max(10).default(5).describe('Maximum number of final quotes to return'),
      min_score: z.number().min(0).max(1).default(0.05).describe('Minimum relevance score for candidates'),
      expanded_terms: z.array(z.string()).optional().describe('Phase 2: Array of expanded search terms generated by the LLM'),
      selected_indices: z.array(z.number()).optional().describe('Phase 3: Array of candidate indices selected by the LLM after filtering')
    },
    async ({ query, guest, limit, min_score, expanded_terms, selected_indices }) => {
      const response = smartSearch(index, {
        query,
        guest,
        limit,
        minScore: min_score,
        expandedTerms: expanded_terms,
        selectedIndices: selected_indices
      });

      const formatted = formatSmartSearchResponse(response);

      return {
        content: [{
          type: 'text' as const,
          text: formatted
        }]
      };
    }
  );
}

/**
 * list_guests - List all podcast guests
 */
function registerListGuestsTool(server: McpServer, index: SearchIndex) {
  server.tool(
    'list_guests',
    "List all guests from Lenny's Podcast with their episode titles.",
    {
      search: z.string().optional().describe('Filter guests by name'),
      sort_by: z.enum(['name', 'views']).default('name').describe('Sort order')
    },
    async ({ search, sort_by }) => {
      let guests = getAllGuests(index);

      // Filter by search term if provided
      if (search) {
        const searchLower = search.toLowerCase();
        guests = guests.filter(g =>
          g.guest.toLowerCase().includes(searchLower) ||
          g.title.toLowerCase().includes(searchLower)
        );
      }

      // Sort
      if (sort_by === 'views') {
        guests.sort((a, b) => b.viewCount - a.viewCount);
      }

      if (guests.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: search
              ? `No guests found matching "${search}".`
              : 'No guests found in the database.'
          }]
        };
      }

      const lines = guests.map(g =>
        `- **${g.guest}**: "${g.title}" (${g.viewCount.toLocaleString()} views)`
      );

      return {
        content: [{
          type: 'text' as const,
          text: `Found ${guests.length} episode(s):\n\n${lines.join('\n')}`
        }]
      };
    }
  );
}

/**
 * get_episode - Get details about a specific episode
 */
function registerGetEpisodeTool(server: McpServer, index: SearchIndex) {
  server.tool(
    'get_episode',
    "Get detailed information about a specific Lenny's Podcast episode by guest name.",
    {
      guest: z.string().describe('Guest name to look up'),
      include_transcript: z.boolean().default(false).describe('Include the full transcript text')
    },
    async ({ guest, include_transcript }) => {
      const guestLower = guest.toLowerCase();

      // Find matching episode
      let episode = null;
      for (const ep of index.episodes.values()) {
        if (ep.guest.toLowerCase().includes(guestLower)) {
          episode = ep;
          break;
        }
      }

      if (!episode) {
        return {
          content: [{
            type: 'text' as const,
            text: `No episode found for guest "${guest}". Use list_guests to see available episodes.`
          }]
        };
      }

      const youtubeUrl = buildYouTubeUrl(episode.videoId, 0);

      let text = `# ${episode.title}\n\n`;
      text += `**Guest:** ${episode.guest}\n`;
      text += `**Duration:** ${episode.duration}\n`;
      text += `**Views:** ${episode.viewCount.toLocaleString()}\n`;
      text += `**YouTube:** ${youtubeUrl}\n\n`;
      text += `**Description:**\n${episode.description}\n`;

      if (include_transcript) {
        text += `\n---\n\n**Full Transcript:**\n\n`;
        for (const segment of episode.segments) {
          text += `**${segment.speaker} (${segment.timestamp}):**\n${segment.text}\n\n`;
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text
        }]
      };
    }
  );
}

/**
 * random_wisdom - Get a random inspiring quote
 */
function registerRandomWisdomTool(server: McpServer, index: SearchIndex) {
  server.tool(
    'random_wisdom',
    "Get a random insightful quote from Lenny's Podcast for inspiration.",
    {
      topic: z.string().optional().describe('Optional topic to filter by (e.g., "leadership", "growth")')
    },
    async ({ topic }) => {
      const result = getRandomSegment(index, topic);

      if (!result) {
        return {
          content: [{
            type: 'text' as const,
            text: topic
              ? `No quotes found for topic "${topic}". Try a different topic or leave it empty for a random quote.`
              : 'No quotes available.'
          }]
        };
      }

      const quote = searchResultToQuote(result);
      const formatted = formatQuotesForDisplay([quote]);

      return {
        content: [{
          type: 'text' as const,
          text: topic
            ? `Here's wisdom about "${topic}":\n\n${formatted}`
            : `Here's some random wisdom:\n\n${formatted}`
        }]
      };
    }
  );
}

// Run the server
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
