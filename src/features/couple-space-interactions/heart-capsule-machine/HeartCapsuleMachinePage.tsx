import * as React from 'react';
import { ChevronLeft, History } from 'lucide-react';
import type {
  ApiConfig,
  Character,
  ChatHistory,
  CoupleSpaceData,
  HeartCapsuleMachineHistoryEntry,
  UserProfileExtended,
} from '../../../types';
import { HEART_CAPSULE_POOL } from './heartCapsulePool';
import { HeartCapsuleDropResult } from './HeartCapsuleDropResult';
import { HeartCapsuleAsyncDualRuleRoundPage } from './HeartCapsuleAsyncDualRuleRoundPage';
import { HeartCapsuleHistoryPage } from './HeartCapsuleHistoryPage';
import { HeartCapsuleMachine } from './HeartCapsuleMachine';
import { HeartCapsuleRelationshipShiftRoundPage } from './HeartCapsuleRelationshipShiftRoundPage';
import { HeartCapsuleTruthVariantRoundPage } from './HeartCapsuleTruthVariantRoundPage';
import { pickDailyHeartCapsule } from './pickDailyHeartCapsule';
import type {
  AsyncDualRuleCapsule,
  HeartCapsule,
  RelationshipShiftCapsule,
  TruthVariantCapsule,
} from './types';

type Props = {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatHistory: ChatHistory;
  activeConfig?: ApiConfig;
  updateSpace: (updater: any) => void;
  onBack: () => void;
};

type PageState =
  | 'machine'
  | 'result'
  | 'history'
  | 'truth_variant_round'
  | 'relationship_shift_round'
  | 'async_dual_rule_round'
  | 'history_detail';

const CAPSULE_PALETTES = [
  { top: '#ffd9ea', bottom: '#ffc7dd', rim: 'rgba(255,255,255,0.88)' },
  { top: '#d9f1ff', bottom: '#bfe5ff', rim: 'rgba(255,255,255,0.88)' },
  { top: '#fff1b8', bottom: '#ffe28b', rim: 'rgba(255,255,255,0.88)' },
  { top: '#e7dcff', bottom: '#d4c4ff', rim: 'rgba(255,255,255,0.88)' },
  { top: '#dff8e8', bottom: '#bff1d2', rim: 'rgba(255,255,255,0.88)' },
];

function getTodayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCapsuleById(id: string | null | undefined) {
  if (!id) return null;
  return HEART_CAPSULE_POOL.find((capsule) => capsule.id === id) ?? null;
}

function getCapsulePalette(capsule: HeartCapsule | null) {
  if (!capsule) return CAPSULE_PALETTES[0];
  const total = capsule.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return CAPSULE_PALETTES[total % CAPSULE_PALETTES.length];
}

export function HeartCapsuleMachinePage({
  user,
  partner,
  coupleSpace,
  chatHistory,
  activeConfig,
  updateSpace,
  onBack,
}: Props) {
  const [pageState, setPageState] = React.useState<PageState>('machine');
  const [isTurning, setIsTurning] = React.useState(false);
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = React.useState<string | null>(null);
  const todayKey = React.useMemo(() => getTodayKey(), []);
  const machineState = coupleSpace.heartCapsuleMachine ?? { todayDraw: null, history: [] };
  const todayDraw = machineState.todayDraw?.date === todayKey ? machineState.todayDraw : null;
  const currentCapsule = React.useMemo(
    () => getCapsuleById(todayDraw?.capsuleId),
    [todayDraw?.capsuleId],
  );
  const eggPalette = React.useMemo(() => getCapsulePalette(currentCapsule), [currentCapsule]);

  const selectedHistoryEntry = React.useMemo(
    () => (machineState.history ?? []).find((entry) => entry.id === selectedHistoryEntryId) ?? null,
    [machineState.history, selectedHistoryEntryId],
  );
  const selectedHistoryCapsule = React.useMemo(
    () => getCapsuleById(selectedHistoryEntry?.capsuleId),
    [selectedHistoryEntry?.capsuleId],
  );

  const handleDraw = React.useCallback(
    (drawnBy: 'self' | 'partner') => {
      if (isTurning) return;

      setIsTurning(true);
      window.setTimeout(() => {
        const history = machineState.history ?? [];
        const { draw } = pickDailyHeartCapsule({
          date: todayKey,
          drawnBy,
          history,
        });

        updateSpace((prev: CoupleSpaceData) => {
          const prevMachine = prev.heartCapsuleMachine ?? { todayDraw: null, history: [] };
          return {
            ...prev,
            heartCapsuleMachine: {
              todayDraw: draw,
              history: [draw, ...(prevMachine.history ?? [])].slice(0, 60),
            },
          };
        });

        setIsTurning(false);
        setPageState('result');
      }, 900);
    },
    [isTurning, machineState.history, todayKey, updateSpace],
  );

  const openHistoryEntry = React.useCallback((entryId: string) => {
    setSelectedHistoryEntryId(entryId);
    setPageState('history_detail');
  }, []);

  if (pageState === 'history') {
    return (
      <HeartCapsuleHistoryPage
        history={machineState.history ?? []}
        onBackToMachine={() => setPageState('machine')}
        onClose={onBack}
        onOpenEntry={openHistoryEntry}
      />
    );
  }

  if (
    pageState === 'history_detail' &&
    selectedHistoryEntry &&
    selectedHistoryCapsule &&
    selectedHistoryCapsule.category === 'truth_variant'
  ) {
    return (
      <HeartCapsuleTruthVariantRoundPage
        key={selectedHistoryEntry.id}
        user={user}
        partner={partner}
        coupleSpace={coupleSpace}
        chatHistory={chatHistory}
        activeConfig={activeConfig}
        draw={selectedHistoryEntry as any}
        capsule={selectedHistoryCapsule as TruthVariantCapsule}
        updateSpace={updateSpace}
        onBackToResult={() => setPageState('history')}
      />
    );
  }

  if (
    pageState === 'history_detail' &&
    selectedHistoryEntry &&
    selectedHistoryCapsule &&
    selectedHistoryCapsule.category === 'relationship_shift'
  ) {
    return (
      <HeartCapsuleRelationshipShiftRoundPage
        key={selectedHistoryEntry.id}
        user={user}
        partner={partner}
        coupleSpace={coupleSpace}
        chatHistory={chatHistory}
        activeConfig={activeConfig}
        draw={selectedHistoryEntry}
        capsule={selectedHistoryCapsule as RelationshipShiftCapsule}
        updateSpace={updateSpace}
        onBackToResult={() => setPageState('history')}
      />
    );
  }

  if (
    pageState === 'history_detail' &&
    selectedHistoryEntry &&
    selectedHistoryCapsule &&
    selectedHistoryCapsule.category === 'async_dual_rule'
  ) {
    return (
      <HeartCapsuleAsyncDualRuleRoundPage
        key={selectedHistoryEntry.id}
        user={user}
        partner={partner}
        coupleSpace={coupleSpace}
        chatHistory={chatHistory}
        activeConfig={activeConfig}
        draw={selectedHistoryEntry}
        capsule={selectedHistoryCapsule as AsyncDualRuleCapsule}
        updateSpace={updateSpace}
        onBackToResult={() => setPageState('history')}
      />
    );
  }

  if (pageState === 'history_detail' && selectedHistoryEntry && selectedHistoryCapsule) {
    return (
      <HeartCapsuleDropResult
        key={selectedHistoryEntry.id}
        draw={selectedHistoryEntry}
        capsule={selectedHistoryCapsule}
        onBackToMachine={() => setPageState('history')}
        onClose={onBack}
      />
    );
  }

  if (
    pageState === 'truth_variant_round' &&
    todayDraw &&
    currentCapsule &&
    currentCapsule.category === 'truth_variant'
  ) {
    return (
      <HeartCapsuleTruthVariantRoundPage
        key={todayDraw.id}
        user={user}
        partner={partner}
        coupleSpace={coupleSpace}
        chatHistory={chatHistory}
        activeConfig={activeConfig}
        draw={todayDraw}
        capsule={currentCapsule as TruthVariantCapsule}
        updateSpace={updateSpace}
        onBackToResult={() => setPageState('result')}
      />
    );
  }

  if (
    pageState === 'relationship_shift_round' &&
    todayDraw &&
    currentCapsule &&
    currentCapsule.category === 'relationship_shift'
  ) {
    return (
      <HeartCapsuleRelationshipShiftRoundPage
        key={todayDraw.id}
        user={user}
        partner={partner}
        coupleSpace={coupleSpace}
        chatHistory={chatHistory}
        activeConfig={activeConfig}
        draw={todayDraw}
        capsule={currentCapsule as RelationshipShiftCapsule}
        updateSpace={updateSpace}
        onBackToResult={() => setPageState('result')}
      />
    );
  }

  if (
    pageState === 'async_dual_rule_round' &&
    todayDraw &&
    currentCapsule &&
    currentCapsule.category === 'async_dual_rule'
  ) {
    return (
      <HeartCapsuleAsyncDualRuleRoundPage
        key={todayDraw.id}
        user={user}
        partner={partner}
        coupleSpace={coupleSpace}
        chatHistory={chatHistory}
        activeConfig={activeConfig}
        draw={todayDraw}
        capsule={currentCapsule as AsyncDualRuleCapsule}
        updateSpace={updateSpace}
        onBackToResult={() => setPageState('result')}
      />
    );
  }

  if (pageState === 'result' && todayDraw && currentCapsule) {
    return (
      <HeartCapsuleDropResult
        key={todayDraw.id}
        draw={todayDraw}
        capsule={currentCapsule}
        onBackToMachine={() => setPageState('machine')}
        onClose={onBack}
        onStartRound={
          currentCapsule.category === 'truth_variant'
            ? () => setPageState('truth_variant_round')
            : currentCapsule.category === 'relationship_shift'
              ? () => setPageState('relationship_shift_round')
              : currentCapsule.category === 'async_dual_rule'
                ? () => setPageState('async_dual_rule_round')
              : undefined
        }
      />
    );
  }

  return (
    <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-18 pt-2">
      <div className="mb-3 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-full bg-white/72 px-3 py-1.5 text-sm font-medium text-zinc-500 shadow-sm backdrop-blur-md"
        >
          <ChevronLeft size={16} />
          返回互动
        </button>

        <button
          type="button"
          onClick={() => setPageState('history')}
          className="inline-flex items-center gap-2 rounded-full bg-white/72 px-3 py-1.5 text-sm font-medium text-zinc-500 shadow-sm backdrop-blur-md"
        >
          <History size={15} />
          扭蛋记录
        </button>
      </div>

      <div className="space-y-5 text-center">
        <div className="flex justify-center">
          <div className="inline-flex h-10 items-center justify-center rounded-full border-[3px] border-rose-200/90 bg-[linear-gradient(90deg,#ffd7e6_0%,#fff2bf_26%,#dbf4ff_54%,#eedfff_78%,#ffd7e6_100%)] px-6 shadow-[0_12px_24px_rgba(255,174,198,0.32)]">
            <div className="rounded-full bg-white/78 px-5 py-1 text-[12px] font-black tracking-[0.28em] text-rose-500">
              LOVE CAPSULE
            </div>
          </div>
        </div>

        <div
          className={`grid items-center gap-4 px-1 ${
            todayDraw && currentCapsule ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'
          }`}
        >
          <div className={`flex ${todayDraw && currentCapsule ? 'justify-center pl-8' : 'justify-center'}`}>
            <div className="relative inline-flex items-center rounded-full border-[3px] border-white/90 bg-[linear-gradient(90deg,rgba(255,230,239,0.98)_0%,rgba(255,248,214,0.98)_50%,rgba(230,245,255,0.98)_100%)] px-5 py-2 shadow-[0_12px_26px_rgba(255,185,204,0.26)]">
              <div className="absolute inset-x-4 top-0 h-3 rounded-b-full bg-white/45 blur-sm" />
              <div className="absolute left-2.5 h-2.5 w-2.5 rounded-full bg-rose-300" />
              <div className="absolute right-2.5 h-2.5 w-2.5 rounded-full bg-sky-300" />
              <p className="relative px-3 text-[13px] font-black tracking-[0.14em] text-rose-500">
                今天你扭蛋了吗？
              </p>
            </div>
          </div>

          {todayDraw && currentCapsule && (
            <button
              type="button"
              onClick={() => setPageState('result')}
              className="relative h-[44px] w-[34px] shrink-0 justify-self-end"
              aria-label={`打开今天的扭蛋：${currentCapsule.name}`}
            >
              <div
                className="absolute inset-x-0 top-0 h-5 rounded-t-full border-[3px] shadow-[inset_0_3px_6px_rgba(255,255,255,0.35)]"
                style={{
                  borderColor: eggPalette.rim,
                  background: `linear-gradient(180deg,${eggPalette.top} 0%,${eggPalette.bottom} 100%)`,
                }}
              />
              <div
                className="absolute inset-x-0 bottom-0 h-5 rounded-b-full border-[3px] shadow-[inset_0_-3px_6px_rgba(255,255,255,0.28)]"
                style={{
                  borderColor: eggPalette.rim,
                  background: `linear-gradient(180deg,${eggPalette.bottom} 0%,${eggPalette.top} 100%)`,
                }}
              />
              <div className="absolute left-1/2 top-[17px] h-[5px] w-[38px] -translate-x-1/2 rounded-full bg-white/88" />
              <div className="absolute left-[6px] top-[7px] h-2.5 w-3 rotate-[-20deg] rounded-full bg-white/45 blur-[1px]" />
            </button>
          )}
        </div>

        <div className="inline-flex rounded-full border border-white/70 bg-white/70 px-4 py-1.5 text-[13px] font-medium text-pink-500 shadow-sm backdrop-blur-md">
          当前测试阶段不限次数
        </div>
      </div>

      <div className="mt-4">
        <HeartCapsuleMachine isTurning={isTurning} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleDraw('self')}
          disabled={isTurning}
          className="relative overflow-hidden rounded-[30px] border-[4px] border-white/90 bg-[linear-gradient(180deg,#fff8fb_0%,#ffe5ee_100%)] px-4 py-4 text-left shadow-[0_16px_32px_rgba(255,182,202,0.24)] active:scale-[0.98] disabled:opacity-50"
        >
          <div className="absolute inset-x-5 top-0 h-4 rounded-b-full bg-white/45 blur-sm" />
          <div className="absolute left-3 top-3 h-3 w-3 rounded-full bg-rose-300 shadow-[0_0_0_3px_rgba(255,255,255,0.75)]" />
          <div className="absolute right-3 top-3 h-3 w-3 rounded-full bg-yellow-300 shadow-[0_0_0_3px_rgba(255,255,255,0.75)]" />
          <div className="text-[13px] font-black tracking-[0.16em] text-rose-400">今天这次</div>
          <div className="mt-1 text-[20px] font-black tracking-tight text-zinc-800">我来扭</div>
        </button>

        <button
          type="button"
          onClick={() => handleDraw('partner')}
          disabled={isTurning}
          className="relative overflow-hidden rounded-[30px] border-[4px] border-white/90 bg-[linear-gradient(180deg,#fefcff_0%,#e6f5ff_100%)] px-4 py-4 text-left shadow-[0_16px_32px_rgba(170,212,255,0.22)] active:scale-[0.98] disabled:opacity-50"
        >
          <div className="absolute inset-x-5 top-0 h-4 rounded-b-full bg-white/45 blur-sm" />
          <div className="absolute left-3 top-3 h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_0_3px_rgba(255,255,255,0.75)]" />
          <div className="absolute right-3 top-3 h-3 w-3 rounded-full bg-pink-300 shadow-[0_0_0_3px_rgba(255,255,255,0.75)]" />
          <div className="text-[13px] font-black tracking-[0.16em] text-sky-500">今天这次</div>
          <div className="mt-1 text-[20px] font-black tracking-tight text-zinc-800">让 TA 扭</div>
        </button>
      </div>
    </div>
  );
}
