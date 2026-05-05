import * as React from 'react';
import { ChevronLeft } from 'lucide-react';
import type {
  ApiConfig,
  Character,
  ChatHistory,
  CoupleSpaceData,
  HeartCapsuleMachineHistoryEntry,
  HeartCapsuleTodayDraw,
  UserProfileExtended,
} from '../../../types';
import { generateRelationshipShiftReply } from './generateRelationshipShiftReply';
import type { RelationshipShiftCapsule } from './types';

type Props = {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatHistory: ChatHistory;
  activeConfig?: ApiConfig;
  draw: HeartCapsuleTodayDraw | HeartCapsuleMachineHistoryEntry;
  capsule: RelationshipShiftCapsule;
  updateSpace: (updater: (prev: CoupleSpaceData) => CoupleSpaceData) => void;
  onBackToResult: () => void;
};

const DEFAULT_OPENING_FALLBACK = '他今天一开口，气氛就已经和平时不一样了。';
const DEFAULT_ERROR_TEXT = '未知错误';
const INPUT_PLACEHOLDER_SELF = '按照这一轮落到你这边的玩法，先把这句话递给他。';
const INPUT_PLACEHOLDER_PARTNER = '顺着他刚刚先抛过来的这颗球，按你这边的玩法接回去。';

export function HeartCapsuleRelationshipShiftRoundPage({
  user,
  partner,
  coupleSpace,
  chatHistory,
  activeConfig,
  draw,
  capsule,
  updateSpace,
  onBackToResult,
}: Props) {
  const getDisplayError = React.useCallback(
    (err: unknown) => (err instanceof Error ? err.message : String(err || DEFAULT_ERROR_TEXT)),
    [],
  );

  const isPartnerDraw = draw.drawnBy === 'partner';
  const [draft, setDraft] = React.useState('');
  const [submitted, setSubmitted] = React.useState<string | null>(draw.userAnswer ?? null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [replyText, setReplyText] = React.useState(draw.resultReply ?? '');
  const [openingText, setOpeningText] = React.useState(draw.openingText ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const hasCompletedRound = Boolean(draw.roundCompletedAt);
  const hasRequestedOpeningRef = React.useRef(false);

  React.useEffect(() => {
    if (
      !isPartnerDraw ||
      hasRequestedOpeningRef.current ||
      hasCompletedRound ||
      Boolean(draw.openingText)
    ) {
      return;
    }

    hasRequestedOpeningRef.current = true;
    setIsGenerating(true);
    setError(null);

    void generateRelationshipShiftReply({
      activeConfig,
      user,
      partner,
      coupleSpace,
      chatHistory,
      capsule,
      mode: 'partner_opening',
    })
      .then((reply) => {
        setOpeningText(reply || DEFAULT_OPENING_FALLBACK);
      })
      .catch((err) => {
        setError(getDisplayError(err));
      })
      .finally(() => {
        setIsGenerating(false);
      });
  }, [
    activeConfig,
    capsule,
    chatHistory,
    coupleSpace,
    draw.openingText,
    hasCompletedRound,
    isPartnerDraw,
    partner,
    user,
    getDisplayError,
  ]);

  const canSubmit =
    draft.trim().length > 0 &&
    !isGenerating &&
    !hasCompletedRound &&
    (!isPartnerDraw || Boolean(openingText));

  const handleSubmit = React.useCallback(async () => {
    if (!draft.trim()) return;

    const answer = draft.trim();
    setSubmitted(answer);
    setIsGenerating(true);
    setReplyText('');
    setError(null);

    try {
      const reply = await generateRelationshipShiftReply({
        activeConfig,
        user,
        partner,
        coupleSpace,
        chatHistory,
        capsule,
        userInput: answer,
        mode: isPartnerDraw ? 'partner_result' : 'self',
      });

      const finalReply = reply?.trim();
      if (!finalReply) {
        throw new Error('模型返回了空内容，没有生成角色回应。');
      }

      const completedAt = Date.now();
      setReplyText(finalReply);

      updateSpace((prev) => {
        const machine = prev.heartCapsuleMachine ?? { todayDraw: null, history: [] };
        const updatedTodayDraw =
          machine.todayDraw?.id === draw.id
            ? {
                ...machine.todayDraw,
                openingText: isPartnerDraw ? openingText || DEFAULT_OPENING_FALLBACK : null,
                userAnswer: answer,
                resultReply: finalReply,
                roundCompletedAt: completedAt,
                revealedAt: completedAt,
              }
            : machine.todayDraw;

        const updatedHistory = (machine.history ?? []).map((entry) =>
          entry.id === draw.id
            ? {
                ...entry,
                openingText: isPartnerDraw ? openingText || DEFAULT_OPENING_FALLBACK : null,
                userAnswer: answer,
                resultReply: finalReply,
                roundCompletedAt: completedAt,
              }
            : entry,
        );

        return {
          ...prev,
          heartCapsuleMachine: {
            ...machine,
            todayDraw: updatedTodayDraw,
            history: updatedHistory,
          },
        };
      });
    } catch (err) {
      setError(getDisplayError(err));
    } finally {
      setIsGenerating(false);
    }
  }, [
    activeConfig,
    capsule,
    chatHistory,
    coupleSpace,
    draft,
    draw.id,
    hasCompletedRound,
    isPartnerDraw,
    openingText,
    partner,
    updateSpace,
    user,
    getDisplayError,
  ]);

  return (
    <div className="no-scrollbar h-full overflow-y-auto space-y-5 px-4 pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] pt-2">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToResult}
          className="inline-flex items-center gap-1 rounded-full bg-white/75 px-3 py-1.5 text-sm font-medium text-zinc-500 shadow-sm backdrop-blur-md"
        >
          <ChevronLeft size={16} />
          返回结果
        </button>

        <div className="rounded-full bg-white/75 px-3 py-1.5 text-sm font-medium text-pink-500 shadow-sm backdrop-blur-md">
          关系异变
        </div>
      </div>

      <div className="rounded-[34px] border border-white/80 bg-white/82 p-5 shadow-[0_22px_60px_rgba(255,192,212,0.22)] backdrop-blur-md">
        <div className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-medium tracking-[0.18em] text-rose-400">
          {capsule.name}
        </div>

        <div className="mt-5 rounded-[28px] border border-rose-100/80 bg-gradient-to-b from-rose-50/90 to-white/95 p-4">
          <div className="text-xs font-medium tracking-[0.2em] text-rose-300">今天这轮的关系</div>
          <div className="mt-2 text-lg font-bold text-zinc-800">{capsule.relationshipTitle}</div>
          <div className="mt-3 text-sm leading-6 text-zinc-500">{capsule.summary}</div>
          <div className="mt-4 rounded-[24px] border border-rose-100 bg-white/85 px-4 py-4 text-sm leading-7 text-zinc-600">
            {capsule.relationshipDescription}
          </div>
        </div>

        {isPartnerDraw && !submitted && (
          <div className="mt-5 rounded-[26px] border border-dashed border-rose-200/90 bg-rose-50/70 px-4 py-4">
            {isGenerating && !openingText ? (
              <div className="mt-1 h-16 animate-pulse rounded-[18px] bg-white/70" />
            ) : error && !openingText ? (
              <p className="mt-1 text-sm leading-7 text-rose-400">{error}</p>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-zinc-600">{openingText}</p>
            )}
          </div>
        )}

        {!submitted && !hasCompletedRound ? (
          <div className="mt-5 space-y-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={4}
              placeholder={isPartnerDraw ? INPUT_PLACEHOLDER_PARTNER : INPUT_PLACEHOLDER_SELF}
              className="w-full resize-none rounded-[24px] border border-white/90 bg-white/85 px-4 py-3 text-[15px] leading-7 text-zinc-700 shadow-sm outline-none placeholder:text-zinc-400 focus:border-rose-200"
            />
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="w-full rounded-full bg-[linear-gradient(90deg,#ff9fc0_0%,#ffb6cd_50%,#ffc7d9_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(255,170,197,0.32)] disabled:opacity-50"
            >
              {isPartnerDraw ? '接住这轮气氛' : '先这样接'}
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {isPartnerDraw && (
              <div className="rounded-[26px] border border-rose-100/80 bg-white/88 px-4 py-4 shadow-sm">
                <div className="text-xs font-medium tracking-[0.18em] text-rose-300">他刚刚先带出来的是</div>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-zinc-700">{openingText}</p>
              </div>
            )}

            <div className="rounded-[26px] border border-rose-100/80 bg-white/88 px-4 py-4 shadow-sm">
              <div className="text-xs font-medium tracking-[0.18em] text-rose-300">你刚刚接的是</div>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-zinc-700">
                {submitted ?? draw.userAnswer}
              </p>
            </div>

            <div className="rounded-[26px] border border-dashed border-rose-200/90 bg-rose-50/70 px-4 py-4">
              {isGenerating ? (
                <div className="h-16 animate-pulse rounded-[18px] bg-white/70" />
              ) : error ? (
                <p className="text-sm leading-7 text-rose-400">{error}</p>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-600">
                  {replyText || draw.resultReply}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onBackToResult}
              className="w-full rounded-full bg-white/90 px-4 py-3 text-sm font-medium text-zinc-500 shadow-sm"
            >
              先回到结果页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
