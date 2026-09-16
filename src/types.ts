export interface Segment {
  idx: number;
  speaker: string;
  timestamp: string;
  seconds: number;
  text: string;
}

export interface EpisodeMeta {
  slug: string;
  guest: string;
  title: string;
  videoId: string;
  youtubeUrl: string;
  publishDate: string;
  description: string;
  durationSeconds: number;
  duration: string;
  viewCount: number;
  keywords: string[];
}

export interface Episode extends EpisodeMeta {
  segments: Segment[];
}

export interface Hit {
  episode: EpisodeMeta;
  segment: Segment;
  score: number;
  contextBefore?: string;
  contextAfter?: string;
}

export interface DataStatus {
  episodes: number;
  segments: number;
  newestEpisode: string;
  newestPublishDate: string;
  builtAt: string;
  dbPath: string;
}
