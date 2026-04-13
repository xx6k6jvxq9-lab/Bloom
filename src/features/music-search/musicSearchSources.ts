import type { MusicSearchResult, MusicSearchSource } from './musicSearchTypes';
import { neteaseMusicSearchSource } from './searchNeteaseMusic';

const musicSearchSources: MusicSearchSource[] = [neteaseMusicSearchSource];

export async function searchMusicAcrossSources(
  query: string,
  limitPerSource = 30,
): Promise<MusicSearchResult[]> {
  const settled = await Promise.allSettled(
    musicSearchSources.map((source) => source.search(query, limitPerSource)),
  );

  const aggregated: MusicSearchResult[] = [];
  const failures: Error[] = [];

  settled.forEach((result) => {
    if (result.status === 'fulfilled') {
      aggregated.push(...result.value);
      return;
    }

    failures.push(result.reason instanceof Error ? result.reason : new Error('搜索失败，请稍后再试'));
  });

  if (aggregated.length > 0) {
    return aggregated;
  }

  if (failures.length > 0) {
    throw failures[0];
  }

  return [];
}

export function getMusicSearchSources(): MusicSearchSource[] {
  return musicSearchSources;
}
