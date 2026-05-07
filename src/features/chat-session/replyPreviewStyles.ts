import type { CSSProperties } from 'react';

const MESSAGE_REPLY_PREVIEW_BASE_CLASS =
  'chat-reply-preview mb-1 inline-flex max-w-[min(82%,32rem)] items-start gap-2 rounded-2xl border px-3 py-2 shadow-[0_6px_16px_rgba(15,23,42,0.08)] backdrop-blur-sm';

const FOOTER_REPLY_PREVIEW_BASE_CLASS =
  'chat-footer-reply-preview flex items-center justify-between rounded-xl border px-3 py-2 text-[13px] shadow-[0_4px_14px_rgba(15,23,42,0.06)] backdrop-blur-sm';

export const MESSAGE_REPLY_PREVIEW_LABEL_CLASS = 'text-[11px] font-medium';

export const MESSAGE_REPLY_PREVIEW_TEXT_CLASS =
  'mt-0.5 max-w-[min(60vw,24rem)] line-clamp-2 text-[12px] leading-5 break-words';

export const MESSAGE_REPLY_PREVIEW_ICON_STYLE: CSSProperties = {
  color: 'currentColor',
  opacity: 0.7,
};

export const MESSAGE_REPLY_PREVIEW_LABEL_STYLE: CSSProperties = {
  color: 'inherit',
  opacity: 0.78,
};

export const MESSAGE_REPLY_PREVIEW_TEXT_STYLE: CSSProperties = {
  color: 'inherit',
  opacity: 0.94,
};

export const FOOTER_REPLY_PREVIEW_ICON_STYLE: CSSProperties = {
  color: 'currentColor',
  opacity: 0.78,
};

export function getMessageReplyPreviewClass(isUser: boolean): string {
  return `${MESSAGE_REPLY_PREVIEW_BASE_CLASS} ${
    isUser
      ? 'border-white/65 bg-white/90 text-zinc-700'
      : 'border-white/75 bg-white/92 text-zinc-700'
  }`;
}

export function getFooterReplyPreviewClass(tone: 'default' | 'editing' = 'default'): string {
  return `${FOOTER_REPLY_PREVIEW_BASE_CLASS} ${
    tone === 'editing'
      ? 'border-amber-200/80 bg-amber-50/95 text-amber-700'
      : 'border-white/65 bg-white/90 text-zinc-700'
  }`;
}

export function getFooterReplyCloseButtonClass(tone: 'default' | 'editing' = 'default'): string {
  return `chat-footer-reply-close-button shrink-0 rounded-full p-1 transition-colors ${
    tone === 'editing'
      ? 'hover:bg-amber-100/80'
      : 'hover:bg-black/5'
  }`;
}
