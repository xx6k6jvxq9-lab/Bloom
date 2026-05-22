import type { ApiConfig, Character, ChatGroup, MomentComment, MomentItem } from '../../types';
import { buildMomentCommentReplyPrompt } from '../ai/prompts/builders/buildMomentCommentReplyPrompt';
import { buildPublicPersonaGuide } from '../ai/prompts/character/buildPublicPersonaGuide';
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
import { hasOwnershipClaimRisk } from './publicThreadPolicy';

type BaseCommentGenerationOptions = {
  activeConfig: ApiConfig;
  characters: Character[];
  chatGroups?: ChatGroup[];
  userName: string;
};

export async function generateMomentBodyComment(options: BaseCommentGenerationOptions & {
  replyCharacter: Character;
  moment: MomentItem;
}) {
  const { activeConfig, replyCharacter, moment, characters, chatGroups, userName } = options;
  return generateMomentAutoComment({
    activeConfig,
    replyCharacter,
    moment,
    characters,
    chatGroups,
    userName,
  });
}

export async function generateMomentThreadReply(options: BaseCommentGenerationOptions & {
  replyCharacter: Character;
  moment: MomentItem;
  targetComment: MomentComment;
  recentChain?: MomentComment[];
}) {
  const { activeConfig, replyCharacter, moment, targetComment, characters, chatGroups, userName, recentChain = [] } = options;
  const guidance = buildThreadReplyGuidance({
    moment,
    targetComment,
    replyCharacter,
    characters,
    chatGroups,
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
  const replyCharacterContext = buildCharacterContext({ character: replyCharacter });
  const publicPersonaGuide = buildPublicPersonaGuide({
    corePersona: replyCharacterContext.corePersona,
    expressionStyle: replyCharacterContext.expressionStyle,
    boundaryPack: replyCharacterContext.boundaryPack,
    extendedLore: replyCharacterContext.extendedLore,
    signature: replyCharacter.signature,
    openingRemark: replyCharacter.openingRemark,
  });

  const prompt = buildMomentCommentReplyPrompt({
    characterCore: {
      characterSetting: replyCharacterContext.corePersona ?? '',
      signature: replyCharacter.signature?.trim() || undefined,
      personaGuidePrompt: publicPersonaGuide || undefined,
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
      '如果你和楼层人物不熟，不要突然亲密，不要代替别人认领用户，也不要说得像默认你们私下很熟。',
      '除非你就是动态作者本人，否则禁止用“领走、带走、抱走、收到人了、乖乖等着、我的人”这类占位表达。',
    ],
  });

  try {
    const response = await generateTextFromMessagesWithConfig({
      activeConfig,
      traceLabel: 'moments:thread-reply',
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n请生成一条已经可以直接发在评论区里的回复。`,
        },
      ],
      temperature: 0.75,
    });

    const normalized = response?.trim() || '';
    if (
      normalized
      && options.replyCharacter.id !== options.moment.authorId
      && hasOwnershipClaimRisk(normalized)
    ) {
      return fallback;
    }

    return normalized || fallback;
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
