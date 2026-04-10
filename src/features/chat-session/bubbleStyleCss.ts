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
  if (!selector) {
    return '';
  }

  if (selector.startsWith(scopeClass)) {
    return selector;
  }

  if (selector.startsWith('&')) {
    return `${scopeClass} ${variantSelector}${selector.slice(1)}`;
  }

  const variantAliases = getVariantAliasSelectors(variantSelector);
  if (variantAliases.some((alias) => selector.includes(alias))) {
    return `${scopeClass} ${selector}`;
  }

  if (selector.startsWith('.') && !/[ >+~]/.test(selector)) {
    return `${scopeClass} ${variantSelector}${selector}, ${scopeClass} ${variantSelector} ${selector}`;
  }

  return `${scopeClass} ${variantSelector} ${selector}`;
}

export function buildScopedBubbleThemeCss(styleText: string | undefined, scopeClass: string): string {
  const normalized = normalizeBubbleStyleText(styleText);
  if (!normalized || !normalized.includes('{')) {
    return '';
  }

  return normalized.replace(/(^|})\s*([^@}{][^{]+)\{/g, (match, prefix: string, selectors: string) => {
    const scopedSelectors = scopeSelectorList(selectors, scopeClass);
    return `${prefix} ${scopedSelectors}{`;
  });
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

  return trimmed.replace(/(^|})\s*([^@}{][^{]+)\{/g, (match, prefix: string, selectors: string) => {
    const scopedSelectors = selectors
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => buildScopedVariantSelector(selector, scopeClass, variantSelector))
      .join(', ');
    return `${prefix} ${scopedSelectors}{`;
  });
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

  return trimmed.replace(/(^|})\s*([^@}{][^{]+)\{/g, (match, prefix: string, selectors: string) => {
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
}
