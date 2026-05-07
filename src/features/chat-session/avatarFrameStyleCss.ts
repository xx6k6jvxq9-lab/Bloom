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

  return trimmed.replace(/(^|})\s*([^@}{][^{]+)\{/g, (match, prefix: string, selectors: string) => {
    const scopedSelectors = selectors
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => buildScopedAvatarFrameSelector(selector, scopeClass))
      .join(', ');

    return `${prefix} ${scopedSelectors}{`;
  });
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
  '.avatar-frame-dot',
] as const;
