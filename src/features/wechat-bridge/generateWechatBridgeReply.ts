import type { ApiConfig, AppData, Character, Mask, WorldBookEntry } from '../../types';
import { generateQualityCheckedAssistantReply } from '../../services/ai/outputQuality';
import { buildChatPrompt } from '../../services/ai/prompts/builders/buildChatPrompt';
import { buildChatSceneInput } from '../../services/scene-inputs/buildChatSceneInput';
import { buildCharacterTemporalState } from '../../services/relationship-time/buildCharacterTemporalState';
import { buildTemporalContextPrompt } from '../../services/relationship-time/buildTemporalContextPrompt';
import { getDirectMemoryMessageLimit } from '../../services/memory/memoryWindowLimits';
import { stripAssistantSpeakerPrefix } from '../../services/chat/assistantText';
import type { WechatConversationMessage } from './conversationStore';

const WECHAT_HISTORY_LIMIT = 12;

function toWechatPromptContent(message: WechatConversationMessage): string {
  return message.text.trim();
}

function sanitizeWechatAssistantReply(character: Character, text: string): string {
  const stripped = stripAssistantSpeakerPrefix(text, [character.name, character.remarkName?.trim() || ''])
    .replace(/^\[(?:reply|reply to)\s*:\s*[^\]]+\]\s*/i, '')
    .replace(/^\[(?:sticker|image|recall|withdraw)\]\s*/i, '')
    .trim();

  return stripped;
}

function resolveActiveWorldBooks(character: Character, worldBooks: WorldBookEntry[]): WorldBookEntry[] {
  return worldBooks.filter((worldBook) => {
    if (character.activeWorldBookIds?.includes(worldBook.id)) {
      return true;
    }

    return !!worldBook.isActive && (worldBook.isGlobal || worldBook.characterIds?.includes(character.id));
  });
}

function resolveActiveMask(character: Character, masks: Mask[]): Mask | undefined {
  return masks.find((mask) => mask.isActive && mask.linkedCharacters.includes(character.id));
}

function buildPerceptionPrompt(params: {
  character: Character;
  appData: AppData;
}): string {
  const perception = params.appData.coupleSpace?.perception;
  const temporalState = buildCharacterTemporalState({
    characterId: params.character.id,
    perception,
    directChatHistory: params.appData.chatHistory,
    groupMessages: [],
    coupleSpace: params.appData.coupleSpace,
  });

  return buildTemporalContextPrompt({
    perception,
    now: Date.now(),
  }) || temporalState.continuityMode;
}

export async function generateWechatBridgeReply(input: {
  activeConfig: ApiConfig;
  appData: AppData;
  character: Character;
  recentConversation: WechatConversationMessage[];
}): Promise<string> {
  const { activeConfig, appData, character, recentConversation } = input;
  const activeMask = resolveActiveMask(character, appData.masks || []);
  const activeWorldBooks = resolveActiveWorldBooks(character, appData.worldBooks || []);
  const historyWindow = recentConversation
    .slice(-Math.min(WECHAT_HISTORY_LIMIT, getDirectMemoryMessageLimit(character.memoryLimit)))
    .map((message) => ({
      role: message.role === 'user' ? 'user' as const : 'assistant' as const,
      content: toWechatPromptContent(message),
    }))
    .filter((message) => !!message.content.trim());

  const sceneInput = buildChatSceneInput({
    mode: 'autoReply',
    includeProtocolRules: true,
    character,
    userName: appData.userProfile?.name || '你',
    coupleSpace: appData.coupleSpace,
    activeMask,
    activeWorldBooks,
    worldBooks: appData.worldBooks || [],
    perception: appData.coupleSpace?.perception,
    perceptionPrompt: buildPerceptionPrompt({ character, appData }),
    directChatHistory: appData.chatHistory,
    chatGroups: appData.chatGroups || [],
  });

  const systemPrompt = buildChatPrompt({
    ...sceneInput,
    sections: [
      ...(sceneInput.sections || []),
      '当前输入来自微信 Clawbot 通道。请直接自然回复对方，就像在微信聊天窗口里说话。',
      '不要输出系统说明、分析过程、标题，也不要输出 [reply]、[sticker]、[recall] 这类控制标记。',
      '微信侧聊天记录不会完整回流到 Bloom 单聊，只会做记忆整理，所以你的回复要尽量承接最近几轮对话。',
    ],
  });

  const result = await generateQualityCheckedAssistantReply({
    activeConfig,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyWindow,
    ],
    allowBracketActions: false,
  });

  if (!result.ok) {
    throw new Error(`Failed to generate WeChat bridge reply: ${result.reason || 'unknown'}`);
  }

  const cleaned = sanitizeWechatAssistantReply(character, result.cleanedText);
  if (!cleaned) {
    throw new Error('WeChat bridge reply was empty after sanitization');
  }

  return cleaned;
}
