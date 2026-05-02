import React from 'react';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import type { ForumSpectatorSettings } from '../../../types';
import { getSpectatorWorldShellMeta, resolveSpectatorWorldShell } from '../../../features/forum-domain/spectatorWorldShells';
import { normalizeSpectatorTargetCharacters, normalizeSpectatorUserSlot, resolveSpectatorAngles, SPECTATOR_ANGLE_OPTIONS } from '../../../features/forum-domain/spectatorBoard';
import { buildSpectatorObjectSemantics } from '../../../services/forum/spectatorSettingsManager';

type ForumHomeHeaderProps = {
  forumBoard: 'public' | 'spectator';
  publicLabel: string;
  publicFilterLabel: string;
  publicBlurb: string;
  spectatorSettings: ForumSpectatorSettings;
  spectatorCharacters: Array<{ id: string; name: string }>;
  currentUserName: string;
  feedRefreshLoading: boolean;
  forumConfigEnabled: boolean;
  onClose: () => void;
  onSwitchBoard: (board: 'public' | 'spectator') => void;
  onRefresh: () => void;
  onOpenFilter: () => void;
  onOpenBrowseFilter: () => void;
  onOpenSpectatorSettings: () => void;
  topInsetStyle?: React.CSSProperties;
};

export function ForumHomeHeader({
  forumBoard,
  publicLabel,
  publicFilterLabel,
  publicBlurb,
  spectatorSettings,
  spectatorCharacters,
  currentUserName,
  feedRefreshLoading,
  forumConfigEnabled,
  onClose,
  onSwitchBoard,
  onRefresh,
  onOpenFilter,
  onOpenBrowseFilter,
  onOpenSpectatorSettings,
  topInsetStyle,
}: ForumHomeHeaderProps) {
  const spectatorShellMeta = getSpectatorWorldShellMeta(resolveSpectatorWorldShell(spectatorSettings.worldShell));
  const spectatorAngles = resolveSpectatorAngles(spectatorSettings);
  const primaryAngleLabel = SPECTATOR_ANGLE_OPTIONS.find((item) => item.id === spectatorAngles[0])?.label;
  const spectatorUserSlot = normalizeSpectatorUserSlot(spectatorSettings);
  const objectSemantics = buildSpectatorObjectSemantics({
    currentUserName,
    characters: spectatorCharacters,
    targets: normalizeSpectatorTargetCharacters(spectatorSettings),
    userSlotMode: spectatorUserSlot.mode,
    objectMode: spectatorSettings.objectMode,
  });
  const spectatorSummaryText = objectSemantics.targetLabel
    ? `${objectSemantics.targetLabel}${spectatorSettings.relationshipSummary ? ` / ${spectatorSettings.relationshipSummary}` : ''}`
    : spectatorSettings.subjectName
      ? `${spectatorSettings.subjectName}${spectatorSettings.relationshipSummary ? ` / ${spectatorSettings.relationshipSummary}` : ''}`
      : '先去开一栋楼，或者直接点随机生成。';

  return (
    <div className="sticky top-0 z-10 border-b border-zinc-100 bg-white/90 backdrop-blur-md" style={topInsetStyle}>
      <div className="flex items-center justify-between px-4">
        <button onClick={onClose} className="-ml-2 rounded-full p-2 transition-colors hover:bg-zinc-100">
          <ChevronLeft size={24} className="text-zinc-900" />
        </button>
        <div className="flex gap-6 text-[14px] font-bold">
          <button
            onClick={() => onSwitchBoard('public')}
            className={`relative pb-3 transition-all ${forumBoard === 'public' ? 'text-sky-700' : 'text-zinc-500'}`}
          >
            众声
            {forumBoard === 'public' && <div className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-sky-400" />}
          </button>
          <button
            onClick={() => onSwitchBoard('spectator')}
            className={`relative pb-3 transition-all ${forumBoard === 'spectator' ? 'text-rose-700' : 'text-zinc-500'}`}
          >
            镜间
            {forumBoard === 'spectator' && <div className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-rose-300" />}
          </button>
        </div>
        <button
          onClick={onRefresh}
          disabled={feedRefreshLoading}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            feedRefreshLoading
              ? 'text-zinc-300'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
          title={forumBoard === 'spectator' ? '生成镜间帖子' : forumConfigEnabled ? '开一轮新楼' : '当前论坛 AI 未启用'}
        >
          <RefreshCw size={18} className={feedRefreshLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-4 pb-3">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {forumBoard === 'public' ? (
                  <>
                    <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                      {publicLabel}
                    </span>
                    <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                      {publicFilterLabel}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                      {spectatorShellMeta.label}
                    </span>
                    <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                      {spectatorSettings.tone || '未设置'}
                    </span>
                    {primaryAngleLabel && (
                      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                        {primaryAngleLabel}
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="mt-2 text-[12px] text-zinc-500">
                {forumBoard === 'public'
                  ? publicBlurb
                  : spectatorSettings.subjectName
                    ? `${spectatorSettings.subjectName}${spectatorSettings.relationshipSummary ? ` / ${spectatorSettings.relationshipSummary}` : ''}`
                    : '先去开一栋楼，或者直接点随机生成。'}
              </div>
            </div>

            {forumBoard === 'public' ? (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenBrowseFilter}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  筛选
                </button>
                <button
                  type="button"
                  onClick={onOpenFilter}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  开楼
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenSpectatorSettings}
                className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                开楼
              </button>
            )}
          </div>

          {feedRefreshLoading && (
            <div className="mt-2 text-[12px] text-zinc-500">
              {forumBoard === 'public' ? '正在开一轮新楼...' : '正在生成镜间帖子...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
