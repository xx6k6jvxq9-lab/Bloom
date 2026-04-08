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
    return font.format.trim();
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

export function buildThemeTypographyCss(
  typography: ThemeTypographySettings | undefined,
  resolvedFonts: ResolvedThemeFont[],
): string {
  if (!typography) {
    return '';
  }

  const fontFaces = resolvedFonts
    .map((font) => {
      const format = inferThemeFontFormat(font);
      return `@font-face {
  font-family: ${quoteFontFamily(font.familyName)};
  src: url("${font.resolvedUrl}") format("${format}");
  font-display: swap;
}`;
    })
    .join('\n\n');

  const selectedFont = resolvedFonts.find((font) => font.id === typography.selectedFontId);
  const selectedFamily = selectedFont ? quoteFontFamily(selectedFont.familyName) : '';
  const selectedStack = selectedFamily
    ? `${selectedFamily}, "PingFang SC", "Microsoft YaHei", sans-serif`
    : '';
  const textColorCss = typography.textColor?.trim()
    ? `body, button, input, textarea, select {
  color: ${typography.textColor.trim()};
}
`
    : '';

  let fontPriorityCss = '';
  if (selectedStack && typography.fontPriority === 'imported-first') {
    fontPriorityCss = `body, button, input, textarea, select {
  font-family: ${selectedStack};
}`;
  } else if (selectedStack && typography.fontPriority === 'lock-imported') {
    fontPriorityCss = `body, button, input, textarea, select {
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
