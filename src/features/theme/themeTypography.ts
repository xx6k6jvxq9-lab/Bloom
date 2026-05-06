import type { ThemeFontAsset, ThemeTypographySettings } from '../../types';

export type ResolvedThemeFont = ThemeFontAsset & {
  familyName: string;
  resolvedUrl: string;
};

const FONT_FORMAT_BY_EXTENSION: Record<string, string> = {
  ttf: 'truetype',
  otf: 'opentype',
  woff: 'woff',
  woff2: 'woff2',
  ttc: 'truetype',
  eot: 'embedded-opentype',
};

function quoteFontFamily(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function inferThemeFontFormat(font: Pick<ThemeFontAsset, 'name' | 'source' | 'format'>): string {
  if (font.format?.trim()) {
    return FONT_FORMAT_BY_EXTENSION[font.format.trim().toLowerCase()] || font.format.trim();
  }

  const candidate = `${font.name || ''} ${font.source || ''}`.toLowerCase();
  const extensionMatch = candidate.match(/\.(woff2?|ttf|otf|ttc|eot)(?:\?|$|\s)/i);
  if (!extensionMatch) {
    return 'truetype';
  }

  return FONT_FORMAT_BY_EXTENSION[extensionMatch[1].toLowerCase()] || 'truetype';
}

export function getThemeImportedFontFamily(fontId: string): string {
  return `ThemeImportedFont-${fontId}`;
}

export function resolveThemeFontPriority(
  typography: ThemeTypographySettings | undefined,
): 'css-only' | 'imported-first' | 'lock-imported' {
  return typography?.fontPriority || 'lock-imported';
}

export function getThemeSelectedFontStack(typography: ThemeTypographySettings | undefined): string | undefined {
  const selectedFontId = typography?.selectedFontId?.trim();
  if (!selectedFontId) {
    return undefined;
  }

  const fontPriority = resolveThemeFontPriority(typography);
  if (fontPriority === 'css-only') {
    return undefined;
  }

  return `"${getThemeImportedFontFamily(selectedFontId)}", "PingFang SC", "Microsoft YaHei", sans-serif`;
}

export function buildThemeTypographyCss(
  typography: ThemeTypographySettings | undefined,
  resolvedFonts: ResolvedThemeFont[],
): string {
  if (!typography) {
    return '';
  }

  const selectedFontId = typography.selectedFontId?.trim();
  const fontsToLoad = selectedFontId
    ? resolvedFonts.filter((font) => font.id === selectedFontId)
    : [];

  const fontFaces = fontsToLoad
    .map((font) => `@font-face {
  font-family: ${quoteFontFamily(font.familyName)};
  src: url("${font.resolvedUrl}");
  font-display: swap;
}`)
    .join('\n\n');

  const selectedFont = resolvedFonts.find((font) => font.id === typography.selectedFontId);
  const selectedFamily = selectedFont ? quoteFontFamily(selectedFont.familyName) : '';
  const selectedStack = getThemeSelectedFontStack(typography) || '';
  const fontPriorityTargets = 'body, .app-shell, .app-shell *, .app-shell *::before, .app-shell *::after, .app-phone-container, .app-phone-container *, .app-phone-container *::before, .app-phone-container *::after';
  const textColorTargets = 'body, .app-shell, .app-phone-container, button, input, textarea, select';
  const textColorCss = typography.textColor?.trim()
    ? `${textColorTargets} {
  color: ${typography.textColor.trim()};
}
`
    : '';

  let fontPriorityCss = '';
  const effectiveFontPriority = resolveThemeFontPriority(typography);

  if (selectedStack && effectiveFontPriority === 'imported-first') {
    fontPriorityCss = `${fontPriorityTargets} {
  font-family: ${selectedStack};
}`;
  } else if (selectedStack && effectiveFontPriority === 'lock-imported') {
    fontPriorityCss = `${fontPriorityTargets} {
  font-family: ${selectedStack} !important;
}`;
  } else if (selectedStack) {
    fontPriorityCss = `:root {
  --theme-imported-font-family: ${selectedFamily};
}`;
  }

  return [fontFaces, textColorCss, fontPriorityCss].filter(Boolean).join('\n\n');
}

export function buildThemePreviewCss(rawCss: string): string {
  return rawCss
    .replace(/:root/g, '.theme-live-preview')
    .replace(/\bhtml\b/g, '.theme-live-preview')
    .replace(/\bbody\b/g, '.theme-live-preview');
}
