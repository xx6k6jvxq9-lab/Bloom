import type { Character, ChatMessage } from '../../types';
import { getMessageMainText } from '../../utils';
import type { ParsedAvatarAction } from './avatarActions';

export type AvatarConfirmationReply = 'confirm' | 'decline' | 'unknown';

export type AvatarConfirmationResolution = {
  reply: Exclude<AvatarConfirmationReply, 'unknown'>;
  action: ParsedAvatarAction | null;
  promptSection: string;
  clearPending: boolean;
};

const CONFIRM_REPLY_REGEX = /^(?:好(?:啊|呀|哦|呢)?|行(?:啊|呀|呢)?|可以(?:啊|呀|呢)?|换吧|换呗|那就换|就这个|就这张|用这个|用这张|是的?|嗯(?:嗯)?|对(?:啊|呀)?|确认|确定|可以换|换成这个|换成这张)(?:[吧呀啊呢哦啦!！。]*)$/u;
const DECLINE_REPLY_REGEX = /^(?:别(?:换)?|不要(?:换)?|不用(?:换)?|先别(?:换)?|先不要(?:换)?|不换|算了|不是这张|别用这张|不用了|先算了)(?:[吧呀啊呢哦啦!！。]*)$/u;

function normalizeConfirmationText(text: string) {
  return text.trim().replace(/[，,。！？!?、~～\s]+$/gu, '');
}

export function isPendingAvatarConfirmationExpired(
  pending: Character['pendingAvatarConfirmation'] | null | undefined,
  now = Date.now(),
) {
  return Boolean(pending && Number.isFinite(pending.expiresAt) && now > (pending.expiresAt as number));
}

export function classifyAvatarConfirmationReply(text: string): AvatarConfirmationReply {
  const normalized = normalizeConfirmationText(text);
  if (!normalized) {
    return 'unknown';
  }

  if (DECLINE_REPLY_REGEX.test(normalized)) {
    return 'decline';
  }

  if (CONFIRM_REPLY_REGEX.test(normalized)) {
    return 'confirm';
  }

  return 'unknown';
}

export function resolveAvatarConfirmationFromMessages(character: Character, messages: ChatMessage[]): AvatarConfirmationResolution | null {
  const pending = character.pendingAvatarConfirmation;
  if (!pending) {
    return null;
  }

  if (isPendingAvatarConfirmationExpired(pending)) {
    return {
      reply: 'decline',
      action: null,
      promptSection: [
        '## 上轮头像确认已过期',
        '你上轮问过用户要不要换头像，但这轮已经不再继续追这个点了。',
        '不要继续追问头像，也不要再按那个待确认动作执行。',
      ].join('\n'),
      clearPending: true,
    };
  }

  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user' && !message.isSystem && !message.isRecalled);
  if (!latestUserMessage) {
    return null;
  }

  const reply = classifyAvatarConfirmationReply(getMessageMainText(latestUserMessage));
  if (reply === 'unknown') {
    return null;
  }

  if (reply === 'decline') {
    return {
      reply,
      action: null,
      promptSection: [
        '## 用户刚刚拒绝了上轮头像确认',
        '用户已经明确表示这轮先别换头像。',
        '不要继续追问头像，也不要再执行上轮待确认的头像动作。',
      ].join('\n'),
      clearPending: true,
    };
  }

  const action: ParsedAvatarAction | null = pending.source === 'pending_avatar_image'
    ? {
        type: 'change',
        source: 'pending_avatar_image',
        reason: pending.reason || '用户已经确认这张可以换成头像。',
      }
    : pending.entryId
      ? {
          type: 'change',
          source: `avatar_library:${pending.entryId}`,
          reason: pending.reason || '用户已经确认从头像库里换这张。',
        }
      : null;

  return {
    reply,
    action,
    promptSection: [
      '## 用户刚刚确认了上轮头像请求',
      pending.kind === 'image-offer'
        ? '用户已经同意把上一轮那张图片当成头像处理。'
        : '用户已经同意从头像库里换成你刚才提到的那张。',
      '这轮请把这件事自然接住；如果你提到头像，要像角色自己完成了这个动作，不要像系统通知。',
    ].join('\n'),
    clearPending: true,
  };
}
