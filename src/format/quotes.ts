import type { DataStatus, EpisodeMeta, Hit } from '../types.js';

const QUOTE_CHARS = 500;

export function youtubeLink(videoId: string, seconds: number): string {
  if (!videoId) return '';
  const t = seconds > 0 ? `&t=${Math.floor(seconds)}` : '';
  return `https://www.youtube.com/watch?v=${videoId}${t}`;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function formatHit(hit: Hit, index: number): string {
  const { episode, segment } = hit;
  const link = youtubeLink(episode.videoId, segment.seconds);
  const lines = [
    `**${index}. ${segment.speaker}** (${episode.guest} - "${episode.title}"${episode.publishDate ? `, ${episode.publishDate}` : ''})`,
    `> ${clip(segment.text, QUOTE_CHARS)}`
  ];
  if (link) lines.push(`[Watch at ${segment.timestamp}](${link})`);
  return lines.join('\n');
}

export function formatHits(hits: Hit[]): string {
  if (hits.length === 0) return 'No matching quotes found.';
  return hits.map((hit, i) => formatHit(hit, i + 1)).join('\n\n');
}

export function formatEpisodeLine(episode: EpisodeMeta): string {
  const date = episode.publishDate ? ` [${episode.publishDate}]` : '';
  return `- **${episode.guest}**: "${episode.title}"${date} (${episode.viewCount.toLocaleString()} views)`;
}

export function formatStatus(status: DataStatus): string {
  return [
    `**Episodes:** ${status.episodes}`,
    `**Transcript segments:** ${status.segments.toLocaleString()}`,
    `**Newest episode:** ${status.newestEpisode || 'unknown'}${status.newestPublishDate ? ` (${status.newestPublishDate})` : ''}`,
    `**Data built:** ${status.builtAt || 'unknown'}`,
    `**Database:** ${status.dbPath}`
  ].join('\n');
}
