import type { AppData, AppSettings } from '../../types';
import {
  buildModularBackupArchive,
  buildSingleFileModularBackupBundle,
} from './backupArchive';

type BackupExportMode = 'full' | 'split';

type BackupExportWorkerProgress = {
  type: 'progress';
  message: string;
};

type BackupExportWorkerSuccess = {
  type: 'result';
  assetCount: number;
  files: Array<{
    blob: Blob;
    fileName: string;
  }>;
};

type BackupExportWorkerError = {
  type: 'error';
  message: string;
};

type BackupExportWorkerMessage =
  | BackupExportWorkerProgress
  | BackupExportWorkerSuccess
  | BackupExportWorkerError;

export type BackupExportJobResult = {
  assetCount: number;
  files: Array<{
    blob: Blob;
    fileName: string;
  }>;
};

type RunBackupExportJobParams = {
  appData: Partial<AppData> | null | undefined;
  mode: BackupExportMode;
  onProgress?: (message: string) => void;
  settings: AppSettings | unknown;
};

function buildJsonBlob(payload: unknown): Blob {
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

async function runBackupExportFallback(params: RunBackupExportJobParams): Promise<BackupExportJobResult> {
  params.onProgress?.(params.mode === 'full' ? '正在主线程生成完整备份...' : '正在主线程生成分批备份...');

  if (params.mode === 'split') {
    const timestamp = Date.now();
    const bundle = await buildSingleFileModularBackupBundle({
      appData: params.appData,
      settings: params.settings,
    });

    return {
      assetCount: bundle.dataArchive.assetCount,
      files: [
        {
          fileName: `split_backup_${timestamp}.json`,
          blob: buildJsonBlob(bundle),
        },
      ],
    };
  }

  const timestamp = Date.now();
  const archive = await buildModularBackupArchive({
    appData: params.appData,
    settings: params.settings,
  });

  return {
    assetCount: archive.assets.length,
    files: [
      {
        fileName: `full_backup_${timestamp}.json`,
        blob: buildJsonBlob(archive),
      },
    ],
  };
}

export async function runBackupExportJob(params: RunBackupExportJobParams): Promise<BackupExportJobResult> {
  if (typeof Worker === 'undefined') {
    return runBackupExportFallback(params);
  }

  return new Promise<BackupExportJobResult>((resolve, reject) => {
    const worker = new Worker(new URL('./backupExport.worker.ts', import.meta.url), {
      type: 'module',
    });
    let settled = false;

    const finish = () => {
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<BackupExportWorkerMessage>) => {
      const message = event.data;

      if (!message || typeof message !== 'object') {
        return;
      }

      if (message.type === 'progress') {
        params.onProgress?.(message.message);
        return;
      }

      if (message.type === 'error') {
        if (settled) {
          return;
        }

        settled = true;
        finish();
        reject(new Error(message.message || '后台备份失败'));
        return;
      }

      if (message.type === 'result') {
        if (settled) {
          return;
        }

        settled = true;
        finish();
        resolve({
          assetCount: message.assetCount,
          files: message.files,
        });
      }
    };

    worker.onerror = (event) => {
      if (settled) {
        return;
      }

      settled = true;
      finish();
      reject(new Error(event.message || '后台备份线程启动失败'));
    };

    worker.postMessage({
      type: 'build',
      mode: params.mode,
      timestamp: Date.now(),
    });
  });
}
