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
import { generateTruthVariantReply } from './generateTruthVariantReply';
import type { TruthVariantCapsule } from './types';

type Props = {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatHistory: ChatHistory;
  activeConfig?: ApiConfig;
  draw: HeartCapsuleTodayDraw | HeartCapsuleMachineHistoryEntry;
  capsule: TruthVariantCapsule;
  updateSpace: (updater: (prev: CoupleSpaceData) => CoupleSpaceData) => void;
  onBackToResult: () => void;
};

const DEFAULT_HIDDEN_THOUGHT = '他嘴上收着，心里其实已经把答案想得更满了。';
const DEFAULT_OPENING_FALLBACK = '他像是早就想好这句了，还是先把问题递到了你面前。';
const DEFAULT_ERROR_TEXT = '未知错误';
const INPUT_PLACEHOLDER = '先按这一轮的方式，把这句话回给他。';

export function HeartCapsuleTruthVariantRoundPage({
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
  const [hiddenThought, setHiddenThought] = React.useState(draw.hiddenThought ?? '');
  const [isHiddenThoughtOpen, setIsHiddenThoughtOpen] = React.useState(false);
  const [openingText, setOpeningText] = React.useState(draw.openingText ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const hasCompletedRound = Boolean(draw.roundCompletedAt);
  const hasRequestedOpeningRef = React.useRef(false);

  React.useEffect(() => {
    if (
      !isPartnerDraw ||
      !draw.selectedQuestion ||
      hasRequestedOpeningRef.current ||
      hasCompletedRound ||
      Boolean(draw.openingText)
    ) {
      return;
    }

    hasRequestedOpeningRef.current = true;
    setIsGenerating(true);
    setError(null);

    void generateTruthVariantReply({
      activeConfig,
      user,
      partner,
      coupleSpace,
      chatHistory,
      capsule,
      question: draw.selectedQuestion,
      mode: 'partner_opening',
    })
      .then((result) => {
        setOpeningText(result.visibleReply || DEFAULT_OPENING_FALLBACK);
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
    draw.selectedQuestion,
    hasCompletedRound,
    isPartnerDraw,
    partner,
    user,
  ]);

  const canSubmit =
    draft.trim().length > 0 &&
    !isGenerating &&
    !hasCompletedRound &&
    (!isPartnerDraw || Boolean(openingText));

  const handleSubmit = React.useCallback(async () => {
    if (!draft.trim() || !draw.selectedQuestion) return;

    const answer = draft.trim();
    setSubmitted(answer);
    setIsGenerating(true);
    setReplyText('');
    setHiddenThought('');
    setIsHiddenThoughtOpen(false);
    setError(null);

    try {
      const result = await generateTruthVariantReply({
        activeConfig,
        user,
        partner,
        coupleSpace,
        chatHistory,
        capsule,
        question: draw.selectedQuestion,
        userAnswer: answer,
        mode: isPartnerDraw ? 'partner_result' : 'self',
      });

      const finalReply = result.visibleReply?.trim();
      if (!finalReply) {
        throw new Error('模型返回了空内容，没有生成角色回应。');
      }
      const finalHiddenThought =
        result.mode === 'partner_opening'
          ? ''
          : result.hiddenThought || DEFAULT_HIDDEN_THOUGHT;
      const completedAt = Date.now();

      setReplyText(finalReply);
      setHiddenThought(finalHiddenThought);

      updateSpace((prev) => {
        const machine = prev.heartCapsuleMachine ?? { todayDraw: null, history: [] };
        const updatedTodayDraw =
          machine.todayDraw?.id === draw.id
            ? {
                ...machine.todayDraw,
                openingText: isPartnerDraw ? openingText || DEFAULT_OPENING_FALLBACK : null,
                userAnswer: answer,
                resultReply: finalReply,
                hiddenThought: finalHiddenThought,
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
                hiddenThought: finalHiddenThought,
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
    draw.selectedQuestion,
    isPartnerDraw,
    openingText,
    partner,
    updateSpace,
    user,
    getDisplayError,
  ]);

  const currentVisibleReply = replyText || draw.resultReply;
  const currentHiddenThought = hiddenThought || draw.hiddenThought;

  return (
    <div className="no-scrollbar h-full overflow-y-auto space-y-5 px-4 pb-24 pt-2">
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
          真心话变体
        </div>
      </div>

      <div className="rounded-[34px] border border-white/80 bg-white/82 p-5 shadow-[0_22px_60px_rgba(255,192,212,0.22)] backdrop-blur-md">
        <div className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-medium tracking-[0.18em] text-rose-400">
          {capsule.name}
        </div>

        <div className="mt-5 rounded-[28px] border border-rose-100/80 bg-gradient-to-b from-rose-50/90 to-white/95 p-4">
          <div className="text-xs font-medium tracking-[0.2em] text-rose-300">这一轮的状态</div>
          <div className="mt-2 text-lg font-bold text-zinc-800">{capsule.summary}</div>

          {draw.selectedQuestion && (
            <div className="mt-4 rounded-[24px] border border-rose-100 bg-white/85 px-4 py-4">
              <div className="text-xs font-medium tracking-[0.2em] text-rose-300">这句先落到你这里</div>
              <div className="mt-2 text-base font-medium leading-7 text-zinc-700">
                {draw.selectedQuestion}
              </div>
              <div className="mt-3 text-sm leading-6 text-zinc-500">{capsule.feeling}</div>
            </div>
          )}
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
              placeholder={INPUT_PLACEHOLDER}
              className="w-full resize-none rounded-[24px] border border-white/90 bg-white/85 px-4 py-3 text-[15px] leading-7 text-zinc-700 shadow-sm outline-none placeholder:text-zinc-400 focus:border-rose-200"
            />
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="w-full rounded-full bg-[linear-gradient(90deg,#ff9fc0_0%,#ffb6cd_50%,#ffc7d9_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(255,170,197,0.32)] disabled:opacity-50"
            >
              {isPartnerDraw ? '接住这句' : '先这样说'}
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {isPartnerDraw && (
              <div className="rounded-[26px] border border-rose-100/80 bg-white/88 px-4 py-4 shadow-sm">
                <div className="text-xs font-medium tracking-[0.18em] text-rose-300">他刚刚先说的是</div>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-zinc-700">{openingText}</p>
              </div>
            )}

            <div className="rounded-[26px] border border-rose-100/80 bg-white/88 px-4 py-4 shadow-sm">
              <div className="text-xs font-medium tracking-[0.18em] text-rose-300">你刚刚回的是</div>
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
                  {currentVisibleReply}
                </p>
              )}
            </div>

            {Boolean(currentHiddenThought) && (
              <button
                type="button"
                onClick={() => setIsHiddenThoughtOpen((prev) => !prev)}
                className="w-full rounded-[26px] border border-rose-100/80 bg-white/88 px-4 py-4 text-left shadow-sm transition hover:bg-rose-50/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium tracking-[0.18em] text-rose-300">他真实想的是</div>
                  <div className="text-xs text-zinc-400">
                    {isHiddenThoughtOpen ? '点击收起' : '点击查看'}
                  </div>
                </div>

                {isHiddenThoughtOpen ? (
                  <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-zinc-700">
                    {currentHiddenThought}
                  </p>
                ) : (
                  <p className="mt-2 text-sm leading-7 text-zinc-400">点开看看他没直接说出口的那层想法。</p>
                )}
              </button>
            )}

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
