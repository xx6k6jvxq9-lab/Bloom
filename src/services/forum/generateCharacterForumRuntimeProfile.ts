import type { ApiConfig, Character, ForumRuntimeAuthorProfile } from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';
import { buildCharacterForumRuntimeProfile, CHARACTER_FORUM_ALIAS_VERSION } from './buildCharacterForumRuntimeProfile';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';

type GenerateCharacterForumRuntimeProfileInput = {
  activeConfig: ApiConfig;
  character: Character;
  channel?: ForumChannel;
};

type ParsedForumProfile = {
  displayName: string;
  handle: string;
  bio: string;
};

function stripCodeFence(raw: string) {
  return raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function normalizeHandle(value: string) {
  return value
    .replace(/^@/, '')
    .replace(/\s+/g, '')
    .replace(/[^\p{Script=Han}A-Za-z0-9·]+/gu, '')
    .slice(0, 12);
}

function extractJsonObject(raw: string) {
  const cleaned = stripCodeFence(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function parseGeneratedForumProfile(raw: string): ParsedForumProfile | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const displayName = typeof parsed.displayName === 'string' ? parsed.displayName.trim() : '';
    const handle = typeof parsed.handle === 'string' ? normalizeHandle(parsed.handle) : '';
    const bio = typeof parsed.bio === 'string' ? parsed.bio.trim() : '';

    if (!displayName || !handle || !bio) return null;
    if (!/[\p{Script=Han}]/u.test(displayName) || !/[\p{Script=Han}]/u.test(bio)) return null;
    if (displayName.length < 2 || displayName.length > 12) return null;
    if (handle.length < 2 || handle.length > 12) return null;
    if (bio.length < 8 || bio.length > 48) return null;

    return {
      displayName,
      handle,
      bio,
    };
  } catch {
    return null;
  }
}

function buildPrompt(character: Character, fallbackProfile: ForumRuntimeAuthorProfile, channel?: ForumChannel) {
  return [
    '给这个角色生成第一次进论坛会长期使用的小号资料。',
    '只输出 JSON：{"displayName":"昵称","handle":"论坛ID","bio":"简介"}',
    '规则：昵称像活人网名，不照搬本名；ID像本人会起的号；简介是一两句像本人自己写的签名。',
    '必须带出脾气、口味、雷点、习惯、职业碎片或记忆残留，不要写设定说明，不要出现 machine token。',
    `角色本名：${character.name}`,
    character.remarkName?.trim() ? `备注名：${character.remarkName.trim()}` : '',
    character.signature?.trim() ? `签名：${character.signature.trim()}` : '',
    character.openingRemark?.trim() ? `开场白：${character.openingRemark.trim()}` : '',
    character.corePersona?.trim() ? `核心人设：${character.corePersona.trim()}` : '',
    character.expressionStyle?.trim() ? `说话风格：${character.expressionStyle.trim()}` : '',
    character.setting?.trim() ? `背景设定：${character.setting.trim()}` : '',
    character.sceneHints?.forum?.trim() ? `论坛场景提示：${character.sceneHints.forum.trim()}` : '',
    character.globalMemory?.trim() ? `长期记忆：${character.globalMemory.trim()}` : '',
    character.memorySummary?.trim() ? `记忆摘要：${character.memorySummary.trim()}` : '',
    character.longTermMemoryProfile?.trim() ? `长期记忆画像：${character.longTermMemoryProfile.trim()}` : '',
    channel ? `当前更常发的分区：${channel}` : '',
    `兜底号感参考：昵称=${fallbackProfile.name}；ID=@${fallbackProfile.handle}；简介=${fallbackProfile.bio}`,
  ].filter(Boolean).join('\n');
}

export async function generateCharacterForumRuntimeProfile(input: GenerateCharacterForumRuntimeProfileInput): Promise<ForumRuntimeAuthorProfile> {
  const fallbackProfile = buildCharacterForumRuntimeProfile(input.character, input.channel);
  const attemptAt = Date.now();
  try {
    const raw = await generateTextFromMessagesWithConfig({
      activeConfig: input.activeConfig,
      messages: [
        {
          role: 'user',
          content: buildPrompt(input.character, fallbackProfile, input.channel),
        },
      ],
      temperature: 0.9,
      maxOutputTokens: 140,
      timeoutMs: 12000,
    });

    const parsed = parseGeneratedForumProfile(raw || '');
    if (!parsed) {
      return {
        ...fallbackProfile,
        aiLastAttemptAt: attemptAt,
        aiLastFailedAt: attemptAt,
      };
    }

    return {
      ...fallbackProfile,
      name: parsed.displayName,
      handle: parsed.handle,
      bio: parsed.bio,
      aliasVersion: CHARACTER_FORUM_ALIAS_VERSION,
      generationMode: 'ai',
      manuallyEdited: false,
      aiGeneratedAt: attemptAt,
      aiLastAttemptAt: attemptAt,
      aiLastFailedAt: undefined,
    };
  } catch {
    return {
      ...fallbackProfile,
      aiLastAttemptAt: attemptAt,
      aiLastFailedAt: attemptAt,
    };
  }
}
