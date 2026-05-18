import type {
  DatingPageEpisode,
  GroupOfflineDirectorOutputMode,
} from '../../types';
import { compileSpecialDirective } from '../special-directives/compileSpecialDirective';

export type GroupOfflineDirectorPagePlan = {
  pageType: NonNullable<DatingPageEpisode['pageType']>;
  platform?: DatingPageEpisode['platform'];
};

export type GroupOfflineDirectorOutputOption = {
  id: GroupOfflineDirectorOutputMode;
  label: string;
  hint: string;
};

export const GROUP_OFFLINE_DIRECTOR_OUTPUT_OPTIONS: GroupOfflineDirectorOutputOption[] = [
  { id: 'auto', label: '自动', hint: '继续按文字判断' },
  { id: 'narrative', label: '普通剧情', hint: '只走正文轮' },
  { id: 'wechat_chat', label: '微信页', hint: '固定聊天页' },
  { id: 'feed_post', label: '动态页', hint: '固定动态流' },
  { id: 'document_page', label: '文档页', hint: '固定文档结构' },
  { id: 'custom_html', label: 'HTML页', hint: '固定自定义页' },
  { id: 'micro_app', label: 'HTML模块', hint: '固定互动模块' },
];

const GROUP_OFFLINE_DIRECTOR_OUTPUT_HINTS: Record<Exclude<GroupOfflineDirectorOutputMode, 'auto'>, string> = {
  narrative: '强制路由：这次特殊指令只按普通剧情轮输出，不要页面，不要 html，不要平台壳。',
  wechat_chat: '强制路由：这次特殊指令固定输出为微信聊天页面（wechat_chat），就算原始指令没有明确写页面类型，也按微信聊天页处理。',
  feed_post: '强制路由：这次特殊指令固定输出为动态页面（feed_post），优先拆成动态流，不要退回普通剧情轮。',
  document_page: '强制路由：这次特殊指令固定输出为文档页面（document_page），优先用问卷、报名表、通知页或记录页这类文档结构承载。',
  custom_html: '强制路由：这次特殊指令固定输出为自定义 HTML 页面（custom_html），不要退回普通剧情轮。',
  micro_app: '强制路由：这次特殊指令固定输出为互动 HTML 模块（micro_app），允许少量 js/css/svg 交互，首屏必须可见。',
};

export function getGroupOfflineDirectorOutputModeLabel(mode: GroupOfflineDirectorOutputMode | undefined): string {
  return GROUP_OFFLINE_DIRECTOR_OUTPUT_OPTIONS.find((option) => option.id === mode)?.label || '自动';
}

export function getGroupOfflineDirectorOutputModeSummary(mode: GroupOfflineDirectorOutputMode | undefined): string {
  switch (mode) {
    case 'narrative':
      return '当前会强制走普通剧情轮，不再靠指令里的页面关键词切页。';
    case 'wechat_chat':
      return '当前会强制走微信聊天页。';
    case 'feed_post':
      return '当前会强制走动态页。';
    case 'document_page':
      return '当前会强制走文档页。';
    case 'custom_html':
      return '当前会强制走自定义 HTML 页。';
    case 'micro_app':
      return '当前会强制走互动 HTML 模块。';
    case 'auto':
    default:
      return '当前仍按你写的特殊指令自动判断，不额外锁页型。';
  }
}

export function resolveGroupOfflineDirectorOutputModePagePlan(
  outputMode: GroupOfflineDirectorOutputMode | undefined,
): GroupOfflineDirectorPagePlan | undefined {
  switch (outputMode) {
    case 'wechat_chat':
      return { pageType: 'wechat_chat', platform: 'wechat' };
    case 'feed_post':
      return { pageType: 'feed_post', platform: 'generic' };
    case 'document_page':
      return { pageType: 'document_page' };
    case 'custom_html':
      return { pageType: 'custom_html' };
    case 'micro_app':
      return { pageType: 'micro_app' };
    default:
      return undefined;
  }
}

export function buildGroupOfflineDirectorInstructionRuntimeText(
  rawText: string | undefined,
  outputMode: GroupOfflineDirectorOutputMode | undefined,
): string {
  const trimmed = (rawText || '').trim();
  if (!trimmed) {
    return '';
  }

  if (!outputMode || outputMode === 'auto') {
    return trimmed;
  }

  return `${GROUP_OFFLINE_DIRECTOR_OUTPUT_HINTS[outputMode]}\n${trimmed}`;
}

export function resolveGroupOfflineDirectorPagePlan(
  rawText: string | undefined,
  outputMode: GroupOfflineDirectorOutputMode | undefined,
): GroupOfflineDirectorPagePlan | undefined {
  if (outputMode === 'narrative') {
    return undefined;
  }

  const forcedPlan = resolveGroupOfflineDirectorOutputModePagePlan(outputMode);
  if (forcedPlan) {
    return forcedPlan;
  }

  const compiled = rawText?.trim()
    ? compileSpecialDirective(rawText.trim())
    : null;
  if (!compiled?.pageType || compiled.outputKind === 'narrative_episode') {
    return undefined;
  }

  return {
    pageType: compiled.pageType,
    ...(compiled.platform ? { platform: compiled.platform } : {}),
  };
}
