import type {
  DatingPageEpisodeCanonMode,
  DatingPageEpisodeStatusBarMode,
  DatingPageEpisodeType,
} from '../../types';

export type SpecialDirectiveOutputKind =
  | 'narrative_episode'
  | 'platform_page'
  | 'micro_app'
  | 'custom_html';

export type SpecialDirectivePlatform =
  | 'wechat'
  | 'moments'
  | 'weibo'
  | 'xiaohongshu'
  | 'netease'
  | 'survey'
  | 'campus'
  | 'generic';

export type CompiledSpecialDirective = {
  raw: string;
  normalized: string;
  outputKind: SpecialDirectiveOutputKind;
  platform?: SpecialDirectivePlatform;
  pageType?: DatingPageEpisodeType;
  sceneHandling: 'pause_mainline' | 'continue_mainline';
  writebackPolicy: DatingPageEpisodeCanonMode;
  chrome: {
    statusBarMode: DatingPageEpisodeStatusBarMode;
    statusBarInstruction?: string;
  };
  eventPlan: string[];
  hardConstraints: string[];
  softPreferences: string[];
};

const SPECIAL_DIRECTIVE_PREFIX_REGEX = /^[\$＄]\s*([\s\S]+)$/u;
const PAUSE_MAINLINE_REGEX = /暂停当前主线|暂停主线|先暂停主线|不计入主线|番外|平行线|独立小剧场/u;
const SIDE_STORY_WRITEBACK_REGEX = /不计入主线|别计入主线|不要写回主线|不写回主线/u;
const MAINLINE_WRITEBACK_REGEX = /计入主线|写回主线|并入主线|作为主线/u;
const NARRATIVE_OVERRIDE_REGEX = /普通番外|普通剧情|只输出剧情|只要剧情|不要页面|不用页面|不要html|不用html|不要平台壳|不用平台壳/u;
const HIDE_STATUS_BAR_REGEX = /不要状态栏|无需状态栏|隐藏状态栏|不显示状态栏/u;
const STATUS_BAR_CLAUSE_REGEX = /状态栏[^\n]{0,80}/u;
const PAGE_DIRECTIVE_HARD_CONSTRAINT_REGEX = /不要状态栏|不准输出正文|不输出正文|消息不低于|消息不少于|至少\d+条|评论区[^\n]{0,10}\d+条|评论[^\n]{0,10}\d+条|[一二三四五六七八九十两\d]+条(?:动态|朋友圈|微博|帖子|笔记)|不允许回消息|不许回消息|不能回消息|不接电话|不接收转账|禁止省略|禁止截断|一次性生成|一次性完成|禁止空格|不准有空格|使用js|使用css|使用svg|使用canvas|宽度|高度|max-width|min-height|height:\d|width:\d/u;
const PAGE_DIRECTIVE_SOFT_STYLE_REGEX = /幽默|搞笑|直白|大胆|紧凑|话风|文风|搞怪|好笑|轻松|辛辣|阴阳|发疯|撩|会撩|嘴毒|温柔|冷淡|克制|高冷/u;
const GENERIC_PAGE_REGEX = /页面|html/u;
const MICRO_APP_REGEX = /js|javascript|svg|canvas|css|绘制|动画|交互|模块|切换页面|切页|画布|画板|一笔一笔|小程序|组件/u;

const PLATFORM_PATTERNS: Array<{
  platform: SpecialDirectivePlatform;
  pattern: RegExp;
}> = [
  { platform: 'wechat', pattern: /微信|wechat|聊天界面|聊天页|聊天格式|消息界面|私聊界面|单聊界面/u },
  { platform: 'moments', pattern: /朋友圈|moments|动态/u },
  { platform: 'weibo', pattern: /微博/u },
  { platform: 'xiaohongshu', pattern: /小红书|xhs/u },
  { platform: 'netease', pattern: /网易云|云村|乐评|歌单页|音乐软件/u },
  { platform: 'survey', pattern: /问卷|调查|表单|报名表|调查页/u },
  { platform: 'campus', pattern: /校园|校园墙|表白墙|班级|宿舍|社团|校园公告/u },
];

function normalizeDirectiveText(value: string | null | undefined): string {
  return (value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/^[\$＄]\s*/u, '').trim())
    .filter(Boolean)
    .join('\n');
}

function splitDirectiveLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function detectPlatform(value: string): SpecialDirectivePlatform | undefined {
  return PLATFORM_PATTERNS.find((entry) => entry.pattern.test(value))?.platform;
}

function inferOutputKind(value: string, platform: SpecialDirectivePlatform | undefined): SpecialDirectiveOutputKind {
  if (NARRATIVE_OVERRIDE_REGEX.test(value)) {
    return 'narrative_episode';
  }

  if (MICRO_APP_REGEX.test(value)) {
    return 'micro_app';
  }

  if (platform) {
    return 'platform_page';
  }

  if (GENERIC_PAGE_REGEX.test(value)) {
    return 'custom_html';
  }

  return 'narrative_episode';
}

function inferPageType(
  outputKind: SpecialDirectiveOutputKind,
  platform: SpecialDirectivePlatform | undefined,
): DatingPageEpisodeType | undefined {
  if (outputKind === 'platform_page') {
    if (platform === 'wechat') {
      return 'wechat_chat';
    }
    if (platform === 'survey') {
      return 'document_page';
    }
    return 'feed_post';
  }

  if (outputKind === 'micro_app') {
    return 'micro_app';
  }

  if (outputKind === 'custom_html') {
    return 'custom_html';
  }

  return undefined;
}

function extractStatusBarInstruction(value: string): string | undefined {
  if (!/状态栏/u.test(value) || HIDE_STATUS_BAR_REGEX.test(value)) {
    return undefined;
  }

  return value.match(STATUS_BAR_CLAUSE_REGEX)?.[0]?.trim() || undefined;
}

function categorizeDirectiveLines(lines: string[]): Pick<CompiledSpecialDirective, 'eventPlan' | 'hardConstraints' | 'softPreferences'> {
  const eventPlan: string[] = [];
  const hardConstraints: string[] = [];
  const softPreferences: string[] = [];

  lines.forEach((line) => {
    if (PAGE_DIRECTIVE_HARD_CONSTRAINT_REGEX.test(line)) {
      hardConstraints.push(line);
      return;
    }

    if (PAGE_DIRECTIVE_SOFT_STYLE_REGEX.test(line)) {
      softPreferences.push(line);
      return;
    }

    eventPlan.push(line);
  });

  return {
    eventPlan,
    hardConstraints,
    softPreferences,
  };
}

export function extractSpecialDirectiveCommand(value: string): string | null {
  const normalized = value.replace(/\r/g, '').trim();
  if (!normalized) {
    return null;
  }

  return normalized.match(SPECIAL_DIRECTIVE_PREFIX_REGEX)?.[1]?.trim() || null;
}

export function compileSpecialDirective(value: string | null | undefined): CompiledSpecialDirective | null {
  const raw = (value || '').trim();
  const normalized = normalizeDirectiveText(raw);
  if (!normalized) {
    return null;
  }

  const lines = splitDirectiveLines(normalized);
  const platform = detectPlatform(normalized);
  const outputKind = inferOutputKind(normalized, platform);
  const lineCategories = categorizeDirectiveLines(lines);

  if (lineCategories.eventPlan.length === 0) {
    lineCategories.eventPlan.push(normalized.replace(/\n+/g, ' '));
  }

  return {
    raw,
    normalized,
    outputKind,
    platform: platform || (outputKind === 'custom_html' ? 'generic' : undefined),
    pageType: inferPageType(outputKind, platform),
    sceneHandling: PAUSE_MAINLINE_REGEX.test(normalized) ? 'pause_mainline' : 'continue_mainline',
    writebackPolicy: SIDE_STORY_WRITEBACK_REGEX.test(normalized)
      ? 'side_story'
      : MAINLINE_WRITEBACK_REGEX.test(normalized)
        ? 'mainline'
        : 'side_story',
    chrome: {
      statusBarMode: HIDE_STATUS_BAR_REGEX.test(normalized)
        ? 'hidden'
        : /状态栏/u.test(normalized)
          ? 'custom'
          : 'auto',
      statusBarInstruction: extractStatusBarInstruction(normalized),
    },
    eventPlan: lineCategories.eventPlan,
    hardConstraints: lineCategories.hardConstraints,
    softPreferences: lineCategories.softPreferences,
  };
}
