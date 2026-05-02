import React, { useState } from 'react';
import type { ForumPost } from '../../../types';
import type { ForumThreadType } from '../../../features/forum-domain/types';
import { getForumPollUserVote, parseForumPollOptionsFromContent, type ForumPollOptionState } from '../../../services/forum/forumPoll';

type ForumRichTextProps = {
  content: string;
  compact?: boolean;
  className?: string;
  threadType?: ForumThreadType;
  post?: ForumPost;
  currentUserId?: string;
  onVote?: (postId: string, optionId: string) => void;
};

type RichTextBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'meta'; label: string; text: string }
  | { type: 'quote'; text: string }
  | { type: 'styled'; text: string; styleKind: 'note' | 'paper' | 'sticky' | 'tape'; palette: 'amber' | 'mint' | 'sky' | 'rose' | 'violet' }
  | { type: 'tags'; tags: string[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'ordered'; items: string[] }
  | { type: 'unordered'; items: string[] };

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function normalizeLine(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function isMetaLine(value: string) {
  return /^(os|OS|补一句|补充|补个后续|后续|二编|楼主补充|编辑一下)[:：，,\s]+(.+)$/u.test(value);
}

function parseMetaLine(value: string) {
  const match = value.match(/^(os|OS|补一句|补充|补个后续|后续|二编|楼主补充|编辑一下)[:：，,\s]+(.+)$/u);
  if (!match) return null;
  return {
    label: 'os',
    text: match[2]?.trim() || '',
  };
}

const INLINE_TOKEN_PATTERN =
  /(==[^=\n]+==|~~[^~\n]+~~|__[^_\n]+__|!![^!\n]+!!|\^\^[^^\n]+\^\^|%%[^%\n]+%%|@@[^@\n]+@@|\[\[[^[\]\n]+\]\]|\{\{[^{}\n]+\}\}|<<[^<>\n]+>>|\/\/[^/\n]+\/\/|【[^】\n]+】|"[^"\n]+"|“[^”\n]+”)/g;

function isOrderedLine(value: string) {
  return /^\d+[.\s、]/.test(value);
}

function stripOrderedPrefix(value: string) {
  return value.replace(/^\d+[.\s、]*/, '').trim();
}

function isUnorderedLine(value: string) {
  return /^[-•·]\s+/.test(value);
}

function stripUnorderedPrefix(value: string) {
  return value.replace(/^[-•·]\s+/, '').trim();
}

function isVoteOptionLine(value: string) {
  return /^[A-DＡ-Ｄ][.\s、]/.test(value) || /^[①②③④⑤⑥]\s*/.test(value);
}

function stripVotePrefix(value: string) {
  return value
    .replace(/^[A-DＡ-Ｄ][.\s、]*/, '')
    .replace(/^[①②③④⑤⑥]\s*/, '')
    .trim();
}

function isTagLine(value: string) {
  const tags = value.match(/#([\p{Script=Han}A-Za-z0-9_]{1,12})/gu);
  return !!tags && tags.length >= 2;
}

function extractTags(value: string) {
  return Array.from(
    new Set(
      (value.match(/#([\p{Script=Han}A-Za-z0-9_]{1,12})/gu) || [])
        .map((tag) => tag.replace(/^#/, '').trim())
        .filter(Boolean),
    ),
  ).slice(0, 6);
}

function isTableLine(value: string) {
  return /[|｜]/.test(value) && value.split(/[|｜]/).filter((item) => item.trim()).length >= 2;
}

function splitTableLine(value: string) {
  return value.split(/[|｜]/).map((item) => item.trim()).filter(Boolean);
}

function buildPollOptions(content: string) {
  return parseForumPollOptionsFromContent(content);
}

function parseStyledBlockLine(value: string) {
  const match = value.match(/^\[!(note|paper|sticky|tape)(?::(amber|mint|sky|rose|violet))?\]\s*(.+)$/i);
  if (!match?.[1] || !match?.[3]) return null;
  return {
    type: 'styled' as const,
    styleKind: match[1].toLowerCase() as 'note' | 'paper' | 'sticky' | 'tape',
    palette: (match[2]?.toLowerCase() || 'amber') as 'amber' | 'mint' | 'sky' | 'rose' | 'violet',
    text: match[3].trim(),
  };
}

function parseBlocks(content: string, threadType?: ForumThreadType) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, source) => !(line === '' && source[index - 1] === ''));

  const blocks: RichTextBlock[] = [];
  let paragraphBuffer: string[] = [];
  let orderedBuffer: string[] = [];
  let unorderedBuffer: string[] = [];
  let tableBuffer: string[][] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const text = paragraphBuffer.join(' ').trim();
    if (text) {
      blocks.push({
        type: /^["“].+["”]$/.test(text) ? 'quote' : 'paragraph',
        text,
      });
    }
    paragraphBuffer = [];
  };

  const flushOrdered = () => {
    if (!orderedBuffer.length) return;
    blocks.push({ type: 'ordered', items: [...orderedBuffer] });
    orderedBuffer = [];
  };

  const flushUnordered = () => {
    if (!unorderedBuffer.length) return;
    blocks.push({ type: 'unordered', items: [...unorderedBuffer] });
    unorderedBuffer = [];
  };

  const flushTable = () => {
    if (!tableBuffer.length) return;
    blocks.push({ type: 'table', rows: [...tableBuffer] });
    tableBuffer = [];
  };

  lines.forEach((rawLine) => {
    const line = normalizeLine(rawLine);

    if (!line) {
      flushParagraph();
      flushOrdered();
      flushUnordered();
      flushTable();
      return;
    }

    if (threadType === 'vote' && isVoteOptionLine(line)) {
      flushParagraph();
      flushOrdered();
      flushUnordered();
      flushTable();
      return;
    }

    if (isMetaLine(line)) {
      flushParagraph();
      flushOrdered();
      flushUnordered();
      flushTable();
      const meta = parseMetaLine(line);
      if (meta) {
        blocks.push({ type: 'meta', label: meta.label, text: meta.text });
        return;
      }
    }

    const styledBlock = parseStyledBlockLine(line);
    if (styledBlock) {
      flushParagraph();
      flushOrdered();
      flushUnordered();
      flushTable();
      blocks.push(styledBlock);
      return;
    }

    if (isTagLine(line)) {
      flushParagraph();
      flushOrdered();
      flushUnordered();
      flushTable();
      blocks.push({ type: 'tags', tags: extractTags(line) });
      return;
    }

    if (isTableLine(line)) {
      flushParagraph();
      flushOrdered();
      flushUnordered();
      tableBuffer.push(splitTableLine(line));
      return;
    }

    if (isOrderedLine(line)) {
      flushParagraph();
      flushUnordered();
      flushTable();
      orderedBuffer.push(stripOrderedPrefix(line));
      return;
    }

    if (isUnorderedLine(line)) {
      flushParagraph();
      flushOrdered();
      flushTable();
      unorderedBuffer.push(stripUnorderedPrefix(line));
      return;
    }

    paragraphBuffer.push(line);
  });

  flushParagraph();
  flushOrdered();
  flushUnordered();
  flushTable();

  return blocks;
}

function renderInlineText(text: string) {
  return text
    .split(INLINE_TOKEN_PATTERN)
    .filter(Boolean)
    .map((part, index) => {
      if (/^==[^=]+==$/.test(part)) {
        return (
          <span
            key={`${part}-${index}`}
            className="rounded-md bg-emerald-100/90 px-1.5 py-0.5 font-semibold text-emerald-700"
          >
            {part.slice(2, -2)}
          </span>
        );
      }

      if (/^~~[^~]+~~$/.test(part)) {
        return (
          <span key={`${part}-${index}`} className="text-zinc-400 line-through decoration-zinc-300">
            {part.slice(2, -2)}
          </span>
        );
      }

      if (/^__[^_]+__$/.test(part)) {
        return (
          <span
            key={`${part}-${index}`}
            className="font-semibold text-zinc-800 underline decoration-zinc-300 decoration-2 underline-offset-4"
          >
            {part.slice(2, -2)}
          </span>
        );
      }

      if (/^!![^!]+!!$/.test(part)) {
        return (
          <span
            key={`${part}-${index}`}
            className="font-semibold text-rose-600"
          >
            {part.slice(2, -2)}
          </span>
        );
      }

      if (/^\^\^[^^]+\^\^$/.test(part)) {
        return (
          <span
            key={`${part}-${index}`}
            className="font-semibold text-sky-600"
          >
            {part.slice(2, -2)}
          </span>
        );
      }

      if (/^%%[^%]+%%$/.test(part)) {
        return (
          <span
            key={`${part}-${index}`}
            className="font-semibold text-fuchsia-600"
          >
            {part.slice(2, -2)}
          </span>
        );
      }

      if (/^@@[^@]+@@$/.test(part)) {
        return (
          <span
            key={`${part}-${index}`}
            className="font-semibold text-amber-600"
          >
            {part.slice(2, -2)}
          </span>
        );
      }

      if (/^\[\[[^[\]]+\]\]$/.test(part)) {
        return (
          <span
            key={`${part}-${index}`}
            className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[0.9em] font-medium text-sky-700"
          >
            {part.slice(2, -2)}
          </span>
        );
      }

      if (/^\{\{[^{}]+\}\}$/.test(part)) {
        return (
          <span
            key={`${part}-${index}`}
            className="inline-flex rounded-lg bg-zinc-100 px-2 py-0.5 text-[0.92em] text-zinc-500"
          >
            {part.slice(2, -2)}
          </span>
        );
      }

      if (/^<<[^<>]+>>$/.test(part)) {
        return (
          <span
            key={`${part}-${index}`}
            className="inline-flex rounded-md border border-rose-200 px-2 py-0.5 text-[0.92em] font-medium text-rose-600"
          >
            {part.slice(2, -2)}
          </span>
        );
      }

      if (/^\/\/[^/\n]+\/\/$/.test(part)) {
        return (
          <span
            key={`${part}-${index}`}
            className="italic text-zinc-500"
          >
            {part.slice(2, -2)}
          </span>
        );
      }

      if (/^(【[^】]+】|"[^"]+"|“[^”]+”)$/.test(part)) {
        return (
          <span key={`${part}-${index}`} className="font-medium text-zinc-900">
            {part}
          </span>
        );
      }

      return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    });
}

function resolveStyledBlockClass(styleKind: 'note' | 'paper' | 'sticky' | 'tape', palette: 'amber' | 'mint' | 'sky' | 'rose' | 'violet') {
  const paletteMap = {
    amber: {
      note: 'border-white/70 bg-white/90 text-zinc-700 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-amber-100/70',
      paper: 'border-white/80 bg-gradient-to-br from-white via-amber-50/35 to-white text-zinc-700 shadow-[0_12px_32px_rgba(15,23,42,0.05)] ring-1 ring-amber-100/60',
      sticky: 'border-white/75 bg-gradient-to-br from-amber-50/55 to-white text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-amber-100/70',
      tape: 'border-white/80 bg-white/88 text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-amber-100/60',
    },
    mint: {
      note: 'border-white/70 bg-white/90 text-zinc-700 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-emerald-100/70',
      paper: 'border-white/80 bg-gradient-to-br from-white via-emerald-50/35 to-white text-zinc-700 shadow-[0_12px_32px_rgba(15,23,42,0.05)] ring-1 ring-emerald-100/60',
      sticky: 'border-white/75 bg-gradient-to-br from-emerald-50/55 to-white text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-emerald-100/70',
      tape: 'border-white/80 bg-white/88 text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-emerald-100/60',
    },
    sky: {
      note: 'border-white/70 bg-white/90 text-zinc-700 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-sky-100/70',
      paper: 'border-white/80 bg-gradient-to-br from-white via-sky-50/35 to-white text-zinc-700 shadow-[0_12px_32px_rgba(15,23,42,0.05)] ring-1 ring-sky-100/60',
      sticky: 'border-white/75 bg-gradient-to-br from-sky-50/55 to-white text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-sky-100/70',
      tape: 'border-white/80 bg-white/88 text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-sky-100/60',
    },
    rose: {
      note: 'border-white/70 bg-white/90 text-zinc-700 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-rose-100/70',
      paper: 'border-white/80 bg-gradient-to-br from-white via-rose-50/35 to-white text-zinc-700 shadow-[0_12px_32px_rgba(15,23,42,0.05)] ring-1 ring-rose-100/60',
      sticky: 'border-white/75 bg-gradient-to-br from-rose-50/55 to-white text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-rose-100/70',
      tape: 'border-white/80 bg-white/88 text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-rose-100/60',
    },
    violet: {
      note: 'border-white/70 bg-white/90 text-zinc-700 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-violet-100/70',
      paper: 'border-white/80 bg-gradient-to-br from-white via-violet-50/35 to-white text-zinc-700 shadow-[0_12px_32px_rgba(15,23,42,0.05)] ring-1 ring-violet-100/60',
      sticky: 'border-white/75 bg-gradient-to-br from-violet-50/55 to-white text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-violet-100/70',
      tape: 'border-white/80 bg-white/88 text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-violet-100/60',
    },
  } as const;

  return paletteMap[palette][styleKind];
}

function PollCard({
  options,
  compact,
  selectedId,
  onSelect,
}: {
  options: ForumPollOptionState[];
  compact?: boolean;
  selectedId?: string | null;
  onSelect?: (optionId: string) => void;
}) {
  if (!options.length) return null;

  const total = options.reduce((sum, option) => sum + option.voterIds.length, 0);
  const revealed = !!selectedId;
  const maxVotes = Math.max(1, ...options.map((option) => option.voterIds.length));

  return (
    <div className={joinClassNames('rounded-2xl border border-indigo-100 bg-indigo-50/60', compact ? 'mt-2 p-3' : 'mt-4 p-4')}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.18em] text-indigo-600">投票区</span>
        <span className="text-[11px] text-indigo-500">{options.length} 个选项</span>
      </div>
      <div className="space-y-2">
        {options.map((option) => {
          const votes = option.voterIds.length;
          const width = revealed ? Math.max(10, Math.round((votes / maxVotes) * 100)) : 0;

          return (
            <button
              key={option.id}
              type="button"
              disabled={compact || revealed || !onSelect}
              onClick={() => onSelect?.(option.id)}
              className={joinClassNames(
                'relative w-full overflow-hidden rounded-2xl border text-left transition-colors',
                compact ? 'cursor-default border-indigo-100 bg-white/80 px-3 py-2' : 'border-indigo-200 bg-white px-3 py-3 hover:bg-indigo-50',
                selectedId === option.id && !compact ? 'ring-2 ring-indigo-200' : '',
              )}
            >
              {revealed && (
                <span
                  className="absolute inset-y-0 left-0 rounded-r-2xl bg-indigo-100/80"
                  style={{ width: `${width}%` }}
                />
              )}
              <span className="relative flex items-center justify-between gap-3">
                <span className={joinClassNames('pr-2 text-zinc-900', compact ? 'text-[12px] font-medium' : 'text-[13px] font-semibold')}>
                  {option.text}
                </span>
                {revealed && <span className="shrink-0 text-[11px] font-bold text-indigo-600">{votes}票</span>}
              </span>
            </button>
          );
        })}
      </div>
      {!compact && (
        <div className="mt-2 text-[11px] text-indigo-500">
          {revealed ? `已显示结果 · 当前共 ${total} 票` : '先投票，投完后再看结果。'}
        </div>
      )}
    </div>
  );
}

export function ForumRichText({ content, compact = false, className, threadType, post, currentUserId, onVote }: ForumRichTextProps) {
  const normalizedContent = content.trim();
  if (!normalizedContent) return null;

  const blocks = parseBlocks(normalizedContent, threadType);
  const pollOptions = threadType === 'vote'
    ? (post?.poll?.options?.length ? post.poll.options : buildPollOptions(normalizedContent))
    : [];
  const selectedPollOptionId = post && currentUserId ? getForumPollUserVote(post, currentUserId) : null;

  return (
    <div
      className={joinClassNames(
        compact ? 'space-y-2 text-[13px] leading-6 text-zinc-600' : 'space-y-3 text-[15px] leading-8 text-zinc-800',
        className,
      )}
    >
      {blocks.map((block, index) => {
        if (block.type === 'meta') {
          return (
            <div
              key={`${block.type}-${index}`}
              className={joinClassNames(
                'rounded-2xl border border-zinc-200/80 bg-zinc-50/80',
                compact ? 'px-3 py-2 text-[12px] leading-5' : 'px-3.5 py-2.5 text-[13px] leading-6',
              )}
            >
              <span className="mr-1 font-bold text-zinc-900">OS：</span>
              <span className="text-zinc-600">{renderInlineText(block.text)}</span>
            </div>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={`${block.type}-${index}`}
              className={joinClassNames(
                'border-l-[3px] border-zinc-300 pl-4 text-zinc-600',
                compact ? 'text-[12px] leading-5' : 'text-[14px] leading-7 italic',
              )}
            >
              {renderInlineText(block.text)}
            </blockquote>
          );
        }

        if (block.type === 'styled') {
          const baseClass = resolveStyledBlockClass(block.styleKind, block.palette);
          return (
            <div
              key={`${block.type}-${index}`}
              className={joinClassNames(
                'relative overflow-hidden rounded-[20px] border backdrop-blur-[10px] px-4 py-3.5',
                compact ? 'text-[12px] leading-6' : 'text-[14px] leading-7',
                baseClass,
                block.styleKind === 'tape' ? 'before:absolute before:left-6 before:top-0 before:h-2.5 before:w-14 before:-translate-y-1/2 before:rotate-[-5deg] before:rounded-sm before:bg-white/80 before:shadow-[0_2px_8px_rgba(15,23,42,0.08)] before:content-[\'\']' : '',
                block.styleKind === 'paper' ? 'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/80 after:to-transparent after:content-[\'\']' : '',
              )}
            >
              <div className={joinClassNames('relative', block.styleKind === 'sticky' ? 'font-medium' : '')}>
                {renderInlineText(block.text)}
              </div>
            </div>
          );
        }

        if (block.type === 'tags') {
          return (
            <div key={`${block.type}-${index}`} className="flex flex-wrap gap-2">
              {block.tags.map((tag, tagIndex) => (
                <span
                  key={`${tag}-${tagIndex}`}
                  className={joinClassNames(
                    'inline-flex rounded-full border px-2.5 py-1 font-medium',
                    compact
                      ? 'border-zinc-200 bg-zinc-50 text-[11px] text-zinc-500'
                      : 'border-rose-200 bg-rose-50 text-[12px] text-rose-700',
                  )}
                >
                  #{tag}
                </span>
              ))}
            </div>
          );
        }

        if (block.type === 'table') {
          const columnCount = Math.max(...block.rows.map((row) => row.length));
          return (
            <div
              key={`${block.type}-${index}`}
              className={joinClassNames(
                'overflow-hidden rounded-2xl border border-zinc-200/80',
                compact ? 'text-[11px]' : 'text-[13px]',
              )}
            >
              <div
                className="grid bg-zinc-50/85"
                style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
              >
                {block.rows.flatMap((row, rowIndex) =>
                  Array.from({ length: columnCount }).map((_, columnIndex) => (
                    <div
                      key={`${rowIndex}-${columnIndex}`}
                      className={joinClassNames(
                        'border-zinc-200/70 px-3 py-2 leading-6 text-zinc-700',
                        rowIndex > 0 ? 'border-t' : '',
                        columnIndex > 0 ? 'border-l' : '',
                        rowIndex === 0 ? 'font-semibold text-zinc-900' : '',
                      )}
                    >
                      {renderInlineText(row[columnIndex] || '—')}
                    </div>
                  )),
                )}
              </div>
            </div>
          );
        }

        if (block.type === 'ordered') {
          return (
            <ol
              key={`${block.type}-${index}`}
              className={joinClassNames(
                'space-y-2',
                compact ? 'pl-4 text-[12px] leading-5' : 'pl-0 text-[14px] leading-7',
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li
                  key={`${item}-${itemIndex}`}
                  className={joinClassNames(
                    'list-none',
                    compact ? '' : 'rounded-2xl border border-zinc-100 bg-zinc-50/70 px-3 py-2.5',
                  )}
                >
                  <div className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white">
                      {itemIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1">{renderInlineText(item)}</span>
                  </div>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'unordered') {
          return (
            <ul
              key={`${block.type}-${index}`}
              className={joinClassNames(
                'space-y-2',
                compact ? 'pl-4 text-[12px] leading-5' : 'pl-5 text-[14px] leading-7',
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="list-disc marker:text-zinc-400">
                  {renderInlineText(item)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p
            key={`${block.type}-${index}`}
            className={joinClassNames(
              threadType === 'essay' && !compact ? 'text-[15px] leading-8 text-zinc-800' : '',
              threadType === 'ownerUpdate' && !compact ? 'rounded-2xl bg-zinc-50/80 px-3 py-2.5' : '',
              threadType === 'timeline' && !compact ? 'leading-7' : '',
            )}
          >
            {renderInlineText(block.text)}
          </p>
        );
      })}

      {pollOptions.length > 0 && (
        <PollCard
          options={pollOptions}
          compact={compact}
          selectedId={selectedPollOptionId}
          onSelect={post && onVote ? (optionId) => onVote(post.id, optionId) : undefined}
        />
      )}
    </div>
  );
}
