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

export type LongTermMemorySection = {
  heading: string;
  body: string;
};

const LONG_TERM_SECTION_HEADING_PATTERN =
  /^(关系定位|核心相处逻辑|稳定行为偏好|长期关系红线|重要事件锚点|阶段变化|沟通特质|关系气质|稳定偏好与边界|稳定互动模式|长期关系主线)\s*[:：]\s*(.+)$/;

export function formatMemoryEntryContentForDisplay(
  content: string,
  kind: MemoryLibraryKind,
): string {
  if (kind !== 'long-term') {
    return content.trim();
  }

  return normalizeMarkdownDecorations(content);
}

export function parseLongTermMemorySections(content: string): LongTermMemorySection[] {
  const normalized = normalizeMarkdownDecorations(content);
  if (!normalized) {
    return [];
  }

  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const sections: LongTermMemorySection[] = [];

  for (const line of lines) {
    const matched = line.match(LONG_TERM_SECTION_HEADING_PATTERN);
    if (matched) {
      const [, heading, summary] = matched;
      sections.push({
        heading: `${heading}：${summary.trim()}`,
        body: '',
      });
      continue;
    }

    if (sections.length === 0) {
      sections.push({
        heading: '',
        body: line,
      });
      continue;
    }

    const lastSection = sections[sections.length - 1];
    lastSection.body = lastSection.body ? `${lastSection.body}\n${line}` : line;
  }

  return sections.filter(section => section.heading || section.body);
}
