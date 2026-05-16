import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { Character } from '../../types';
import { ResolvedOfflineAvatar } from './ResolvedOfflineAvatar';

type EndingPayload = {
  summaryLines: string[];
  endingVoices: Array<{ characterId: string; characterName: string; text: string }>;
};

type EndingDisplayLine = {
  id: string;
  text: string;
  kind: 'summary' | 'voice-name' | 'voice-line';
};

type EndingParticle = {
  x: number;
  y: number;
  color: string;
  size: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  delay: number;
  wiggle: number;
};

type GroupOfflineSceneOverlaysProps = {
  showInviteSheet: boolean;
  addableGroupMembers: Character[];
  onCloseInviteSheet: () => void;
  onInviteCharacter: (character: Character) => void | Promise<void>;
  showCustomStyleSheet: boolean;
  customStyleDraft: string;
  loading: boolean;
  onCloseCustomStyleSheet: () => void;
  onCustomStyleDraftChange: (value: string) => void;
  onApplyCustomStyle: () => void | Promise<void>;
  endingState: 'idle' | 'generating' | 'ready';
  endingPayload: EndingPayload | null;
  endingTitle: string;
  endingAccentColor?: string;
  onFinalizeEnding: () => void;
};

function normalizeHexColor(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex.split('').map((char) => `${char}${char}`).join('').toUpperCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `#${hex.toUpperCase()}`;
  }
  return undefined;
}

function hexToRgb(value: string | undefined): [number, number, number] | null {
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

function buildEndingAccentVars(accentColor?: string): React.CSSProperties | undefined {
  const accent = normalizeHexColor(accentColor);
  const rgb = hexToRgb(accent) || [126, 231, 242];
  if (!accent) return undefined;
  return {
    '--group-offline-ending-accent': accent,
    '--group-offline-ending-accent-soft': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.16)`,
    '--group-offline-ending-accent-strong': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`,
    '--group-offline-ending-accent-glow': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.45)`,
    '--group-offline-ending-accent-muted': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.35)`,
  } as React.CSSProperties;
}

function parseCssPx(value: string | null | undefined): number {
  if (!value || value === 'normal') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildCanvasFont(style: CSSStyleDeclaration): string {
  const fontStyle = style.fontStyle || 'normal';
  const fontVariant = style.fontVariant || 'normal';
  const fontWeight = style.fontWeight || '400';
  const fontSize = style.fontSize || '16px';
  const fontFamily = style.fontFamily || 'sans-serif';
  return `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize} ${fontFamily}`;
}

function drawTextWithLetterSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
) {
  if (!text) return;
  if (!letterSpacing) {
    ctx.fillText(text, x, y);
    return;
  }

  let cursor = x;
  const chars = Array.from(text);
  chars.forEach((char, index) => {
    ctx.fillText(char, cursor, y);
    const width = ctx.measureText(char).width;
    cursor += width + (index < chars.length - 1 ? letterSpacing : 0);
  });
}

function drawElementTextToCanvas(
  ctx: CanvasRenderingContext2D,
  element: HTMLElement,
  containerRect: DOMRect,
) {
  const text = element.textContent?.trim();
  if (!text) return;

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  ctx.save();
  ctx.font = buildCanvasFont(style);
  ctx.fillStyle = style.color || '#ffffff';
  ctx.textBaseline = 'top';
  drawTextWithLetterSpacing(
    ctx,
    text,
    rect.left - containerRect.left,
    rect.top - containerRect.top,
    parseCssPx(style.letterSpacing),
  );
  ctx.restore();
}

function formatEndingTitle(title: string): string {
  const normalized = title.trim();
  return normalized ? Array.from(normalized).join(' ') : '';
}

function splitEndingText(text: string): string[] {
  const normalized = text.replace(/\r/g, '').trim();
  if (!normalized) return [];

  return normalized
    .split('\n')
    .flatMap((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return [];
      const matches = trimmed.match(/[^。！？!?…]+(?:[。！？!?…]+|$)/g);
      return (matches || [trimmed]).map((segment) => segment.trim()).filter(Boolean);
    })
    .filter(Boolean);
}

function buildEndingDisplayLines(payload: EndingPayload | null): EndingDisplayLine[] {
  if (!payload) return [];
  const lines: EndingDisplayLine[] = [];

  payload.summaryLines.forEach((line, index) => {
    splitEndingText(line).forEach((segment, segmentIndex) => {
      lines.push({
        id: `summary-${index}-${segmentIndex}`,
        text: segment,
        kind: 'summary',
      });
    });
  });

  payload.endingVoices.forEach((voice) => {
    lines.push({
      id: `voice-name-${voice.characterId}`,
      text: voice.characterName,
      kind: 'voice-name',
    });
    splitEndingText(voice.text).forEach((segment, segmentIndex) => {
      lines.push({
        id: `voice-line-${voice.characterId}-${segmentIndex}`,
        text: segment,
        kind: 'voice-line',
      });
    });
  });

  return lines;
}

export function GroupOfflineSceneOverlays(props: GroupOfflineSceneOverlaysProps) {
  const endingScreenRef = useRef<HTMLButtonElement | null>(null);
  const endingContentRef = useRef<HTMLDivElement | null>(null);
  const endingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const endingParticlesRef = useRef<EndingParticle[]>([]);
  const endingAnimationFrameRef = useRef<number | null>(null);
  const endingParticleKickoffTimeoutRef = useRef<number | null>(null);
  const endingCurtainTimeoutRef = useRef<number | null>(null);
  const endingCompleteTimeoutRef = useRef<number | null>(null);

  const [endingRevealCount, setEndingRevealCount] = useState(0);
  const [endingRipple, setEndingRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const [endingCurtainVisible, setEndingCurtainVisible] = useState(false);
  const [isReturning, setIsReturning] = useState(false);

  const endingDisplayName = useMemo(
    () => formatEndingTitle(props.endingTitle || '群线下'),
    [props.endingTitle],
  );
  const endingDisplayLines = useMemo(
    () => buildEndingDisplayLines(props.endingPayload),
    [props.endingPayload],
  );
  const summaryHighlightIndex = useMemo(() => {
    const summaryIndexes = endingDisplayLines
      .map((line, index) => (line.kind === 'summary' ? index : -1))
      .filter((index) => index >= 0);
    return summaryIndexes.length > 0 ? summaryIndexes[summaryIndexes.length - 1] : -1;
  }, [endingDisplayLines]);
  const accentVars = useMemo(
    () => buildEndingAccentVars(props.endingAccentColor),
    [props.endingAccentColor],
  );

  const clearEndingVisualTimers = () => {
    if (endingParticleKickoffTimeoutRef.current !== null) {
      window.clearTimeout(endingParticleKickoffTimeoutRef.current);
      endingParticleKickoffTimeoutRef.current = null;
    }
    if (endingCurtainTimeoutRef.current !== null) {
      window.clearTimeout(endingCurtainTimeoutRef.current);
      endingCurtainTimeoutRef.current = null;
    }
    if (endingCompleteTimeoutRef.current !== null) {
      window.clearTimeout(endingCompleteTimeoutRef.current);
      endingCompleteTimeoutRef.current = null;
    }
  };

  const stopEndingParticleAnimation = () => {
    if (endingAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(endingAnimationFrameRef.current);
      endingAnimationFrameRef.current = null;
    }

    endingParticlesRef.current = [];
    const canvas = endingCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => {
    return () => {
      clearEndingVisualTimers();
      stopEndingParticleAnimation();
    };
  }, []);

  useEffect(() => {
    if (props.endingState !== 'ready') {
      setEndingRevealCount(0);
      setEndingRipple(null);
      setEndingCurtainVisible(false);
      setIsReturning(false);
      clearEndingVisualTimers();
      stopEndingParticleAnimation();
      return;
    }

    setEndingRevealCount(0);
    setEndingRipple(null);
    setEndingCurtainVisible(false);
    setIsReturning(false);
    clearEndingVisualTimers();
    stopEndingParticleAnimation();

    if (endingDisplayLines.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setEndingRevealCount((previous) => {
        const next = previous + 1;
        if (next >= endingDisplayLines.length) {
          window.clearInterval(timer);
          return endingDisplayLines.length;
        }
        return next;
      });
    }, 280);

    return () => window.clearInterval(timer);
  }, [endingDisplayLines, props.endingState]);

  const buildEndingParticles = () => {
    const screen = endingScreenRef.current;
    const content = endingContentRef.current;
    const canvas = endingCanvasRef.current;

    if (!screen || !content || !canvas) {
      return [] as EndingParticle[];
    }

    const screenRect = screen.getBoundingClientRect();
    const width = Math.max(1, Math.round(screenRect.width));
    const height = Math.max(1, Math.round(screenRect.height));

    canvas.width = width;
    canvas.height = height;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (!offscreenCtx) {
      return [] as EndingParticle[];
    }

    const drawableElements = content.querySelectorAll<HTMLElement>(
      '.group-offline-scene__ending-name, .group-offline-scene__ending-line',
    );

    drawableElements.forEach((element) => {
      drawElementTextToCanvas(offscreenCtx, element, screenRect);
    });

    const density = 2;
    const imageData = offscreenCtx.getImageData(0, 0, width, height).data;
    const particles: EndingParticle[] = [];

    for (let y = 0; y < height; y += density) {
      for (let x = 0; x < width; x += density) {
        const index = (y * width + x) * 4;
        const alpha = imageData[index + 3];
        if (alpha <= 35) continue;

        const angle = Math.random() * Math.PI * 2;
        const speed = 0.12 + Math.random() * 0.5;

        particles.push({
          x: x + (Math.random() - 0.5) * density,
          y: y + (Math.random() - 0.5) * density,
          color: `rgba(${imageData[index]}, ${imageData[index + 1]}, ${imageData[index + 2]}, ${(alpha / 255).toFixed(2)})`,
          size: 0.55 + Math.random() * 0.9,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.15,
          life: 1,
          decay: 0.004 + Math.random() * 0.005,
          delay: Math.random() * 55,
          wiggle: Math.random() * Math.PI * 2,
        });
      }
    }

    return particles;
  };

  const finalizeAfterCurtain = () => {
    clearEndingVisualTimers();
    endingCompleteTimeoutRef.current = window.setTimeout(() => {
      props.onFinalizeEnding();
    }, 1100);
  };

  const revealEndingCurtain = () => {
    stopEndingParticleAnimation();
    setEndingCurtainVisible(true);
    finalizeAfterCurtain();
  };

  const startEndingParticleAnimation = () => {
    const canvas = endingCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      revealEndingCurtain();
      return;
    }

    const particles = buildEndingParticles();
    if (particles.length === 0) {
      revealEndingCurtain();
      return;
    }

    endingParticlesRef.current = particles;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = 0;
      endingParticlesRef.current.forEach((particle) => {
        if (particle.delay > 0) {
          particle.delay -= 1;
          alive += 1;
          return;
        }

        particle.wiggle += 0.04;
        particle.vx += Math.sin(particle.wiggle) * 0.007;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= particle.decay;

        if (particle.life <= 0) {
          return;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, particle.life * particle.life);
        ctx.fillStyle = particle.color;
        if (particle.size > 1.2) {
          ctx.shadowBlur = 3;
          ctx.shadowColor = particle.color;
        }
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * Math.max(particle.life, 0.35), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        alive += 1;
      });

      if (alive > 0) {
        endingAnimationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      endingAnimationFrameRef.current = null;
      revealEndingCurtain();
    };

    tick();
  };

  const handleEndingScreenClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (props.endingState !== 'ready' || isReturning) {
      return;
    }

    const linesReady = endingDisplayLines.length === 0 || endingRevealCount >= endingDisplayLines.length;
    if (!linesReady) {
      setEndingRevealCount(endingDisplayLines.length);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setEndingRipple({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      key: Date.now(),
    });
    setIsReturning(true);
    setEndingCurtainVisible(false);
    clearEndingVisualTimers();
    stopEndingParticleAnimation();

    endingParticleKickoffTimeoutRef.current = window.setTimeout(() => {
      const maybeFonts = typeof document !== 'undefined' && 'fonts' in document
        ? (document.fonts.ready as Promise<unknown>)
        : Promise.resolve();

      maybeFonts
        .catch(() => undefined)
        .finally(() => {
          startEndingParticleAnimation();
        });
    }, 90);
  };

  return (
    <>
      <AnimatePresence>
        {props.showInviteSheet ? (
          <div className="absolute inset-0 z-[135] flex items-end bg-black/34 backdrop-blur-[2px]">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="group-offline-scene__invite-sheet"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[16px] font-semibold text-white">拉人进场</div>
                  <div className="mt-1 text-[12px] text-white/48">这里只会显示本群里还没到场的成员。</div>
                </div>
                <button type="button" className="group-offline-scene__icon-btn" onClick={props.onCloseInviteSheet}>
                  <X size={16} />
                </button>
              </div>
              {props.addableGroupMembers.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  className="group-offline-scene__invite-item w-full text-left"
                  onClick={() => void props.onInviteCharacter(character)}
                >
                  <ResolvedOfflineAvatar
                    value={character.avatar}
                    alt={character.name}
                    containerClassName="group-offline-scene__entry-avatar"
                    fallbackClassName="text-[14px] text-white/84"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-white">{character.remarkName?.trim() || character.name}</div>
                    <div className="truncate text-[12px] text-white/45">{character.signature?.trim() || '加入这一场群线下'}</div>
                  </div>
                </button>
              ))}
              {props.addableGroupMembers.length === 0 ? (
                <div className="group-offline-scene__invite-empty">这场里已经把本群当前能加入的人都带上了。</div>
              ) : null}
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {props.showCustomStyleSheet ? (
          <div className="absolute inset-0 z-[136] flex items-end bg-black/36 backdrop-blur-[2px]">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="group-offline-scene__style-sheet"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[16px] font-semibold text-zinc-900">自定义改文风</div>
                  <div className="mt-1 text-[12px] text-zinc-500">写下你要的文风要求。会先改当前轮，后续继续生成也会沿用。</div>
                </div>
                <button type="button" className="group-offline-scene__icon-btn" onClick={props.onCloseCustomStyleSheet}>
                  <X size={16} />
                </button>
              </div>

              <textarea
                value={props.customStyleDraft}
                onChange={(event) => props.onCustomStyleDraftChange(event.target.value)}
                className="group-offline-scene__style-textarea"
                rows={6}
                placeholder="例如：暧昧一点，但不要太露骨；句子更细腻，重点写眼神和停顿。"
              />

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="group-offline-scene__entry-tool"
                  onClick={props.onCloseCustomStyleSheet}
                  disabled={props.loading}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="group-offline-scene__entry-tool group-offline-scene__entry-tool--primary"
                  onClick={() => void props.onApplyCustomStyle()}
                  disabled={props.loading || !props.customStyleDraft.trim()}
                >
                  应用并重写当前轮
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {props.endingState !== 'idle' ? (
          <motion.button
            ref={endingScreenRef}
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`group-offline-scene__ending-screen ${props.endingState === 'generating' ? 'group-offline-scene__ending-screen--generating' : ''} ${isReturning ? 'group-offline-scene__ending-screen--returning' : ''}`}
            onClick={handleEndingScreenClick}
            style={accentVars}
          >
            <div className="group-offline-scene__ending-backdrop" />
            {props.endingState === 'generating' ? (
              <div className="group-offline-scene__ending-wait">
                <div className="group-offline-scene__ending-stars" aria-hidden="true">
                  <span className="group-offline-scene__ending-star group-offline-scene__ending-star--white" />
                  <span className="group-offline-scene__ending-star group-offline-scene__ending-star--white" />
                  <span className="group-offline-scene__ending-star group-offline-scene__ending-star--white" />
                  <span className="group-offline-scene__ending-star group-offline-scene__ending-star--white" />
                  <span className="group-offline-scene__ending-star group-offline-scene__ending-star--white" />
                  <span className="group-offline-scene__ending-star group-offline-scene__ending-star--white" />
                  <span className="group-offline-scene__ending-star group-offline-scene__ending-star--accent" />
                  <span className="group-offline-scene__ending-star group-offline-scene__ending-star--accent" />
                  <span className="group-offline-scene__ending-star group-offline-scene__ending-star--accent" />
                  <span className="group-offline-scene__ending-star group-offline-scene__ending-star--accent" />
                  <span className="group-offline-scene__ending-star group-offline-scene__ending-star--accent" />
                  <span className="group-offline-scene__ending-star group-offline-scene__ending-star--accent" />
                </div>
                <div className="group-offline-scene__ending-wait-copy">
                  <div className="group-offline-scene__ending-wait-name">{endingDisplayName || '群线下'}</div>
                  <div className="group-offline-scene__ending-wait-sub">正在收拢这一场余温</div>
                </div>
              </div>
            ) : (
              <div
                ref={endingContentRef}
                className={`group-offline-scene__ending-content ${isReturning ? 'is-returning' : ''}`}
              >
                <div className={`group-offline-scene__ending-header ${endingDisplayLines.length > 0 ? 'is-visible' : ''}`}>
                  <span className="group-offline-scene__ending-pip" />
                  <span className="group-offline-scene__ending-name">{endingDisplayName || '群线下'}</span>
                </div>
                <div className="group-offline-scene__ending-lines">
                  {endingDisplayLines.map((line, index) => (
                    <span
                      key={line.id}
                      className={`group-offline-scene__ending-line ${line.kind === 'voice-name' ? 'group-offline-scene__ending-line--voice-name' : ''} ${line.kind === 'summary' && index === summaryHighlightIndex ? 'group-offline-scene__ending-line--highlight' : ''} ${index < endingRevealCount ? 'is-visible' : ''}`}
                    >
                      {line.text}
                    </span>
                  ))}
                </div>
                <div className={`group-offline-scene__ending-rule ${endingDisplayLines.length > 0 && endingRevealCount >= endingDisplayLines.length ? 'is-visible' : ''}`} />
                {props.endingState === 'ready' && (endingDisplayLines.length === 0 || endingRevealCount >= endingDisplayLines.length) ? (
                  <div className="group-offline-scene__ending-hint">轻 触 回 群</div>
                ) : null}
              </div>
            )}
            <canvas ref={endingCanvasRef} className="group-offline-scene__ending-canvas" />
            <div className={`group-offline-scene__ending-curtain ${endingCurtainVisible ? 'is-visible' : ''}`}>
              <div className="group-offline-scene__ending-curtain-text">已 回 到 群 聊</div>
            </div>
            {endingRipple ? (
              <span
                key={endingRipple.key}
                className="group-offline-scene__ending-ripple"
                style={{ left: endingRipple.x, top: endingRipple.y }}
              />
            ) : null}
          </motion.button>
        ) : null}
      </AnimatePresence>
    </>
  );
}
