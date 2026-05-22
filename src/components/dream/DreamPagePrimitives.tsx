import { useEffect, useRef, type ReactNode } from 'react';

import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import type { DreamRole } from './dreamPageTypes';

export const dreamThemeStyle = {
  '--void': '#030509',
  '--ink': '#05080E',
  '--deep': '#080C18',
  '--gold': '#C4A96A',
  '--gold-bright': '#D9C08A',
  '--jade': '#7BA8C4',
  '--paper': '#EDE6D6',
  '--paper-60': 'rgba(237,230,214,.6)',
  '--mist': '#647899',
  '--border': 'rgba(196,169,106,.1)',
  '--border-mid': 'rgba(196,169,106,.2)',
  fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', Georgia, serif",
} as const;

const dreamNoise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`;

export type DreamPresentationView = {
  accent: string;
  accentSoft: string;
  dialogueText: string;
  frameBorder: string;
  frameFill: string;
  layoutId?: string;
};

function DreamStars() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const particles = Array.from({ length: 66 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.2 + Math.random() * 0.8,
      a: 0.03 + Math.random() * 0.32,
      da: (Math.random() - 0.5) * 0.006,
      vx: (Math.random() - 0.5) * 0.0007,
      vy: -0.00025 + (Math.random() - 0.5) * 0.00055,
    }));
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    let frame = 0;
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.x = (p.x + p.vx + 1) % 1;
        p.y = (p.y + p.vy + 1) % 1;
        p.a += p.da;
        if (p.a < 0.03 || p.a > 0.35) p.da *= -1;
        ctx.beginPath();
        ctx.fillStyle = `rgba(196,169,106,${p.a})`;
        ctx.arc(p.x * width, p.y * height, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      frame = window.requestAnimationFrame(draw);
    };
    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-0 h-full w-full" />;
}

export function Shell({
  time: _time,
  children,
  bottomTone = true,
  scrollable = true,
  contentClassName = '',
}: {
  time: string;
  children: ReactNode;
  bottomTone?: boolean;
  scrollable?: boolean;
  contentClassName?: string;
}) {
  return (
    <div className="relative h-full min-h-full w-full overflow-hidden bg-[var(--ink)] text-[var(--paper)]" style={dreamThemeStyle}>
      <DreamStars />
      <div className="pointer-events-none fixed inset-0 z-[5] opacity-[0.025]" style={{ backgroundImage: dreamNoise, backgroundRepeat: 'repeat', mixBlendMode: 'screen' }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-48 bg-[linear-gradient(180deg,rgba(8,12,24,.92),rgba(8,12,24,0))]" />
      {bottomTone ? <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-[linear-gradient(0deg,rgba(8,12,24,.96),rgba(8,12,24,0))]" /> : null}
      <div
        className={`relative z-10 flex h-full min-h-full min-w-0 flex-col px-5 pb-[calc(2.75rem+var(--app-safe-area-bottom-ui,0px))] pt-[calc(2rem+var(--app-safe-area-top,0px))] sm:px-7 ${scrollable ? 'overflow-y-auto overscroll-contain touch-pan-y' : ''} ${contentClassName}`}
        style={scrollable ? { WebkitOverflowScrolling: 'touch' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export function Avatar({ role, secret, small = false }: { role?: DreamRole | null; secret?: boolean; small?: boolean }) {
  const outer = small ? 'h-[88px] w-[88px]' : 'h-[168px] w-[168px]';
  const inner = small ? 'h-[74px] w-[74px]' : 'h-[88px] w-[88px]';
  const { resolvedUrl } = useResolvedPersistentValue(role?.avatar);
  const avatarSrc = getDisplayableAssetValue(role?.avatar, resolvedUrl);
  const roleName = role?.name ?? '角色';

  return (
    <div className={`relative flex ${outer} items-center justify-center`}>
      <div className="absolute inset-[-28px] rounded-full border border-[rgba(196,169,106,.05)] animate-[pulse_6s_ease-in-out_infinite]" />
      <div className="absolute inset-[-14px] rounded-full border border-[var(--border)] animate-[pulse_5.2s_ease-in-out_infinite]" />
      <div
        className={`relative flex ${inner} items-center justify-center rounded-full border border-[var(--border-mid)]`}
        style={{
          background:
            'radial-gradient(circle at 40% 38%, rgba(196,169,106,.35), rgba(123,168,196,.15) 55%, transparent 75%)',
        }}
      >
        {secret ? (
          <span className="text-[40px] font-[200] text-[var(--gold)]">?</span>
        ) : avatarSrc ? (
          <img alt={roleName} src={avatarSrc} className="h-full w-full rounded-full object-cover" />
        ) : (
          <span className={`${small ? 'text-[24px]' : 'text-[56px]'} font-[200] text-[var(--paper)]`}>{role?.glyph || '梦'}</span>
        )}
      </div>
    </div>
  );
}

export function SealButton({
  label,
  onClick,
  disabled,
  presentation,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  presentation?: DreamPresentationView;
}) {
  const buttonColor = presentation?.accent || 'var(--gold)';
  const buttonBorder = presentation?.frameBorder || 'rgba(196,169,106,.2)';
  const buttonFill = presentation?.accentSoft || 'rgba(196,169,106,.14)';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group relative w-full overflow-hidden border px-6 py-4 text-center text-[13px] font-[400] tracking-[0.48em] transition duration-500 active:scale-[0.99] disabled:opacity-30"
      style={{ borderColor: buttonBorder, backgroundColor: disabled ? 'rgba(13,18,32,.45)' : 'transparent', color: buttonColor }}
    >
      <span className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition duration-500 group-hover:scale-x-100 group-active:scale-x-100" style={{ backgroundColor: buttonFill }} />
      <span className="pointer-events-none absolute inset-[3px] border" style={{ borderColor: buttonBorder }} />
      <span className="relative transition duration-500 group-hover:tracking-[0.62em] group-active:tracking-[0.62em]">{label}</span>
    </button>
  );
}

export function SecondaryAction({
  label,
  onClick,
  className = '',
  disabled = false,
  presentation,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  presentation?: DreamPresentationView;
}) {
  const buttonColor = presentation?.accent || 'var(--gold)';
  const buttonBorder = presentation?.frameBorder || 'rgba(196,169,106,.2)';
  const buttonFill = presentation?.accentSoft || 'rgba(196,169,106,.14)';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative w-full overflow-hidden border px-6 py-4 text-center text-[13px] font-[400] tracking-[0.48em] transition duration-500 active:scale-[0.99] disabled:opacity-30 ${className}`}
      style={{ borderColor: buttonBorder, backgroundColor: disabled ? 'rgba(13,18,32,.45)' : 'transparent', color: buttonColor }}
    >
      <span className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition duration-500 group-hover:scale-x-100 group-active:scale-x-100" style={{ backgroundColor: buttonFill }} />
      <span className="pointer-events-none absolute inset-[3px] border" style={{ borderColor: buttonBorder }} />
      <span className="relative transition duration-500 group-hover:tracking-[0.62em] group-active:tracking-[0.62em]">{label}</span>
    </button>
  );
}

export function DreamNarrativeBlocks({
  blocks,
  presentation,
}: {
  blocks: Array<{
    id: string;
    type: string;
    text: string;
    speakerName?: string;
    align?: 'left' | 'center' | 'right';
    emphasis?: 'low' | 'medium' | 'high';
  }>;
  presentation: DreamPresentationView;
}) {
  return (
    <div className="space-y-6">
      {blocks.map((block) => {
        const alignClass =
          block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : 'text-left';
        const emphasisClass =
          block.emphasis === 'high' ? 'text-[19px] leading-[2.15]' : block.emphasis === 'low' ? 'text-[14px] leading-[2.35]' : 'text-[16px] leading-[2.3]';
        const narrativeShellClass =
          presentation.layoutId === 'cinematic-caption-stream'
            ? 'px-1'
            : presentation.layoutId === 'full-bleed-dialogue-card'
              ? 'border-l pl-5'
              : presentation.layoutId === 'soft-overlay-monologue'
                ? block.type === 'narration'
                  ? 'px-1'
                  : 'rounded-[22px] px-4 py-4'
                : '';
        const narrativeShellStyle =
          presentation.layoutId === 'full-bleed-dialogue-card'
            ? { borderColor: presentation.frameBorder }
            : presentation.layoutId === 'soft-overlay-monologue'
              ? block.type === 'narration'
                ? undefined
                : { backgroundColor: presentation.accentSoft }
              : undefined;

        if (block.type === 'framed-dialogue') {
          return (
            <div
              key={block.id}
              className="rounded-[26px] border px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,.18)]"
              style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.frameFill }}
            >
              {block.speakerName ? (
                <div className="mb-3 text-[11px] tracking-[0.24em]" style={{ color: presentation.accent }}>
                  {block.speakerName}
                </div>
              ) : null}
              <div className={`whitespace-pre-line font-[300] ${alignClass} ${emphasisClass}`} style={{ color: presentation.accent }}>
                {block.text}
              </div>
            </div>
          );
        }

        if (block.type === 'highlight-dialogue') {
          return (
            <div key={block.id} className={`rounded-[20px] px-4 py-3 whitespace-pre-line font-[400] ${alignClass} text-[22px] leading-[2]`} style={{ color: presentation.accent, backgroundColor: presentation.accentSoft }}>
              <span className="inline-block max-w-[28rem]">{block.text}</span>
            </div>
          );
        }

        if (block.type === 'dialogue') {
          return (
            <div key={block.id} className={`rounded-[20px] border px-4 py-3 ${alignClass}`} style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.accentSoft }}>
              {block.speakerName ? (
                <div className="mb-2 text-[11px] tracking-[0.24em]" style={{ color: presentation.accent }}>
                  {block.speakerName}
                </div>
              ) : null}
              <div className={`whitespace-pre-line font-[300] ${emphasisClass}`} style={{ color: presentation.dialogueText || presentation.accent }}>
                {block.text}
              </div>
            </div>
          );
        }

        if (block.type === 'aside') {
          return (
            <div key={block.id} className={`border-l pl-4 ${alignClass}`} style={{ borderColor: presentation.frameBorder }}>
              {block.speakerName ? (
                <div className="mb-2 text-[11px] tracking-[0.24em]" style={{ color: presentation.accent }}>
                  {block.speakerName}
                </div>
              ) : null}
              <div className="whitespace-pre-line text-[15px] font-[300] leading-[2.2] italic" style={{ color: presentation.accent }}>
                {block.text}
              </div>
            </div>
          );
        }

        if (block.type === 'prompt') {
          return (
            <div key={block.id} className="rounded-[18px] border px-4 py-3 text-center text-[12px] tracking-[0.28em]" style={{ color: presentation.accent, borderColor: presentation.frameBorder, backgroundColor: presentation.accentSoft }}>
              {block.text}
            </div>
          );
        }

        if (block.type === 'strikethrough') {
          return (
            <div key={block.id} className={`border-l pl-4 ${alignClass}`} style={{ borderColor: presentation.frameBorder }}>
              <div className="whitespace-pre-line text-[16px] font-[300] leading-[2.25] opacity-70 line-through" style={{ color: presentation.accent }}>
                {block.text.replace(/^~~|~~$/g, '')}
              </div>
            </div>
          );
        }

        if (block.type === 'annotation') {
          return (
            <div key={block.id} className="rounded-[16px] border px-4 py-3" style={{ borderColor: presentation.frameBorder, backgroundColor: 'rgba(255,255,255,.02)' }}>
              <div className="mb-2 text-[10px] tracking-[0.28em]" style={{ color: presentation.accent }}>档案批注</div>
              <div className="whitespace-pre-line text-[14px] font-[300] leading-[2.1]" style={{ color: 'var(--paper-60)' }}>
                {block.text.replace(/^注：/, '')}
              </div>
            </div>
          );
        }

        if (block.type === 'verdict') {
          return (
            <div key={block.id} className="rounded-[18px] border px-4 py-4 text-center" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.frameFill }}>
              <div className="mb-2 text-[10px] tracking-[0.32em]" style={{ color: presentation.accent }}>裁定</div>
              <div className="whitespace-pre-line text-[15px] font-[400] leading-[2.1]" style={{ color: presentation.accent }}>
                {block.text}
              </div>
            </div>
          );
        }

        if (block.type === 'redacted') {
          return (
            <div key={block.id} className="rounded-[16px] border px-4 py-4" style={{ borderColor: presentation.frameBorder, backgroundColor: 'rgba(255,255,255,.02)' }}>
              <div className="mb-2 text-[10px] tracking-[0.28em]" style={{ color: presentation.accent }}>遮蔽记录</div>
              <div className="whitespace-pre-line text-[15px] font-[300] leading-[2.2]" style={{ color: 'var(--paper)' }}>
                {block.text}
              </div>
            </div>
          );
        }

        if (block.type === 'echo-line') {
          const [mainLine, echoLine] = block.text.split('\n');
          return (
            <div key={block.id} className={`border-l px-4 py-2 ${alignClass}`} style={{ borderColor: presentation.frameBorder }}>
              <div className="whitespace-pre-line text-[17px] font-[300] leading-[2.25]">{mainLine}</div>
              {echoLine ? (
                <div className="mt-2 text-[13px] leading-[2] opacity-45" style={{ color: presentation.accent }}>
                  {echoLine}
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <div key={block.id} className={`${narrativeShellClass}`} style={narrativeShellStyle}>
            <div className={`whitespace-pre-line font-[300] text-[17px] leading-[2.35] ${alignClass}`}>
              {block.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}
