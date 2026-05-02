import type { Character, ChatMessage, WorldBookEntry } from '../../types';
import { extractImageUrls } from '../../utils';
import {
  normalizeWorldBookCategory,
  normalizeWorldBookPriorityLevel,
} from '../../services/world-book/worldBookMeta';
import { buildWorldBookChunkCache } from '../../services/world-book/worldBookBudget';

type CharacterImportFields = Pick<
  Character,
  'name' | 'gender' | 'avatar' | 'setting' | 'remarkName' | 'signature' | 'openingRemark' | 'groupId'
> & Partial<Pick<Character, 'corePersona'>>;

const DIRECT_IMAGE_VALUE_REGEX = /^(https?:|data:image\/)/i;
const HTTP_IMAGE_URL_REGEX = /https?:\/\/[^\s"'<>]+/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pickFirstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function normalizeOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function joinSections(...values: (string | false | null | undefined)[]): string {
  return values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n\n')
    .trim();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeDisplayableAvatar(value: unknown): string {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'none') return '';
  if (DIRECT_IMAGE_VALUE_REGEX.test(trimmed)) return trimmed;

  const matchedUrl = trimmed.match(HTTP_IMAGE_URL_REGEX);
  return matchedUrl?.[0] || '';
}

function pickFirstDisplayableImageUrl(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) continue;

    const urls = extractImageUrls(value);
    const displayable = urls.find((item) => DIRECT_IMAGE_VALUE_REGEX.test(item) || HTTP_IMAGE_URL_REGEX.test(item));
    if (displayable) {
      return displayable;
    }
  }

  return '';
}

function normalizeImportedGender(value: unknown): Character['gender'] {
  if (typeof value !== 'string') return 'other';

  const normalized = value.trim().toLowerCase();
  if (['male', 'man', 'm', '男'].includes(normalized)) return 'male';
  if (['female', 'woman', 'f', '女'].includes(normalized)) return 'female';
  return 'other';
}

function inferGenderFromText(...values: unknown[]): Character['gender'] | undefined {
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) continue;

    const genderMatch = value.match(/(?:^|\n)\s*(?:gender|sex|性别)\s*[：:]\s*(male|female|man|woman|m|f|男|女)\b/i);
    if (!genderMatch) continue;

    const normalized = normalizeImportedGender(genderMatch[1]);
    if (normalized !== 'other') {
      return normalized;
    }
  }

  return undefined;
}

function appendSectionValue(target: Record<string, string>, key: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  target[key] = target[key] ? `${target[key]}\n${trimmed}` : trimmed;
}

function mapImportKey(rawKey: string): string | null {
  const key = rawKey
    .replace(/^#+\s*/, '')
    .replace(/[：:]\s*$/, '')
    .replace(/^["']|["']$/g, '')
    .trim()
    .toLowerCase();

  if (['name', '角色名', '角色姓名', '姓名', '名字', 'character', 'charactername'].includes(key)) return 'name';
  if (['remarkname', 'remark', '备注', '备注名', '称呼', 'nickname', 'alias'].includes(key)) return 'remarkName';
  if (['gender', '性别', 'sex'].includes(key)) return 'gender';
  if (['avatar', '头像', '头像链接', '头像地址', 'avatarurl', 'image', 'portrait'].includes(key)) return 'avatar';
  if (['setting', 'persona', 'profile', '角色设定', '设定', '人设', 'description', 'characterdescription'].includes(key)) return 'setting';
  if (['signature', '个性签名', '签名', 'tagline', 'motto'].includes(key)) return 'signature';
  if (['openingremark', 'opening', '开场白', '第一句话', 'firstmessage', 'firstmes', 'greeting'].includes(key)) return 'openingRemark';
  if (['group', 'groupid', '分组', 'folder'].includes(key)) return 'groupId';
  return null;
}

function parseLooseCharacterImport(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('导入内容为空');
  }

  const sections: Record<string, string> = {};
  let currentKey: string | null = null;

  trimmed.split(/\r?\n/).forEach((line) => {
    const cleaned = line.trim();
    if (!cleaned) return;

    const headingLike = cleaned.replace(/^[-*]\s*/, '');
    const headingKey = mapImportKey(headingLike);
    if (headingKey && !/[：:]/.test(headingLike)) {
      currentKey = headingKey;
      return;
    }

    const pairMatch = cleaned.match(/^#{0,6}\s*["']?([^"':：]+)["']?\s*[：:]\s*(.*)$/);
    if (pairMatch) {
      const mapped = mapImportKey(pairMatch[1]);
      if (mapped) {
        currentKey = mapped;
        appendSectionValue(sections, mapped, pairMatch[2]);
        return;
      }
    }

    if (currentKey) {
      appendSectionValue(sections, currentKey, cleaned);
    } else {
      appendSectionValue(sections, 'setting', cleaned);
    }
  });

  if (!sections.name) {
    throw new Error('缺少角色名称');
  }

  return sections;
}

function normalizeCharacterImportRecord(raw: Record<string, unknown>): CharacterImportFields | null {
  const nestedCharacter = isRecord(raw.character) ? raw.character : null;
  const base = nestedCharacter || raw;
  const nestedData = isRecord(base.data) ? base.data : null;
  const source = nestedData || base;

  const name = pickFirstText(source.name, raw.name);
  if (!name) return null;

  const directSetting = pickFirstText(source.setting, source.corePersona, raw.setting, raw.corePersona);
  const description = pickFirstText(source.description, source.persona, raw.description, raw.persona);
  const personality = pickFirstText(source.personality, raw.personality);
  const scenario = pickFirstText(source.scenario, raw.scenario);
  const creatorNotes = pickFirstText(source.creator_notes, source.system_prompt, source.post_history_instructions);
  const mesExample = pickFirstText(source.mes_example, raw.mes_example);
  const directAvatar = normalizeDisplayableAvatar(
    pickFirstText(source.avatar, raw.avatar, source.image, raw.image, source.portrait, raw.portrait),
  );
  const explicitGender = normalizeImportedGender(pickFirstText(source.gender, raw.gender));
  const combinedSetting = directSetting || joinSections(
    description,
    personality && `性格：${personality}`,
    scenario && `场景：${scenario}`,
    creatorNotes && `补充：${creatorNotes}`,
    mesExample && `示例对话：${mesExample}`,
  );

  return {
    name,
    gender:
      explicitGender !== 'other'
        ? explicitGender
        : inferGenderFromText(description, source.first_mes, raw.first_mes, directSetting) || 'other',
    avatar:
      directAvatar
      || pickFirstDisplayableImageUrl(
        source.first_mes,
        source.firstMessage,
        raw.first_mes,
        raw.firstMessage,
        description,
        creatorNotes,
        mesExample,
      ),
    setting: combinedSetting,
    corePersona: combinedSetting || undefined,
    remarkName: normalizeOptionalText(source.remarkName ?? raw.remarkName),
    signature: normalizeOptionalText(
      pickFirstText(source.signature, raw.signature, source.creator_notes, source.personality, raw.personality),
    ),
    openingRemark: pickFirstText(source.openingRemark, source.first_mes, source.firstMessage, raw.first_mes, raw.firstMessage),
    groupId: normalizeOptionalText(source.groupId ?? source.group ?? raw.groupId ?? raw.group),
  };
}

function normalizeCharacterImportSections(sections: Record<string, string>): CharacterImportFields {
  const setting = sections.setting?.trim() || '';
  const explicitGender = normalizeImportedGender(sections.gender);

  return {
    name: sections.name.trim(),
    gender: explicitGender !== 'other' ? explicitGender : inferGenderFromText(setting) || 'other',
    avatar: normalizeDisplayableAvatar(sections.avatar),
    setting,
    corePersona: setting || undefined,
    remarkName: normalizeOptionalText(sections.remarkName),
    signature: normalizeOptionalText(sections.signature),
    openingRemark: sections.openingRemark?.trim() || '',
    groupId: normalizeOptionalText(sections.groupId),
  };
}

function flattenWorldBookSource(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) return Object.values(value);
  return [];
}

function inferWorldBookTitle(record: Record<string, unknown>, fallbackIndex: number): string {
  const fromKeyArray = toStringArray(record.key);
  return pickFirstText(
    record.title,
    record.comment,
    record.name,
    fromKeyArray.join(' / '),
    typeof record.content === 'string' ? record.content.slice(0, 24) : '',
    `导入设定 ${fallbackIndex + 1}`,
  );
}

function normalizeWorldBookRecord(item: unknown, index: number): WorldBookEntry | null {
  if (!isRecord(item)) return null;

  const title = inferWorldBookTitle(item, index);
  const content = pickFirstText(item.content, item.text, item.value, item.description);
  if (!title || !content) return null;

  const characterIds = toStringArray(item.characterIds);
  const disabled = item.disable === true || item.enabled === false || item.isActive === false;

  return {
    id: pickFirstText(item.id, item.uid) || `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    title,
    content,
    category: normalizeWorldBookCategory(normalizeOptionalText(item.category)),
    priorityLevel: normalizeWorldBookPriorityLevel(
      typeof item.priorityLevel === 'string' ? item.priorityLevel : undefined,
    ),
    isActive: !disabled,
    isGlobal: typeof item.isGlobal === 'boolean' ? item.isGlobal : characterIds.length === 0,
    characterIds,
    pinMode: item.pinMode === 'always' ? 'always' : 'none',
    chunkCache: buildWorldBookChunkCache({
      id: pickFirstText(item.id, item.uid) || `${Date.now()}-${index}`,
      content,
    }),
  };
}

export function repairCommonJsonIssues(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(
      /(^\s*"[^"\r\n]+"\s*:\s*"[^"\r\n\\]*(?:\\.[^"\r\n\\]*)*)(?=,\s*$)/gm,
      '$1"',
    );
}

export function parseJsonWithCompatibility(raw: string): unknown | null {
  const candidates = [raw, repairCommonJsonIssues(raw)];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

export function extractCompatibleWorldBookEntries(raw: string): WorldBookEntry[] {
  const parsed = parseJsonWithCompatibility(raw);
  if (!parsed) return [];

  const topLevelRecord = isRecord(parsed) ? parsed : null;
  const sourceCandidates = [
    parsed,
    topLevelRecord?.entries,
    isRecord(topLevelRecord?.character_book) ? topLevelRecord.character_book.entries : null,
  ];

  for (const candidate of sourceCandidates) {
    const nextEntries = flattenWorldBookSource(candidate)
      .map((item, index) => normalizeWorldBookRecord(item, index))
      .filter((entry): entry is WorldBookEntry => Boolean(entry));

    if (nextEntries.length > 0) {
      return nextEntries;
    }
  }

  return [];
}

export function extractCompatibleCharacterImport(raw: string): CharacterImportFields | null {
  const parsed = parseJsonWithCompatibility(raw);
  if (isRecord(parsed)) {
    const recordResult = normalizeCharacterImportRecord(parsed);
    if (recordResult) {
      return recordResult;
    }
  }

  try {
    const looseSections = parseLooseCharacterImport(raw);
    return normalizeCharacterImportSections(looseSections);
  } catch {
    return null;
  }
}

export function extractCompatibleChatSettingsImport(raw: string): {
  character?: Partial<Character>;
  history?: ChatMessage[];
} | null {
  const parsed = parseJsonWithCompatibility(raw);
  if (!isRecord(parsed)) return null;

  const result: {
    character?: Partial<Character>;
    history?: ChatMessage[];
  } = {};

  if (isRecord(parsed.character)) {
    result.character = parsed.character as Partial<Character>;
  } else {
    const compatibleCharacter = extractCompatibleCharacterImport(raw);
    if (compatibleCharacter) {
      result.character = compatibleCharacter;
    }
  }

  if (Array.isArray(parsed.history)) {
    result.history = parsed.history as ChatMessage[];
  }

  return result.character || result.history ? result : null;
}
