import type React from 'react';

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function extractDeclarationBody(styleText: string): string {
  const trimmed = styleText.trim();
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
  if (!styleText?.trim()) {
    return {};
  }

  const trimmed = styleText.trim();

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

export function hasBubbleThemeCss(styleText?: string): boolean {
  const trimmed = styleText?.trim();
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

export function buildScopedBubbleThemeCss(styleText: string | undefined, scopeClass: string): string {
  if (!styleText?.trim() || !styleText.includes('{')) {
    return '';
  }

  return styleText.replace(/(^|})\s*([^@}{][^{]+)\{/g, (match, prefix: string, selectors: string) => {
    const scopedSelectors = scopeSelectorList(selectors, scopeClass);
    return `${prefix} ${scopedSelectors}{`;
  });
}

export function buildScopedBubbleVariantCss(
  styleText: string | undefined,
  scopeClass: string,
  variantSelector: string,
): string {
  const trimmed = styleText?.trim();
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
      .map((selector) => `${scopeClass} ${variantSelector}${selector.startsWith('&') ? selector.slice(1) : ` ${selector}`}`)
      .join(', ');
    return `${prefix} ${scopedSelectors}{`;
  });
}
