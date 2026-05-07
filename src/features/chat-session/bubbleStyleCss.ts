import type React from 'react';

const BUBBLE_TEXT_STYLE_KEYS = new Set([
  'color',
  'caretColor',
  'textShadow',
  'WebkitTextFillColor',
  'font',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
]);

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function normalizeBubbleStyleText(styleText?: string): string {
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
  const trimmed = normalizeBubbleStyleText(styleText);
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

export function parseBubbleStyleCss(styleText?: string): React.CSSProperties {
  const trimmed = normalizeBubbleStyleText(styleText);
  if (!trimmed) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as React.CSSProperties;
    }
  } catch {
    // Fall through to CSS declaration parsing.
  }

  // Full theme CSS with selectors should be injected via <style>, not merged into inline styles.
  if (trimmed.includes('{') && !trimmed.startsWith('{')) {
    return {};
  }

  const declarationBody = extractDeclarationBody(trimmed);
  if (!declarationBody) {
    return {};
  }

  if (declarationBody.startsWith('{')) {
    try {
      const parsed = JSON.parse(declarationBody);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as React.CSSProperties)
        : {};
    } catch {
      console.warn('Ignoring invalid chat bubbleStyleCss input.', styleText);
      return {};
    }
  }

  const style: Record<string, string> = {};
  const declarations = declarationBody
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const declaration of declarations) {
    const colonIndex = declaration.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const property = declaration.slice(0, colonIndex).trim();
    const value = declaration.slice(colonIndex + 1).trim();

    if (!property || !value) {
      continue;
    }

    style[toCamelCase(property)] = value;
  }

  return style as React.CSSProperties;
}

export function sanitizeBubbleSurfaceStyle(style: React.CSSProperties): React.CSSProperties {
  if (!style || typeof style !== 'object') {
    return {};
  }

  const nextStyle: React.CSSProperties = {};

  Object.entries(style).forEach(([key, value]) => {
    if (BUBBLE_TEXT_STYLE_KEYS.has(key)) {
      return;
    }

    nextStyle[key as keyof React.CSSProperties] = value as never;
  });

  return nextStyle;
}

export function extractBubbleTextStyle(style: React.CSSProperties): React.CSSProperties {
  if (!style || typeof style !== 'object') {
    return {};
  }

  const nextStyle: React.CSSProperties = {};

  Object.entries(style).forEach(([key, value]) => {
    if (!BUBBLE_TEXT_STYLE_KEYS.has(key)) {
      return;
    }

    nextStyle[key as keyof React.CSSProperties] = value as never;
  });

  return nextStyle;
}

export function hasBubbleThemeCss(styleText?: string): boolean {
  const trimmed = normalizeBubbleStyleText(styleText);
  return !!trimmed && trimmed.includes('{') && !trimmed.startsWith('{');
}

function wrapDeclarationsAsCss(styleText: string, selector: string): string {
  const declarationBody = extractDeclarationBody(styleText);
  if (!declarationBody) {
    return '';
  }

  if (declarationBody.startsWith('{') && declarationBody.endsWith('}')) {
    return `${selector} ${declarationBody}`;
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

    const token = `__BUBBLE_KEYFRAMES_${blocks.length}__`;
    blocks.push(styleText.slice(nextIndex, endIndex));
    nextCss += token;
    cursor = endIndex;
  }

  return { css: nextCss, blocks };
}

function restoreProtectedBlocks(styleText: string, blocks: string[]): string {
  return blocks.reduce(
    (nextCss, block, index) => nextCss.replace(`__BUBBLE_KEYFRAMES_${index}__`, block),
    styleText,
  );
}

function scopeSelectorList(selectorList: string, scopeClass: string): string {
  return selectorList
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean)
    .map((selector) => (selector.startsWith(scopeClass) ? selector : `${scopeClass} ${selector}`))
    .join(', ');
}

function canAttachSelectorToScope(selector: string): boolean {
  return selector.startsWith('.') && !/[ >+~]/.test(selector) && !selector.startsWith('..');
}

const GLOBAL_BUBBLE_ROOT_SELECTOR = '.chat-bubble';
const BUBBLE_ROOT_ALIASES = [
  '.chat-bubble',
  '.message-bubble',
  '.user-bubble',
  '.bot-bubble',
  '.chat-bubble-left',
  '.chat-bubble-right',
  '.left',
  '.right',
  '.chat-loading-bubble',
];
const BUBBLE_CHILD_ALIASES = [
  '.corner',
  '.bubble-corner',
  '.sticker-skull',
  '.bubble-sticker-skull',
];
const BUBBLE_DESCENDANT_ALIASES = [
  '.chat-message-image',
  '.chat-transfer-card',
  '.chat-transfer-card-header',
  '.chat-transfer-card-icon',
  '.chat-transfer-card-content',
  '.chat-transfer-card-footer',
];

function escapeSelectorFragment(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selectorStartsWithAlias(selector: string, alias: string): boolean {
  return new RegExp(`^${escapeSelectorFragment(alias)}(?=$|[\\s>+~:#.\\[])`).test(selector);
}

function selectorIncludesAlias(selector: string, aliases: string[]): boolean {
  return aliases.some((alias) => selector.includes(alias));
}

function getBubbleScopeRoot(scopeClass: string, variantSelector?: string): string {
  return variantSelector ? `${scopeClass} ${variantSelector}` : `${scopeClass} ${GLOBAL_BUBBLE_ROOT_SELECTOR}`;
}

function buildScopedBubbleSelector(
  selector: string,
  scopeClass: string,
  variantSelector?: string,
): string {
  const bubbleScopeRoot = getBubbleScopeRoot(scopeClass, variantSelector);
  const variantAliases = variantSelector ? getVariantAliasSelectors(variantSelector) : [];

  if (!selector) {
    return '';
  }

  if (selector.startsWith(scopeClass)) {
    return selector;
  }

  if (selector.startsWith('&')) {
    return `${bubbleScopeRoot}${selector.slice(1)}`;
  }

  if (selector.startsWith(':') || selector.startsWith('::')) {
    return `${bubbleScopeRoot}${selector}`;
  }

  if (variantAliases.some((alias) => selectorIncludesAlias(selector, [alias]))) {
    return `${scopeClass} ${selector}`;
  }

  if (BUBBLE_ROOT_ALIASES.some((alias) => selectorStartsWithAlias(selector, alias))) {
    return variantSelector ? `${bubbleScopeRoot} ${selector}` : `${scopeClass} ${selector}`;
  }

  if (BUBBLE_CHILD_ALIASES.some((alias) => selectorStartsWithAlias(selector, alias))) {
    return `${bubbleScopeRoot} ${selector}`;
  }

  if (selectorIncludesAlias(selector, [...BUBBLE_ROOT_ALIASES, ...BUBBLE_CHILD_ALIASES, ...BUBBLE_DESCENDANT_ALIASES])) {
    return `${scopeClass} ${selector}`;
  }

  if (selector.startsWith('.') && canAttachSelectorToScope(selector)) {
    return `${bubbleScopeRoot} ${selector}`;
  }

  return `${bubbleScopeRoot} ${selector}`;
}

function getVariantAliasSelectors(variantSelector: string): string[] {
  if (variantSelector === '.bot-bubble') {
    return [
      '.bot-bubble',
      '.left',
      '.chat-bubble-left',
      '.user-left-bubble',
      '.model-left-bubble',
      '.character-left-bubble',
      '.assistant-left-bubble',
      '.left-bubble',
    ];
  }

  if (variantSelector === '.user-bubble') {
    return [
      '.user-bubble',
      '.right',
      '.chat-bubble-right',
      '.user-right-bubble',
      '.self-right-bubble',
      '.me-right-bubble',
      '.right-bubble',
    ];
  }

  return [variantSelector];
}

function buildScopedVariantSelector(
  selector: string,
  scopeClass: string,
  variantSelector: string,
): string {
  return buildScopedBubbleSelector(selector, scopeClass, variantSelector);
}

export function buildScopedBubbleThemeCss(styleText: string | undefined, scopeClass: string): string {
  const normalized = normalizeBubbleStyleText(styleText);
  if (!normalized || !normalized.includes('{')) {
    return '';
  }

  const { css: protectedCss, blocks } = protectKeyframesBlocks(normalized);
  const scopedCss = protectedCss.replace(/(^|})\s*([^@}{][^{]+)\{/g, (match, prefix: string, selectors: string) => {
    const scopedSelectors = selectors
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => buildScopedBubbleSelector(selector, scopeClass))
      .join(', ');
    return `${prefix} ${scopedSelectors}{`;
  });

  return restoreProtectedBlocks(scopedCss, blocks);
}

export function buildScopedBubbleVariantCss(
  styleText: string | undefined,
  scopeClass: string,
  variantSelector: string,
): string {
  const trimmed = normalizeBubbleStyleText(styleText);
  if (!trimmed) {
    return '';
  }

  const scopedVariantSelector = `${scopeClass} ${variantSelector}`;

  if (!trimmed.includes('{') || trimmed.startsWith('{')) {
    return wrapDeclarationsAsCss(trimmed, scopedVariantSelector);
  }

  const { css: protectedCss, blocks } = protectKeyframesBlocks(trimmed);
  const scopedCss = protectedCss.replace(/(^|})\s*([^@}{][^{]+)\{/g, (match, prefix: string, selectors: string) => {
    const scopedSelectors = selectors
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => buildScopedVariantSelector(selector, scopeClass, variantSelector))
      .join(', ');
    return `${prefix} ${scopedSelectors}{`;
  });

  return restoreProtectedBlocks(scopedCss, blocks);
}

export function buildScopedElementThemeCss(
  styleText: string | undefined,
  scopeSelector: string,
  selfAliases: string[] = [],
): string {
  const trimmed = normalizeBubbleStyleText(styleText);
  if (!trimmed) {
    return '';
  }

  if (!trimmed.includes('{') || trimmed.startsWith('{')) {
    return wrapDeclarationsAsCss(trimmed, scopeSelector);
  }

  const { css: protectedCss, blocks } = protectKeyframesBlocks(trimmed);
  const scopedCss = protectedCss.replace(/(^|})\s*([^@}{][^{]+)\{/g, (match, prefix: string, selectors: string) => {
    const scopedSelectors = selectors
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => {
        if (selector.startsWith(scopeSelector)) {
          return selector;
        }

        if (selector.startsWith('&')) {
          return `${scopeSelector}${selector.slice(1)}`;
        }

        const matchesSelfAlias = selfAliases.some((alias) => selector.includes(alias));
        if (matchesSelfAlias && canAttachSelectorToScope(selector)) {
          return `${scopeSelector}${selector}, ${scopeSelector} ${selector}`;
        }

        return `${scopeSelector} ${selector}`;
      })
      .join(', ');

    return `${prefix} ${scopedSelectors}{`;
  });

  return restoreProtectedBlocks(scopedCss, blocks);
}
