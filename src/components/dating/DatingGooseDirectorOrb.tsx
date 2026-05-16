import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Palette,
  Pencil,
  RefreshCw,
  Settings2,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';
import type { DateRelationshipStageOverride } from '../../types';
import type { GroupOfflineStylePresetId } from '../../services/ai/prompts/builders/groupOfflineStylePresets';
import './DatingGooseDirectorOrb.css';

type DatingGooseDirectorOrbProps = {
  containerRef: React.RefObject<HTMLElement | null>;
  loading: boolean;
  directorLaunchToken?: number;
  initialDirectorSection?: DatingDirectorSection;
  relationshipSummary: string;
  currentRelationshipStage: DateRelationshipStageOverride;
  allowAdultIntimacy: boolean;
  currentCustomStyle: string;
  currentBodyTextColor?: string;
  currentHighlightTextColor?: string;
  currentDirectorInstruction?: string;
  stylePresetOptions: Array<{ id: GroupOfflineStylePresetId; label: string }>;
  canEditCurrentRound: boolean;
  isInlineEditing: boolean;
  onApplyRelationship: (params: {
    relationshipStageOverride: DateRelationshipStageOverride;
    allowAdultIntimacy: boolean;
  }, mode: 'rewrite' | 'next_round') => void;
  onApplyStylePreset: (presetId: GroupOfflineStylePresetId) => void;
  onApplyCustomStyle: (text: string, mode: 'rewrite' | 'next_round') => void;
  onChangeTextColors: (params: { bodyTextColor?: string; highlightTextColor?: string }) => void;
  onRetryRound: () => void;
  onApplyDirectorInstruction: (text: string, mode: 'rewrite' | 'next_round') => void;
  onToggleInlineEdit: () => void;
};

export type DatingDirectorSection = 'relationship' | 'style' | 'color' | 'instruction' | 'round';
type OrbPosition = {
  x: number;
  y: number;
};

const ORB_SIZE = 48;
const ORB_MARGIN = 12;
const PANEL_WIDTH = 288;
const DOCK_DELAY_MS = 1400;
const DOCK_VISIBLE_RATIO = 0.58;

function shouldHidePresetInstruction(value: string | undefined): boolean {
  const normalized = (value || '').trim();
  return normalized.startsWith('当前固定文风：') || normalized.startsWith('目标手感：');
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function GooseDirectorArt() {
  return (
    <svg viewBox="0 0 160 160" className="dating-goose-orb__goose-art" aria-hidden="true">
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

export function DatingGooseDirectorOrb(props: DatingGooseDirectorOrbProps) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [docked, setDocked] = useState(true);
  const [activeSection, setActiveSection] = useState<DatingDirectorSection>('relationship');
  const [position, setPosition] = useState<OrbPosition>({ x: 0, y: 168 });
  const [relationshipStageDraft, setRelationshipStageDraft] = useState<DateRelationshipStageOverride>(props.currentRelationshipStage || 'auto');
  const [adultIntimacyDraft, setAdultIntimacyDraft] = useState(props.allowAdultIntimacy);
  const [customStyleDraft, setCustomStyleDraft] = useState(
    shouldHidePresetInstruction(props.currentCustomStyle) ? '' : (props.currentCustomStyle || ''),
  );
  const [bodyTextColorDraft, setBodyTextColorDraft] = useState(props.currentBodyTextColor || '#FAFBFF');
  const [highlightTextColorDraft, setHighlightTextColorDraft] = useState(props.currentHighlightTextColor || '#92EBF2');
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

  const sections = useMemo<DatingDirectorSection[]>(() => ['relationship', 'style', 'color', 'instruction', 'round'], []);

  useEffect(() => {
    setRelationshipStageDraft(props.currentRelationshipStage || 'auto');
  }, [props.currentRelationshipStage]);
  useEffect(() => {
    setAdultIntimacyDraft(props.allowAdultIntimacy);
  }, [props.allowAdultIntimacy]);

  useEffect(() => {
    setCustomStyleDraft(shouldHidePresetInstruction(props.currentCustomStyle) ? '' : (props.currentCustomStyle || ''));
  }, [props.currentCustomStyle]);
  useEffect(() => {
    setBodyTextColorDraft(props.currentBodyTextColor || '#FAFBFF');
  }, [props.currentBodyTextColor]);
  useEffect(() => {
    setHighlightTextColorDraft(props.currentHighlightTextColor || '#92EBF2');
  }, [props.currentHighlightTextColor]);
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
    const timeout = window.setTimeout(() => setDocked(true), DOCK_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [docked, open]);

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

  const sectionTitle = activeSection === 'relationship'
    ? '关系'
    : activeSection === 'style'
      ? '改文风'
      : activeSection === 'color'
        ? '颜色'
        : activeSection === 'instruction'
          ? '指令'
      : '轮级';
  const sectionDescription = activeSection === 'relationship'
    ? '手动盖住这一场约会的关系基线，并决定是否允许更开放的成人亲密表达。'
    : activeSection === 'style'
      ? '直接套用群聊线下的文风预设，或者写自定义导演词；选完以后，后续剧情默认沿用这个文风。'
      : activeSection === 'color'
        ? '这里只改约会正文的显示色，不改按钮和界面的强调色。'
        : activeSection === 'instruction'
          ? '用户可以输入任意导演指令，影响下一轮剧情生成。'
      : '当前轮可以直接重写，或者切到正文里的编辑状态。';

  const closeAndRun = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="dating-goose-orb" aria-live="polite">
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 6 }}
            className="dating-goose-orb__panel"
            style={panelStyle}
          >
            <div className="dating-goose-orb__panel-head">
              <div className="dating-goose-orb__panel-copy">
                <div className="dating-goose-orb__panel-title">大鹅导演</div>
                <div className="dating-goose-orb__panel-subtitle">{sectionTitle}</div>
              </div>
              <button
                type="button"
                className="dating-goose-orb__panel-close"
                onClick={() => setOpen(false)}
                aria-label="关闭导演面板"
              >
                <X size={14} />
              </button>
            </div>

            <div className="dating-goose-orb__tabs">
              {sections.map((section) => {
                const label = sectionTitleMap(section);
                const Icon = section === 'relationship'
                  ? Settings2
                  : section === 'style'
                    ? Sparkles
                    : section === 'color'
                      ? Palette
                    : WandSparkles;
                return (
                  <button
                    key={section}
                    type="button"
                    className={`dating-goose-orb__tab ${activeSection === section ? 'dating-goose-orb__tab--active' : ''}`}
                    onClick={() => setActiveSection(section)}
                    disabled={props.loading}
                  >
                    <Icon size={13} />
                    <span className="dating-goose-orb__tab-label">{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="dating-goose-orb__section">
              <div className="dating-goose-orb__section-copy">
                <div className="dating-goose-orb__section-title">{sectionTitle}</div>
                <div className="dating-goose-orb__section-desc">{sectionDescription}</div>
              </div>

              {activeSection === 'relationship' ? (
                <>
                  <div className="dating-goose-orb__option-label">关系阶段覆盖</div>
                  <div className="dating-goose-orb__option-grid">
                    {[
                      { value: 'auto', label: '自动继承' },
                      { value: 'careful', label: '谨慎基线' },
                      { value: 'growing', label: '持续升温' },
                      { value: 'intimate', label: '已亲密' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`dating-goose-orb__option ${relationshipStageDraft === option.value ? 'dating-goose-orb__option--active' : ''}`}
                        onClick={() => setRelationshipStageDraft(option.value as DateRelationshipStageOverride)}
                        disabled={props.loading}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`dating-goose-orb__toggle ${adultIntimacyDraft ? 'dating-goose-orb__toggle--active' : ''}`}
                    onClick={() => setAdultIntimacyDraft((previous) => !previous)}
                    disabled={props.loading}
                  >
                    <div className="dating-goose-orb__toggle-copy">
                      <div className="dating-goose-orb__toggle-title">允许成人亲密</div>
                      <div className="dating-goose-orb__toggle-desc">如果关系、人设和这轮气氛都成立，就不要因为保守模板自动收住。</div>
                    </div>
                    <span className={`dating-goose-orb__switch ${adultIntimacyDraft ? 'dating-goose-orb__switch--on' : ''}`}>
                      <span className="dating-goose-orb__switch-knob" />
                    </span>
                  </button>
                  <div className="dating-goose-orb__actions-grid dating-goose-orb__actions-grid--compact">
                    <button
                      type="button"
                      className="dating-goose-orb__action dating-goose-orb__action--primary"
                      onClick={() => closeAndRun(() => props.onApplyRelationship({
                        relationshipStageOverride: relationshipStageDraft,
                        allowAdultIntimacy: adultIntimacyDraft,
                      }, 'rewrite'))}
                      disabled={props.loading}
                    >
                      <RefreshCw size={14} />
                      <span>重写当前轮</span>
                    </button>
                    <button
                      type="button"
                      className="dating-goose-orb__action dating-goose-orb__action--secondary"
                      onClick={() => closeAndRun(() => props.onApplyRelationship({
                        relationshipStageOverride: relationshipStageDraft,
                        allowAdultIntimacy: adultIntimacyDraft,
                      }, 'next_round'))}
                      disabled={props.loading}
                    >
                      <WandSparkles size={14} />
                      <span>开下一轮</span>
                    </button>
                  </div>
                  <div className="dating-goose-orb__meta-card">
                    <div className="dating-goose-orb__meta-label">当前指示</div>
                    <div className="dating-goose-orb__meta-text">{props.relationshipSummary}</div>
                  </div>
                </>
              ) : null}

              {activeSection === 'style' ? (
                <>
                  <div className="dating-goose-orb__actions-grid">
                    {props.stylePresetOptions.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="dating-goose-orb__action dating-goose-orb__action--secondary"
                        onClick={() => closeAndRun(() => props.onApplyStylePreset(preset.id))}
                        disabled={props.loading}
                      >
                        <Sparkles size={14} />
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {activeSection === 'color' ? (
                <>
                  <div className="dating-goose-orb__option-label">文字颜色</div>
                  <div className="dating-goose-orb__color-grid">
                    <label className="dating-goose-orb__color-field">
                      <span>高亮文字</span>
                      <input
                        type="color"
                        value={highlightTextColorDraft}
                        onChange={(event) => {
                          const next = event.target.value;
                          setHighlightTextColorDraft(next);
                          props.onChangeTextColors({
                            bodyTextColor: bodyTextColorDraft,
                            highlightTextColor: next,
                          });
                        }}
                      />
                    </label>
                    <label className="dating-goose-orb__color-field">
                      <span>正文颜色</span>
                      <input
                        type="color"
                        value={bodyTextColorDraft}
                        onChange={(event) => {
                          const next = event.target.value;
                          setBodyTextColorDraft(next);
                          props.onChangeTextColors({
                            bodyTextColor: next,
                            highlightTextColor: highlightTextColorDraft,
                          });
                        }}
                      />
                    </label>
                  </div>
                </>
              ) : null}

              {activeSection === 'style' ? (
                <>
                  <div className="dating-goose-orb__option-label">自定义改文风</div>
                  <textarea
                    value={customStyleDraft}
                    onChange={(event) => setCustomStyleDraft(event.target.value)}
                    className="dating-goose-orb__textarea"
                    rows={5}
                    placeholder="例如：写得更直接一点，但不要假装关系还在试探；情绪更黏、更贴身，少一点保守收束。"
                  />
                  <div className="dating-goose-orb__actions-grid">
                    <button
                      type="button"
                      className="dating-goose-orb__action dating-goose-orb__action--primary"
                      onClick={() => closeAndRun(() => props.onApplyCustomStyle(customStyleDraft, 'rewrite'))}
                      disabled={props.loading || !customStyleDraft.trim()}
                    >
                      <Pencil size={14} />
                      <span>重写当前轮</span>
                    </button>
                    <button
                      type="button"
                      className="dating-goose-orb__action dating-goose-orb__action--secondary"
                      onClick={() => closeAndRun(() => props.onApplyCustomStyle(customStyleDraft, 'next_round'))}
                      disabled={props.loading || !customStyleDraft.trim()}
                    >
                      <WandSparkles size={14} />
                      <span>开下一轮</span>
                    </button>
                  </div>
                </>
              ) : null}

              {activeSection === 'instruction' ? (
                <>
                  <div className="dating-goose-orb__option-label">自定义导演指令</div>
                  <textarea
                    value={directorInstructionDraft}
                    onChange={(event) => setDirectorInstructionDraft(event.target.value)}
                    className="dating-goose-orb__textarea"
                    rows={6}
                    placeholder="例如：暂停当前主线，生成一个番外小剧场；或者指定这轮的剧情方向、篇幅、状态栏处理方式等。"
                  />
                  <div className="dating-goose-orb__actions-grid">
                    <button
                      type="button"
                      className="dating-goose-orb__action dating-goose-orb__action--primary"
                      onClick={() => closeAndRun(() => props.onApplyDirectorInstruction(directorInstructionDraft, 'rewrite'))}
                      disabled={props.loading || !directorInstructionDraft.trim()}
                    >
                      <RefreshCw size={14} />
                      <span>重写当前轮</span>
                    </button>
                    <button
                      type="button"
                      className="dating-goose-orb__action dating-goose-orb__action--secondary"
                      onClick={() => closeAndRun(() => props.onApplyDirectorInstruction(directorInstructionDraft, 'next_round'))}
                      disabled={props.loading || !directorInstructionDraft.trim()}
                    >
                      <WandSparkles size={14} />
                      <span>开下一轮</span>
                    </button>
                  </div>
                </>
              ) : null}

              {activeSection === 'round' ? (
                <>
                  <div className="dating-goose-orb__actions-grid dating-goose-orb__actions-grid--compact">
                    <button
                      type="button"
                      className="dating-goose-orb__action dating-goose-orb__action--secondary"
                      onClick={() => closeAndRun(props.onRetryRound)}
                      disabled={props.loading || !props.canEditCurrentRound}
                    >
                      <RefreshCw size={14} />
                      <span>重写当前轮</span>
                    </button>
                    <button
                      type="button"
                      className={`dating-goose-orb__action ${props.isInlineEditing ? 'dating-goose-orb__action--primary' : 'dating-goose-orb__action--secondary'}`}
                      onClick={() => closeAndRun(props.onToggleInlineEdit)}
                      disabled={props.loading || !props.canEditCurrentRound}
                    >
                      <Pencil size={14} />
                      <span>{props.isInlineEditing ? '关闭页面编辑' : '进入页面编辑'}</span>
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        className={`dating-goose-orb__trigger ${open ? 'dating-goose-orb__trigger--open' : ''}`}
        style={{ transform: `translate(${resolveVisualX(position.x)}px, ${position.y}px)` }}
        onPointerDown={startDrag}
        aria-label="打开约会导演"
        title="大鹅导演"
      >
        <GooseDirectorArt />
      </button>
    </div>
  );
}

function sectionTitleMap(section: DatingDirectorSection) {
  if (section === 'relationship') return '关系';
  if (section === 'style') return '改文风';
  if (section === 'color') return '颜色';
  if (section === 'instruction') return '指令';
  return '轮级';
}
