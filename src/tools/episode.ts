import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { findEpisode } from '../db/queries.js';
import { youtubeLink } from '../format/quotes.js';
import { READ_ONLY, text, type ToolContext } from './context.js';

export function registerGetEpisodeTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'get_episode',
    {
      title: 'Get episode',
      description: "Details for one Lenny's Podcast episode: guest, title, date, description, YouTube link, optionally the full transcript. Look up by guest name, episode title, slug or YouTube video id.",
      inputSchema: {
        guest: z.string().min(1).describe('Guest name, title fragment, slug (e.g. brian-chesky) or YouTube video id'),
        include_transcript: z.boolean().default(false).describe('Include the full timestamped transcript (long)')
      },
      annotations: READ_ONLY
    },
    async ({ guest, include_transcript }) => {
      const episode = findEpisode(ctx.db, guest);
      if (!episode) return text(`No episode found for "${guest}". Use list_guests to browse available episodes.`);

      const lines = [
        `# ${episode.title}`,
        '',
        `**Guest:** ${episode.guest}`,
        `**Published:** ${episode.publishDate || 'unknown'}`,
        `**Duration:** ${episode.duration || 'unknown'}`,
        `**Views:** ${episode.viewCount.toLocaleString()}`,
        `**YouTube:** ${youtubeLink(episode.videoId, 0) || 'n/a'}`,
        episode.keywords.length ? `**Topics:** ${episode.keywords.join(', ')}` : '',
        '',
        `**Description:**\n${episode.description || 'n/a'}`
      ].filter((line) => line !== '');

      if (include_transcript) {
        lines.push('', '---', '', '**Full transcript:**', '');
        for (const s of episode.segments) lines.push(`**${s.speaker} (${s.timestamp}):**\n${s.text}\n`);
      }
      return text(lines.join('\n'));
    }
  );
}
