import type { Character } from '../../types';
import type { DreamRuntimeScenario } from '../../services/dream/dreamRuntimeTypes';
import { dreamTagGroups, resolveDomainName } from './dreamContent';
import type { DreamDepth, DreamEntryMode, DreamTagCategory } from './types';

export type DreamArchiveRecord = {
  id: string;
  roleId: string;
  roleName: string;
  roleAvatar: string;
  domainName: string;
  depth: DreamDepth;
  entryMode: DreamEntryMode;
  selectedLabels: string[];
  scenario: DreamRuntimeScenario;
  createdAt: number;
  updatedAt: number;
};

const DREAM_ARCHIVE_STORAGE_KEY = 'dream_app_archive_records_v1';
const DREAM_ARCHIVE_LIMIT = 24;

export function getSelectedTagLabels(selectedTags: Record<DreamTagCategory, string[]>) {
  return dreamTagGroups.flatMap((group) =>
    group.options
      .filter((option) => (selectedTags[group.category] ?? []).includes(option.id))
      .map((option) => option.label),
  );
}

export function loadDreamArchiveRecords(): DreamArchiveRecord[] {
  try {
    const raw = localStorage.getItem(DREAM_ARCHIVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DreamArchiveRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((record) => record?.id && record?.scenario)
      .slice(0, DREAM_ARCHIVE_LIMIT);
  } catch {
    return [];
  }
}

export function saveDreamArchiveRecords(records: DreamArchiveRecord[]) {
  localStorage.setItem(DREAM_ARCHIVE_STORAGE_KEY, JSON.stringify(records.slice(0, DREAM_ARCHIVE_LIMIT)));
}

export function exportDreamArchiveRecords(records: DreamArchiveRecord[], filename = 'dream-archive.json') {
  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: 1,
      records,
    },
    null,
    2,
  );
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function upsertDreamArchiveRecord(records: DreamArchiveRecord[], nextRecord: DreamArchiveRecord) {
  const existing = records.find((record) => record.id === nextRecord.id);
  const mergedRecord = existing
    ? { ...existing, ...nextRecord, createdAt: existing.createdAt }
    : nextRecord;
  const rest = records.filter((record) => record.id !== nextRecord.id);
  return [mergedRecord, ...rest].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, DREAM_ARCHIVE_LIMIT);
}

export function buildDreamArchiveRecord({
  character,
  scenario,
  selectedTags,
}: {
  character: Character;
  scenario: DreamRuntimeScenario;
  selectedTags: Record<DreamTagCategory, string[]>;
}): DreamArchiveRecord {
  const now = Date.now();
  return {
    id: scenario.id,
    roleId: character.id,
    roleName: character.remarkName?.trim() || character.name || '未命名角色',
    roleAvatar: character.avatar || '',
    domainName: resolveDomainName(scenario.domainId),
    depth: scenario.depth,
    entryMode: scenario.entryMode,
    selectedLabels: getSelectedTagLabels(selectedTags),
    scenario,
    createdAt: now,
    updatedAt: now,
  };
}

export function formatArchiveDate(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
