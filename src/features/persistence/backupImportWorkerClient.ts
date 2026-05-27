type BackupImportWorkerProgress = {
  type: 'progress';
  message: string;
};

type BackupImportWorkerSuccess = {
  type: 'result';
  kind: 'single-file' | 'data-archive' | 'assets-archive' | 'modular-archive' | 'full-archive' | 'unsupported';
  assetCount: number;
};

type BackupImportWorkerError = {
  type: 'error';
  message: string;
};

type BackupImportWorkerMessage =
  | BackupImportWorkerProgress
  | BackupImportWorkerSuccess
  | BackupImportWorkerError;

export type BackupImportJobResult = {
  assetCount: number;
  kind: BackupImportWorkerSuccess['kind'];
};

type RunBackupImportJobParams = {
  file: Blob;
  onProgress?: (message: string) => void;
};

export async function runBackupImportJob(params: RunBackupImportJobParams): Promise<BackupImportJobResult> {
  if (typeof Worker === 'undefined') {
    return {
      kind: 'unsupported',
      assetCount: 0,
    };
  }

  return new Promise<BackupImportJobResult>((resolve, reject) => {
    const worker = new Worker(new URL('./backupImport.worker.ts', import.meta.url), {
      type: 'module',
    });
    let settled = false;

    const finish = () => {
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<BackupImportWorkerMessage>) => {
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
        reject(new Error(message.message || '后台导入失败'));
        return;
      }

      if (message.type === 'result') {
        if (settled) {
          return;
        }

        settled = true;
        finish();
        resolve({
          kind: message.kind,
          assetCount: message.assetCount,
        });
      }
    };

    worker.onerror = (event) => {
      if (settled) {
        return;
      }

      settled = true;
      finish();
      reject(new Error(event.message || '后台导入线程启动失败'));
    };

    worker.postMessage({
      type: 'import',
      file: params.file,
    });
  });
}
