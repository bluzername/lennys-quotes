/**
 * Build a YouTube URL with timestamp
 */
export function buildYouTubeUrl(videoId: string, timestampSeconds: number): string {
  if (!videoId) return '';
  if (timestampSeconds > 0) {
    return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(timestampSeconds)}`;
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}
