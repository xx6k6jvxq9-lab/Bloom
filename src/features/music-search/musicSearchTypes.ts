import type { Song } from '../../types';

export type MusicSearchCategory = 'song' | 'podcast' | 'free';
export type MusicSearchFilter = 'all' | MusicSearchCategory;

export type MusicSearchResult = {
  song: Song;
  sourceId: string;
  sourceLabel: string;
  category: MusicSearchCategory;
  playbackStatus: 'unverified' | 'search-only' | 'supported';
  note?: string;
};

export type MusicSearchSource = {
  id: string;
  label: string;
  search: (query: string, limit?: number) => Promise<MusicSearchResult[]>;
};
