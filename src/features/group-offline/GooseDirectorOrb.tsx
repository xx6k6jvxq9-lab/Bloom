import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Dices,
  Palette,
  Pencil,
  RefreshCw,
  Sparkles,
  Target,
  WandSparkles,
  X,
} from 'lucide-react';
import type { GroupOfflineStylePresetId } from '../../types';

export type GooseDirectorInstructionMode = 'start' | 'rewrite' | 'next_round';
export type GooseDirectorSection = 'dispatch' | 'progress' | 'display' | 'style' | 'instruction' | 'round';

type GooseDirectorProgressPanel = {
  roundLabel: string;
  backgroundLabel?: string;
  taskLabel?: string;
  statusLabel: string;
  progressSummary: string;
  successCondition?: string;
  failureCondition?: string;
  pressureLine?: string;
  taskSteps: Array<{
    slot: number;
    label: string;
    status: 'pending' | 'completed' | 'failed';
    note?: string;
  }>;
  memoryRows: Array<{
    characterName: string;
    shortTermCount: number;
    longTermCount: number;
  }>;
  lockReason?: string;
};

export type GooseDirectorOrbProps = {
  containerRef: React.RefObject<HTMLElement | null>;
  mode: 'blocks';
  loading: boolean;
  manualSelectionMode: boolean;
  queuedLabels: string[];
  recommendedLabels: string[];
  highlightColor: string;
  bodyTextColor: string;
  highlightColorOptions: string[];
  bodyTextColorOptions: string[];
  stylePresetOptions: Array<{ id: GroupOfflineStylePresetId; label: string }>;
  progressPanel?: GooseDirectorProgressPanel;
  dispatchDisabledReason?: string;
  directorLaunchToken?: number;
  initialDirectorSection?: GooseDirectorSection;
  currentDirectorInstruction?: string;
  awaitingDirectorInstruction?: boolean;
  hasCurrentRound?: boolean;
  onRecommend: () => void;
  onRandom: () => void;
  onToggleManual: () => void;
  onClearManual: () => void;
  onRunManual: () => void;
  onRetryRound?: () => void;
  onRewindRound?: () => void;
  onApplyStylePreset?: (presetId: GroupOfflineStylePresetId) => void;
  onOpenCustomStyle?: () => void;
  onApplyDirectorInstruction?: (text: string, mode: GooseDirectorInstructionMode) => void;
  onHighlightColorChange: (color: string) => void;
  onBodyTextColorChange: (color: string) => void;
};

type OrbPosition = {
  x: number;
  y: number;
};

const ORB_SIZE = 52;
const ORB_MARGIN = 12;
const PANEL_WIDTH = 272;
const DOCK_DELAY_MS = 1400;
const DOCK_VISIBLE_RATIO = 0.58;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function GooseDirectorArt() {
  return (
    <svg viewBox="0 0 160 160" className="goose-director-orb__goose-art" aria-hidden="true">
      <path
        d="M49 39C42 28 29 25 21 30C12 36 15 49 24 52L37 56"
        fill="#f45148"
        stroke="#0b0b0d"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M49 39C48 23 58 14 74 14C96 14 108 27 108 49V72H131C147 72 153 82 153 98V111C153 130 139 146 120 146H73C47 146 29 127 29 101V63C29 48 37 39 49 39Z"
        fill="#fbfbfb"
        stroke="#0b0b0d"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="77" cy="43" r="4.5" fill="#0b0b0d" />
      <path
        d="M61 146V156C61 160 67 161 69 157L73 151"
        fill="none"
        stroke="#0b0b0d"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M96 146V156C96 160 102 161 104 157L108 151"
        fill="none"
        stroke="#0b0b0d"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M53 157C54 149 62 147 68 150C72 152 73 156 69 160H57Z"
        fill="#ffd65e"
        stroke="#0b0b0d"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M89 157C90 149 98 147 104 150C108 152 109 156 105 160H93Z"
        fill="#ffd65e"
        stroke="#0b0b0d"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GooseDirectorOrb(props: GooseDirectorOrbProps) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [docked, setDocked] = useState(true);
  const [activeSection, setActiveSection] = useState<GooseDirectorSection>('dispatch');
  const [position, setPosition] = useState<OrbPosition>({ x: 0, y: 168 });
  const [directorInstructionDraft, setDirectorInstructionDraft] = useState(props.currentDirectorInstruction || '');
  const dragRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const lastLaunchTokenRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setDirectorInstructionDraft(props.currentDirectorInstruction || '');
  }, [props.currentDirectorInstruction]);

  useEffect(() => {
    if (!props.directorLaunchToken) return;
    if (props.directorLaunchToken === lastLaunchTokenRef.current) return;
    lastLaunchTokenRef.current = props.directorLaunchToken;
    setActiveSection(props.initialDirectorSection || 'instruction');
    setDocked(false);
    setOpen(true);
  }, [props.directorLaunchToken, props.initialDirectorSection]);

  const alignRight = useMemo(() => {
    const container = props.containerRef.current;
    if (!container) return true;
    return position.x + ORB_SIZE / 2 > container.clientWidth / 2;
  }, [position.x, props.containerRef]);

  const availableSections = useMemo<GooseDirectorSection[]>(() => {
    const sections: GooseDirectorSection[] = ['dispatch'];
    if (props.progressPanel) {
      sections.push('progress');
    }
    if (props.highlightColorOptions.length > 0 || props.bodyTextColorOptions.length > 0) {
      sections.push('display');
    }
    if ((props.stylePresetOptions.length > 0 && props.onApplyStylePreset) || props.onOpenCustomStyle) {
      sections.push('style');
    }
    if (props.onApplyDirectorInstruction) {
      sections.push('instruction');
    }
    if (props.onRetryRound || props.onRewindRound) {
      sections.push('round');
    }
    return sections;
  }, [
    props.currentDirectorInstruction,
    props.bodyTextColorOptions.length,
    props.highlightColorOptions.length,
    props.onApplyDirectorInstruction,
    props.onApplyStylePreset,
    props.onOpenCustomStyle,
    props.onRetryRound,
    props.onRewindRound,
    props.progressPanel,
    props.stylePresetOptions.length,
  ]);

  const snapPosition = (next: OrbPosition) => {
    const container = props.containerRef.current;
    if (!container) return next;

    const maxX = Math.max(ORB_MARGIN, container.clientWidth - ORB_SIZE - ORB_MARGIN);
    const maxY = Math.max(ORB_MARGIN, container.clientHeight - ORB_SIZE - ORB_MARGIN);
    const snappedX = next.x + ORB_SIZE / 2 < container.clientWidth / 2
      ? ORB_MARGIN
      : maxX;

    return {
      x: clamp(snappedX, ORB_MARGIN, maxX),
      y: clamp(next.y, ORB_MARGIN, maxY),
    };
  };

  const resolveVisualX = (baseX: number) => {
    const container = props.containerRef.current;
    if (!container || !docked) return baseX;

    const dockedVisibleWidth = ORB_SIZE * DOCK_VISIBLE_RATIO;
    const hiddenWidth = ORB_SIZE - dockedVisibleWidth;

    return baseX + ORB_SIZE / 2 < container.clientWidth / 2
      ? -hiddenWidth
      : container.clientWidth - dockedVisibleWidth;
  };

  useLayoutEffect(() => {
    const container = props.containerRef.current;
    if (!container || ready) return;

    setPosition({
      x: Math.max(ORB_MARGIN, container.clientWidth - ORB_SIZE - ORB_MARGIN),
      y: Math.min(Math.max(160, ORB_MARGIN), Math.max(ORB_MARGIN, container.clientHeight * 0.44)),
    });
    setDocked(true);
    setReady(true);
  }, [props.containerRef, ready]);

  useEffect(() => {
    const container = props.containerRef.current;
    if (!container) return;

    const handleResize = () => {
      const maxX = Math.max(ORB_MARGIN, container.clientWidth - ORB_SIZE - ORB_MARGIN);
      const maxY = Math.max(ORB_MARGIN, container.clientHeight - ORB_SIZE - ORB_MARGIN);
      setPosition((previous) => ({
        x: clamp(previous.x, ORB_MARGIN, maxX),
        y: clamp(previous.y, ORB_MARGIN, maxY),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [props.containerRef]);

  useEffect(() => {
    if (open || docked) return undefined;

    const timeout = window.setTimeout(() => {
      setDocked(true);
    }, DOCK_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [docked, open]);

  useEffect(() => {
    if (open) {
      setActiveSection((previous) => (
        availableSections.includes(previous) ? previous : availableSections[0]
      ));
      return;
    }
    setActiveSection('dispatch');
  }, [availableSections, open]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const active = dragRef.current;
      const container = props.containerRef.current;
      if (!active || !container || event.pointerId !== active.pointerId) return;

      const nextX = active.originX + (event.clientX - active.startX);
      const nextY = active.originY + (event.clientY - active.startY);
      const maxX = Math.max(ORB_MARGIN, container.clientWidth - ORB_SIZE - ORB_MARGIN);
      const maxY = Math.max(ORB_MARGIN, container.clientHeight - ORB_SIZE - ORB_MARGIN);

      if (Math.abs(event.clientX - active.startX) > 4 || Math.abs(event.clientY - active.startY) > 4) {
        active.moved = true;
      }

      if (docked) {
        setDocked(false);
      }

      setPosition({
        x: clamp(nextX, ORB_MARGIN, maxX),
        y: clamp(nextY, ORB_MARGIN, maxY),
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const active = dragRef.current;
      if (!active || event.pointerId !== active.pointerId) return;

      dragRef.current = null;
      setPosition((previous) => snapPosition(previous));
      if (!active.moved) {
        setDocked(false);
        setOpen((previous) => !previous);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [docked, props.containerRef]);

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const container = props.containerRef.current;
    const currentVisualX = docked && container
      ? resolveVisualX(position.x)
      : position.x;

    dragRef.current = {
      pointerId: event.pointerId,
      originX: currentVisualX,
      originY: position.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const panelStyle = {
    left: alignRight
      ? Math.max(ORB_MARGIN, resolveVisualX(position.x) - PANEL_WIDTH - 8)
      : resolveVisualX(position.x) + ORB_SIZE + 8,
    top: clamp(
      position.y - 10,
      ORB_MARGIN,
      Math.max(ORB_MARGIN, (props.containerRef.current?.clientHeight || 0) - 360),
    ),
    width: PANEL_WIDTH,
  } as const;

  const handleLeafAction = (fn?: () => void) => {
    if (!fn) return;
    fn();
    setOpen(false);
    setDocked(false);
  };

  const closeAndRun = (action: () => void) => {
    setOpen(false);
    setDocked(false);
    action();
  };

  const sectionTitle = activeSection === 'style'
    ? '改文风'
    : activeSection === 'display'
      ? '配色'
    : activeSection === 'progress'
      ? '看进度'
    : activeSection === 'instruction'
      ? '特殊指令'
    : activeSection === 'round'
      ? '轮级'
      : '调度';

  const sectionDescription = activeSection === 'style'
    ? '这一层只动写法和表达，不改现在这一轮已经发生的事。'
    : activeSection === 'display'
      ? '这里只动场内文字颜色，不改内容、不改文风。'
    : activeSection === 'progress'
      ? '这里统一看任务、轮数、推进状态和记忆累计，不用在场内来回翻。'
    : activeSection === 'instruction'
      ? (props.awaitingDirectorInstruction
        ? '这次是从特殊指令入口进来的。先写清这一场该怎么开，再点“开始这场”。'
        : '特殊指令只改这一轮怎么推进、先回应谁、节奏和限制，不改角色是谁，也不和文风混用。')
    : activeSection === 'round'
      ? '这里放整轮控制，不是改单个角色块。'
      : '选这一轮谁出场，或者直接让系统替你调度。';

  return (
    <div className="goose-director-orb" aria-live="polite">
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 6 }}
            className="goose-director-orb__panel"
            style={panelStyle}
          >
            <div className="goose-director-orb__panel-head">
              <div className="goose-director-orb__panel-copy">
                <div className="goose-director-orb__panel-title">大鹅导演</div>
                <div className="goose-director-orb__panel-subtitle">{sectionTitle}</div>
              </div>
              <button
                type="button"
                className="goose-director-orb__panel-close"
                onClick={() => setOpen(false)}
                aria-label="关闭导演面板"
              >
                <X size={14} />
              </button>
            </div>

            <div className="goose-director-orb__tabs">
              {availableSections.map((section) => {
                const label = section === 'style'
                  ? '改文风'
                  : section === 'display'
                    ? '配色'
                  : section === 'progress'
                    ? '进度'
                    : section === 'instruction'
                      ? '特殊指令'
                    : section === 'round'
                      ? '轮级'
                      : '调度';
                const Icon = section === 'style'
                  ? Sparkles
                  : section === 'display'
                    ? Palette
                  : section === 'progress'
                    ? Target
                    : section === 'instruction'
                      ? WandSparkles
                    : section === 'round'
                      ? RefreshCw
                      : WandSparkles;
                return (
                  <button
                    key={section}
                    type="button"
                    className={`goose-director-orb__tab ${activeSection === section ? 'goose-director-orb__tab--active' : ''}`}
                    onClick={() => setActiveSection(section)}
                    disabled={props.loading}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="goose-director-orb__section">
              <div className="goose-director-orb__section-copy">
                <div className="goose-director-orb__section-title">{sectionTitle}</div>
                <div className="goose-director-orb__section-desc">{sectionDescription}</div>
              </div>

              {activeSection === 'dispatch' ? (
                <>
                  <div className="goose-director-orb__actions-grid">
                    <button
                      type="button"
                      className="goose-director-orb__action"
                      onClick={() => handleLeafAction(props.onRecommend)}
                      disabled={props.loading || !!props.dispatchDisabledReason}
                    >
                      <Sparkles size={14} />
                      <span>系统推荐</span>
                    </button>
                    <button
                      type="button"
                      className="goose-director-orb__action"
                      onClick={() => handleLeafAction(props.onRandom)}
                      disabled={props.loading || !!props.dispatchDisabledReason}
                    >
                      <Dices size={14} />
                      <span>随机出场</span>
                    </button>
                    <button
                      type="button"
                      className={`goose-director-orb__action ${props.manualSelectionMode ? 'goose-director-orb__action--active' : ''}`}
                      onClick={props.onToggleManual}
                      disabled={props.loading || !!props.dispatchDisabledReason}
                    >
                      <Pencil size={14} />
                      <span>{props.manualSelectionMode ? '退出手动' : '手动选人'}</span>
                    </button>
                  </div>

                  {props.manualSelectionMode ? (
                    <div className="goose-director-orb__actions-grid goose-director-orb__actions-grid--compact">
                      <button
                        type="button"
                        className="goose-director-orb__action goose-director-orb__action--secondary"
                        onClick={props.onClearManual}
                        disabled={props.loading || !!props.dispatchDisabledReason}
                      >
                        <X size={14} />
                        <span>清空顺序</span>
                      </button>
                      <button
                        type="button"
                        className="goose-director-orb__action goose-director-orb__action--primary"
                        onClick={() => handleLeafAction(props.onRunManual)}
                        disabled={props.loading || props.queuedLabels.length === 0 || !!props.dispatchDisabledReason}
                      >
                        <Check size={14} />
                        <span>开始本轮</span>
                      </button>
                    </div>
                  ) : null}

                  {props.recommendedLabels.length > 0 ? (
                    <div className="goose-director-orb__meta-card">
                      <div className="goose-director-orb__meta-label">系统更想先推</div>
                      <div className="goose-director-orb__meta-text">{props.recommendedLabels.join('、')}</div>
                    </div>
                  ) : null}

                  {props.queuedLabels.length > 0 ? (
                    <div className="goose-director-orb__meta-card">
                      <div className="goose-director-orb__meta-label">本轮顺序</div>
                      <div className="goose-director-orb__meta-text">
                        {props.queuedLabels.map((label, index) => `${index + 1}. ${label}`).join('  ')}
                      </div>
                    </div>
                  ) : null}

                  {props.dispatchDisabledReason ? (
                    <div className="goose-director-orb__meta-card goose-director-orb__meta-card--warning">
                      <div className="goose-director-orb__meta-label">当前不能继续推进</div>
                      <div className="goose-director-orb__meta-text">{props.dispatchDisabledReason}</div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {activeSection === 'progress' && props.progressPanel ? (
                <div className="goose-director-orb__progress">
                  <div className="goose-director-orb__progress-top">
                    <div className="goose-director-orb__meta-card">
                      <div className="goose-director-orb__meta-label">轮次</div>
                      <div className="goose-director-orb__meta-text">{props.progressPanel.roundLabel}</div>
                    </div>
                    <div className="goose-director-orb__meta-card">
                      <div className="goose-director-orb__meta-label">状态</div>
                      <div className="goose-director-orb__meta-text">{props.progressPanel.statusLabel}</div>
                    </div>
                  </div>

                  <div className="goose-director-orb__meta-card">
                    <div className="goose-director-orb__meta-label">当前任务</div>
                    <div className="goose-director-orb__meta-text">
                      {props.progressPanel.taskLabel || props.progressPanel.progressSummary}
                    </div>
                    {props.progressPanel.taskLabel && props.progressPanel.progressSummary ? (
                      <div className="goose-director-orb__progress-inline-note">{props.progressPanel.progressSummary}</div>
                    ) : null}
                  </div>

                  {props.progressPanel.taskSteps.length > 0 ? (
                    <div className="goose-director-orb__meta-card">
                      <div className="goose-director-orb__meta-label">任务步骤</div>
                      <div className="goose-director-orb__progress-steps">
                        {props.progressPanel.taskSteps.map((step) => (
                          <div key={step.slot} className="goose-director-orb__progress-step">
                            <div className={`goose-director-orb__progress-step-dot goose-director-orb__progress-step-dot--${step.status}`} />
                            <div className="goose-director-orb__progress-step-copy">
                              <div className="goose-director-orb__progress-step-title">{step.slot}. {step.label}</div>
                              {step.note ? <div className="goose-director-orb__progress-step-note">{step.note}</div> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {(props.progressPanel.successCondition || props.progressPanel.failureCondition || props.progressPanel.pressureLine) ? (
                    <div className="goose-director-orb__meta-card">
                      <div className="goose-director-orb__meta-label">规则</div>
                      <div className="goose-director-orb__meta-text">
                        {[
                          props.progressPanel.successCondition ? `成：${props.progressPanel.successCondition}` : '',
                          props.progressPanel.failureCondition ? `败：${props.progressPanel.failureCondition}` : '',
                          props.progressPanel.pressureLine ? `限：${props.progressPanel.pressureLine}` : '',
                        ].filter(Boolean).join('\n')}
                      </div>
                    </div>
                  ) : null}

                  {props.progressPanel.memoryRows.length > 0 ? (
                    <div className="goose-director-orb__meta-card">
                      <div className="goose-director-orb__meta-label">记忆累计</div>
                      <div className="goose-director-orb__memory-list">
                        {props.progressPanel.memoryRows.map((row) => (
                          <div key={row.characterName} className="goose-director-orb__memory-row">
                            <span className="goose-director-orb__memory-name">{row.characterName}</span>
                            <span className="goose-director-orb__memory-value">
                              短期 {row.shortTermCount}/10 · 长期 {row.longTermCount}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {props.progressPanel.lockReason ? (
                    <div className="goose-director-orb__meta-card goose-director-orb__meta-card--warning">
                      <div className="goose-director-orb__meta-label">推进提示</div>
                      <div className="goose-director-orb__meta-text">{props.progressPanel.lockReason}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeSection === 'display' ? (
                <div className="goose-director-orb__display">
                  <div className="goose-director-orb__meta-card">
                    <div className="goose-director-orb__meta-label">高亮文字颜色</div>
                    <div className="goose-director-orb__color-grid">
                      {props.highlightColorOptions.map((color) => {
                        const active = props.highlightColor === color;
                        return (
                          <button
                            key={`highlight-${color}`}
                            type="button"
                            className={`goose-director-orb__color-swatch ${active ? 'goose-director-orb__color-swatch--active' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => props.onHighlightColorChange(color)}
                            disabled={props.loading}
                            aria-label={`选择高亮文字颜色 ${color}`}
                            title={active ? '当前高亮颜色' : '切换为这组高亮颜色'}
                          />
                        );
                      })}
                    </div>
                    <div className="goose-director-orb__color-field-grid">
                      <label className="goose-director-orb__color-field">
                        <span>自定义高亮</span>
                        <input
                          type="color"
                          value={props.highlightColor}
                          onChange={(event) => props.onHighlightColorChange(event.target.value)}
                          disabled={props.loading}
                          aria-label="自定义高亮文字颜色"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="goose-director-orb__meta-card">
                    <div className="goose-director-orb__meta-label">普通文字颜色</div>
                    <div className="goose-director-orb__color-grid">
                      {props.bodyTextColorOptions.map((color) => {
                        const active = props.bodyTextColor === color;
                        return (
                          <button
                            key={`body-${color}`}
                            type="button"
                            className={`goose-director-orb__color-swatch ${active ? 'goose-director-orb__color-swatch--active' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => props.onBodyTextColorChange(color)}
                            disabled={props.loading}
                            aria-label={`选择普通文字颜色 ${color}`}
                            title={active ? '当前普通文字颜色' : '切换为这组普通文字颜色'}
                          />
                        );
                      })}
                    </div>
                    <div className="goose-director-orb__color-field-grid">
                      <label className="goose-director-orb__color-field">
                        <span>自定义正文</span>
                        <input
                          type="color"
                          value={props.bodyTextColor}
                          onChange={(event) => props.onBodyTextColorChange(event.target.value)}
                          disabled={props.loading}
                          aria-label="自定义普通文字颜色"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeSection === 'style' && (props.onApplyStylePreset || props.onOpenCustomStyle) ? (
                <div className="goose-director-orb__actions-grid">
                  {props.stylePresetOptions.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="goose-director-orb__action goose-director-orb__action--secondary"
                      onClick={() => handleLeafAction(() => props.onApplyStylePreset?.(preset.id))}
                      disabled={props.loading}
                    >
                      <Sparkles size={14} />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                  {props.onOpenCustomStyle ? (
                    <button
                      type="button"
                      className="goose-director-orb__action goose-director-orb__action--secondary"
                      onClick={() => handleLeafAction(props.onOpenCustomStyle)}
                      disabled={props.loading}
                    >
                      <Pencil size={14} />
                      <span>自定义改文风</span>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {activeSection === 'instruction' && props.onApplyDirectorInstruction ? (
                <>
                  <div className="goose-director-orb__option-label">特殊指令</div>
                  <textarea
                    value={directorInstructionDraft}
                    onChange={(event) => setDirectorInstructionDraft(event.target.value)}
                    className="goose-director-orb__textarea"
                    rows={6}
                    placeholder={props.awaitingDirectorInstruction
                      ? '例如：先不要按默认主线开场，直接把这场写成一个带任务感的临时局，先让被我点名的人接，再收束到当前目标。'
                      : '例如：这一轮先让被我点名的人接，少铺环境，多落任务推进；或者压住起哄角色，把焦点收回两个人。'}
                    disabled={props.loading}
                  />
                  <div className="goose-director-orb__actions-grid goose-director-orb__actions-grid--compact">
                    {props.awaitingDirectorInstruction ? (
                      <button
                        type="button"
                        className="goose-director-orb__action goose-director-orb__action--primary"
                        onClick={() => closeAndRun(() => props.onApplyDirectorInstruction?.(directorInstructionDraft, 'start'))}
                        disabled={props.loading || !directorInstructionDraft.trim()}
                      >
                        <WandSparkles size={14} />
                        <span>开始这场</span>
                      </button>
                    ) : null}

                    {props.hasCurrentRound ? (
                      <button
                        type="button"
                        className="goose-director-orb__action goose-director-orb__action--primary"
                        onClick={() => closeAndRun(() => props.onApplyDirectorInstruction?.(directorInstructionDraft, 'rewrite'))}
                        disabled={props.loading || !directorInstructionDraft.trim()}
                      >
                        <RefreshCw size={14} />
                        <span>按这条指令重写本轮</span>
                      </button>
                    ) : null}

                    {!props.awaitingDirectorInstruction ? (
                      <button
                        type="button"
                        className="goose-director-orb__action goose-director-orb__action--secondary"
                        onClick={() => closeAndRun(() => props.onApplyDirectorInstruction?.(directorInstructionDraft, 'next_round'))}
                        disabled={props.loading || !directorInstructionDraft.trim()}
                      >
                        <WandSparkles size={14} />
                        <span>{props.hasCurrentRound ? '下一轮执行一次' : '开始第一轮'}</span>
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}

              {activeSection === 'round' ? (
                <div className="goose-director-orb__actions-grid goose-director-orb__actions-grid--compact">
                  {props.onRetryRound ? (
                    <button
                      type="button"
                      className="goose-director-orb__action goose-director-orb__action--secondary"
                      onClick={() => handleLeafAction(props.onRetryRound)}
                      disabled={props.loading}
                    >
                      <RefreshCw size={14} />
                      <span>重试本轮</span>
                    </button>
                  ) : null}
                  {props.onRewindRound ? (
                    <button
                      type="button"
                      className="goose-director-orb__action goose-director-orb__action--secondary"
                      onClick={() => handleLeafAction(props.onRewindRound)}
                      disabled={props.loading}
                    >
                      <WandSparkles size={14} />
                      <span>回到上一轮</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        className={`goose-director-orb__trigger ${open ? 'goose-director-orb__trigger--open' : ''}`}
        style={{ transform: `translate(${resolveVisualX(position.x)}px, ${position.y}px)` }}
        onPointerDown={startDrag}
        aria-label="打开大鹅导演"
        title="大鹅导演"
      >
        <div className="goose-director-orb__body">
          <GooseDirectorArt />
        </div>
      </button>
    </div>
  );
}
