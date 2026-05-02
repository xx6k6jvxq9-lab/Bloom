import type { ForumSpectatorSettings } from '../../../../types';
import { FORUM_SCENARIO_PROMPT } from '../scenarios/forum';
import { FORUM_THREAD_TYPE_LABELS } from '../../../../features/forum-domain/constants';
import { getSpectatorWorldShellMeta, resolveSpectatorWorldShell } from '../../../../features/forum-domain/spectatorWorldShells';
import { normalizeSpectatorTargetCharacters, normalizeSpectatorUserSlot, resolveSpectatorAngles, SPECTATOR_ANGLE_OPTIONS } from '../../../../features/forum-domain/spectatorBoard';
import { buildSpectatorPromptStyleGuide } from './buildSpectatorPromptStyleGuide';
import { buildSpectatorPromptExamples } from './buildSpectatorPromptExamples';
import type { ForumThreadType } from '../../../../features/forum-domain/types';
import { buildSpectatorObjectSemantics } from '../../../forum/spectatorSettingsManager';
import { buildSpectatorAuthorPoolPromptLines } from '../../../forum/spectatorAuthorPool';

type BuildSpectatorThreadPromptOptions = {
  settings: ForumSpectatorSettings;
  currentUserName: string;
  selectedCharacters: Array<{ id: string; name: string }>;
  existingTitles?: string[];
  count?: number;
  allowedThreadTypes?: ForumThreadType[];
  extraContextSections?: string[];
};

export function buildSpectatorThreadPrompt(options: BuildSpectatorThreadPromptOptions): string {
  const {
    settings,
    currentUserName,
    selectedCharacters,
    existingTitles = [],
    count = 10,
    allowedThreadTypes = [],
    extraContextSections = [],
  } = options;
  const selectedCharacterNames = selectedCharacters.map((character) => character.name);
  const shell = getSpectatorWorldShellMeta(resolveSpectatorWorldShell(settings.worldShell));
  const angles = resolveSpectatorAngles(settings);
  const angleLabels = angles.map((angle) => SPECTATOR_ANGLE_OPTIONS.find((item) => item.id === angle)?.label || angle);
  const hasFictionAngle = angles.some((angle) => ['fiction', 'essay', 'rps', 'romance'].includes(angle));
  const relationshipSummary = settings.relationshipSummary.trim() || '别人已经开始从细节里误读、脑补、拿这条关系线开楼。';
  const topicHint = settings.topicHint?.trim();
  const isSingleCharacterMode = settings.objectMode === 'single_character';
  const userSlot = normalizeSpectatorUserSlot(settings);
  const objectSemantics = buildSpectatorObjectSemantics({
    currentUserName,
    characters: selectedCharacters,
    targets: normalizeSpectatorTargetCharacters(settings),
    userSlotMode: userSlot.mode,
    objectMode: settings.objectMode,
  });
  const spectatorAuthorPoolLines = buildSpectatorAuthorPoolPromptLines({
    currentUserName,
    selectedCharacterNames,
  });
  const relationshipCoordinates = objectSemantics.relationshipCoordinates;
  const targetLabel = settings.subjectName.trim() || objectSemantics.targetLabel || [currentUserName, ...selectedCharacterNames].filter(Boolean).join(' x ');
  const singleCharacterName = selectedCharacterNames[0] || targetLabel;
  const userObjectLine = userSlot.mode === 'mask'
    ? '这次对象里的用户部分要按面具身份理解，不要默认按本人公开形象来读。'
    : '这次对象里的用户部分就是本人，不要擅自套面具身份。';
  const allowedThreadTypeLabels = allowedThreadTypes
    .map((threadType) => FORUM_THREAD_TYPE_LABELS[threadType])
    .filter(Boolean);
  const allowedThreadTypeValue = allowedThreadTypes.length
    ? allowedThreadTypes.join(' | ')
    : 'sameTopic | sighting | timeline | essay | vote | gossip | normal | rift';

  return [
    FORUM_SCENARIO_PROMPT,
    ...extraContextSections,
    '## 镜间开楼任务',
    `当前板块：${shell.label}`,
    `板块气质：${shell.blurb}`,
    `这楼在聊谁：${targetLabel}`,
    isSingleCharacterMode ? `单开角色：${singleCharacterName}` : `对象里的用户：${objectSemantics.userObjectLabel}`,
    objectSemantics.roleSummary ? `对象里的角色：${objectSemantics.roleSummary}` : '',
    !isSingleCharacterMode && relationshipCoordinates?.focusLine ? `坐标主线：${relationshipCoordinates.focusLine}` : '',
    !isSingleCharacterMode && relationshipCoordinates?.supportingRoleSummary ? `坐标辅线：${relationshipCoordinates.supportingRoleSummary}` : '',
    !isSingleCharacterMode ? userObjectLine : '单人角色模式下，用户默认不入场；如果要带一点用户痕迹，也只能轻轻提一笔，不能把帖子重新写回“你和角色”。',
    objectSemantics.focusGuidance ? `对象展开重点：${objectSemantics.focusGuidance}` : '',
    !isSingleCharacterMode && relationshipCoordinates?.userPosition ? `用户位置：${relationshipCoordinates.userPosition}` : '',
    !isSingleCharacterMode && relationshipCoordinates?.actionRuleSummary ? `动作边界：${relationshipCoordinates.actionRuleSummary}` : '',
    !isSingleCharacterMode && relationshipCoordinates?.readingBiasSummary ? `偏读方向：${relationshipCoordinates.readingBiasSummary}` : '',
    ...objectSemantics.promptLines,
    ...(!isSingleCharacterMode ? (relationshipCoordinates?.promptLines || []) : []),
    objectSemantics.roleSummary ? '生成时要让主位、次位、平位真的影响围观重心和关系展开方式，不只是决定谁名字出现得更长。' : '',
    `已知线索：${relationshipSummary}`,
    topicHint ? `这轮题材：${topicHint}` : '',
    `楼里人设：${settings.tone || '未指定'}`,
    `这楼想往哪类发酵：${angleLabels.join('、') || '按镜间默认围观感走'}`,
    selectedCharacterNames.length ? `相关角色：${selectedCharacterNames.join('、')}` : '',
    existingTitles.length ? `尽量避开这些已有标题的重复话题：${existingTitles.join(' | ')}` : '',
    allowedThreadTypeLabels.length ? `这一轮只允许这些帖型：${allowedThreadTypeLabels.join(' / ')}。不在范围内就不要生成。` : '',
    '这不是公共区新闻帖，而是镜间里“别人眼里的你们”被拿出来开楼的板块。',
    '发帖口吻必须像中文手机论坛、匿名树洞、灌水区、同人脑补楼，不要像系统总结，不要像世界观说明。',
    `请固定生成 ${count} 个镜间帖，并顺带生成 6 到 8 个会在这个板块反复出现的网友。`,
    '先分清三层：帖型管结构，料头管内容，小短文只管片段帖的文段味。',
    '正文先写能被看见的事实层，再写楼主和网友怎么误读、脑补、站队，不要把误读直接写成客观真相。',
    '网友不能像拿到了角色完整档案。除非是公开看得见的动作、说出口的话、以前公开发生过的事，否则不要把角色的私人底色、真实动机、深层设定写成网友已经知道。',
    '“小短文”不是和“片段帖”并列的新帖型。它只是片段帖内部的一种写法，不要把小短文当成独立帖型。',
    '料头主要管内容：比如护短偏心、旧账翻出、对视过长、聊天存疑、半夜单独回头。它们可以长成不同帖型，不要把料头当成帖型名字。',
    '帖型主要管结构：目击帖要像撞见现场，复盘帖要像顺线扒细节，站队帖要有明确站队或投票感，片段帖要真的是片段体。',
    '同一个料头可以长成不同帖型；同一种帖型也可以装不同料头。',
    '只有当这楼明确命中同人文、短打一口、代餐发癫、嗑这口这一类角度时，才允许其中 1 到 2 条帖子写成带小短文味的片段帖。',
    '如果没有命中这些角度，就不要硬写成小短文。',
    '不管是哪一类帖，都要像人在发帖，不要像在总结关系，不要像设定说明。',
    '评论也必须像真人论坛回帖，可以短，可以损一句，可以接楼，可以半句，不要每条都很完整。',
    '尤其不要写成“这段关系体现了……”“从这个角度来看……”这种解释腔。',
    '不要轻易写用户对角色做强控制、强占有或明显越界动作，比如拎走、塞进副驾、强行带走、按着人走、当场宣示归属。镜间更适合写围观者看见了什么，再顺着误读发酵。',
    '如果当前是多人对象，不要自动塌成只有两个人的关系线。主位、次位、平位都要持续在场，至少让正文和评论能看出这不是错误缩线。',
    '同人文向帖子可以更有情绪、更有文气、更像片段，但仍然必须保留“这是论坛用户在发帖”的感觉，比如有标题党、前情说明、分段、时间戳、碎片化句子。',
    '非同人文向帖子不要突然写成整段小说，它们还是帖子，只是更像活人：会偏嘴碎、偏上头、偏带私货、偏楼里口气。',
    '如果写成短文向 essay，标题必须结合正文里的具体事件、画面或判断，不要用“投一段”“来口代餐”“片段一则”这种空标题糊过去。',
    '如果写成短文向 essay，正文必须真的有文段感：要有动作、对白、现场细节、停顿和段落，不要只写成抒情总结。',
    '如果 threadType 是 essay，正文不少于 400 字，最好在 400 到 650 字之间；如果不到这个量，就不要把它写成 essay。',
    '如果不是短文向，也必须像真人发帖，有具体看到的东西、听到的话，哪怕是很碎的小证据，不能只有抽象判断。',
    '请主动拉开不同帖子之间的形式差异，不要 5 条都像同一种人写的。',
    '可以自然使用时间戳、地点、简单分段、引号、删减号、括号补充、列表式碎句，但不要机械套模板。',
    buildSpectatorPromptStyleGuide({ hasFictionAngle }),
    buildSpectatorPromptExamples({ angles }),
    '作者昵称要像活人论坛 ID，带点网感和圈层感，不要像模板用户。',
    '镜间新网友不要写成泛论坛路人池。至少要自然分散成几类：围观者、嗑线者、目击者、吃瓜者、认得角色或认得用户的人。',
    '这些人要在 bio / persona / speakingStyle 里体现出为什么会盯这条线，而不是都写成同一种“路过网友”。',
    '有人是长期围观这对线的人，有人是刚好撞见的人，有人认识其中一个角色，有人专门来嗑，也有人就是来看戏的。',
    ...spectatorAuthorPoolLines,
    'authors.displayName 必须全部唯一，不能让两个网友同名。',
    '作者 bio 要像短签名，不要像人物设定说明。',
    '输出必须是一个 JSON 对象，不要输出解释，不要输出 markdown。',
    'JSON 格式固定为：',
    '{',
    '  "authors": [',
    '    {',
    '      "displayName": "网友显示名",',
    '      "bio": "短签名",',
    '      "handle": "论坛ID，不带@",',
    '      "persona": "公开人设简介",',
    '      "speakingStyle": "说话方式",',
    '      "avatarSeed": "头像seed"',
    '    }',
    '  ],',
    '  "posts": [',
    '    {',
    '      "displayName": "必须从 authors 里选一个",',
    `      "threadType": "${allowedThreadTypeValue}",`,
    '      "contentTier": "baseline | ferment | highlight | fragment",',
    '      "discourseAxis": "一句话概括评论区会围绕什么点发酵",',
    '      "title": "帖子标题",',
    '      "body": "帖子正文",',
    '      "comments": [',
    '        { "displayName": "必须从 authors 里选一个", "content": "评论正文" },',
    '        { "displayName": "必须从 authors 里选一个", "content": "评论正文", "replyToFloor": 1 }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '至少有 1 条帖子正文带一点“小短文/脑补片段/像小说一样的小段落”气质。',
    '如果 threadType 是 essay，它才可以带小短文味，而且正文不少于 400 字；如果不是 essay，就不要用小短文形式写正文。',
    '不要输出 null，不要缺字段，不要输出对象外的任何文字。',
  ].filter(Boolean).join('\n');
}
