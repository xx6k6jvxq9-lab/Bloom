import type { ChangeEvent } from 'react';

import type { DreamRuntimeAct, DreamRuntimeScenario } from '../../services/dream/dreamRuntimeTypes';
import type { DreamRole } from './dreamPageTypes';
import { Avatar, DreamNarrativeBlocks, type DreamPresentationView, SealButton, SecondaryAction, Shell } from './DreamPagePrimitives';

export function DreamRolePickerStage({
  time,
  roles,
  selectedRoleId,
  onBack,
  onPickRole,
}: {
  time: string;
  roles: DreamRole[];
  selectedRoleId: string | null;
  onBack: () => void;
  onPickRole: (roleId: string) => void;
}) {
  const hasRoles = roles.length > 0;

  return (
    <Shell time={time} scrollable contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col pb-[calc(1.5rem+var(--app-safe-area-bottom-ui,0px))]">
        <div className={`flex flex-col ${hasRoles ? 'w-full flex-1' : 'my-auto w-full max-w-[320px] self-center'}`}>
          <button type="button" onClick={onBack} className="self-center border border-[var(--border)] px-6 py-2 text-[11px] tracking-[0.4em] text-[var(--mist)]">返 回</button>
          <div className="mt-10 text-center text-[14px] tracking-[0.36em] text-[var(--mist)]">选择入梦角色</div>
          {hasRoles ? (
            <div className="mt-8 flex flex-1 flex-col gap-4">
              {roles.map((role) => {
                const active = selectedRoleId === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => onPickRole(role.id)}
                    className="border px-4 py-5 text-left transition duration-300"
                    style={{
                      borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)',
                      backgroundColor: active ? 'rgba(19,25,38,.92)' : 'rgba(13,18,32,.76)',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar role={role} small />
                      <div className="min-w-0">
                        <div className="text-[16px] font-[300] tracking-[0.14em] text-[var(--paper)]">{role.name}</div>
                        <div className="mt-2 line-clamp-2 text-[12px] leading-[1.9] tracking-[0.14em] text-[var(--mist)]">{role.mood}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

export function DreamLoadingStage({
  time,
  selectedRoleName,
  loadingError,
  loadingLabel,
  loadingProgress,
  onRetry,
  onBackConfirm,
  onLeaveHome,
}: {
  time: string;
  selectedRoleName: string;
  loadingError: string | null;
  loadingLabel: string;
  loadingProgress: number;
  onRetry: () => void;
  onBackConfirm: () => void;
  onLeaveHome: () => void;
}) {
  return (
    <Shell time={time} bottomTone={false} contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col items-center justify-start pb-[calc(3rem+var(--app-safe-area-bottom-ui,0px))] pt-[10vh] text-center sm:justify-center sm:pt-0">
        <div className="relative flex h-36 w-36 items-center justify-center">
          <div className="absolute h-14 w-14 rounded-full border border-[rgba(196,169,106,.2)] bg-[radial-gradient(circle_at_40%_38%,rgba(196,169,106,.4),transparent_65%)] animate-[pulse_3s_ease-in-out_infinite]" />
          <div className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle,rgba(196,169,106,.06),transparent_70%)] animate-[pulse_3s_ease-in-out_infinite_reverse]" />
        </div>
        <div className="mt-8 text-[22px] font-[200] tracking-[0.22em] text-[var(--paper)]">正在进入 {selectedRoleName} 的今夜</div>
        {loadingError ? (
          <>
            <div className="mt-4 max-w-[320px] text-[12px] leading-[2.1] tracking-[0.12em] text-[var(--mist)]">{loadingError}</div>
            <div className="mt-8 grid w-full max-w-[334px] gap-4">
              <SealButton label="重新入梦" onClick={onRetry} />
              <SecondaryAction label="返回确认" onClick={onBackConfirm} />
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 text-[12px] tracking-[0.42em] text-[var(--mist)] animate-[pulse_3s_ease-in-out_infinite]">{loadingLabel}</div>
            <div className="mt-5 h-px w-20 bg-[rgba(196,169,106,.1)]">
              <div className="h-px bg-[var(--gold)] transition-[width] duration-300 ease-linear" style={{ width: `${loadingProgress}%` }} />
            </div>
            <div className="mt-8 w-full max-w-[334px]">
              <SecondaryAction label="返 回 首 页" onClick={onLeaveHome} />
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

export function DreamSceneStage({
  time,
  scenarioTitle,
  actLabel,
  scenarioActs,
  actIndex,
  displayStoryFrame,
  presentation,
  typedSceneBlocks,
  act,
  loadingError,
  sceneReady,
  isClosingAct,
  isDeepDream,
  isEndingDeepDream,
  isGeneratingNextAct,
  onSaveAndExit,
  onProceed,
  onEndDeepDream,
}: {
  time: string;
  scenarioTitle: string;
  actLabel: string;
  scenarioActs: Array<{ id: string }>;
  actIndex: number;
  displayStoryFrame: Partial<DreamRuntimeScenario['storyFrame']> | null;
  presentation: DreamPresentationView;
  typedSceneBlocks: Array<{
    id: string;
    type: string;
    text: string;
    speakerName?: string;
    align?: 'left' | 'center' | 'right';
    emphasis?: 'low' | 'medium' | 'high';
  }>;
  act: DreamRuntimeAct;
  loadingError: string | null;
  sceneReady: boolean;
  isClosingAct: boolean;
  isDeepDream: boolean;
  isEndingDeepDream: boolean;
  isGeneratingNextAct: boolean;
  onSaveAndExit: () => void;
  onProceed: () => void;
  onEndDeepDream: () => void;
}) {
  return (
    <Shell time={time} contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col pb-[calc(3rem+var(--app-safe-area-bottom-ui,0px))]">
        <div className="mt-5 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{scenarioTitle} · {actLabel}</div>
        <div className="mt-8 flex items-center justify-center gap-3">{scenarioActs.map((item, index) => <div key={item.id} className="h-[5px] w-[5px] border border-[var(--border)]">{index <= actIndex ? <div className="h-full w-full bg-[var(--gold)]" /> : null}</div>)}</div>
        <div className="mt-8">
          <div className="mx-auto w-full max-w-[460px]">
            {displayStoryFrame && actIndex === 0 ? (
              <div className="mb-7 border px-4 py-4" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.accentSoft }}>
                {displayStoryFrame.worldTitle || displayStoryFrame.dreamRelationship ? (
                  <div className="text-[11px] tracking-[0.28em]" style={{ color: presentation.accent }}>
                    {[displayStoryFrame.worldTitle, displayStoryFrame.dreamRelationship].filter(Boolean).join(' · ')}
                  </div>
                ) : null}
                {displayStoryFrame.worldSummary ? <div className="mt-3 text-[14px] leading-[2.1] tracking-[0.08em] text-[var(--paper)]">{displayStoryFrame.worldSummary}</div> : null}
                {displayStoryFrame.characterDreamIdentity || displayStoryFrame.userDreamIdentity ? (
                  <div className="mt-4 text-[12px] leading-[2] tracking-[0.08em] text-[var(--mist)]">
                    {[displayStoryFrame.characterDreamIdentity, displayStoryFrame.userDreamIdentity].filter(Boolean).join(' / ')}
                  </div>
                ) : null}
                {displayStoryFrame.openingNode ? (
                  <div className="mt-2 text-[12px] leading-[2] tracking-[0.08em] text-[var(--mist)]">
                    节点：{displayStoryFrame.openingNode}
                  </div>
                ) : null}
                {displayStoryFrame.immediateGoal ? <div className="mt-2 text-[12px] leading-[2] tracking-[0.08em]" style={{ color: presentation.accent }}>此幕目标：{displayStoryFrame.immediateGoal}</div> : null}
                {displayStoryFrame.storyObjective ? (
                  <div className="mt-2 text-[12px] leading-[2] tracking-[0.08em]" style={{ color: presentation.accent }}>
                    主线：{displayStoryFrame.storyObjective}
                  </div>
                ) : null}
              </div>
            ) : null}
            <DreamNarrativeBlocks blocks={typedSceneBlocks} presentation={presentation} />
            <div className="mt-8 border-l pl-4 text-[13px] leading-[2.2] tracking-[0.16em] text-[var(--mist)]" style={{ borderColor: presentation.frameBorder }}>
              <div>{act.charState}</div>
              {act.progression.consequence ? <div className="mt-3">变化：{act.progression.consequence}</div> : null}
              {act.progression.plotAdvance ? <div className="mt-2">推进：{act.progression.plotAdvance}</div> : null}
            </div>
          </div>
        </div>
        {loadingError ? <div className="mt-6 text-[12px] leading-[2] tracking-[0.12em] text-[rgba(255,190,190,.9)]">{loadingError}</div> : null}
        <div className="mt-10 grid gap-4">
          <SecondaryAction label="保 存 退 出" onClick={onSaveAndExit} presentation={presentation} />
          <SealButton label={sceneReady ? (isClosingAct ? '进 入 结 局' : '进 入 选 择') : '正 文 正 在 浮 出'} onClick={onProceed} disabled={!sceneReady} presentation={presentation} />
        </div>
        {isDeepDream && !isClosingAct ? (
          <div className="mt-4">
            <SecondaryAction
              label={isEndingDeepDream ? '正 在 收 梦' : '结 束 做 梦'}
              onClick={onEndDeepDream}
              disabled={isEndingDeepDream || isGeneratingNextAct}
              presentation={presentation}
            />
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

export function DreamChoiceStage({
  time,
  domainLabel,
  scenarioTitle,
  actLabel,
  choiceAct,
  previewChoiceId,
  customInputOpen,
  customInput,
  isSubmittingCustom,
  loadingError,
  presentation,
  isDeepDream,
  isEndingDeepDream,
  isGeneratingNextAct,
  onBeginChoicePreview,
  onCancelChoicePreview,
  onSelectGeneratedChoice,
  onToggleCustomInput,
  onCustomInputChange,
  onSubmitCustomChoice,
  onCloseCustomInput,
  onSaveAndExit,
  onEndDeepDream,
}: {
  time: string;
  domainLabel: string;
  scenarioTitle: string;
  actLabel: string;
  choiceAct: DreamRuntimeAct;
  previewChoiceId: string | null;
  customInputOpen: boolean;
  customInput: string;
  isSubmittingCustom: boolean;
  loadingError: string | null;
  presentation: DreamPresentationView;
  isDeepDream: boolean;
  isEndingDeepDream: boolean;
  isGeneratingNextAct: boolean;
  onBeginChoicePreview: (choiceId: string) => void;
  onCancelChoicePreview: () => void;
  onSelectGeneratedChoice: (choiceIndex: number) => void;
  onToggleCustomInput: () => void;
  onCustomInputChange: (value: string) => void;
  onSubmitCustomChoice: () => void;
  onCloseCustomInput: () => void;
  onSaveAndExit: () => void;
  onEndDeepDream: () => void;
}) {
  return (
    <Shell time={time} contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col pb-[calc(3rem+var(--app-safe-area-bottom-ui,0px))]">
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] tracking-[0.26em] text-[var(--gold)]">
          <span className="inline-flex border border-[rgba(196,169,106,.18)] px-3 py-1">{domainLabel}</span>
          <span className="text-[var(--mist)]">路</span>
          <span>{scenarioTitle}</span>
        </div>
        <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{actLabel} 路 梦触</div>
        <div className="mt-6 text-center text-[14px] leading-[2.2] tracking-[0.16em] text-[var(--paper-60)]">
          梦已经给出方向。<br />
          现在由你决定，下一步要怎样落下去。
        </div>
        <div className="mt-10 flex flex-1 flex-col gap-4">
          {choiceAct.choiceSet.generated.map((choice, index) => {
            const previewing = previewChoiceId === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                onPointerDown={() => onBeginChoicePreview(choice.id)}
                onPointerUp={onCancelChoicePreview}
                onPointerLeave={onCancelChoicePreview}
                onPointerCancel={onCancelChoicePreview}
                onClick={() => onSelectGeneratedChoice(index)}
                className="w-full border px-5 py-5 text-left transition duration-300"
                style={{
                  borderColor: previewing ? presentation.frameBorder : 'rgba(255,255,255,.08)',
                  backgroundColor: previewing ? presentation.accentSoft : presentation.frameFill,
                  transform: previewing ? 'translateX(6px)' : 'translateX(0px)',
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="pt-1 text-[14px] tracking-[0.18em] text-[var(--gold)]">{['一', '二', '三'][index]}</div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-[300] tracking-[0.18em] text-[var(--paper)]">{choice.title}</div>
                    <div className="mt-3 text-[12px] leading-[2.1] tracking-[0.14em] text-[var(--mist)]">{choice.detail}</div>
                  </div>
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onToggleCustomInput}
            className="w-full border px-5 py-5 text-left opacity-70"
            style={{
              borderColor: presentation.frameBorder,
              backgroundColor: presentation.frameFill,
            }}
          >
            <div className="flex items-start gap-4">
              <div className="pt-1 text-[14px] tracking-[0.18em]" style={{ color: presentation.accent }}>四</div>
              <div className="min-w-0">
                <div className="text-[15px] font-[300] tracking-[0.18em] text-[var(--paper)]">{choiceAct.choiceSet.custom.title}</div>
                <div className="mt-3 text-[12px] leading-[2.1] tracking-[0.14em] text-[var(--mist)]">{choiceAct.choiceSet.custom.guidance}</div>
              </div>
            </div>
          </button>
          {customInputOpen ? (
            <div className="border px-5 py-5" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.frameFill }}>
              <textarea
                value={customInput}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onCustomInputChange(event.target.value)}
                placeholder={choiceAct.choiceSet.custom.placeholder}
                className="min-h-[120px] w-full resize-none bg-transparent text-[14px] leading-[2.1] tracking-[0.08em] text-white caret-white outline-none placeholder:text-white/65 selection:bg-white/20"
                style={{
                  color: 'rgba(255,255,255,.96)',
                  WebkitTextFillColor: 'rgba(255,255,255,.96)',
                  caretColor: '#ffffff',
                  backgroundColor: 'rgba(255,255,255,.035)',
                }}
              />
              <div className="mt-4 text-[12px] leading-[2] tracking-[0.12em] text-[var(--mist)]">
                这里输入的是你这一幕想怎么做、怎么说、想把梦推向哪边。
              </div>
              <div className="mt-5 grid gap-3">
                <SealButton
                  label={isSubmittingCustom ? '正 在 续 写' : '提 交 自 定 义'}
                  onClick={onSubmitCustomChoice}
                  disabled={isSubmittingCustom || !customInput.trim()}
                  presentation={presentation}
                />
                <SecondaryAction label="收 起 输 入" onClick={onCloseCustomInput} presentation={presentation} />
              </div>
            </div>
          ) : null}
          {loadingError ? <div className="text-[12px] leading-[2] tracking-[0.12em] text-[rgba(255,190,190,.9)]">{loadingError}</div> : null}
          <SecondaryAction label="保 存 退 出" onClick={onSaveAndExit} presentation={presentation} />
          {isDeepDream ? (
            <SecondaryAction
              label={isEndingDeepDream ? '正 在 收 梦' : '结 束 做 梦'}
              onClick={onEndDeepDream}
              disabled={isEndingDeepDream || isGeneratingNextAct || isSubmittingCustom}
              presentation={presentation}
            />
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

export function DreamReactionStage({
  time,
  selectedChoiceTitle,
  selectedChoiceEmotion,
  typedReactionBlocks,
  reactionReady,
  loadingError,
  presentation,
  isDeepDream,
  isLastGeneratedAct,
  isClosingAct,
  isGeneratingNextAct,
  isEndingDeepDream,
  onContinue,
  onSaveAndExit,
  onEndDeepDream,
}: {
  time: string;
  selectedChoiceTitle: string;
  selectedChoiceEmotion: string;
  typedReactionBlocks: Array<{
    id: string;
    type: string;
    text: string;
    speakerName?: string;
    align?: 'left' | 'center' | 'right';
    emphasis?: 'low' | 'medium' | 'high';
  }>;
  reactionReady: boolean;
  loadingError: string | null;
  presentation: DreamPresentationView;
  isDeepDream: boolean;
  isLastGeneratedAct: boolean;
  isClosingAct: boolean;
  isGeneratingNextAct: boolean;
  isEndingDeepDream: boolean;
  onContinue: () => void;
  onSaveAndExit: () => void;
  onEndDeepDream: () => void;
}) {
  return (
    <Shell time={time} contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col pb-[calc(3rem+var(--app-safe-area-bottom-ui,0px))]">
        <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">角 色 反 应</div>
        <div className="mt-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-[rgba(196,169,106,.18)]" />
          <div className="text-[12px] tracking-[0.18em]" style={{ color: presentation.accent }}>你选择了 {selectedChoiceTitle}</div>
          <div className="h-px flex-1 bg-[rgba(196,169,106,.18)]" />
        </div>
        <div className="mt-12">
          <DreamNarrativeBlocks blocks={typedReactionBlocks} presentation={presentation} />
        </div>
        <div className={`mt-16 transition duration-500 ${reactionReady ? 'opacity-100' : 'opacity-0'}`}>
          <span className="inline-flex rounded-[20px] border px-5 py-3 text-[12px] tracking-[0.2em]" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.accentSoft, color: presentation.accent }}>
            <span className="mr-3 inline-block h-[6px] w-[6px] rounded-full" style={{ backgroundColor: presentation.accent }} />
            {selectedChoiceEmotion}
          </span>
        </div>
        {loadingError ? <div className="mt-6 text-[12px] leading-[2] tracking-[0.12em] text-[rgba(255,190,190,.9)]">{loadingError}</div> : null}
        <div className="mt-8">
          <SealButton
            label={
              !reactionReady
                ? '反 应 正 在 浮 出'
                : isDeepDream && isLastGeneratedAct && !isClosingAct
                  ? isGeneratingNextAct
                    ? '正 在 下 沉'
                    : '沉 向 更 深 一 幕'
                  : '继 续  →'
            }
            onClick={onContinue}
            disabled={!reactionReady || isGeneratingNextAct || isEndingDeepDream}
            presentation={presentation}
          />
        </div>
        <div className="mt-4">
          <SecondaryAction label="保 存 退 出" onClick={onSaveAndExit} presentation={presentation} />
        </div>
        {isDeepDream && !isClosingAct ? (
          <div className="mt-4">
            <SecondaryAction
              label={isEndingDeepDream ? '正 在 收 梦' : '结 束 做 梦'}
              onClick={onEndDeepDream}
              disabled={isEndingDeepDream || isGeneratingNextAct}
              presentation={presentation}
            />
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

export function DreamEndingStage({
  time,
  endingView,
  isGeneratingEnding,
  typedEndingBody,
  typedEndingExcerpt,
  loadingError,
  presentation,
  endingTextReady,
  hasEndingOutput,
  onRetry,
  onExit,
  onNextAftermath,
}: {
  time: string;
  endingView: {
    title: string;
    signature: string;
    chapter: string;
  };
  isGeneratingEnding: boolean;
  typedEndingBody: string;
  typedEndingExcerpt: string;
  loadingError: string | null;
  presentation: DreamPresentationView;
  endingTextReady: boolean;
  hasEndingOutput: boolean;
  onRetry: () => void;
  onExit: () => void;
  onNextAftermath: () => void;
}) {
  return (
    <Shell time={time} bottomTone={false} contentClassName="pb-[calc(5rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col justify-center py-8">
        <div className="border-y py-10 text-center" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.frameFill }}>
          <div className="text-[34px] font-[200] tracking-[0.22em] text-[var(--paper)]">{endingView.title}</div>
          <div className="mx-auto mt-8 max-w-[360px] text-left text-[14px] font-[300] leading-[2.35] tracking-[0.1em] text-[var(--paper)]">
            {isGeneratingEnding ? '结局正在收束……' : typedEndingBody}
          </div>
          <div className="mx-auto mt-10 max-w-[290px] text-[15px] font-[300] leading-[2.35] tracking-[0.08em] text-[var(--paper-60)]">
            {isGeneratingEnding ? '梦尾摘录正在浮出。' : typedEndingExcerpt}
          </div>
          <div className="mt-8 text-[13px] tracking-[0.18em] text-[var(--mist)]">—— {endingView.signature}</div>
          <div className="mt-3 text-[12px] tracking-[0.26em]" style={{ color: presentation.accent }}>{endingView.chapter}</div>
        </div>
        {loadingError ? <div className="mt-6 px-8 text-[12px] leading-[2] tracking-[0.12em] text-[rgba(255,190,190,.9)]">{loadingError}</div> : null}
        {loadingError && !isGeneratingEnding ? (
          <div className="mt-6 grid gap-3 px-8">
            <SecondaryAction label="重 试 结 局" onClick={onRetry} presentation={presentation} />
            <SecondaryAction label="退 出 梦 境" onClick={onExit} presentation={presentation} />
          </div>
        ) : null}
        <div className="mt-10 grid gap-4 px-8">
          <SecondaryAction
            label={
              isGeneratingEnding
                ? '结 局 正 在 收 束'
                : !endingTextReady
                  ? '梦 尾 正 在 浮 出'
                  : hasEndingOutput
                    ? '查 看 梦 后 余 响  →'
                    : '请 先 等 结 局 完 成'
            }
            onClick={onNextAftermath}
            presentation={presentation}
            disabled={isGeneratingEnding || !hasEndingOutput || !endingTextReady}
          />
        </div>
      </div>
    </Shell>
  );
}

export function DreamAftermathStage({
  time,
  role,
  aftermathView,
  typedAftermathMessages,
  typedAftermathSummary,
  typedAftermathDetail,
  aftermathMetaLine,
  isGeneratingAftermath,
  loadingError,
  presentation,
  aftermathTextReady,
  onRetry,
  onExit,
  onRestart,
}: {
  time: string;
  role: DreamRole | null;
  aftermathView: {
    previewMessages: [string, string];
  };
  typedAftermathMessages: string[];
  typedAftermathSummary: string;
  typedAftermathDetail: string;
  aftermathMetaLine: string;
  isGeneratingAftermath: boolean;
  loadingError: string | null;
  presentation: DreamPresentationView;
  aftermathTextReady: boolean;
  onRetry: () => void;
  onExit: () => void;
  onRestart: () => void;
}) {
  return (
    <Shell time={time} scrollable contentClassName="pb-[calc(5rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col pb-[calc(3rem+var(--app-safe-area-bottom-ui,0px))]">
        <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">余响</div>
        <div className="mt-8 border border-[var(--border)] bg-[rgba(13,18,32,.72)] px-5 py-6">
          <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
            <Avatar role={role} small />
            <div className="min-w-0">
              <div className="text-[14px] tracking-[0.14em] text-[var(--paper)]">{role?.name || '角色'}</div>
              <div className="mt-1 text-[11px] tracking-[0.18em] text-[var(--mist)]">明日聊天预览</div>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {aftermathView.previewMessages.map((message, index) => (
              <div
                key={`${aftermathView.previewMessages[index]}-${index}`}
                className="max-w-[92%] border px-4 py-4 text-[13px] leading-[2] tracking-[0.12em] text-[var(--paper)]"
                style={{
                  marginLeft: index === 1 ? 'auto' : 0,
                  borderColor: presentation.frameBorder,
                  backgroundColor: index === 1 ? presentation.accentSoft : presentation.frameFill,
                }}
              >
                {isGeneratingAftermath ? (index === 0 ? '余响正在回流……' : '次日聊天正在浮出。') : typedAftermathMessages[index] || message}
              </div>
            ))}
            <div className="max-w-[48%] border px-4 py-3 text-[12px] tracking-[0.24em] text-[var(--mist)]" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.frameFill }}>
              ……
            </div>
          </div>
        </div>
        <div className="mt-8 border border-[var(--border)] bg-[rgba(13,18,32,.62)] px-5 py-6">
          <div className="text-[12px] tracking-[0.26em] text-[var(--mist)]">余响</div>
          <div className="mt-4 text-[14px] leading-[2.2] tracking-[0.14em] text-[var(--paper)]">
            {isGeneratingAftermath ? '梦醒后的余响正在整理……' : typedAftermathSummary}
          </div>
          <div className="mt-3 text-[12px] leading-[2] tracking-[0.14em] text-[var(--mist)]">
            {isGeneratingAftermath ? '它会沿着这场梦的结尾，慢一点回到现实里。' : typedAftermathDetail}
          </div>
          {aftermathMetaLine ? (
            <div className="mt-5 border-t pt-4 text-[11px] tracking-[0.24em]" style={{ borderColor: presentation.frameBorder, color: presentation.accent }}>
              {aftermathMetaLine}
            </div>
          ) : null}
        </div>
        {loadingError ? <div className="mt-6 text-[12px] leading-[2] tracking-[0.12em] text-[rgba(255,190,190,.9)]">{loadingError}</div> : null}
        {loadingError && !isGeneratingAftermath ? (
          <div className="mt-6 grid gap-3">
            <SecondaryAction label="重 试 余 响" onClick={onRetry} presentation={presentation} />
            <SecondaryAction label="退 出 梦 境" onClick={onExit} presentation={presentation} />
          </div>
        ) : null}
        <div className="mt-8">
          <SealButton
            label={isGeneratingAftermath ? '余 响 正 在 回 流' : aftermathTextReady ? '再 入 一 梦' : '余 响 正 在 浮 出'}
            onClick={onRestart}
            presentation={presentation}
            disabled={isGeneratingAftermath || !aftermathTextReady}
          />
        </div>
      </div>
    </Shell>
  );
}
