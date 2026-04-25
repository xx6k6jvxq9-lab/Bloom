import type { AppData } from '../../types';
import { sanitizePersistedCharacters as sanitizePersistedCharactersFromStore } from '../persistence/appDataSanitizers';
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
