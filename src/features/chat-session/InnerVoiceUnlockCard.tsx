import React, { useMemo } from 'react';
import { Heart, Share2, Star } from 'lucide-react';
import { motion } from 'motion/react';

const SERIF_FONT = '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif';

export type InnerVoiceUnlockCardProps = {
  characterName: string;
  date: string;
  headline: string;
  body: string;
  translation?: string;
  ps?: string;
  isSaved?: boolean;
  onSave: () => void;
  onShare: () => void;
  showShareButton?: boolean;
};

export type ParsedInnerVoiceCardContent = {
  headline: string;
  body: string;
  ps?: string;
};

function splitHeadlineIntoLines(headline: string): string[] {
  const normalizedLines = headline
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (normalizedLines.length >= 2) {
    return normalizedLines.slice(0, 3);
  }

  const sentenceParts = headline
    .split(/[，、；]/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (sentenceParts.length >= 2) {
    return sentenceParts.slice(0, 3);
  }

  const fallback = headline.trim();
  if (fallback.length <= 11) {
    return [fallback];
  }
  if (fallback.length <= 22) {
    return [fallback.slice(0, Math.ceil(fallback.length / 2)).trim(), fallback.slice(Math.ceil(fallback.length / 2)).trim()].filter(Boolean);
  }

  const first = fallback.slice(0, 8).trim();
  const second = fallback.slice(8, 16).trim();
  const third = fallback.slice(16).trim();
  return [first, second, third].filter(Boolean);
}

export function parseInnerVoiceCardContent(text: string): ParsedInnerVoiceCardContent {
  const normalized = text.replace(/\r/g, '').trim();
  if (!normalized) {
    return {
      headline: '在我这儿，\n你永远有\n不坚强的权利。',
      body: '我没有要你时时都稳住的意思。你累了、慌了、想躲一会儿，都可以。',
    };
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  let headlineBlock = blocks[0] || normalized;
  let bodyBlocks = blocks.slice(1);

  if (bodyBlocks.length === 0) {
    const lines = normalized
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length > 1) {
      headlineBlock = lines.slice(0, Math.min(3, lines.length)).join('\n');
      bodyBlocks = lines.slice(Math.min(3, lines.length));
    }
  }

  let ps: string | undefined;
  if (bodyBlocks.length > 0) {
    const lastBlock = bodyBlocks[bodyBlocks.length - 1];
    if (/^(?:ps|p\.s\.|附言|注)\s*[:：]/i.test(lastBlock)) {
      ps = lastBlock.replace(/^(?:ps|p\.s\.|附言|注)\s*[:：]\s*/i, '').trim();
      bodyBlocks = bodyBlocks.slice(0, -1);
    }
  }

  const headlineLines = splitHeadlineIntoLines(headlineBlock);
  const headline = headlineLines.join('\n');
  const body = bodyBlocks.join('\n\n').trim() || normalized.replace(headlineBlock, '').trim() || normalized;

  return {
    headline,
    body,
    ...(ps ? { ps } : {}),
  };
}

export function InnerVoiceUnlockCard({
  characterName,
  date,
  headline,
  body,
  translation,
  ps,
  isSaved = false,
  onSave,
  onShare,
  showShareButton = true,
}: InnerVoiceUnlockCardProps) {
  const headlineLines = useMemo(() => splitHeadlineIntoLines(headline), [headline]);
  const bodyParagraphs = useMemo(
    () => body.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean),
    [body],
  );
  const translationParagraphs = useMemo(
    () => (translation || '').split(/\n{2,}/).map((item) => item.trim()).filter(Boolean),
    [translation],
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="w-[340px] max-w-full overflow-hidden rounded-[18px] border border-[rgba(160,140,120,0.08)]"
      style={{
        backgroundColor: '#FAF8F4',
        backgroundImage: 'repeating-linear-gradient(transparent 31px, rgba(160,140,120,0.055) 31px, rgba(160,140,120,0.055) 32px)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.04), 0 8px 28px rgba(0,0,0,0.07)',
      }}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[rgba(160,140,120,0.1)] px-[18px] py-[14px] pr-[30px]">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
            style={{ backgroundColor: '#FEF0F2', color: '#C87880' }}
          >
            <Heart size={15} fill="currentColor" />
          </div>
          <div className="min-w-0">
            <div
              className="truncate text-[13px] font-semibold"
              style={{ color: '#1E1610', fontFamily: SERIF_FONT }}
            >
              对方的心声
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: '#B0A090' }}>
              倾听道具 · 刚刚
            </div>
          </div>
        </div>
        <div
          className="mr-2 shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium"
          style={{
            backgroundColor: '#FEF0F2',
            color: '#C87880',
            borderColor: 'rgba(200,120,128,0.18)',
          }}
        >
          已解锁
        </div>
      </header>

      <div className="px-[22px] pb-5 pt-6">
        <div className="space-y-0.5">
          {headlineLines.map((line, index) => (
            <motion.div
              key={`${line}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.15 + index * 0.15, ease: 'easeOut' }}
              className="text-[21px] font-semibold leading-[1.5]"
              style={{ color: index === headlineLines.length - 1 ? '#C87880' : '#1E1610', fontFamily: SERIF_FONT }}
            >
              {index === headlineLines.length - 1 ? <em className="not-italic">{line}</em> : line}
            </motion.div>
          ))}
        </div>

        <div className="mt-[14px] space-y-3">
          {bodyParagraphs.map((paragraph, index) => (
            <motion.p
              key={`${paragraph}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.3 + index * 0.15, ease: 'easeOut' }}
              className="whitespace-pre-wrap break-words text-[13px] font-light leading-[1.95]"
              style={{ color: '#7A6A5A', fontFamily: SERIF_FONT }}
            >
              {paragraph}
            </motion.p>
          ))}
        </div>

        {translationParagraphs.length > 0 ? (
          <div className="mt-4 border-t border-[rgba(160,140,120,0.1)] pt-4">
            <div
              className="mb-2 text-[11px] font-medium tracking-[0.12em]"
              style={{ color: '#B0A090', fontFamily: SERIF_FONT }}
            >
              中文翻译
            </div>
            <div className="space-y-3">
              {translationParagraphs.map((paragraph, index) => (
                <motion.p
                  key={`${paragraph}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, delay: 0.36 + index * 0.12, ease: 'easeOut' }}
                  className="whitespace-pre-wrap break-words text-[12px] font-light leading-[1.9]"
                  style={{ color: '#938275', fontFamily: SERIF_FONT }}
                >
                  {paragraph}
                </motion.p>
              ))}
            </div>
          </div>
        ) : null}

        {ps ? (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.45 + bodyParagraphs.length * 0.15, ease: 'easeOut' }}
            className="mt-3 text-[12px] italic"
            style={{ color: '#C0B0A0', fontFamily: SERIF_FONT }}
          >
            P.S. {ps}
          </motion.p>
        ) : null}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-[rgba(160,140,120,0.1)] px-5 pb-[17px] pt-[13px]">
        <div
          className="min-w-0 truncate text-[11px]"
          style={{ color: '#B0A090', fontFamily: SERIF_FONT }}
        >
          — {characterName} · {date}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            className="inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[11px] transition-transform active:scale-95"
            style={{
              backgroundColor: isSaved ? '#FEF0F2' : 'transparent',
              color: isSaved ? '#C87880' : '#8E7C6E',
              borderColor: isSaved ? 'rgba(200,120,128,0.18)' : 'rgba(160,140,120,0.25)',
            }}
          >
            <Star size={12} fill={isSaved ? 'currentColor' : 'none'} />
            <span>{isSaved ? '已收藏' : '收藏'}</span>
          </button>
          {showShareButton ? (
            <button
              type="button"
              onClick={onShare}
              aria-label="??????"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full border transition-transform active:scale-95"
              style={{
                color: '#8E7C6E',
                borderColor: 'rgba(160,140,120,0.25)',
              }}
            >
              <Share2 size={13} />
            </button>
          ) : null}
        </div>
      </footer>
    </motion.article>
  );
}
