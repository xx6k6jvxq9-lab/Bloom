export const DEFAULT_CONTACT_GROUPS = ['家人', '朋友', '同事', '星标'] as const;

const LEGACY_CONTACT_GROUP_NAME_MAP: Record<string, string> = {
  瀹朵汉: '家人',
  鏈嬪弸: '朋友',
  鍚屼簨: '同事',
  鏄熸爣: '星标',
};

export function normalizeContactGroupName(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return LEGACY_CONTACT_GROUP_NAME_MAP[trimmed] || trimmed;
}

export function normalizeContactGroups(groups: readonly unknown[] | null | undefined): string[] {
  if (!Array.isArray(groups)) {
    return [];
  }

  return Array.from(
    new Set(
      groups
        .map((group) => normalizeContactGroupName(group))
        .filter((group): group is string => !!group),
    ),
  );
}
