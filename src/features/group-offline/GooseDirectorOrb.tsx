import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Dices,
  Pencil,
  RefreshCw,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';
import type { GroupOfflineStylePresetId } from '../../types';

type GooseDirectorOrbProps = {
  containerRef: React.RefObject<HTMLElement | null>;
  mode: 'blocks' | 'ensemble';
  loading: boolean;
  manualSelectionMode: boolean;
  queuedLabels: string[];
  recommendedLabels: string[];
  stylePresetOptions: Array<{ id: GroupOfflineStylePresetId; label: string }>;
  onRecommend: () => void;
  onRandom: () => void;
  onToggleManual: () => void;
  onClearManual: () => void;
  onRunManual: () => void;
  onContinueEnsemble: () => void;
  onRetryRound?: () => void;
  onRewindRound?: () => void;
  onApplyStylePreset?: (presetId: GroupOfflineStylePresetId) => void;
  onOpenCustomStyle?: () => void;
};

type OrbPosition = {
  x: number;
  y: number;
};

type GooseDirectorSection = 'dispatch' | 'style' | 'round';

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
  const dragRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const alignRight = useMemo(() => {
    const container = props.containerRef.current;
    if (!container) return true;
    return position.x + ORB_SIZE / 2 > container.clientWidth / 2;
  }, [position.x, props.containerRef]);

  const availableSections = useMemo<GooseDirectorSection[]>(() => {
    const sections: GooseDirectorSection[] = ['dispatch'];
    if ((props.stylePresetOptions.length > 0 && props.onApplyStylePreset) || props.onOpenCustomStyle) {
      sections.push('style');
    }
    if (props.onRetryRound || props.onRewindRound) {
      sections.push('round');
    }
    return sections;
  }, [props.onApplyStylePreset, props.onOpenCustomStyle, props.onRetryRound, props.onRewindRound, props.stylePresetOptions.length]);

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

  const sectionTitle = activeSection === 'style'
    ? '改文风'
    : activeSection === 'round'
      ? '轮级'
      : '调度';

  const sectionDescription = activeSection === 'style'
    ? '这一层只动写法和表达，不改现在这一轮已经发生的事。'
    : activeSection === 'round'
      ? '这里放整轮控制，不是改单个角色块。'
      : props.mode === 'blocks'
        ? '选这一轮谁出场，或者直接让系统替你调度。'
        : '当前是同场群像，继续推进会让多人一起往下走。';

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
                const label = section === 'style' ? '改文风' : section === 'round' ? '轮级' : '调度';
                const Icon = section === 'style' ? Sparkles : section === 'round' ? RefreshCw : WandSparkles;
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
                  {props.mode === 'blocks' ? (
                    <>
                      <div className="goose-director-orb__actions-grid">
                        <button
                          type="button"
                          className="goose-director-orb__action"
                          onClick={() => handleLeafAction(props.onRecommend)}
                          disabled={props.loading}
                        >
                          <Sparkles size={14} />
                          <span>系统推荐</span>
                        </button>
                        <button
                          type="button"
                          className="goose-director-orb__action"
                          onClick={() => handleLeafAction(props.onRandom)}
                          disabled={props.loading}
                        >
                          <Dices size={14} />
                          <span>随机出场</span>
                        </button>
                        <button
                          type="button"
                          className={`goose-director-orb__action ${props.manualSelectionMode ? 'goose-director-orb__action--active' : ''}`}
                          onClick={props.onToggleManual}
                          disabled={props.loading}
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
                            disabled={props.loading}
                          >
                            <X size={14} />
                            <span>清空顺序</span>
                          </button>
                          <button
                            type="button"
                            className="goose-director-orb__action goose-director-orb__action--primary"
                            onClick={() => handleLeafAction(props.onRunManual)}
                            disabled={props.loading || props.queuedLabels.length === 0}
                          >
                            <Check size={14} />
                            <span>开始本轮</span>
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="goose-director-orb__actions-grid goose-director-orb__actions-grid--compact">
                      <button
                        type="button"
                        className="goose-director-orb__action goose-director-orb__action--primary"
                        onClick={() => handleLeafAction(props.onContinueEnsemble)}
                        disabled={props.loading}
                      >
                        <WandSparkles size={14} />
                        <span>继续同场</span>
                      </button>
                    </div>
                  )}

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
                </>
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
