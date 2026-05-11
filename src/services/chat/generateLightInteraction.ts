import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { buildLightInteractionPrompt } from '../ai/prompts/builders/buildLightInteractionPrompt';
import { normalizeChatPunctuationNoise } from './messageHygiene';
import { splitDirectAssistantReplyText, stripAssistantSpeakerPrefix } from './assistantText';
import type {
  DirectLightInteractionGenerationInput,
  GroupLightInteractionGenerationInput,
  LightInteractionResult,
} from './lightInteractionTypes';

const JSON_CODE_BLOCK_REGEX = /```(?:json)?\s*([\s\S]*?)```/i;
const JSON_OBJECT_REGEX = /\{[\s\S]*\}/;
const WRAPPING_QUOTES_REGEX = /^["'`“”‘’]+|["'`“”‘’]+$/g;
type LightInteractionGenerationInput = DirectLightInteractionGenerationInput | GroupLightInteractionGenerationInput;

function stripWrappingQuotes(value: string) {
  return value.replace(WRAPPING_QUOTES_REGEX, '').trim();
}

function buildDefaultSystemLine(input: LightInteractionGenerationInput) {
  return `${input.actor.label}拍了拍${input.target.label}`;
}

function buildDefaultCounterSystemLine(input: LightInteractionGenerationInput) {
  const counterTarget = input.actor.role === 'user' ? '你' : input.actor.label;
  return `${input.target.label}拍了拍${counterTarget}`;
}

function extractJsonPayload(rawText: string) {
  const fencedMatch = rawText.match(JSON_CODE_BLOCK_REGEX);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectMatch = rawText.match(JSON_OBJECT_REGEX);
  return objectMatch?.[0]?.trim() || '';
}

function normalizeSystemLine(
  rawValue: unknown,
  input: LightInteractionGenerationInput,
  fallback: string,
) {
  if (typeof rawValue !== 'string') {
    return fallback;
  }

  const normalized = stripWrappingQuotes(rawValue)
    .replace(/^\s*(?:systemline|system|系统条|系统提示)\s*[:：-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[。！？!?]+$/u, '')
    .trim();

  if (!normalized || !normalized.includes('拍') || !normalized.includes(input.target.label)) {
    return fallback;
  }

  return normalized;
}

function extractSystemLineDescriptors(systemLine: string, targetLabel: string): string[] {
  const trimmed = systemLine.trim();
  if (!trimmed) {
    return [];
  }

  const escapedTarget = targetLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`拍了拍(.+?)的${escapedTarget}$`, 'u'),
    new RegExp(`拍了拍(.+?)${escapedTarget}$`, 'u'),
  ];

  for (const pattern of patterns) {
    const matched = trimmed.match(pattern);
    const descriptor = matched?.[1]?.trim().replace(/^的/u, '').trim();
    if (descriptor) {
      return [descriptor];
    }
  }

  return [];
}

function normalizeRawBubbleEntries(rawValue: unknown): string[] {
  if (Array.isArray(rawValue)) {
    return rawValue
      .map((item) => (typeof item === 'string' ? item : ''))
      .filter(Boolean);
  }

  if (typeof rawValue === 'string') {
    return rawValue
      .split(/\|\|\||\r?\n+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

function sanitizeBubbleText(rawValue: string, aliases: string[]) {
  const normalized = stripWrappingQuotes(rawValue)
    .replace(/^\s*(?:assistantbubbles?|bubble|reply|replies|气泡|回复)\s*[:：-]\s*/i, '')
    .trim();

  if (!normalized) {
    return '';
  }

  return normalizeChatPunctuationNoise(stripAssistantSpeakerPrefix(normalized, aliases)).trim();
}

function normalizeAssistantBubbles(
  rawValue: unknown,
  input: LightInteractionGenerationInput,
) {
  const aliases = [input.target.character.name, input.target.character.remarkName?.trim() || '']
    .filter((value): value is string => !!value);
  const defaultMaxBubbleCount = input.scene === 'group' ? 2 : 3;
  const maxBubbleCount = Math.max(1, Math.min(Math.floor(input.target.character.maxReplies || defaultMaxBubbleCount), 5));
  const resolvedBubbles: string[] = [];

  for (const rawBubble of normalizeRawBubbleEntries(rawValue)) {
    const normalizedBubble = sanitizeBubbleText(rawBubble, aliases);
    if (!normalizedBubble) {
      continue;
    }

    const remainingBubbleSlots = maxBubbleCount - resolvedBubbles.length;
    if (remainingBubbleSlots <= 0) {
      break;
    }

    const splitParts = splitDirectAssistantReplyText(normalizedBubble, remainingBubbleSlots)
      .map((part) => sanitizeBubbleText(part, aliases))
      .filter(Boolean);

    resolvedBubbles.push(...splitParts.slice(0, remainingBubbleSlots));
  }

  return resolvedBubbles.slice(0, maxBubbleCount);
}

function normalizeNextActions(rawValue: unknown) {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .map((item) => {
      if (typeof item === 'string') {
        return stripWrappingQuotes(item);
      }

      if (item && typeof item === 'object' && 'label' in item) {
        const typedItem = item as { label?: unknown };
        if (typeof typedItem.label === 'string') {
          return stripWrappingQuotes(typedItem.label);
        }
      }

      return '';
    })
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeCounterAction(
  rawValue: unknown,
  input: LightInteractionGenerationInput,
) {
  const defaultSystemLine = buildDefaultCounterSystemLine(input);

  if (rawValue === true) {
    return {
      type: 'poke_back' as const,
      systemLine: defaultSystemLine,
    };
  }

  if (typeof rawValue === 'string') {
    return rawValue === 'poke_back'
      ? { type: 'poke_back' as const, systemLine: defaultSystemLine }
      : { type: 'none' as const, systemLine: '' };
  }

  if (!rawValue || typeof rawValue !== 'object') {
    return {
      type: 'none' as const,
      systemLine: '',
    };
  }

  const rawType = 'type' in rawValue ? rawValue.type : undefined;
  if (rawType !== 'poke_back') {
    return {
      type: 'none' as const,
      systemLine: '',
    };
  }

  const rawSystemLine = 'systemLine' in rawValue ? rawValue.systemLine : undefined;
  return {
    type: 'poke_back' as const,
    systemLine: typeof rawSystemLine === 'string'
      ? stripWrappingQuotes(rawSystemLine).trim() || defaultSystemLine
      : defaultSystemLine,
  };
}

function normalizeSpectatorReply(
  rawValue: unknown,
  input: LightInteractionGenerationInput,
): LightInteractionResult['spectatorReply'] | undefined {
  if (input.scene !== 'group' || !rawValue || typeof rawValue !== 'object') {
    return undefined;
  }

  const typedValue = rawValue as {
    speakerLabel?: unknown;
    bubbles?: unknown;
  };
  const speakerLabel = typeof typedValue.speakerLabel === 'string'
    ? stripWrappingQuotes(typedValue.speakerLabel)
    : '';
  if (!speakerLabel) {
    return undefined;
  }

  const allowedAliases = new Set(
    input.spectatorCandidates
      .flatMap((candidate) => [
        candidate.label,
        candidate.character.name,
        candidate.character.remarkName?.trim() || '',
      ])
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!allowedAliases.has(speakerLabel.trim().toLowerCase())) {
    return undefined;
  }

  const bubbles = normalizeRawBubbleEntries(typedValue.bubbles)
    .map((bubble) => normalizeChatPunctuationNoise(stripWrappingQuotes(bubble)))
    .filter(Boolean)
    .slice(0, 1);

  if (bubbles.length === 0) {
    return undefined;
  }

  return {
    speakerLabel,
    bubbles,
  };
}

function buildFallbackResult(
  rawText: string,
  input: LightInteractionGenerationInput,
): LightInteractionResult {
  const fallbackSystemLine = buildDefaultSystemLine(input);
  const rawLines = rawText
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const systemCandidate = rawLines.find((line) => line.includes('拍') && line.includes(input.target.label));
  const assistantBubbles = normalizeAssistantBubbles(
    rawLines.filter((line) => line !== systemCandidate),
    input,
  );

  return {
    type: input.type,
    scene: input.scene,
    systemLine: normalizeSystemLine(systemCandidate, input, fallbackSystemLine),
    assistantBubbles: assistantBubbles.length > 0 ? assistantBubbles : ['……你拍我干嘛。'],
    counterAction: {
      type: 'none',
      systemLine: '',
    },
    interactionState: {
      streak: Math.max(1, input.upcomingStreak ?? 1),
      recentDescriptors: extractSystemLineDescriptors(
        normalizeSystemLine(systemCandidate, input, fallbackSystemLine),
        input.target.label,
      ),
    },
  };
}

function parseLightInteractionResult(
  rawText: string,
  input: LightInteractionGenerationInput,
): LightInteractionResult {
  const fallbackSystemLine = buildDefaultSystemLine(input);
  const jsonPayload = extractJsonPayload(rawText);
  if (!jsonPayload) {
    return buildFallbackResult(rawText, input);
  }

  try {
    const parsed = JSON.parse(jsonPayload) as Record<string, unknown>;
    const assistantBubbles = normalizeAssistantBubbles(parsed.assistantBubbles, input);
    const normalizedSystemLine = normalizeSystemLine(parsed.systemLine, input, fallbackSystemLine);
    const spectatorReply = normalizeSpectatorReply(parsed.spectatorReply, input);
    const counterAction = normalizeCounterAction(parsed.counterAction, input);
    const nextActions = normalizeNextActions(parsed.nextActions);
    const rawInteractionState = parsed.interactionState;
    const interactionState = rawInteractionState && typeof rawInteractionState === 'object'
      ? {
          mood: typeof (rawInteractionState as { mood?: unknown }).mood === 'string'
            ? stripWrappingQuotes((rawInteractionState as { mood: string }).mood)
            : undefined,
          streak: typeof (rawInteractionState as { streak?: unknown }).streak === 'number'
            ? (rawInteractionState as { streak: number }).streak
            : Math.max(1, input.upcomingStreak ?? 1),
          recentDescriptors: Array.isArray((rawInteractionState as { recentDescriptors?: unknown }).recentDescriptors)
            ? (rawInteractionState as { recentDescriptors: unknown[] }).recentDescriptors
              .map((item) => (typeof item === 'string' ? stripWrappingQuotes(item) : ''))
              .filter(Boolean)
              .slice(0, 4)
            : extractSystemLineDescriptors(normalizedSystemLine, input.target.label),
        }
      : {
        streak: Math.max(1, input.upcomingStreak ?? 1),
        recentDescriptors: extractSystemLineDescriptors(normalizedSystemLine, input.target.label),
      };

    return {
      type: input.type,
      scene: input.scene,
      systemLine: normalizedSystemLine,
      assistantBubbles: assistantBubbles.length > 0 ? assistantBubbles : ['……你拍我干嘛。'],
      ...(spectatorReply ? { spectatorReply } : {}),
      counterAction,
      ...(nextActions.length > 0 ? { nextActions } : {}),
      interactionState,
    };
  } catch {
    return buildFallbackResult(rawText, input);
  }
}

function buildGenerationUserInstruction(input: LightInteractionGenerationInput) {
  if (input.scene === 'group') {
    return `请生成这次群聊拍一拍的结果。发起者：${input.actor.label}；目标：${input.target.label}；群成员：${input.sceneInput.memberNames.join('、')}。只输出 JSON。`;
  }

  return `请生成这次单聊拍一拍的结果。发起者：${input.actor.label}；目标：${input.target.label}。只输出 JSON。`;
}

export async function generateLightInteraction(
  input: LightInteractionGenerationInput,
): Promise<LightInteractionResult> {
  const prompt = buildLightInteractionPrompt(input);
  const rawText = await generateTextFromMessagesWithConfig({
    activeConfig: input.activeConfig,
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      {
        role: 'user',
        content: buildGenerationUserInstruction(input),
      },
    ],
    temperature: Math.max(0.75, Math.min(input.activeConfig.temperature ?? 0.92, 1.05)),
    maxOutputTokens: input.scene === 'group' ? 420 : 320,
  });

  return parseLightInteractionResult(rawText, input);
}
