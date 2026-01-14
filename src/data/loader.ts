import { readFile } from 'fs/promises';
import { glob } from 'glob';
import matter from 'gray-matter';
import path from 'path';
import type { Episode, TranscriptSegment } from './types.js';

/**
 * Parse a timestamp string like "00:01:27" to seconds
 */
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Parse transcript body into segments with speaker and timestamp info
 */
function parseTranscriptBody(body: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  // Match patterns like "Speaker Name (00:01:27):" or just "(00:01:27):"
  // Some transcripts have speaker on same line, some don't
  const lines = body.split('\n');

  let currentSpeaker = 'Unknown';
  let currentTimestamp = '00:00:00';
  let currentTimestampSeconds = 0;
  let currentText: string[] = [];

  // Regex to match "Speaker (HH:MM:SS):" pattern
  const speakerTimestampRegex = /^(.+?)\s*\((\d{1,2}:\d{2}:\d{2})\):?\s*$/;
  // Regex to match standalone "(HH:MM:SS):" pattern
  const timestampOnlyRegex = /^\((\d{1,2}:\d{2}:\d{2})\):?\s*$/;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check if this line is a speaker/timestamp header
    const speakerMatch = trimmedLine.match(speakerTimestampRegex);
    const timestampMatch = trimmedLine.match(timestampOnlyRegex);

    if (speakerMatch) {
      // Save previous segment if we have text
      if (currentText.length > 0) {
        segments.push({
          speaker: currentSpeaker,
          timestamp: currentTimestamp,
          timestampSeconds: currentTimestampSeconds,
          text: currentText.join(' ').trim()
        });
        currentText = [];
      }

      currentSpeaker = speakerMatch[1].trim();
      currentTimestamp = speakerMatch[2];
      currentTimestampSeconds = parseTimestamp(currentTimestamp);
    } else if (timestampMatch) {
      // Save previous segment if we have text
      if (currentText.length > 0) {
        segments.push({
          speaker: currentSpeaker,
          timestamp: currentTimestamp,
          timestampSeconds: currentTimestampSeconds,
          text: currentText.join(' ').trim()
        });
        currentText = [];
      }

      currentTimestamp = timestampMatch[1];
      currentTimestampSeconds = parseTimestamp(currentTimestamp);
    } else {
      // This is content text
      // Skip markdown headers like "# Title" or "## Transcript"
      if (!trimmedLine.startsWith('#')) {
        currentText.push(trimmedLine);
      }
    }
  }

  // Don't forget the last segment
  if (currentText.length > 0) {
    segments.push({
      speaker: currentSpeaker,
      timestamp: currentTimestamp,
      timestampSeconds: currentTimestampSeconds,
      text: currentText.join(' ').trim()
    });
  }

  return segments;
}

/**
 * Load a single transcript file and parse it into an Episode object
 */
async function loadTranscript(filePath: string): Promise<Episode | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const { data: frontmatter, content: body } = matter(content);

    // Extract folder name from path
    const folderName = path.basename(path.dirname(filePath));

    // Parse segments from transcript body
    const segments = parseTranscriptBody(body);

    return {
      guest: frontmatter.guest || 'Unknown',
      title: frontmatter.title || 'Unknown',
      youtubeUrl: frontmatter.youtube_url || '',
      videoId: frontmatter.video_id || '',
      description: frontmatter.description || '',
      durationSeconds: frontmatter.duration_seconds || 0,
      duration: frontmatter.duration || '',
      viewCount: frontmatter.view_count || 0,
      channel: frontmatter.channel || "Lenny's Podcast",
      segments,
      rawText: body,
      folderName
    };
  } catch (error) {
    console.error(`Error loading transcript ${filePath}:`, error);
    return null;
  }
}

/**
 * Load all transcripts from a directory
 */
export async function loadAllTranscripts(dataDir: string): Promise<Episode[]> {
  const pattern = path.join(dataDir, 'episodes', '*', 'transcript.md');
  const files = await glob(pattern);

  console.error(`Found ${files.length} transcript files`);

  const episodes: Episode[] = [];

  for (const file of files) {
    const episode = await loadTranscript(file);
    if (episode && episode.segments.length > 0) {
      episodes.push(episode);
    }
  }

  console.error(`Successfully loaded ${episodes.length} episodes`);
  return episodes;
}
