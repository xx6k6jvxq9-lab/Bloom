import type { MemoryLibraryKind } from '../../types';

function normalizeMarkdownDecorations(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatMemoryEntryContentForDisplay(
  content: string,
  kind: MemoryLibraryKind,
): string {
  if (kind !== 'long-term') {
    return content.trim();
  }

  return normalizeMarkdownDecorations(content);
}
