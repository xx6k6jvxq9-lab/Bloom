export type ThemeScopeTargetId =
  | 'rootVariables'
  | 'pageBackground'
  | 'baseTypography'
  | 'chatHeaderBar'
  | 'chatFooterBar'
  | 'chatBubbles'
  | 'sideBubbles'
  | 'bubbleDecorations'
  | 'replyPreview'
  | 'imageMessage'
  | 'locationCard'
  | 'transferCard'
  | 'noticeAndLoading'
  | 'innerVoiceCard';

export type ThemeScopeTarget = {
  id: ThemeScopeTargetId;
  label: string;
  description: string;
  selectors: string[];
  placeholder: string;
};

export const DISABLED_THEME_SCOPE_TARGET_IDS: ThemeScopeTargetId[] = [];

export const THEME_SCOPE_TARGETS: Record<ThemeScopeTargetId, ThemeScopeTarget> = {
  rootVariables: {
    id: 'rootVariables',
    label: '全局 CSS 变量',
    description: '给整套主题定义颜色、圆角、阴影等基础变量。',
    selectors: [':root'],
    placeholder: '--theme-accent: #f5dfe8;\n--theme-radius: 22px;\n--theme-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);',
  },
  pageBackground: {
    id: 'pageBackground',
    label: '页面背景氛围',
    description: '给页面整体铺底色、纹理、渐变或背景氛围。',
    selectors: ['body'],
    placeholder: 'background-color: #f8f5f7;\nbackground-image: radial-gradient(circle at top, rgba(255,255,255,0.8), transparent 55%);',
  },
  baseTypography: {
    id: 'baseTypography',
    label: '基础文字与通用控件',
    description: '控制全局文字、按钮、输入框的基础气质。',
    selectors: ['body', 'button', 'input', 'textarea'],
    placeholder: 'color: #4e4a4d;\nfont-family: "PingFang SC", "Microsoft YaHei", sans-serif;',
  },
  chatHeaderBar: {
    id: 'chatHeaderBar',
    label: '聊天顶栏',
    description: '控制聊天页顶部栏，包括标题、返回区和右侧操作位。',
    selectors: [
      '.chat-bubble-theme-scope .chat-session-header',
      '.chat-bubble-theme-scope .chat-header-title-block',
      '.chat-bubble-theme-scope .chat-header-title',
      '.chat-bubble-theme-scope .chat-header-subtitle',
      '.chat-bubble-theme-scope .chat-header-back-button',
      '.chat-bubble-theme-scope .chat-header-avatar-button',
      '.chat-bubble-theme-scope .chat-header-action-button',
      '.chat-bubble-theme-scope .chat-header-back-icon',
      '.chat-bubble-theme-scope .chat-header-settings-icon',
      '.chat-bubble-theme-scope .chat-header-avatar',
    ],
    placeholder: '.chat-bubble-theme-scope .chat-session-header {\n  background: rgba(255,255,255,0.75);\n  backdrop-filter: blur(18px);\n  border-bottom: 1px solid rgba(125, 122, 124, 0.12);\n}\n\n.chat-bubble-theme-scope .chat-header-action-button,\n.chat-bubble-theme-scope .chat-header-back-button {\n  color: #6b6570;\n}',
  },
  chatFooterBar: {
    id: 'chatFooterBar',
    label: '聊天底部栏',
    description: '控制输入栏容器、底部操作区和输入托盘外壳。',
    selectors: [
      '.chat-bubble-theme-scope .chat-session-footer',
      '.chat-bubble-theme-scope .chat-footer-input-shell',
      '.chat-bubble-theme-scope .chat-footer-textarea',
      '.chat-bubble-theme-scope .chat-footer-voice-toggle-button',
      '.chat-bubble-theme-scope .chat-footer-voice-button',
      '.chat-bubble-theme-scope .chat-footer-emoji-button',
      '.chat-bubble-theme-scope .chat-footer-send-button',
      '.chat-bubble-theme-scope .chat-footer-plus-button',
      '.chat-bubble-theme-scope .chat-footer-voice-toggle-icon',
      '.chat-bubble-theme-scope .chat-footer-emoji-icon',
      '.chat-bubble-theme-scope .chat-footer-send-icon',
      '.chat-bubble-theme-scope .chat-footer-plus-icon',
      '.chat-bubble-theme-scope .chat-footer-reply-preview',
    ],
    placeholder: '.chat-bubble-theme-scope .chat-session-footer {\n  background: rgba(255,255,255,0.86);\n  backdrop-filter: blur(20px);\n  border-top: 1px solid rgba(125, 122, 124, 0.12);\n}\n\n.chat-bubble-theme-scope .chat-footer-send-button,\n.chat-bubble-theme-scope .chat-footer-plus-button {\n  border-radius: 999px;\n}',
  },
  chatBubbles: {
    id: 'chatBubbles',
    label: '单聊 / 群聊气泡',
    description: '统一控制文本气泡、常规消息外观。',
    selectors: [
      '.chat-bubble-theme-scope .chat-bubble',
      '.chat-bubble-theme-scope .message-bubble',
    ],
    placeholder: 'border-radius: 18px;\nborder: 1px solid rgba(125, 122, 124, 0.35);\nbox-shadow: 0 8px 20px rgba(120, 110, 105, 0.1);',
  },
  sideBubbles: {
    id: 'sideBubbles',
    label: '用户 / 对方局部覆盖',
    description: '分别覆盖自己和对方的气泡样式。',
    selectors: [
      '.chat-bubble-theme-scope .user-bubble',
      '.chat-bubble-theme-scope .bot-bubble',
    ],
    placeholder: '.chat-bubble-theme-scope .user-bubble {\n  background: #fcfbfb;\n}\n\n.chat-bubble-theme-scope .bot-bubble {\n  background: #f8edf2;\n}',
  },
  bubbleDecorations: {
    id: 'bubbleDecorations',
    label: '装饰锚点与伪元素',
    description: '适合补四角装饰、挂件、尾巴和其他伪元素细节。',
    selectors: [
      '.chat-bubble-theme-scope .corner',
      '.chat-bubble-theme-scope .sticker-skull',
      '.chat-bubble-theme-scope .chat-bubble::before',
      '.chat-bubble-theme-scope .chat-bubble::after',
    ],
    placeholder: '.chat-bubble-theme-scope .corner::before {\n  background: #7f7b7d;\n}\n\n.chat-bubble-theme-scope .sticker-skull {\n  border-color: #7f7b7d;\n}',
  },
  replyPreview: {
    id: 'replyPreview',
    label: '回复预览',
    description: '引用回复上方的小预览块。',
    selectors: ['.chat-bubble-theme-scope .chat-reply-preview'],
    placeholder: 'background: rgba(255,255,255,0.72);\nborder: 1px solid rgba(125, 122, 124, 0.18);\nbackdrop-filter: blur(8px);',
  },
  imageMessage: {
    id: 'imageMessage',
    label: '图片消息',
    description: '图片气泡、图片容器与图片消息卡。',
    selectors: ['.chat-bubble-theme-scope .chat-message-image'],
    placeholder: 'border-radius: 12px;\nborder: 2px solid #7f7b7d;',
  },
  locationCard: {
    id: 'locationCard',
    label: '位置卡片',
    description: '聊天中的位置消息卡片与定位块。',
    selectors: [
      '.chat-bubble-theme-scope .chat-location-card',
      '.chat-bubble-theme-scope .chat-location-inline-card',
    ],
    placeholder: 'border-radius: 18px;\nborder: 1px solid rgba(125, 122, 124, 0.2);\nbackground: rgba(255,255,255,0.88);',
  },
  transferCard: {
    id: 'transferCard',
    label: '转账卡片',
    description: '聊天里的转账、收款等消息卡片。',
    selectors: ['.chat-bubble-theme-scope .chat-transfer-card'],
    placeholder: 'border-radius: 18px;\nbox-shadow: 0 10px 24px rgba(250, 157, 59, 0.18);',
  },
  noticeAndLoading: {
    id: 'noticeAndLoading',
    label: '通知与加载态',
    description: '系统通知、notice 卡片和打字加载气泡。',
    selectors: [
      '.chat-bubble-theme-scope .chat-notice-card',
      '.chat-bubble-theme-scope .chat-loading-bubble',
    ],
    placeholder: 'background: rgba(255,255,255,0.82);\nbackdrop-filter: blur(10px);\nborder: 1px solid rgba(125, 122, 124, 0.12);',
  },
  innerVoiceCard: {
    id: 'innerVoiceCard',
    label: '心声卡片',
    description: '聊天里的心声道具消息卡片。',
    selectors: ['.chat-bubble-theme-scope .chat-inner-voice-card'],
    placeholder: 'border-radius: 22px;\nbackground: rgba(255, 245, 248, 0.95);\nborder: 1px solid rgba(251, 113, 133, 0.18);',
  },
};

export const THEME_SCOPE_GROUPS: Array<{
  title: string;
  description: string;
  items: ThemeScopeTargetId[];
}> = [
  {
    title: '全局样式',
    description: '整套主题的基础变量、背景和文字基调。',
    items: ['rootVariables', 'pageBackground', 'baseTypography'],
  },
  {
    title: '聊天栏',
    description: '单独控制聊天顶栏和底部输入栏，不和气泡挤在一起。',
    items: ['chatHeaderBar', 'chatFooterBar'],
  },
  {
    title: '聊天主题',
    description: '文本气泡、左右分流和装饰细节。',
    items: ['chatBubbles', 'sideBubbles', 'bubbleDecorations'],
  },
  {
    title: '扩展消息',
    description: '图片、位置、转账、通知、心声等特殊消息块。',
    items: ['replyPreview', 'imageMessage', 'locationCard', 'transferCard', 'noticeAndLoading', 'innerVoiceCard'],
  },
];
