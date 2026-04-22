import type { Character } from '../../../../types';

export type ReplyLanguagePolicyInput = Pick<
  Character,
  'replyLanguageMode' | 'nativeLanguage' | 'fixedReplyLanguage'
>;

function normalizeLanguageName(value: string | null | undefined): string {
  return value?.trim() || '';
}

export function buildReplyLanguageRules(input: ReplyLanguagePolicyInput | undefined): string {
  const mode = input?.replyLanguageMode || 'follow-user';
  const nativeLanguage = normalizeLanguageName(input?.nativeLanguage) || '角色母语';
  const fixedLanguage = normalizeLanguageName(input?.fixedReplyLanguage) || nativeLanguage;

  const baseRules = [
    '【回复语言策略】资料、人设、世界书和记忆可以包含多种语言；这些资料只提供设定，不自动决定回复语言。',
    '不要输出英文分析、英文策略说明、英文标题、系统规则、任务报告或思考过程。',
    '人名、地名、品牌名、作品名、专有名词、固定称呼和口头禅可以保留原文。',
  ];

  if (mode === 'chinese-with-native-flavor') {
    return [
      ...baseRules,
      `本角色回复以自然中文为主，可以更明显地点缀${nativeLanguage}称呼、口癖、短句或情绪词。`,
      `不要整段切换成${nativeLanguage}，除非用户明确要求或当前对话已经切到该语言。`,
    ].join('\n');
  }

  if (mode === 'native-first') {
    return [
      ...baseRules,
      `本角色回复以${nativeLanguage}为主；如果自动翻译开启，界面会负责提供中文翻译。`,
      '可以在必要时夹少量中文解释，但不要因为资料是中文就强行改回中文回复。',
    ].join('\n');
  }

  if (mode === 'fixed') {
    return [
      ...baseRules,
      `本角色回复固定使用${fixedLanguage}。`,
      `除非用户明确要求临时切换语言，否则不要偏离${fixedLanguage}。`,
    ].join('\n');
  }

  return [
    ...baseRules,
    '默认跟随用户当前主要聊天语言；如果用户使用中文，就以自然中文为主。',
    `角色可以少量保留${nativeLanguage}称呼、口癖、短句或文化词作为角色味道，但不要无故整段切换外语。`,
  ].join('\n');
}
