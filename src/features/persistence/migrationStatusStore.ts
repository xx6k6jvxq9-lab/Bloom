import { loadJson, remove, saveJson } from './localConfigStore';
import { loadJsonRecord, saveJsonRecord } from './browserJsonStore';
import { STORAGE_KEYS } from './storageKeys';

export type MigrationStatus = 'not_started' | 'in_progress' | 'success' | 'failed';

export type PersistenceMigrationMeta = {
  migrationVersion: number;
  status: MigrationStatus;
  migratedAt: number | null;
  lastVerifiedAt: number | null;
  successfulLaunchCount: number;
  legacyCleanupCompleted: boolean;
  lastError: string | null;
};

export type MigrationCheckResult = PersistenceMigrationMeta & {
  indexedDbKeyCount: number;
  criticalKeyCount: number;
  importRecommended: boolean;
  hasLegacyPayload: boolean;
  hasLegacyCompatibilityCopy: boolean;
  canSafelyCleanupLegacy: boolean;
};

export const CURRENT_MIGRATION_VERSION = 1;
export const LEGACY_CLEANUP_SUCCESS_THRESHOLD = 3;

const CRITICAL_STORAGE_KEYS = [
  STORAGE_KEYS.settings,
  STORAGE_KEYS.characters,
  STORAGE_KEYS.chatHistory,
  STORAGE_KEYS.chatOrganization,
  STORAGE_KEYS.userProfile,
] as const;

const DEFAULT_MIGRATION_META: PersistenceMigrationMeta = {
  migrationVersion: CURRENT_MIGRATION_VERSION,
  status: 'not_started',
  migratedAt: null,
  lastVerifiedAt: null,
  successfulLaunchCount: 0,
  legacyCleanupCompleted: false,
  lastError: null,
};

function normalizeMeta(source: Partial<PersistenceMigrationMeta> | null | undefined): PersistenceMigrationMeta {
  return {
    migrationVersion: typeof source?.migrationVersion === 'number'
      ? source.migrationVersion
      : CURRENT_MIGRATION_VERSION,
    status: source?.status ?? DEFAULT_MIGRATION_META.status,
    migratedAt: typeof source?.migratedAt === 'number' ? source.migratedAt : null,
    lastVerifiedAt: typeof source?.lastVerifiedAt === 'number' ? source.lastVerifiedAt : null,
    successfulLaunchCount: typeof source?.successfulLaunchCount === 'number' ? source.successfulLaunchCount : 0,
    legacyCleanupCompleted: source?.legacyCleanupCompleted === true,
    lastError: typeof source?.lastError === 'string' ? source.lastError : null,
  };
}

function detectLegacyPayloadPresence(): {
  hasLegacyPayload: boolean;
  hasLegacyCompatibilityCopy: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      hasLegacyPayload: false,
      hasLegacyCompatibilityCopy: false,
    };
  }

  let hasLegacySettings = false;
  let hasLegacyAppData = false;

  try {
    hasLegacySettings = window.localStorage.getItem(STORAGE_KEYS.settings) != null;
    hasLegacyAppData = window.localStorage.getItem(STORAGE_KEYS.appData) != null;
  } catch (error) {
    console.warn('[migrationStatusStore] Failed to inspect legacy localStorage payload', error);
  }

  return {
    hasLegacyPayload: hasLegacySettings || hasLegacyAppData,
    hasLegacyCompatibilityCopy: hasLegacyAppData,
  };
}

export function loadMigrationMeta(): PersistenceMigrationMeta {
  return normalizeMeta(loadJson<Partial<PersistenceMigrationMeta> | null>(STORAGE_KEYS.migrationMeta, null));
}

export function saveMigrationMeta(meta: PersistenceMigrationMeta): void {
  saveJson(STORAGE_KEYS.migrationMeta, meta);
}

export function clearLegacyCompatibilityCopy(): PersistenceMigrationMeta {
  const previousMeta = loadMigrationMeta();
  remove(STORAGE_KEYS.appData);

  const nextMeta: PersistenceMigrationMeta = {
    ...previousMeta,
    status: previousMeta.status === 'not_started' ? 'not_started' : 'success',
    lastVerifiedAt: Date.now(),
    legacyCleanupCompleted: true,
    lastError: null,
  };

  saveMigrationMeta(nextMeta);
  return nextMeta;
}

export async function migrateCriticalRecordsIfNeeded(
  records: Partial<Record<(typeof CRITICAL_STORAGE_KEYS)[number], unknown>>,
): Promise<void> {
  const previousMeta = loadMigrationMeta();
  const now = Date.now();
  let wroteAnyRecord = false;

  for (const key of CRITICAL_STORAGE_KEYS) {
    const nextValue = records[key];
    if (nextValue == null) {
      continue;
    }

    try {
      const currentValue = await loadJsonRecord<unknown>(key);
      if (currentValue != null) {
        continue;
      }

      await saveJsonRecord(key, nextValue);
      wroteAnyRecord = true;
    } catch (error) {
      console.error(`[migrationStatusStore] Failed to migrate key "${key}"`, error);
      saveMigrationMeta({
        ...previousMeta,
        migrationVersion: CURRENT_MIGRATION_VERSION,
        status: 'failed',
        lastVerifiedAt: now,
        lastError: `关键数据 ${key} 迁移失败，请先导入之前备份的数据。`,
      });
      return;
    }
  }

  if (wroteAnyRecord) {
    saveMigrationMeta({
      ...previousMeta,
      migrationVersion: CURRENT_MIGRATION_VERSION,
      status: 'in_progress',
      migratedAt: previousMeta.migratedAt ?? now,
      lastVerifiedAt: now,
      lastError: null,
    });
  }
}

export async function evaluateMigrationStatus(): Promise<MigrationCheckResult> {
  return evaluateMigrationStatusWithOptions();
}

export async function evaluateMigrationStatusWithOptions(
  options?: {
    countSuccessfulLaunch?: boolean;
  },
): Promise<MigrationCheckResult> {
  const previousMeta = loadMigrationMeta();
  const recordStates = await Promise.all(
    CRITICAL_STORAGE_KEYS.map(async (key) => {
      try {
        const value = await loadJsonRecord<unknown>(key);
        return value != null;
      } catch (error) {
        console.error(`[migrationStatusStore] Failed to inspect key "${key}"`, error);
        return false;
      }
    }),
  );

  const indexedDbKeyCount = recordStates.filter(Boolean).length;
  const criticalKeyCount = CRITICAL_STORAGE_KEYS.length;
  const { hasLegacyPayload, hasLegacyCompatibilityCopy } = detectLegacyPayloadPresence();

  let status: MigrationStatus = 'not_started';
  let lastError: string | null = null;

  if (indexedDbKeyCount === criticalKeyCount) {
    status = 'success';
  } else if (indexedDbKeyCount > 0) {
    status = 'failed';
    lastError = '新存储中的关键数据还不完整，建议先导入之前备份的数据。';
  } else if (hasLegacyPayload) {
    status = 'in_progress';
  }

  const now = Date.now();
  const nextSuccessfulLaunchCount = status === 'success' && options?.countSuccessfulLaunch
    ? previousMeta.successfulLaunchCount + 1
    : previousMeta.successfulLaunchCount;
  const canSafelyCleanupLegacy = (
    status === 'success'
    && nextSuccessfulLaunchCount >= LEGACY_CLEANUP_SUCCESS_THRESHOLD
  );

  const nextMeta: PersistenceMigrationMeta = {
    migrationVersion: CURRENT_MIGRATION_VERSION,
    status,
    migratedAt: status === 'success' ? (previousMeta.migratedAt ?? now) : previousMeta.migratedAt,
    lastVerifiedAt: now,
    successfulLaunchCount: nextSuccessfulLaunchCount,
    legacyCleanupCompleted: previousMeta.legacyCleanupCompleted || (!hasLegacyPayload && canSafelyCleanupLegacy),
    lastError,
  };

  saveMigrationMeta(nextMeta);

  return {
    ...nextMeta,
    indexedDbKeyCount,
    criticalKeyCount,
    importRecommended: status === 'failed',
    hasLegacyPayload,
    hasLegacyCompatibilityCopy,
    canSafelyCleanupLegacy,
  };
}
