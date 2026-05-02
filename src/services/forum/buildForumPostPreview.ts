export function buildForumPostPreview(content: string, maxLength = 120) {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => (
      block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n')
    ))
    .filter(Boolean);

  if (blocks.length === 0) return '';

  const pickedBlocks: string[] = [];
  let totalLength = 0;

  for (const block of blocks) {
    const nextLength = totalLength + block.length + (pickedBlocks.length > 0 ? 2 : 0);
    if (pickedBlocks.length >= 2 && nextLength > Math.max(48, maxLength * 0.7)) break;
    if (nextLength > maxLength) break;
    pickedBlocks.push(block);
    totalLength = nextLength;
    if (pickedBlocks.length >= 3) break;
  }

  const normalized = (pickedBlocks.length > 0 ? pickedBlocks : [blocks[0]])
    .join('\n\n')
    .trim();

  if (normalized.length >= content.trim().length) return normalized;
  if (normalized.length >= maxLength) return `${normalized.slice(0, maxLength).trimEnd()}...`;
  return `${normalized}...`;
}
