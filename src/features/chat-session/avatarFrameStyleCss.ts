function normalizeAvatarFrameStyleText(styleText?: string): string {
  if (!styleText) {
    return '';
  }

  return styleText
    .replace(/^\uFEFF/, '')
    .replace(/@charset\s+["'][^"']+["'];?/gi, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
}

function extractDeclarationBody(styleText: string): string {
  const trimmed = normalizeAvatarFrameStyleText(styleText);
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const blockMatch = trimmed.match(/\{([\s\S]*)\}/);
  if (blockMatch?.[1]) {
    return blockMatch[1];
  }

  return trimmed;
}

function wrapDeclarationsAsCss(styleText: string, selector: string): string {
  const declarationBody = extractDeclarationBody(styleText);
  if (!declarationBody) {
    return '';
  }

  return `${selector} {\n${declarationBody}\n}`;
}

function protectKeyframesBlocks(styleText: string): { css: string; blocks: string[] } {
  const blocks: string[] = [];
  let nextCss = '';
  let cursor = 0;

  while (cursor < styleText.length) {
    const standardIndex = styleText.indexOf('@keyframes', cursor);
    const webkitIndex = styleText.indexOf('@-webkit-keyframes', cursor);
    const candidates = [standardIndex, webkitIndex].filter((index) => index >= 0);
    const nextIndex = candidates.length ? Math.min(...candidates) : -1;

    if (nextIndex === -1) {
      nextCss += styleText.slice(cursor);
      break;
    }

    nextCss += styleText.slice(cursor, nextIndex);
    const openBraceIndex = styleText.indexOf('{', nextIndex);
    if (openBraceIndex === -1) {
      nextCss += styleText.slice(nextIndex);
      break;
    }

    let depth = 0;
    let endIndex = openBraceIndex;
    for (; endIndex < styleText.length; endIndex += 1) {
      const char = styleText[endIndex];
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          endIndex += 1;
          break;
        }
      }
    }

    const token = `__AVATAR_FRAME_KEYFRAMES_${blocks.length}__`;
    blocks.push(styleText.slice(nextIndex, endIndex));
    nextCss += token;
    cursor = endIndex;
  }

  return { css: nextCss, blocks };
}

function restoreProtectedBlocks(styleText: string, blocks: string[]): string {
  return blocks.reduce(
    (nextCss, block, index) => nextCss.replace(`__AVATAR_FRAME_KEYFRAMES_${index}__`, block),
    styleText,
  );
}

function buildScopedAvatarFrameSelector(selector: string, scopeClass: string): string {
  const shellSelector = `${scopeClass} .avatar-frame-shell`;

  if (!selector) {
    return '';
  }

  if (selector.startsWith(scopeClass)) {
    return selector;
  }

  if (selector.startsWith('&')) {
    return `${shellSelector}${selector.slice(1)}`;
  }

  if (selector.startsWith(':') || selector.startsWith('::')) {
    return `${shellSelector}${selector}`;
  }

  return `${scopeClass} ${selector}`;
}

export function buildScopedAvatarFrameThemeCss(styleText: string | undefined, scopeClass: string): string {
  const trimmed = normalizeAvatarFrameStyleText(styleText);
  if (!trimmed) {
    return '';
  }

  if (!trimmed.includes('{')) {
    return wrapDeclarationsAsCss(trimmed, `${scopeClass} .avatar-frame-shell`);
  }

  const { css: protectedCss, blocks } = protectKeyframesBlocks(trimmed);
  const scopedCss = protectedCss.replace(/(^|})\s*([^@}{][^{]+)\{/g, (match, prefix: string, selectors: string) => {
    const scopedSelectors = selectors
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => buildScopedAvatarFrameSelector(selector, scopeClass))
      .join(', ');

    return `${prefix} ${scopedSelectors}{`;
  });

  return restoreProtectedBlocks(scopedCss, blocks);
}

export const AVATAR_FRAME_THEME_TARGETS = [
  '.avatar-frame-shell',
  '.avatar-frame-media',
  '.avatar-frame-ring',
  '.avatar-frame-badge',
  '.avatar-frame-badge-core',
  '.avatar-frame-clover',
  '.avatar-frame-spark',
  '.avatar-frame-heart',
  '.avatar-frame-charm',
  '.avatar-frame-charm-string',
  '.avatar-frame-charm-body',
  '.avatar-frame-charm-core',
  '.avatar-frame-dot',
] as const;
