import type { Segment } from '../types.js';

const HOST_PATTERN = /lenny/i;
const SPEAKER_LINE = /^(.+?)\s*\((\d{1,2}:\d{2}:\d{2})\):?\s*$/;
const TIMESTAMP_LINE = /^\((\d{1,2}:\d{2}:\d{2})\):?\s*$/;

export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return 0;
}

export function isHost(speaker: string): boolean {
  return HOST_PATTERN.test(speaker);
}

/**
 * Parse a transcript body in Lenny's format:
 *   Speaker Name (00:01:27):
 *   text...
 * Lines that are only a timestamp continue the current speaker.
 * Markdown headings are skipped.
 */
export function parseBody(body: string): Segment[] {
  const segments: Segment[] = [];
  let speaker = 'Unknown';
  let timestamp = '00:00:00';
  let buffer: string[] = [];

  const flush = (): void => {
    if (buffer.length === 0) return;
    segments.push({
      idx: segments.length,
      speaker,
      timestamp,
      seconds: parseTimestamp(timestamp),
      text: buffer.join(' ').trim()
    });
    buffer = [];
  };

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const speakerMatch = line.match(SPEAKER_LINE);
    if (speakerMatch) {
      flush();
      speaker = speakerMatch[1]!.trim();
      timestamp = speakerMatch[2]!;
      continue;
    }

    const timestampMatch = line.match(TIMESTAMP_LINE);
    if (timestampMatch) {
      flush();
      timestamp = timestampMatch[1]!;
      continue;
    }

    if (!line.startsWith('#')) buffer.push(line);
  }

  flush();
  return segments;
}
