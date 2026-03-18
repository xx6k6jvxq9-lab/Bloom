import { useMemo } from 'react';
import { extractSingleImageUrl } from '../../utils';
import { saveUploadedFile } from './persistentAssetService';

type PersistentFieldActions = {
  setRemoteUrl(url: string): Promise<string>;
  setUploadedFile(file: File): Promise<string>;
  clearValue(): Promise<string>;
};

export function usePersistentFieldActions(): PersistentFieldActions {
  return useMemo(
    () => ({
      async setRemoteUrl(url: string) {
        return extractSingleImageUrl(url).trim();
      },
      async setUploadedFile(file: File) {
        return saveUploadedFile(file);
      },
      async clearValue() {
        return '';
      },
    }),
    [],
  );
}
