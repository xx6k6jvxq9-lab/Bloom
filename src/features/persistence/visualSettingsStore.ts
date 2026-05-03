import type { VisualSettings } from '../../types';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

const DEFAULT_NAV_BAR_BACKGROUND = '';

export function hydrateVisualSettings(
  source: Partial<VisualSettings> | null | undefined,
  fallbackGlobalBackground: string,
): VisualSettings {
  const hydratedFontPriority = source?.themeTypography?.fontPriority || 'lock-imported';

  return {
    globalBackground: source?.globalBackground || fallbackGlobalBackground,
    chatOpacity: source?.chatOpacity ?? 1,
    momentsBackground: source?.momentsBackground || '',
    themeScopedCss: source?.themeScopedCss || {},
    themeTypography: {
      importedFonts: source?.themeTypography?.importedFonts || [],
      selectedFontId: source?.themeTypography?.selectedFontId || '',
      fontPriority: hydratedFontPriority,
      textColor: source?.themeTypography?.textColor || '#18181b',
      previewText:
        source?.themeTypography?.previewText
        || '晚风轻轻吹过，气泡、标题和正文都应该有自己的气质。',
    },
    desktopIcons: source?.desktopIcons || [],
    widgets: source?.widgets || [],
    navBar: {
      show: source?.navBar?.show ?? true,
      style: source?.navBar?.style || 'default',
      shape: source?.navBar?.shape || 'pill',
      showMultipleAvatars: source?.navBar?.showMultipleAvatars ?? false,
      page: source?.navBar?.page,
      slotId: source?.navBar?.slotId,
      offsetX: source?.navBar?.offsetX,
      offsetY: source?.navBar?.offsetY,
      backgroundImage: source?.navBar?.backgroundImage || DEFAULT_NAV_BAR_BACKGROUND,
      selectedCharacterId: source?.navBar?.selectedCharacterId,
      statusBarPlacement: source?.navBar?.statusBarPlacement || 'top',
      customCss: source?.navBar?.customCss || '',
    },
    desktop: {
      iconSize: source?.desktop?.iconSize ?? 56,
      iconBorderRadius: source?.desktop?.iconBorderRadius ?? 14,
      gridColumns: source?.desktop?.gridColumns ?? 4,
      gridGap: source?.desktop?.gridGap ?? 16,
      dockSlotId: source?.desktop?.dockSlotId,
      topWidgetRow: source?.desktop?.topWidgetRow,
      appOrder: source?.desktop?.appOrder,
      fontFamily: source?.desktop?.fontFamily,
      fontSize: source?.desktop?.fontSize,
      fontColor: source?.desktop?.fontColor,
      fontWeight: source?.desktop?.fontWeight,
    },
    chat: {
      background: source?.chat?.background || '',
      avatarSize: source?.chat?.avatarSize ?? 40,
      avatarBorderRadius: source?.chat?.avatarBorderRadius ?? 20,
      avatarBorderColor: source?.chat?.avatarBorderColor || '#e4e4e7',
      avatarBorderWidth: source?.chat?.avatarBorderWidth ?? 0,
      avatarFrameUrl: source?.chat?.avatarFrameUrl,
      messageBorderRadius: source?.chat?.messageBorderRadius ?? 16,
      messageBackgroundColorUser: source?.chat?.messageBackgroundColorUser || '#3b82f6',
      messageBackgroundColorModel: source?.chat?.messageBackgroundColorModel || '#ffffff',
      messageBackgroundImageUrl: source?.chat?.messageBackgroundImageUrl,
      messageSpacing: source?.chat?.messageSpacing ?? 16,
      bubbleScale: source?.chat?.bubbleScale ?? 1,
      bubbleStyleCss: source?.chat?.bubbleStyleCss || '',
      modelBubbleStyleCss: source?.chat?.modelBubbleStyleCss || '',
      userBubbleStyleCss: source?.chat?.userBubbleStyleCss || '',
      headerStyle: source?.chat?.headerStyle,
      footerStyle: source?.chat?.footerStyle,
      uiScale: source?.chat?.uiScale,
      fontSize: source?.chat?.fontSize,
    },
    dynamics: {
      background: source?.dynamics?.background || '',
      cardStyle: source?.dynamics?.cardStyle || 'flat',
      cardBorderRadius: source?.dynamics?.cardBorderRadius ?? 24,
      cardOpacity: source?.dynamics?.cardOpacity ?? 1,
      customCss: source?.dynamics?.customCss || '',
    },
    globalCss: source?.globalCss || '',
  };
}

function mergeVisualSettingsSource(
  persistedVisualSettings: Partial<VisualSettings> | null | undefined,
  fallbackSource: Partial<VisualSettings> | null | undefined,
): Partial<VisualSettings> | null | undefined {
  if (!persistedVisualSettings) {
    return fallbackSource;
  }

  return {
    ...(fallbackSource || {}),
    ...persistedVisualSettings,
    navBar: {
      ...(fallbackSource?.navBar || {}),
      ...(persistedVisualSettings.navBar || {}),
    },
    desktop: {
      ...(fallbackSource?.desktop || {}),
      ...(persistedVisualSettings.desktop || {}),
    },
    chat: {
      ...(fallbackSource?.chat || {}),
      ...(persistedVisualSettings.chat || {}),
    },
    dynamics: {
      ...(fallbackSource?.dynamics || {}),
      ...(persistedVisualSettings.dynamics || {}),
    },
  } as Partial<VisualSettings>;
}

export function loadPersistedVisualSettings(
  fallbackSource: Partial<VisualSettings> | null | undefined,
  fallbackGlobalBackground: string,
): VisualSettings {
  const persistedVisualSettings = loadJson<Partial<VisualSettings> | null>(STORAGE_KEYS.visualSettings, null);
  const mergedSource = mergeVisualSettingsSource(persistedVisualSettings, fallbackSource);

  return hydrateVisualSettings(mergedSource, fallbackGlobalBackground);
}

export async function loadPreferredVisualSettings(
  fallbackSource: Partial<VisualSettings> | null | undefined,
  fallbackGlobalBackground: string,
): Promise<VisualSettings> {
  try {
    const persistedVisualSettings = await loadJsonRecord<Partial<VisualSettings>>(STORAGE_KEYS.visualSettings);
    if (persistedVisualSettings) {
      return hydrateVisualSettings(
        mergeVisualSettingsSource(persistedVisualSettings, fallbackSource),
        fallbackGlobalBackground,
      );
    }
  } catch (error) {
    console.error('[visualSettingsStore] Failed to load visual settings from IndexedDB', error);
  }

  return loadPersistedVisualSettings(fallbackSource, fallbackGlobalBackground);
}

export function persistVisualSettings(settings: VisualSettings): Promise<void> {
  saveJson(STORAGE_KEYS.visualSettings, settings);

  return saveJsonRecord(STORAGE_KEYS.visualSettings, settings).catch((error) => {
    console.error('[visualSettingsStore] Failed to persist visual settings into IndexedDB', error);
  });
}

export function clearPersistedVisualSettings(): void {
  removeStoredJson(STORAGE_KEYS.visualSettings);
  void removeJsonRecord(STORAGE_KEYS.visualSettings).catch((error) => {
    console.error('[visualSettingsStore] Failed to remove visual settings from IndexedDB', error);
  });
}
