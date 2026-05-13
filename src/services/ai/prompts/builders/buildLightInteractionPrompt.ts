import type { ChatMessage } from '../../../../types';
import { getMessageMainText } from '../../../../utils';
import { sanitizePipeMarkers } from '../../../chat/messageText';
import type {
  DirectLightInteractionGenerationInput,
  GroupLightInteractionGenerationInput,
} from '../../../chat/lightInteractionTypes';

const MAX_CONTEXT_TEXT_LENGTH = 420;
const MAX_HISTORY_LINES = 6;
const MAX_TYPED_SUMMARY_ITEMS = 2;
const RELEVANT_SCENE_SECTION_REGEX = /##\s*(?:表达风格与互动手感|边界与禁区|角色当前时间状态|角色当前在线存在感|连续性判断|当前聊天场景补充|进行中的约会共享语境)/;

function trimContextBlock(value: string | null | undefined, maxLength = MAX_CONTEXT_TEXT_LENGTH) {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

function formatTypedSummaries(
  title: string,
  items: Array<{ summary: string }> | undefined,
  limit = MAX_TYPED_SUMMARY_ITEMS,
) {
  const summaries = (items || [])
    .map((item) => trimContextBlock(item.summary, 160))
    .filter(Boolean)
    .slice(0, limit);

  if (summaries.length === 0) {
    return '';
  }

  return [
    title,
    ...summaries.map((summary) => `- ${summary}`),
  ].join('\n');
}

function selectRelevantSceneSections(sections: string[] | undefined) {
  return (sections || [])
    .filter((section) => RELEVANT_SCENE_SECTION_REGEX.test(section))
    .slice(0, 5)
    .map((section) => trimContextBlock(section, 640))
    .filter(Boolean);
}

function formatMessagePreview(message: ChatMessage) {
  if (message.audioUrl) {
    const transcript = trimContextBlock(message.audioTranscript, 80);
    return transcript ? `[语音] ${transcript}` : '[语音]';
  }

  if (message.location) {
    return `[位置] ${message.location.name}`;
  }

  if (message.imageUrl) {
    if (message.stickerLabel?.trim()) {
      return `[表情] ${message.stickerLabel.trim()}`;
    }
    const caption = trimContextBlock(getMessageMainText(message), 80);
    return caption ? `[图片] ${caption}` : '[图片]';
  }

  const mainText = sanitizePipeMarkers(getMessageMainText(message), ' ');
  return trimContextBlock(mainText, 120);
}

function buildRecentHistoryTranscript(
  messages: ChatMessage[],
  actorLabel: string,
  targetLabel: string,
) {
  const visibleMessages = messages
    .filter((message) => !message.isSystem && !message.isRecalled)
    .slice(-MAX_HISTORY_LINES);

  if (visibleMessages.length === 0) {
    return '';
  }

  return visibleMessages
    .map((message) => {
      const speakerLabel = message.role === 'user' ? actorLabel : targetLabel;
      return `${speakerLabel}：${formatMessagePreview(message)}`;
    })
    .filter((line) => !line.endsWith('：'))
    .join('\n');
}

type LightInteractionPromptInput = DirectLightInteractionGenerationInput | GroupLightInteractionGenerationInput;

function buildSystemLineInstruction(input: LightInteractionPromptInput) {
  if (input.actor.role === 'user') {
    return `systemLine 必须像“${input.actor.label}拍了拍正在假装镇定的${input.target.label}”这种聊天软件提示，保留 ${input.target.label}，但不要复读最近已用过的措辞。`;
  }

  return `systemLine 必须像“${input.actor.label}拍了拍${input.target.label}”这种聊天软件提示，保留双方称呼，不要写成长句。`;
}

function buildDirectLightInteractionPrompt(input: DirectLightInteractionGenerationInput) {
  const { sceneInput } = input;
  const recentContext = sceneInput.recentContext;
  const characterCore = sceneInput.characterCore;
  const memoryContext = sceneInput.memoryContext;
  const relevantSceneSections = selectRelevantSceneSections(sceneInput.sections);
  const recentHistoryTranscript = buildRecentHistoryTranscript(
    input.recentMessages,
    input.actor.role === 'user' ? '你' : input.actor.label,
    input.target.label,
  );

  return [
    '你正在处理聊天软件里的“拍一拍”轻互动。',
    '这不是普通问答，也不是完整长聊天。你的任务是一次性生成这次轻互动的系统提示文案和角色后续短气泡。',
    '拍一拍是软件里的轻互动，不要把它写成现实中的肢体接触、线下动作戏或已经发生的身体动作。',
    '你必须保留当前角色的人设、边界、关系状态和最近情绪，但输出要轻、小、像即时聊天。',
    '',
    '## 当前轻互动',
    `类型：${input.type === 'poke' ? '拍一拍' : input.type}`,
    '场景：单聊',
    `发起者：${input.actor.label}`,
    `目标：${input.target.label}`,
    `这次连拍序号：${Math.max(1, input.upcomingStreak ?? 1)}`,
    buildSystemLineInstruction(input),
    input.recentSystemLines && input.recentSystemLines.length > 0
      ? [
          '最近几次拍一拍系统条（这次尽量避开相似描述）：',
          ...input.recentSystemLines.slice(-5).map((line) => `- ${trimContextBlock(line, 72)}`),
        ].join('\n')
      : '',
    input.recentDescriptors && input.recentDescriptors.length > 0
      ? `最近已经用过的状态词/描述词：${input.recentDescriptors.slice(0, 8).join('、')}`
      : '',
    input.latestMood
      ? `上一轮轻互动余味：${input.latestMood}`
      : '',
    input.latestCounterActionType === 'poke_back'
      ? '上一轮是角色反拍收尾，这一轮可以自然承接那种来回试探感，但不要机械重复。'
      : '',
    input.latestNextActions && input.latestNextActions.length > 0
      ? `上一轮常见可续接方向：${input.latestNextActions.slice(0, 3).join('、')}`
      : '',
    '',
    '## 角色核心与关系底色',
    characterCore?.characterSetting ? `核心人设：${trimContextBlock(characterCore.characterSetting, 560)}` : '',
    characterCore?.maskPrompt ? `额外补充：${trimContextBlock(characterCore.maskPrompt, 260)}` : '',
    characterCore?.worldBookPrompt ? `相关世界补充：${trimContextBlock(characterCore.worldBookPrompt, 320)}` : '',
    recentContext?.shortTermSummary ? `近期关系余波：${trimContextBlock(recentContext.shortTermSummary, 260)}` : '',
    recentContext?.publicAcquaintanceSummary ? `公开认识与连续性：${trimContextBlock(recentContext.publicAcquaintanceSummary, 220)}` : '',
    formatTypedSummaries('最近关系残留：', recentContext?.relationshipResidue),
    formatTypedSummaries('最近话题锚点：', recentContext?.topicAnchors),
    formatTypedSummaries('最近待办残留：', recentContext?.taskResidue, 1),
    memoryContext?.longTermMemoryProfile ? `长期关系底色：${trimContextBlock(memoryContext.longTermMemoryProfile, 320)}` : '',
    relevantSceneSections.length > 0
      ? ['## 当前状态与表达边界', ...relevantSceneSections].join('\n\n')
      : '',
    recentHistoryTranscript
      ? ['## 最近几条聊天', recentHistoryTranscript].join('\n')
      : '',
    '',
    '## 输出目标',
    '1. `systemLine` 负责表现“这次拍到了一个什么状态的 Ta”，要有当下感，不要总是套固定形容词。',
    '2. `assistantBubbles` 必须是目标角色本人真的会发出来的 1 到 3 条短气泡，宁可短，也不要解释。',
    '3. 可以嘴硬、停顿、反问、装没事、试探、轻微回拍，但必须符合这个角色本人。',
    '4. 不要输出名字前缀，不要写旁白，不要替用户说话，不要把互动写成线下现场。',
    '5. 如果这次更适合冷一点、收一点、只回一个短反应，也可以，但仍然要像活人。',
    '6. 如果上一轮已经出现了某个描述词、某种回拍方式或同一类句式，这一轮优先换一种更贴近“当下状态”的表达。',
    '',
    '## JSON 输出协议',
    '只输出 JSON 对象，不要 markdown，不要解释，不要在 JSON 外补充任何文字。',
    `{
  "systemLine": "你拍了拍正在假装镇定的${input.target.label}",
  "assistantBubbles": ["……你拍我干嘛。", "有话就说。"],
  "counterAction": {
    "type": "none",
    "systemLine": ""
  },
  "nextActions": ["再拍一下", "逗一句", "装没事"],
  "interactionState": {
    "mood": "teasing",
    "streak": ${Math.max(1, input.upcomingStreak ?? 1)},
    "recentDescriptors": ["假装镇定"]
  }
}`,
    '额外限制：',
    '- `systemLine` 用简体中文，长度尽量控制在 8 到 24 个字，像聊天软件里的系统提示。',
    '- `assistantBubbles` 必须是字符串数组，数量 1 到 3。',
    '- `counterAction.type` 只能是 `"none"` 或 `"poke_back"`。',
    '- 如果 `counterAction.type` 是 `"poke_back"`，`counterAction.systemLine` 再写一条适合显示在系统条里的文案；否则填空字符串。',
    '- `nextActions` 最多 3 项，给出用户此刻还能继续点的短标签。',
    '- `interactionState.mood` 只写一个很短的氛围词，例如 playful / teasing / warm / awkward / sulky / guarded。',
    '- 不要输出任何 JSON 以外的内容。',
  ].filter(Boolean).join('\n\n');
}

function buildGroupLightInteractionPrompt(input: GroupLightInteractionGenerationInput) {
  const { sceneInput } = input;
  const recentContext = sceneInput.recentContext;
  const spectatorNames = input.spectatorCandidates.map((candidate) => candidate.label);
  const recentHistoryTranscript = trimContextBlock(sceneInput.historyTranscript, 1100);

  return [
    '你正在处理群聊里的“拍一拍”轻互动。',
    '这不是普通长对话，而是一条群聊系统提示之后，目标成员可能会接一句，偶尔再有一个围观成员补一句的轻互动。',
    '拍一拍是聊天软件里的轻互动，不要把它写成现实中的肢体动作或线下现场。',
    '群聊是公开空间，所有输出都必须像群里会出现的自然反应，不要把语气写得过私密、过沉重、过像二人世界。',
    '',
    '## 当前轻互动',
    `类型：${input.type === 'poke' ? '拍一拍' : input.type}`,
    '场景：群聊',
    `发起者：${input.actor.label}`,
    `目标：${input.target.label}`,
    `这次连拍序号：${Math.max(1, input.upcomingStreak ?? 1)}`,
    `群成员：${sceneInput.memberNames.join('、')}`,
    buildSystemLineInstruction(input),
    input.recentSystemLines && input.recentSystemLines.length > 0
      ? [
          '最近几次群聊拍一拍系统条（这次尽量避开相似描述）：',
          ...input.recentSystemLines.slice(-5).map((line) => `- ${trimContextBlock(line, 72)}`),
        ].join('\n')
      : '',
    input.recentDescriptors && input.recentDescriptors.length > 0
      ? `最近已经用过的状态词/描述词：${input.recentDescriptors.slice(0, 8).join('、')}`
      : '',
    input.latestMood
      ? `上一轮群聊轻互动余味：${input.latestMood}`
      : '',
    input.latestCounterActionType === 'poke_back'
      ? '上一轮是目标成员反拍收尾，这一轮可以带一点连招感，但不要机械重复。'
      : '',
    '',
    '## 目标成员人设与群内状态',
    sceneInput.speakerCorePersona ? `核心人设：${trimContextBlock(sceneInput.speakerCorePersona, 520)}` : '',
    sceneInput.speakerSignature ? `角色自我表达线索：${trimContextBlock(sceneInput.speakerSignature, 220)}` : '',
    recentContext?.expressionStyle ? `公开场合说话手感：${trimContextBlock(recentContext.expressionStyle, 240)}` : '',
    recentContext?.boundaryPack ? `边界与禁区：${trimContextBlock(recentContext.boundaryPack, 260)}` : '',
    sceneInput.relationshipSummary ? `目标成员的群内关系起点：${trimContextBlock(sceneInput.relationshipSummary, 520)}` : '',
    sceneInput.peerAwareness.length > 0
      ? ['目标成员眼里的其他成员：', ...sceneInput.peerAwareness.slice(0, 8)].join('\n')
      : '',
    recentContext?.shortTermSummary ? `近期关系余波：${trimContextBlock(recentContext.shortTermSummary, 240)}` : '',
    recentContext?.groupShortTermSummary ? `群公开短期记忆：${trimContextBlock(recentContext.groupShortTermSummary, 320)}` : '',
    recentContext?.groupMemberPerspectiveSummary ? `目标成员私下对群局势的感觉：${trimContextBlock(recentContext.groupMemberPerspectiveSummary, 360)}` : '',
    recentContext?.groupLongTermAtmosphere ? `群长期氛围：${trimContextBlock(recentContext.groupLongTermAtmosphere, 200)}` : '',
    recentContext?.groupRecurringDynamics ? `群常见互动：${trimContextBlock(recentContext.groupRecurringDynamics, 220)}` : '',
    recentContext?.groupSharedHistory ? `群共同经历：${trimContextBlock(recentContext.groupSharedHistory, 220)}` : '',
    recentContext?.publicAcquaintanceSummary ? `公开认识与群内连续性：${trimContextBlock(recentContext.publicAcquaintanceSummary, 220)}` : '',
    formatTypedSummaries('最近关系残留：', recentContext?.relationshipResidue),
    formatTypedSummaries('最近话题锚点：', recentContext?.topicAnchors),
    formatTypedSummaries('最近待办残留：', recentContext?.taskResidue, 1),
    recentContext?.sharedRecentRelationshipSummary ? `跨场景共享关系余波：${trimContextBlock(recentContext.sharedRecentRelationshipSummary, 220)}` : '',
    recentContext?.relationshipTensionSummary ? `同场关系张力：${trimContextBlock(recentContext.relationshipTensionSummary, 340)}` : '',
    recentContext?.sharedCharacterStatePrompt ? `统一角色状态：${trimContextBlock(recentContext.sharedCharacterStatePrompt, 340)}` : '',
    recentContext?.temporalContext ? `当前时间与注意力状态：${trimContextBlock(recentContext.temporalContext, 340)}` : '',
    recentContext?.backgroundSummary ? `群背景简述：${trimContextBlock(recentContext.backgroundSummary, 220)}` : '',
    recentContext?.memberRelationshipState ? `成员关系状态：${trimContextBlock(recentContext.memberRelationshipState, 220)}` : '',
    recentContext?.currentScene ? `当前群场景：${trimContextBlock(recentContext.currentScene, 220)}` : '',
    recentContext?.publicFacts ? `群公开事实：${trimContextBlock(recentContext.publicFacts, 220)}` : '',
    recentContext?.topicStatePrompt ? `当前群话题状态：${trimContextBlock(recentContext.topicStatePrompt, 240)}` : '',
    recentContext?.worldBookPrompt ? `群世界补充：${trimContextBlock(recentContext.worldBookPrompt, 260)}` : '',
    recentContext?.groupSceneHint ? `群聊场景提示：${trimContextBlock(recentContext.groupSceneHint, 240)}` : '',
    recentHistoryTranscript ? ['## 最近群聊片段', recentHistoryTranscript].join('\n') : '',
    spectatorNames.length > 0
      ? `如果要安排围观插嘴，只能从这些成员里选一个：${spectatorNames.join('、')}`
      : '这次不要安排围观成员插嘴。',
    '',
    '## 输出目标',
    '1. `systemLine` 负责表现“这次拍到了目标成员一个什么状态”，要有当下感，不要总是套固定形容词。',
    '2. `assistantBubbles` 是目标成员本人在群里会发出来的 1 到 2 条短气泡，要保留公开场合感。',
    '3. `spectatorReply` 只能是 0 或 1 个围观成员的一句短插话；如果不自然，就填 null，不要硬拉人进场。',
    '4. 不要让围观成员抢戏，不要让目标成员说成长段，不要让整件事变成群里集体起哄。',
    '5. 允许目标成员嘴硬、反问、装没事、回拍，但都要符合他在群里的公开状态和边界。',
    '6. 如果上一轮已经出现了某个描述词、围观方式或同类句式，这一轮优先换一种更贴近当下状态的表达。',
    '',
    '## JSON 输出协议',
    '只输出 JSON 对象，不要 markdown，不要解释，不要在 JSON 外补充任何文字。',
    `{
  "systemLine": "你拍了拍正在走神的${input.target.label}",
  "assistantBubbles": ["？", "你拍我干嘛。"],
  "spectatorReply": {
    "speakerLabel": ${spectatorNames[0] ? `"${spectatorNames[0]}"` : '""'},
    "bubbles": ["公开调戏是吧。"]
  },
  "counterAction": {
    "type": "none",
    "systemLine": ""
  },
  "nextActions": ["再拍一下", "@他一句"],
  "interactionState": {
    "mood": "teasing",
    "streak": ${Math.max(1, input.upcomingStreak ?? 1)},
    "recentDescriptors": ["走神"]
  }
}`,
    '额外限制：',
    '- `systemLine` 用简体中文，长度尽量控制在 8 到 24 个字，像聊天软件里的群聊系统提示。',
    '- `assistantBubbles` 必须是字符串数组，数量 1 到 2。',
    '- `spectatorReply` 要么填 null，要么填一个对象；对象里 `speakerLabel` 必须从允许的围观成员名单中选择。',
    '- `spectatorReply.bubbles` 最多 1 条，必须很短。',
    '- `counterAction.type` 只能是 `"none"` 或 `"poke_back"`。',
    '- 如果 `counterAction.type` 是 `"poke_back"`，`counterAction.systemLine` 再写一条适合显示在群聊系统条里的文案；否则填空字符串。',
    '- `nextActions` 最多 2 项。',
    '- 不要输出任何 JSON 以外的内容。',
  ].filter(Boolean).join('\n\n');
}

export function buildLightInteractionPrompt(input: LightInteractionPromptInput) {
  return input.scene === 'group'
    ? buildGroupLightInteractionPrompt(input)
    : buildDirectLightInteractionPrompt(input);
}
