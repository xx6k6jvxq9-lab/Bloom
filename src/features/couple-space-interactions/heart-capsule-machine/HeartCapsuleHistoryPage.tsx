import * as React from 'react';
import type { HeartCapsuleMachineHistoryEntry } from '../../../types';
import { HEART_CAPSULE_POOL } from './heartCapsulePool';

type Props = {
  history: HeartCapsuleMachineHistoryEntry[];
  onBackToMachine: () => void;
  onClose: () => void;
  onOpenEntry: (entryId: string) => void;
};

function getCategoryLabel(category: HeartCapsuleMachineHistoryEntry['capsuleCategory']) {
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

function getEntryPreview(entry: HeartCapsuleMachineHistoryEntry) {
  const capsule = HEART_CAPSULE_POOL.find((item) => item.id === entry.capsuleId);

  if (!capsule) {
    return {
      primary: entry.summary,
      secondary: entry.selectedQuestion ?? '',
    };
  }

  if (capsule.category === 'truth_variant') {
    return {
      primary: capsule.summary,
      secondary: entry.selectedQuestion ?? '',
    };
  }

  if (capsule.category === 'relationship_shift') {
    return {
      primary: capsule.relationshipTitle,
      secondary: capsule.summary,
    };
  }

  return {
    primary: capsule.summary,
    secondary: entry.selectedQuestion ?? '',
  };
}

export function HeartCapsuleHistoryPage({ history, onBackToMachine, onClose, onOpenEntry }: Props) {
  return (
    <div className="no-scrollbar h-full overflow-y-auto space-y-4 px-4 pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] pt-2">
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

      <div className="space-y-3">
        {history.length === 0 && (
          <div className="rounded-[28px] border border-white/80 bg-white/80 px-5 py-8 text-center text-sm leading-7 text-zinc-400 shadow-sm">
            这里会慢慢收下你们每天扭出来的心动扭蛋。
          </div>
        )}

        {history.map((entry) => {
          const preview = getEntryPreview(entry);

          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onOpenEntry(entry.id)}
              className="block w-full rounded-[28px] border border-white/80 bg-white/82 px-5 py-4 text-left shadow-[0_18px_50px_rgba(255,190,210,0.18)] backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium tracking-[0.16em] text-rose-300">{entry.date}</div>
                  <div className="mt-1 text-lg font-bold text-zinc-800">{entry.capsuleName}</div>
                </div>
                <div className="rounded-full bg-pink-50 px-3 py-1 text-xs font-medium text-pink-500">
                  {entry.drawnBy === 'self' ? '我来扭' : '让 TA 扭'}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-400">
                  {getCategoryLabel(entry.capsuleCategory)}
                </span>
                {entry.roundCompletedAt && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-500">
                    本轮已完成
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm leading-7 text-zinc-500">{preview.primary}</p>

              {preview.secondary && (
                <div className="mt-3 rounded-2xl border border-rose-100 bg-white/80 px-3 py-3 text-sm leading-7 text-zinc-500">
                  {preview.secondary}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
