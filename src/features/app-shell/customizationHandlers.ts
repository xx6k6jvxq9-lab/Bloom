import type { AppData } from '../../types';
import { sanitizePersistedCharacters as sanitizePersistedCharactersFromStore } from '../persistence/appDataSanitizers';
import { clearAllPersistentData } from '../persistence/backupArchive';
import { createDefaultPerceptionSettings, hydratePerceptionSettings } from '../persistence/perceptionStore';
import { sanitizeTransientAssetValue } from '../persistence/sanitizeTransientAssetValue';

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
    const importedPerception = hydratePerceptionSettings(
      parsed.perception
      ?? parsed.coupleSpaceState?.sharedPerception
      ?? parsed.coupleSpace?.perception,
      createDefaultPerceptionSettings(),
    );
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
      perception: importedPerception,
      coupleSpaceState: parsed.coupleSpaceState
        ? {
            ...parsed.coupleSpaceState,
            sharedPerception: importedPerception,
          }
        : parsed.coupleSpaceState,
    });
    alert('导入成功！');
  } catch {
    alert('导入失败，请检查数据格式。');
  }
}

export async function handleCustomizationResetData() {
  try {
    await clearAllPersistentData();
  } catch (error) {
    console.error('[customizationHandlers] Failed to clear persistent data during reset', error);
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
