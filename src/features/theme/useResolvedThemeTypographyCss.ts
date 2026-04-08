import { useEffect, useState } from 'react';
import type { ThemeTypographySettings } from '../../types';
import { resolveValueToDisplayUrl } from '../persistence/persistentAssetService';
import { buildThemeTypographyCss, getThemeImportedFontFamily, type ResolvedThemeFont } from './themeTypography';

type ResolvedThemeTypographyState = {
  resolvedFonts: ResolvedThemeFont[];
  generatedCss: string;
};

export function useResolvedThemeTypographyCss(
  typography: ThemeTypographySettings | undefined,
): ResolvedThemeTypographyState {
  const [state, setState] = useState<ResolvedThemeTypographyState>({
    resolvedFonts: [],
    generatedCss: buildThemeTypographyCss(typography, []),
  });

  useEffect(() => {
    let cancelled = false;
    const fonts = typography?.importedFonts || [];

    if (!fonts.length) {
      setState({
        resolvedFonts: [],
        generatedCss: buildThemeTypographyCss(typography, []),
      });
      return undefined;
    }

    Promise.all(
      fonts.map(async (font) => {
        const resolvedUrl = await resolveValueToDisplayUrl(font.source);
        if (!resolvedUrl) {
          return null;
        }

        return {
          ...font,
          familyName: getThemeImportedFontFamily(font.id),
          resolvedUrl,
        } satisfies ResolvedThemeFont;
      }),
    ).then((resolved) => {
      if (cancelled) {
        return;
      }

      const resolvedFonts = resolved.filter((item): item is ResolvedThemeFont => !!item);
      setState({
        resolvedFonts,
        generatedCss: buildThemeTypographyCss(typography, resolvedFonts),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [typography]);

  return state;
}
