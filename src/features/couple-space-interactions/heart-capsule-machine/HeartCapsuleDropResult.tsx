import * as React from 'react';
import type {
  HeartCapsuleMachineHistoryEntry,
  HeartCapsuleTodayDraw,
} from '../../../types';
import type { HeartCapsule } from './types';

type Props = {
  draw: HeartCapsuleTodayDraw | HeartCapsuleMachineHistoryEntry;
  capsule: HeartCapsule;
  onBackToMachine: () => void;
  onClose: () => void;
  onStartRound?: () => void;
};

function getCategoryLabel(category: HeartCapsule['category']) {
  switch (category) {
    case 'relationship_shift':
      return '关系异变';
    case 'async_dual_rule':
      return '双人不同步';
    case 'truth_variant':
      return '真心话变体';
    default:
      return '心动扭蛋';
  }
}

function getDrawnByLabel(drawnBy: HeartCapsuleTodayDraw['drawnBy']) {
  return drawnBy === 'self' ? '我来扭' : '让 TA 扭';
}

export function HeartCapsuleDropResult({
  draw,
  capsule,
  onBackToMachine,
  onClose,
  onStartRound,
}: Props) {
  const hasCompletedRound = Boolean(draw.roundCompletedAt);
  const hasInProgressRound = Boolean(draw.openingText || draw.userAnswer || draw.resultReply);

  return (
    <div className="space-y-5 px-4 pb-24 pt-2">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center rounded-full bg-white/75 px-3 py-1.5 text-sm font-medium text-zinc-500 shadow-sm backdrop-blur-md"
        >
          返回互动
        </button>

        <button
          type="button"
          onClick={onBackToMachine}
          className="inline-flex items-center rounded-full bg-white/75 px-3 py-1.5 text-sm font-medium text-zinc-500 shadow-sm backdrop-blur-md"
        >
          返回扭蛋机
        </button>
      </div>

      <div className="rounded-[34px] border border-white/80 bg-white/82 p-5 shadow-[0_22px_60px_rgba(255,192,212,0.22)] backdrop-blur-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-medium tracking-[0.18em] text-rose-400">
              {getCategoryLabel(capsule.category)}
            </div>
            <h2 className="mt-3 text-[28px] font-black tracking-tight text-zinc-800">{capsule.name}</h2>
          </div>
          <div className="rounded-full bg-pink-50 px-3 py-1 text-xs font-medium text-pink-500">
            {getDrawnByLabel(draw.drawnBy)}
          </div>
        </div>

        <div className="mt-5 rounded-[28px] border border-rose-100/80 bg-gradient-to-b from-rose-50/90 to-white/95 p-4">
          {capsule.category === 'relationship_shift' && (
            <>
              <div className="text-xs font-medium tracking-[0.2em] text-rose-300">这一轮的关系</div>
              <div className="mt-2 text-lg font-bold text-zinc-800">{capsule.relationshipTitle}</div>
              <p className="mt-2 text-sm leading-7 text-zinc-500">{capsule.summary}</p>
            </>
          )}

          {capsule.category === 'async_dual_rule' && (
            <>
              <div className="text-xs font-medium tracking-[0.2em] text-rose-300">你先知道的是</div>
              <div className="mt-2 text-lg font-bold text-zinc-800">{capsule.summary}</div>
              {draw.selectedQuestion && (
                <div className="mt-4 rounded-[24px] border border-rose-100 bg-white/85 px-4 py-4 text-sm leading-7 text-zinc-600">
                  {draw.selectedQuestion}
                </div>
              )}
            </>
          )}

          {capsule.category === 'truth_variant' && (
            <>
              <div className="text-xs font-medium tracking-[0.2em] text-rose-300">这一轮的状态</div>
              <div className="mt-2 text-lg font-bold text-zinc-800">{capsule.summary}</div>
              {draw.selectedQuestion && (
                <div className="mt-4 rounded-[24px] border border-rose-100 bg-white/85 px-4 py-4">
                  <div className="text-xs font-medium tracking-[0.2em] text-rose-300">今天的问题</div>
                  <div className="mt-2 text-base font-medium leading-7 text-zinc-700">
                    {draw.selectedQuestion}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {onStartRound && (
          <button
            type="button"
            onClick={onStartRound}
            className="mt-5 w-full rounded-full bg-[linear-gradient(90deg,#ff9fc0_0%,#ffb6cd_50%,#ffc7d9_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(255,170,197,0.32)]"
          >
            {hasCompletedRound ? '查看这一轮' : hasInProgressRound ? '继续这一轮' : '开始这一轮'}
          </button>
        )}
      </div>
    </div>
  );
}
