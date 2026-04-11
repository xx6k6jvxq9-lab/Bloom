import type { WorldBookEntry } from '../../types';
import { normalizeWorldBookCategory, sortWorldBooksByPriority } from '../../services/world-book/worldBookMeta';

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function buildGroupWorldBookPrompt(worldBooks: WorldBookEntry[] | undefined): string | undefined {
  if (!worldBooks || worldBooks.length === 0) {
    return undefined;
  }

  const sections = sortWorldBooksByPriority(worldBooks)
    .map((entry) => {
      const title = normalizeOptionalText(entry.title);
      const content = normalizeOptionalText(entry.content);

      if (!title || !content) {
        return '';
      }

      return `[${normalizeWorldBookCategory(entry.category)}] ${title}:\n${content}`;
    })
    .filter(Boolean);

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}
