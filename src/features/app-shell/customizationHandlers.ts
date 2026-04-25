import type { AppData } from '../../types';
import { sanitizePersistedCharacters as sanitizePersistedCharactersFromStore } from '../persistence/appDataSanitizers';
import { clearAssets } from '../persistence/browserDb';
import { clearJsonRecords } from '../persistence/browserJsonStore';
import { sanitizeTransientAssetValue } from '../persistence/sanitizeTransientAssetValue';
import { STORAGE_KEYS } from '../persistence/storageKeys';
import { resetCharacters } from '../persistence/charactersStore';
import { clearPersistedVisualSettings } from '../persistence/visualSettingsStore';

type HandleCustomizationImportDataParams = {
  data: string;
  defaultCharacters: AppData['characters'];
  defaultZhouJibaiAvatar: string;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
};

export function handleCustomizationImportData({
  data,
  defaultCharacters,
  defaultZhouJibaiAvatar,
  setAppData,
}: HandleCustomizationImportDataParams) {
  try {
    const parsed = JSON.parse(data);
    setAppData({
      ...parsed,
      characters: sanitizePersistedCharactersFromStore(
        parsed.characters,
        defaultCharacters,
        defaultZhouJibaiAvatar,
      ),
      userProfile: parsed.userProfile
        ? {
            ...parsed.userProfile,
            avatar: sanitizeTransientAssetValue(parsed.userProfile.avatar),
          }
        : parsed.userProfile,
    });
    alert('导入成功！');
  } catch {
    alert('导入失败，请检查数据格式。');
  }
}

export async function handleCustomizationResetData() {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });

  resetCharacters();
  clearPersistedVisualSettings();

  try {
    await Promise.all([
      clearJsonRecords(),
      clearAssets(),
    ]);
  } catch (error) {
    console.error('[customizationHandlers] Failed to clear IndexedDB during reset', error);
  }

  window.location.reload();
}

export function handleCustomizationExportData(appData: AppData) {
  const data = JSON.stringify(appData);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'ai_phone_backup.json';
  anchor.click();
}

export function handleCustomizationUpdateAppData(
  newData: Partial<AppData>,
  setAppData: React.Dispatch<React.SetStateAction<AppData>>,
) {
  setAppData((prev) => ({ ...prev, ...newData }));
}
