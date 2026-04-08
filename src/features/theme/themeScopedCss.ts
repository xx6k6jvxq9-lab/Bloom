import { THEME_SCOPE_TARGETS, type ThemeScopeTargetId } from './themeCustomizationTargets';

function looksLikeCssRuleBlock(input: string): boolean {
  return /(^|\n)\s*[^@\n][^{\n]*\{/.test(input) || /@media\s*\(|@supports\s*\(/.test(input);
}

function normalizeDeclarationBlock(input: string): string {
  return input.trim().replace(/^\s+|\s+$/g, '');
}

export function buildThemeScopedCss(themeScopedCss?: Record<string, string>): string {
  if (!themeScopedCss) {
    return '';
  }

  return Object.entries(themeScopedCss)
    .map(([targetId, rawValue]) => {
      const target = THEME_SCOPE_TARGETS[targetId as ThemeScopeTargetId];
      const css = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!target || !css) {
        return '';
      }

      if (looksLikeCssRuleBlock(css)) {
        return css;
      }

      const declarations = normalizeDeclarationBlock(css);
      if (!declarations) {
        return '';
      }

      return `${target.selectors.join(',\n')} {\n${declarations}\n}`;
    })
    .filter(Boolean)
    .join('\n\n');
}
