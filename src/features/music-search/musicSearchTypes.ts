import type { Song } from '../../types';

export type MusicSearchResult = {
  song: Song;
  sourceId: string;
  sourceLabel: string;
  playbackStatus: 'unverified' | 'search-only' | 'supported';
  note?: string;
};

export type MusicSearchSource = {
  id: string;
  label: string;
  search: (query: string, limit?: number) => Promise<MusicSearchResult[]>;
};
