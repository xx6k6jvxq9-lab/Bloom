import type { ApiConfig } from '../../../types';
import { streamTextWithConfig } from '../../ai/runtimeClient';
import type { CoupleSpaceInviteContext } from './coupleSpaceInviteTypes';
import { buildCoupleSpaceInviteReplyPrompt } from './buildCoupleSpaceInviteReplyPrompt';

const DEFAULT_COUPLE_SPACE_INVITE_REPLY = '……好。那就从现在开始，把这里只留给我们。';

const normalizeInviteReply = (text?: string | null): string => {
  const normalized = (text ?? '').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
  return normalized || DEFAULT_COUPLE_SPACE_INVITE_REPLY;
};

export async function generateCoupleSpaceInviteReply(params: {
  activeConfig?: ApiConfig;
  context: CoupleSpaceInviteContext;
}): Promise<string> {
  if (!params.activeConfig) {
    return DEFAULT_COUPLE_SPACE_INVITE_REPLY;
  }

  try {
    const prompt = buildCoupleSpaceInviteReplyPrompt(params.context);
    let reply = '';
    await streamTextWithConfig({
      activeConfig: params.activeConfig,
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.8,
      onTextChunk: (chunk) => {
        reply += chunk;
      },
    });

    return normalizeInviteReply(reply);
  } catch (error) {
    console.error('Couple-space invite reply generation failed:', error);
    return DEFAULT_COUPLE_SPACE_INVITE_REPLY;
  }
}
