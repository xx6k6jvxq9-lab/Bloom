/// <reference lib="webworker" />

import {
  isFullBackupArchive,
  isModularBackupArchive,
  isModularBackupAssetsArchive,
  isModularBackupDataArchive,
  isSingleFileModularBackupBundle,
  restoreFullBackupArchive,
  restoreModularBackupArchive,
  restoreModularBackupAssetsArchive,
  restoreModularBackupDataArchive,
  restoreSingleFileModularBackupBundle,
  verifySingleFileModularBackupBundleIntegrity,
  type BackupRestoreProgress,
} from './backupArchive';

type BackupImportWorkerRequest = {
  type: 'import';
  file: Blob;
};

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

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

function postProgress(message: string): void {
  workerScope.postMessage({
    type: 'progress',
    message,
  } satisfies BackupImportWorkerProgress);
}

function createProgressHandler(): (progress: BackupRestoreProgress) => void {
  return (progress) => {
    postProgress(progress.message);
  };
}

async function handleImportRequest(request: BackupImportWorkerRequest): Promise<void> {
  postProgress('正在读取备份文件...');
  const content = await request.file.text();
  postProgress('正在解析备份文件...');
  const parsed = JSON.parse(content);
  const onProgress = createProgressHandler();

  if (isSingleFileModularBackupBundle(parsed)) {
    postProgress('正在校验单文件备份...');
    const integrityOk = await verifySingleFileModularBackupBundleIntegrity(parsed);
    if (!integrityOk) {
      throw new Error('单文件备份校验失败，文件可能已损坏或内容不完整');
    }

    postProgress('正在恢复单文件备份...');
    await restoreSingleFileModularBackupBundle(parsed, { onProgress });
    workerScope.postMessage({
      type: 'result',
      kind: 'single-file',
      assetCount: parsed.assetsArchive?.assets.length ?? 0,
    } satisfies BackupImportWorkerSuccess);
    return;
  }

  if (isModularBackupDataArchive(parsed)) {
    postProgress('正在恢复主数据包...');
    await restoreModularBackupDataArchive(parsed, { onProgress });
    workerScope.postMessage({
      type: 'result',
      kind: 'data-archive',
      assetCount: parsed.assetCount,
    } satisfies BackupImportWorkerSuccess);
    return;
  }

  if (isModularBackupAssetsArchive(parsed)) {
    postProgress('正在恢复资源包...');
    await restoreModularBackupAssetsArchive(parsed, { onProgress });
    workerScope.postMessage({
      type: 'result',
      kind: 'assets-archive',
      assetCount: parsed.assets.length,
    } satisfies BackupImportWorkerSuccess);
    return;
  }

  if (isModularBackupArchive(parsed)) {
    postProgress('正在恢复模块化备份...');
    await restoreModularBackupArchive(parsed, { onProgress });
    workerScope.postMessage({
      type: 'result',
      kind: 'modular-archive',
      assetCount: parsed.assets.length,
    } satisfies BackupImportWorkerSuccess);
    return;
  }

  if (isFullBackupArchive(parsed)) {
    postProgress('正在恢复完整备份...');
    await restoreFullBackupArchive(parsed, { onProgress });
    workerScope.postMessage({
      type: 'result',
      kind: 'full-archive',
      assetCount: parsed.assets.length,
    } satisfies BackupImportWorkerSuccess);
    return;
  }

  workerScope.postMessage({
    type: 'result',
    kind: 'unsupported',
    assetCount: 0,
  } satisfies BackupImportWorkerSuccess);
}

workerScope.onmessage = (event: MessageEvent<BackupImportWorkerRequest>) => {
  const request = event.data;
  if (request?.type !== 'import') {
    return;
  }

  void handleImportRequest(request).catch((error) => {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : '后台导入失败',
    } satisfies BackupImportWorkerError);
  });
};
