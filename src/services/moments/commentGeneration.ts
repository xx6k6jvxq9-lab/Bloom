import type { ApiConfig, Character, MomentComment, MomentItem } from '../../types';
import { buildMomentCommentReplyPrompt } from '../ai/prompts/builders/buildMomentCommentReplyPrompt';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildThreadReplyGuidance } from './commentRules';
import {
  buildFallbackMomentCommentReply,
  generateMomentAutoComment,
} from './generators';
import {
  classifyMomentCommentType,
  getRecentMomentReplyContext,
  inferMomentIntent,
  inferMomentTone,
} from './triggers';

type BaseCommentGenerationOptions = {
  activeConfig: ApiConfig;
  characters: Character[];
  userName: string;
};

export async function generateMomentBodyComment(options: BaseCommentGenerationOptions & {
  replyCharacter: Character;
  moment: MomentItem;
}) {
  const { activeConfig, replyCharacter, moment, characters, userName } = options;
  return generateMomentAutoComment({
    activeConfig,
    replyCharacter,
    moment,
    characters,
    userName,
  });
}

export async function generateMomentThreadReply(options: BaseCommentGenerationOptions & {
  replyCharacter: Character;
  moment: MomentItem;
  targetComment: MomentComment;
  recentChain?: MomentComment[];
}) {
  const { activeConfig, replyCharacter, moment, targetComment, characters, userName, recentChain = [] } = options;
  const guidance = buildThreadReplyGuidance({
    moment,
    targetComment,
    replyCharacter,
    characters,
    userName,
    recentChain,
  });
  const recentCommentReplies = getRecentMomentReplyContext(moment, characters, userName);
  const fallback = buildFallbackMomentCommentReply(
    replyCharacter,
    moment,
    targetComment.content,
    recentCommentReplies,
  ).trim();

  const prompt = buildMomentCommentReplyPrompt({
    characterCore: {
      characterSetting: buildCharacterContext({ character: replyCharacter }).corePersona ?? '',
    },
    momentContext: {
      momentContent: moment.content,
      momentTone: inferMomentTone(moment.content),
      momentIntent: inferMomentIntent(moment.content),
      signature: replyCharacter.signature,
      relationship: guidance.relationshipHint,
      commentType: classifyMomentCommentType(targetComment.content),
      userComment: targetComment.content,
      recentCommentReplies,
      maxLength: 30,
      semanticAnchor: guidance.semanticAnchorLabel,
      actionLabel: guidance.actionLabel,
      timeHint: guidance.timeHint,
      focusHint: guidance.focusHint,
      joinReasonHint: guidance.joinReasonHint,
      replyTargetName: targetComment.authorId === 'user'
        ? userName
        : (characters.find((character) => character.id === targetComment.authorId)?.name || targetComment.replyToAuthorName || '对方'),
      replyStyleHints: guidance.styleHints,
    },
    sections: [
      '回复时优先接住动态主线，不要把话题改成你和别的角色自己闲聊。',
      '如果当前楼层已经说得差不多了，就收短一点，不要继续扩展分支。',
    ],
  });

  try {
    const response = await generateTextFromMessagesWithConfig({
      activeConfig,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n请生成一条已经可以直接发在评论区里的回复。`,
        },
      ],
      temperature: 0.75,
    });

    return response?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export function buildMomentThreadReplyFallback(options: {
  replyCharacter: Character;
  moment: MomentItem;
  targetComment: MomentComment;
  characters: Character[];
  userName: string;
}) {
  const { replyCharacter, moment, targetComment, characters, userName } = options;
  const recentCommentReplies = getRecentMomentReplyContext(moment, characters, userName);
  return buildFallbackMomentCommentReply(
    replyCharacter,
    moment,
    targetComment.content,
    recentCommentReplies,
  ).trim();
}
