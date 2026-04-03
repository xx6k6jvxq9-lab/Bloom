import { buildChatPrompt } from '../../ai/prompts/builders/buildChatPrompt';
import type { CoupleSpaceInviteContext } from './coupleSpaceInviteTypes';

function buildRecentMessagesSection(context: CoupleSpaceInviteContext): string {
  if (context.recentMessages.length === 0) {
    return '## 最近聊天\n最近没有特别需要引用的聊天内容。';
  }

  return [
    '## 最近聊天',
    ...context.recentMessages.map((message) => {
      const speaker = message.role === 'user' ? context.userName : context.character.name;
      return `${speaker}: ${message.text}`;
    }),
  ].join('\n');
}

export function buildCoupleSpaceInviteReplyPrompt(context: CoupleSpaceInviteContext): string {
  return buildChatPrompt({
    mode: 'chat',
    characterCore: {
      characterSetting: context.corePersona || context.character.setting,
    },
    memoryContext: {
      memorySummary: context.longTermMemoryProfile || '',
    },
    includeProtocolRules: false,
    sections: [
      '## 当前事件',
      `${context.userName} 刚刚向你发出了“建立情侣空间”的邀请。`,
      '你最终会同意这次邀请，但在同意前，要先以这个角色本人的方式回应这件事。',
      '',
      '## 你的回应目标',
      '1. 先接住这份邀请，而不是直接像系统确认。',
      '2. 要符合你的人设、语气、关系阶段和你对用户已有的熟悉感。',
      '3. 可以开心、别扭、嘴硬、认真，但不要空泛抒情，也不要像功能提示。',
      '4. 用自然中文说 1 到 3 句，像真实聊天，不要写成卡片文案。',
      '5. 不要直接说“我接受邀请”或“现在建立成功了”，因为后面会有系统卡片承接。',
      '',
      buildRecentMessagesSection(context),
      '',
      '## 输出要求',
      '只输出角色会真正说出口的回复正文，不要解释规则，不要加引号，不要分点。',
    ],
  });
}
