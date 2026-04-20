import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react';

import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { generateDreamContinuation } from '../../services/dream/generateDreamContinuation';
import { generateDreamScenario } from '../../services/dream/generateDreamScenario';
import type { DreamDecisionRecord, DreamGeneratedChoice, DreamRuntimeAct, DreamRuntimeScenario } from '../../services/dream/dreamRuntimeTypes';
import type { ApiConfig, Character, Mask, WorldBookEntry } from '../../types';
import { defaultTagSelection, dreamTagGroups, resolveDomainName, resolveScenario } from './dreamContent';
import type { DreamDepth, DreamDomainId, DreamEntryMode, DreamTagCategory } from './types';

type ActiveDreamChoice = DreamGeneratedChoice & {
  reaction: string;
  fromCustom?: boolean;
};

type DreamEndingView = {
  title: string;
  excerpt: string;
  chapter: string;
};

type DreamAftermathView = {
  summary: string;
  detail: string;
  previewMessages: [string, string];
};

type DreamStage =
  | 'splash'
  | 'home'
  | 'role-picker'
  | 'entry'
  | 'tags'
  | 'confirm'
  | 'loading'
  | 'scene'
  | 'choices'
  | 'reaction'
  | 'ending'
  | 'aftermath';

type DreamRole = {
  id: string;
  name: string;
  avatar: string;
  mood: string;
  glyph: string;
};

type DreamEntryOption = {
  id: DreamEntryMode;
  title: string;
  detail: string;
  glyph: string;
  advanced?: boolean;
};

type DreamConfirmPreview = {
  coverSubtitle: string;
  confirmHint: string;
};

const dreamThemeStyle = {
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
} as CSSProperties;

const dreamNoise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`;

function formatDreamTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function buildRoles(characters: Character[]): DreamRole[] {
  return characters.slice(0, 12).map((character) => ({
    id: character.id,
    name: character.remarkName?.trim() || character.name || '未命名角色',
    avatar: character.avatar || '',
    mood: character.signature?.trim() || character.motto?.trim() || character.openingRemark?.trim() || '今夜在等你',
    glyph: (character.remarkName?.trim() || character.name || '梦').trim().charAt(0) || '梦',
  }));
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function pickRandomIds(category: DreamTagCategory, count: number) {
  const group = dreamTagGroups.find((item) => item.category === category);
  if (!group) return [];
  const pool = [...group.options];
  const picked: string[] = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool[index].id);
    pool.splice(index, 1);
  }
  return picked;
}

function buildQuickDreamPreset(): {
  domainId: DreamDomainId;
  depth: DreamDepth;
  selectedTags: Record<DreamTagCategory, string[]>;
  preview: DreamConfirmPreview;
} {
  const domainId = pickRandom(['crowd', 'threshold', 'shared', 'rift'] as const);
  const genre = pickRandomIds('genre', 1);
  const tension = pickRandomIds('tension', 1);
  const drive = pickRandomIds('drive', 1);
  const mood = pickRandomIds('mood', 1);
  const climate = pickRandomIds('climate', 1);
  const participants = pickRandomIds('participants', 1);
  const faction = pickRandomIds('faction', 1);
  const camp = pickRandomIds('camp', 1);
  const identity = pickRandomIds('identity', 1);
  const lead = pickRandomIds('lead', 1);
  const intensity = pickRandomIds('intensity', 1);
  const interaction = pickRandomIds('interaction', 1);
  const ending = pickRandomIds('ending', 1);

  const selectedTags: Record<DreamTagCategory, string[]> = {
    ...defaultTagSelection,
    world: [domainId],
    genre,
    tension,
    drive,
    mood,
    climate,
    participants,
    faction,
    camp,
    identity,
    lead,
    intensity,
    interaction,
    ending,
  };

  const subtitle = `${pickRandom(['今夜的门先开了一条缝', '这一次梦会先把你拖进节点里', '有人已经在梦里等你', '这一局从失衡的瞬间开始'])}`;
  const confirmHint = `${pickRandom(['这场梦不会先解释规则，你要先活过第一幕。', '你们的关系已经被梦改写，进入后再确认谁站在哪一边。', '这一局会先给你一个世界，再逼你做选择。', '梦已经把身份和冲突排好，只等你落进去。'])}`;

  return {
    domainId,
    depth: 'shallow',
    selectedTags,
    preview: {
      coverSubtitle: subtitle,
      confirmHint,
    },
  };
}

function useTypewriter(text: string, active: boolean) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (!active) {
      setValue('');
      return;
    }
    let cancelled = false;
    let index = 0;
    setValue('');
    const step = () => {
      if (cancelled || index >= text.length) return;
      const char = text[index];
      setValue((prev) => prev + char);
      index += 1;
      window.setTimeout(step, /[，。！？；：]/.test(char) ? 180 : 34);
    };
    window.setTimeout(step, 120);
    return () => {
      cancelled = true;
    };
  }, [active, text]);
  return value;
}

function useNarrativeTypewriter(
  blocks: Array<{
    id: string;
    type: string;
    text: string;
    speakerName?: string;
    align?: 'left' | 'center' | 'right';
    emphasis?: 'low' | 'medium' | 'high';
  }>,
  active: boolean,
  scopeKey: string,
) {
  const [visibleBlocks, setVisibleBlocks] = useState<typeof blocks>([]);

  useEffect(() => {
    if (!active || blocks.length === 0) {
      setVisibleBlocks((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    let cancelled = false;
    let blockIndex = 0;
    let charIndex = 0;

    setVisibleBlocks(
      blocks.map((block) => ({
        ...block,
        text: '',
      })),
    );

    const step = () => {
      if (cancelled || blockIndex >= blocks.length) return;
      const sourceBlock = blocks[blockIndex];
      const char = sourceBlock.text[charIndex];
      if (!char) {
        blockIndex += 1;
        charIndex = 0;
        window.setTimeout(step, 120);
        return;
      }

      setVisibleBlocks((prev) =>
        prev.map((block, index) =>
          index === blockIndex
            ? {
                ...block,
                text: `${block.text}${char}`,
              }
            : block,
        ),
      );

      charIndex += 1;
      window.setTimeout(step, /[，。！？；：]/.test(char) ? 180 : 26);
    };

    window.setTimeout(step, 120);
    return () => {
      cancelled = true;
    };
  }, [active, blocks, scopeKey]);

  return visibleBlocks;
}

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

function Shell({
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
    <div className="relative h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-[var(--ink)] text-[var(--paper)]" style={dreamThemeStyle}>
      <DreamStars />
      <div className="pointer-events-none fixed inset-0 z-[5] opacity-[0.025]" style={{ backgroundImage: dreamNoise, backgroundRepeat: 'repeat', mixBlendMode: 'screen' }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-48 bg-[linear-gradient(180deg,rgba(8,12,24,.92),rgba(8,12,24,0))]" />
      {bottomTone ? <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-[linear-gradient(0deg,rgba(8,12,24,.96),rgba(8,12,24,0))]" /> : null}
      <div
        className={`relative z-10 flex h-[100dvh] min-h-[100dvh] min-w-0 flex-col px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-8 sm:px-7 ${scrollable ? 'overflow-y-auto overscroll-contain touch-pan-y' : ''} ${contentClassName}`}
        style={scrollable ? { WebkitOverflowScrolling: 'touch' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function Avatar({ role, secret, small = false }: { role?: DreamRole | null; secret?: boolean; small?: boolean }) {
  const outer = small ? 'h-[88px] w-[88px]' : 'h-[168px] w-[168px]';
  const inner = small ? 'h-[74px] w-[74px]' : 'h-[88px] w-[88px]';
  const { resolvedUrl } = useResolvedPersistentValue(role?.avatar);
  const avatarSrc = getDisplayableAssetValue(role?.avatar, resolvedUrl);
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
          <img alt={role.name} src={avatarSrc} className="h-full w-full rounded-full object-cover" />
        ) : (
          <span className={`${small ? 'text-[24px]' : 'text-[56px]'} font-[200] text-[var(--paper)]`}>{role?.glyph || '梦'}</span>
        )}
      </div>
    </div>
  );
}

function SealButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group relative w-full overflow-hidden border border-[var(--border-mid)] px-6 py-4 text-center text-[13px] font-[400] tracking-[0.48em] text-[var(--gold)] transition duration-500 active:scale-[0.99] disabled:opacity-30"
      style={{ backgroundColor: disabled ? 'rgba(13,18,32,.45)' : 'transparent', color: 'var(--gold)' }}
    >
      <span className="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-[rgba(196,169,106,.14)] transition duration-500 group-hover:scale-x-100 group-active:scale-x-100" />
      <span className="pointer-events-none absolute inset-[3px] border border-[rgba(196,169,106,.15)]" />
      <span className="relative transition duration-500 group-hover:tracking-[0.62em] group-active:tracking-[0.62em]">{label}</span>
    </button>
  );
}

function SecondaryAction({
  label,
  onClick,
  className = '',
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative w-full overflow-hidden border border-[var(--border-mid)] px-6 py-4 text-center text-[13px] font-[400] tracking-[0.48em] text-[var(--gold)] transition duration-500 active:scale-[0.99] disabled:opacity-30 ${className}`}
      style={{ backgroundColor: disabled ? 'rgba(13,18,32,.45)' : 'transparent', color: 'var(--gold)' }}
    >
      <span className="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-[rgba(196,169,106,.14)] transition duration-500 group-hover:scale-x-100 group-active:scale-x-100" />
      <span className="pointer-events-none absolute inset-[3px] border border-[rgba(196,169,106,.15)]" />
      <span className="relative transition duration-500 group-hover:tracking-[0.62em] group-active:tracking-[0.62em]">{label}</span>
    </button>
  );
}

type DreamPresentationView = {
  accent: string;
  accentSoft: string;
  dialogueText: string;
  frameBorder: string;
  frameFill: string;
};

function DreamNarrativeBlocks({
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
    <div className="space-y-5">
      {blocks.map((block) => {
        const alignClass =
          block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : 'text-left';
        const emphasisClass =
          block.emphasis === 'high' ? 'text-[19px] leading-[2.15]' : block.emphasis === 'low' ? 'text-[14px] leading-[2.35]' : 'text-[16px] leading-[2.3]';

        if (block.type === 'framed-dialogue') {
          return (
            <div
              key={block.id}
              className="rounded-[26px] border px-5 py-5"
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
            <div key={block.id} className={`whitespace-pre-line font-[400] ${alignClass} text-[22px] leading-[2]`} style={{ color: presentation.accent }}>
              {block.text}
            </div>
          );
        }

        if (block.type === 'dialogue') {
          return (
            <div key={block.id} className={alignClass}>
              {block.speakerName ? (
                <div className="mb-2 text-[11px] tracking-[0.24em]" style={{ color: presentation.accent }}>
                  {block.speakerName}
                </div>
              ) : null}
              <div className={`whitespace-pre-line font-[300] ${emphasisClass}`} style={{ color: presentation.accent }}>
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
            <div key={block.id} className="text-center text-[12px] tracking-[0.28em]" style={{ color: presentation.accent }}>
              {block.text}
            </div>
          );
        }

        return (
          <div key={block.id} className={`whitespace-pre-line font-[300] text-[17px] leading-[2.35] ${alignClass}`}>
            {block.text}
          </div>
        );
      })}
    </div>
  );
}

function buildRuntimeEndingView(scenario: DreamRuntimeScenario, roleName: string, userName: string): DreamEndingView {
  const { storyFrame, endingInput } = scenario;
  const resolvedUserName = userName.trim() || '你';
  const normalizedSummary = (endingInput.keyActionSummary || '').replaceAll('用户', resolvedUserName);
  return {
    title: storyFrame.worldTitle || scenario.coverTitle || '今夜',
    excerpt:
      normalizedSummary ||
      `${storyFrame.characterDreamIdentity || roleName} 与 ${storyFrame.userDreamIdentity || resolvedUserName} 的这场梦，最终停在 ${storyFrame.coreConflict || '尚未说破的冲突'} 前。`,
    chapter: `《${endingInput.endingDirection || storyFrame.dreamRelationship || '梦局未竟'}》`,
  };
}

function buildRuntimeAftermathView(scenario: DreamRuntimeScenario): DreamAftermathView {
  return {
    summary: scenario.aftermathInput.relationshipShift || '这场梦会在醒来后留下轻微的关系回响。',
    detail:
      scenario.aftermathInput.toneDrift || scenario.aftermathInput.messagePreviewDirection || '明日的聊天语气会沿着这场梦发生偏移。',
    previewMessages: [
      scenario.aftermathInput.messagePreviewDirection || '我还记得昨晚梦里的那一段。',
      scenario.storyFrame.openingNode || '你醒来之后，会先想起哪个瞬间？',
    ],
  };
}

function createDecisionRecord(act: DreamRuntimeAct, choice: ActiveDreamChoice): DreamDecisionRecord {
  return {
    actId: act.id,
    actLabel: act.label,
    choiceId: choice.id,
    title: choice.title,
    direction: choice.direction,
    detail: choice.detail,
    reaction: choice.reaction,
    storyPush: choice.storyPush,
    emotion: choice.emotion,
    fromCustom: choice.fromCustom,
  };
}

function appendDecisionRecord(trail: DreamDecisionRecord[], nextRecord: DreamDecisionRecord | null) {
  if (!nextRecord) return trail;
  const existingIndex = trail.findIndex((record) => record.actId === nextRecord.actId);
  if (existingIndex === -1) return [...trail, nextRecord];
  const cloned = [...trail];
  cloned[existingIndex] = nextRecord;
  return cloned;
}

function upsertDreamAct(acts: DreamRuntimeAct[], nextAct: DreamRuntimeAct, index: number) {
  const cloned = [...acts];
  cloned[index] = nextAct;
  return cloned;
}

function Home({ time: _time, role: _role, onPickRole: _onPickRole, onEnter: _onEnter }: { time: string; role: DreamRole | null; onPickRole: () => void; onEnter: () => void }) {
  return null;
}
/*
function HomeLegacyDeadCode() {
  return (
    <Shell time={time} contentClassName="pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col pb-[calc(3rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between pb-4 text-[12px] tracking-[0.08em] text-[var(--mist)]">
          <div>{time}</div>
          <div className="h-[6px] w-[6px] rounded-full bg-[var(--gold)] animate-[pulse_2.4s_ease-in-out_infinite]" />
        </div>
        <div className="pt-2 text-[30px] font-[200] tracking-[0.32em] text-[var(--paper)]">梦境</div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-start gap-6 pb-8 pt-6 text-center sm:justify-center sm:py-8">
          <button type="button" onClick={onPickRole}><Avatar role={role} /></button>
          {role ? (
            <>
              <div className="hidden">
              <div className="hidden">
                <div className="text-[22px] font-[300] tracking-[0.18em] text-[var(--paper)]">{role.name}</div>
                <div className="text-[12px] font-[300] tracking-[0.18em] text-[var(--mist)]">今夜在做梦</div>
              </div>
              <div className="relative w-full max-w-[320px] border border-[var(--border)] bg-[rgba(196,169,106,.04)] px-7 py-5 text-center">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-[var(--ink)] px-3 text-[10px] tracking-[0.4em] text-[var(--gold)]">今夜</div>
                <div className="text-[15px] font-[300] leading-[2] tracking-[0.12em] text-[var(--paper)]">有一场梦等待进入</div>
                <div className="mt-2 text-[11px] tracking-[0.12em] text-[var(--mist)]">梦将于 06:00 消散</div>
              </div>
              <div className="w-full max-w-[334px]"><SealButton label="进入今夜" onClick={onEnter} /></div>
              <div className="hidden">
                <div className="text-[22px] font-[300] tracking-[0.18em] text-[var(--paper)]">{role.name}</div>
                <div className="text-[13px] font-[300] tracking-[0.18em] text-[var(--mist)]">浠婂鍦ㄥ仛姊?/div>
              </div>
              <div className="hidden">
              <div className="hidden w-full max-w-[320px] border border-[var(--border)] bg-[rgba(13,18,32,.62)] px-5 py-5 text-center">
                <div className="mx-auto -mt-8 mb-3 inline-block bg-[var(--ink)] px-3 text-[11px] tracking-[0.4em] text-[var(--gold)]">浠婂</div>
                <div className="text-[17px] font-[300] leading-[2] text-[var(--paper)]">鏈変竴鍦烘ⅵ绛夊緟杩涘叆</div>
                <div className="mt-2 text-[12px] tracking-[0.18em] text-[var(--mist)]">姊﹀皢浜?06:00 娑堟暎</div>
              </div>
              <div className="w-full max-w-[334px]"><SealButton label="进 入 今 夜" onClick={onEnter} /></div>
              </div>
            </>
          ) : (
            <div className="pt-2 text-[14px] font-[300] tracking-[0.22em] text-[var(--mist)]">点击头像，选择今夜入梦的角色</div>
          )}
        </div>
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <div className="grid grid-cols-3 text-center text-[12px] tracking-[0.28em] text-[var(--mist)]">
            {['今夜', '残响', '深层'].map((tab, index) => (
              <div key={tab} className="space-y-2">
                <div className={index === 0 ? 'text-[var(--gold)]' : ''}>{tab}</div>
                <div className="mx-auto h-[4px] w-[4px] border border-[var(--border)]">{index === 0 ? <div className="h-full w-full bg-[var(--gold)]" /> : null}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

*/
function HomeV2({
  time,
  role,
  onPickRole,
  onEnter,
  onExit,
}: {
  time: string;
  role: DreamRole | null;
  onPickRole: () => void;
  onEnter: () => void;
  onExit: () => void;
}) {
  return (
    <Shell time={time}>
      <div className="flex flex-1 flex-col pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between pb-4 text-[12px] tracking-[0.08em] text-[var(--mist)]">
          <div>{time}</div>
          <div className="h-[6px] w-[6px] rounded-full bg-[var(--gold)] animate-[pulse_2.4s_ease-in-out_infinite]" />
        </div>
        <div className="pt-2 text-[30px] font-[200] tracking-[0.32em] text-[var(--paper)]">梦境</div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-start gap-4 pb-6 pt-2 text-center sm:justify-center sm:gap-6 sm:py-8">
          <button type="button" onClick={onPickRole}>
            <Avatar role={role} />
          </button>
          {role ? (
            <>
              <div className="space-y-2">
                <div className="text-[22px] font-[300] tracking-[0.18em] text-[var(--paper)]">{role.name}</div>
                <div className="text-[12px] font-[300] tracking-[0.18em] text-[var(--mist)]">今夜在做梦</div>
              </div>
              <div className="relative w-full max-w-[320px] border border-[var(--border)] bg-[rgba(196,169,106,.04)] px-7 py-5 text-center">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-[var(--ink)] px-3 text-[10px] tracking-[0.4em] text-[var(--gold)]">今夜</div>
                <div className="text-[15px] font-[300] leading-[2] tracking-[0.12em] text-[var(--paper)]">有一场梦等待进入</div>
                <div className="mt-2 text-[11px] tracking-[0.12em] text-[var(--mist)]">梦将于 06:00 消散</div>
              </div>
              <div className="w-full max-w-[334px]">
                <SealButton label="进入今夜" onClick={onEnter} />
              </div>
              <div className="w-full max-w-[334px]">
                <SecondaryAction label="退出梦境" onClick={onExit} className="mt-1" />
              </div>
            </>
          ) : (
            <div className="pt-2 text-[14px] font-[300] tracking-[0.22em] text-[var(--mist)]">点击头像，选择今夜入梦的角色</div>
          )}
        </div>
        <div className="mt-auto border-t border-[var(--border)] pt-4">
          <div className="grid grid-cols-3 text-center text-[12px] tracking-[0.28em] text-[var(--mist)]">
            {['今夜', '残响', '深层'].map((tab, index) => (
              <div key={tab} className="space-y-2">
                <div className={index === 0 ? 'text-[var(--gold)]' : ''}>{tab}</div>
                <div className="mx-auto h-[4px] w-[4px] border border-[var(--border)]">{index === 0 ? <div className="h-full w-full bg-[var(--gold)]" /> : null}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function TagsStageV2({
  time,
  selectedRole,
  dreamDepth,
  setDreamDepth,
  selectedTags,
  toggleTag,
  detailExpanded,
  setDetailExpanded,
  selectedLabels,
  onBack,
  onConfirm,
}: {
  time: string;
  selectedRole: DreamRole;
  dreamDepth: DreamDepth;
  setDreamDepth: (depth: DreamDepth) => void;
  selectedTags: Record<DreamTagCategory, string[]>;
  toggleTag: (category: DreamTagCategory, optionId: string, max: number) => void;
  detailExpanded: boolean;
  setDetailExpanded: Dispatch<SetStateAction<boolean>>;
  selectedLabels: string[];
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Shell time={time} scrollable contentClassName="pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col pb-[calc(9rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-5 border-b border-[var(--border)] pb-5 pt-1">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center text-[34px] font-[500] leading-none"
            style={{ color: '#D9C08A', textShadow: '0 0 18px rgba(196,169,106,.42)', opacity: 1 }}
          >
            ‹
          </button>
          <div className="text-[16px] tracking-[0.24em] text-[var(--gold)]">自定义入梦</div>
        </div>

        <div className="mt-8 border-b border-[var(--border)] pb-7">
          <div className="mb-6 flex items-center gap-4">
            <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">梦型</div>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { id: 'shallow', title: '浅梦', detail: '4-5 轮，一局一结，更像短篇。' },
              { id: 'deep', title: '深梦', detail: '更长更沉，幕与幕之间会继续下去。' },
            ] as const).map((item) => {
              const active = dreamDepth === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDreamDepth(item.id)}
                  className="border px-4 py-4 text-left transition duration-300"
                  style={{
                    borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)',
                    backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.65)',
                  }}
                >
                  <div className={`text-[15px] tracking-[0.18em] ${active ? 'text-[var(--gold-bright)]' : 'text-[var(--jade)]'}`}>{item.title}</div>
                  <div className="mt-2 text-[11px] leading-[1.8] tracking-[0.08em] text-[var(--mist)]">{item.detail}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-9">
          {dreamTagGroups
            .filter((group) => !group.detailed)
            .map((group) => {
              const activeIds = selectedTags[group.category] ?? [];
              return (
                <div key={group.category} className="border-b border-[var(--border)] pb-7">
                  <div className="mb-6 flex items-center gap-4">
                    <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">{group.label}</div>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {group.options.map((option) => {
                      const active = activeIds.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleTag(group.category, option.id, group.max)}
                          className="border px-5 py-4 text-[12px] tracking-[0.2em] transition duration-300"
                          style={{
                            borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)',
                            backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.65)',
                            color: active ? 'var(--gold-bright)' : 'var(--jade)',
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        <div className="mt-6 border-b border-t border-[var(--border)] py-5">
          <button type="button" onClick={() => setDetailExpanded((prev) => !prev)} className="flex w-full items-center justify-between text-left">
            <span className="text-[13px] tracking-[0.2em] text-[var(--mist)]">细化标签</span>
            <span className="text-[22px] leading-none text-[var(--jade)]">{detailExpanded ? '˄' : '˅'}</span>
          </button>
        </div>

        {detailExpanded ? (
          <div className="mt-8 flex flex-col gap-9">
            {dreamTagGroups
              .filter((group) => group.detailed)
              .map((group) => {
                const activeIds = selectedTags[group.category] ?? [];
                return (
                  <div key={group.category} className="border-b border-[var(--border)] pb-7">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">{group.label}</div>
                      <div className="h-px flex-1 bg-[var(--border)]" />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {group.options.map((option) => {
                        const active = activeIds.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleTag(group.category, option.id, group.max)}
                            className="border px-5 py-4 text-[12px] tracking-[0.2em] transition duration-300"
                            style={{
                              borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)',
                              backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.65)',
                              color: active ? 'var(--gold-bright)' : 'var(--jade)',
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[rgba(5,8,14,.96)] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5">
          <div className="mx-auto flex max-w-[390px] items-center justify-between gap-4">
            <div className="text-[12px] tracking-[0.16em] text-[var(--jade)]">已选 {selectedLabels.length} 项</div>
            <button
              type="button"
              onClick={onConfirm}
              className="relative w-[62%] overflow-hidden border px-6 py-4 text-center text-[13px] tracking-[0.48em] transition duration-500 active:scale-[0.99]"
              style={{
                borderColor: 'rgba(196,169,106,.2)',
                color: 'var(--gold)',
                backgroundColor: 'transparent',
              }}
            >
              <span className="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-[rgba(196,169,106,.14)] transition duration-500 hover:scale-x-100" />
              <span className="pointer-events-none absolute inset-[3px] border border-[rgba(196,169,106,.15)]" />
              <span className="relative">开始做梦</span>
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function ConfirmStageV2({
  time,
  entryMode,
  selectedRole,
  selectedDomain,
  scenario,
  preview,
  selectedLabels,
  onBack,
  onConfirm,
}: {
  time: string;
  entryMode: DreamEntryMode;
  selectedRole: DreamRole;
  selectedDomain: DreamDomainId;
  scenario: ReturnType<typeof resolveScenario>;
  preview?: DreamConfirmPreview | null;
  selectedLabels: string[];
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Shell time={time} scrollable contentClassName="pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">
          {entryMode === 'character' ? '角色入梦' : `${resolveDomainName(selectedDomain)} · ${scenario.coverTitle}`}
        </div>

        {entryMode === 'character' ? (
          <div className="mt-10 flex flex-1 flex-col items-center justify-start pb-[calc(4rem+env(safe-area-inset-bottom))] text-center sm:mt-12 sm:justify-center">
            <div className="relative px-7">
              <div className="absolute left-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
              <div className="absolute right-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
              <Avatar role={selectedRole} small />
            </div>
            <div className="mt-10 text-[34px] font-[200] tracking-[0.12em] text-[var(--paper)]">{selectedRole.name}</div>
            <div className="mt-4 text-[13px] tracking-[0.2em] text-[#9EBEE2]">TA的梦，TA来决定</div>
            <div className="mt-8 space-y-4 text-[15px] leading-[2.1] tracking-[0.18em] text-[var(--jade)]">
              <div className="text-[#9EBEE2]">这场梦由TA决定</div>
              <div>你进入后才会逐渐知道</div>
              <div>身份 · 阵营 · 你们之间是什么关系</div>
            </div>
            <div className="mt-12 w-full max-w-[420px]"><SealButton label="确认入梦" onClick={onConfirm} /></div>
            <div className="w-full max-w-[420px]">
              <SecondaryAction label="← 换一种入梦方式" onClick={onBack} className="mt-5" />
            </div>
          </div>
        ) : (
          <>
            <div className="mt-10 flex flex-col items-center text-center">
              <div className="relative px-7">
                <div className="absolute left-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                <div className="absolute right-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                <Avatar role={selectedRole} small />
              </div>
              <div className="mt-8 text-[28px] font-[200] tracking-[0.18em] text-[var(--paper)]">{selectedRole.name}</div>
              <div className="mt-3 text-[13px] tracking-[0.18em] text-[var(--mist)]">{preview?.coverSubtitle || scenario.coverSubtitle}</div>
            </div>
            <div className="mt-10 flex-1">
              <div className="flex flex-wrap justify-center gap-3">
                {selectedLabels.map((label) => (
                  <div key={label} className="border px-4 py-3 text-[12px] tracking-[0.2em] text-[var(--gold)]" style={{ borderColor: 'rgba(196,169,106,.18)', backgroundColor: 'rgba(13,18,32,.7)' }}>
                    {label}
                  </div>
                ))}
              </div>
              <div className="mt-8 text-center text-[13px] leading-[2.2] tracking-[0.16em] text-[var(--mist)]">{preview?.confirmHint || scenario.confirmHint}</div>
            </div>
            <div className="mt-10 w-full pb-2"><SealButton label="确认入梦" onClick={onConfirm} /></div>
            <div className="w-full">
              <SecondaryAction label="← 换一种入梦方式" onClick={onBack} className="mt-3" />
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

function EntrySheet({
  role,
  onChoose,
  onClose,
}: {
  role: DreamRole;
  onChoose: (mode: DreamEntryMode) => void;
  onClose: () => void;
}) {
  const options: DreamEntryOption[] = [
    {
      id: 'quick',
      title: '一键入梦',
      detail: '系统自动给出世界观、关系张力、剧情驱动与情绪底色。',
      glyph: '壹',
    },
    {
      id: 'custom',
      title: '自定义入梦',
      detail: '你先挑标签，再决定这场梦该往哪里沉。',
      glyph: '定',
    },
    {
      id: 'character',
      title: '角色入梦',
      detail: `这一场梦由 ${role.name} 来决定。你进入之后，才会渐渐知道自己的位置。`,
      glyph: '隐',
      advanced: true,
    },
  ];

  return (
    <div className="absolute inset-0 z-20 bg-[rgba(3,5,9,.44)]" style={dreamThemeStyle}>
      <button type="button" aria-label="关闭入梦方式" className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.65, ease: [0.2, 0.8, 0.4, 1] }}
        className="absolute inset-x-0 bottom-0 max-h-[min(88vh,calc(100dvh-16px))] overflow-y-auto overscroll-contain touch-pan-y border-t border-[var(--border)] bg-[var(--deep)] px-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 [webkit-overflow-scrolling:touch]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto h-[3px] w-10 rounded-[2px] bg-[var(--mist)] opacity-30" />
        <div className="mt-7 text-center text-[12px] tracking-[0.42em] text-[var(--mist)]">入 梦 方 式</div>
        <div className="mt-7">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChoose(option.id)}
              className="flex w-full items-start gap-4 border-b border-[var(--border)] px-1 py-5 text-left transition duration-300 hover:bg-[rgba(196,169,106,.04)]"
            >
              <div className="mt-1 flex h-10 w-10 flex-none items-center justify-center border border-[var(--border)] text-[16px] text-[var(--gold)]">
                {option.glyph}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[16px] font-[400] tracking-[0.12em] text-[var(--paper)]">{option.title}</div>
                  {option.advanced ? (
                    <span className="inline-flex border border-[rgba(123,168,196,.25)] px-2 py-[2px] text-[9px] tracking-[0.18em] text-[var(--jade)]">
                      高级
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-[12px] leading-[1.7] tracking-[0.08em] text-[var(--mist)]">{option.detail}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-6 text-center">
          <button type="button" onClick={onClose} className="text-[11px] tracking-[0.3em] text-[#8FB3D8]">
            返 回 今 夜
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function DreamAppPage({
  onBack,
  characters,
  userName,
  activeConfig,
  masks,
  worldBooks,
}: {
  onBack: () => void;
  characters: Character[];
  userName: string;
  activeConfig: ApiConfig;
  masks: Mask[];
  worldBooks: WorldBookEntry[];
}) {
  const roles = useMemo(() => buildRoles(characters), [characters]);
  const [time, setTime] = useState(formatDreamTime);
  const [stage, setStage] = useState<DreamStage>('splash');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(roles[0]?.id ?? null);
  const [entryMode, setEntryMode] = useState<DreamEntryMode>('quick');
  const [selectedDomain, setSelectedDomain] = useState<DreamDomainId>('shared');
  const [dreamDepth, setDreamDepth] = useState<DreamDepth>('shallow');
  const [selectedTags, setSelectedTags] = useState<Record<DreamTagCategory, string[]>>(defaultTagSelection);
  const [confirmPreview, setConfirmPreview] = useState<DreamConfirmPreview | null>(null);
  const [detailExpanded, setDetailExpanded] = useState(true);
  const [actIndex, setActIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<ActiveDreamChoice | null>(null);
  const [previewChoiceId, setPreviewChoiceId] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [customInputOpen, setCustomInputOpen] = useState(false);
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);
  const [isGeneratingNextAct, setIsGeneratingNextAct] = useState(false);
  const [isEndingDeepDream, setIsEndingDeepDream] = useState(false);
  const [closingActId, setClosingActId] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [runtimeScenario, setRuntimeScenario] = useState<DreamRuntimeScenario | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === selectedRoleId) ?? characters[0] ?? null,
    [characters, selectedRoleId],
  );
  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null, [roles, selectedRoleId]);
  const previewScenario = useMemo(() => resolveScenario(selectedDomain, dreamDepth), [selectedDomain, dreamDepth]);
  const scenario = runtimeScenario ?? previewScenario;
  const act = runtimeScenario?.acts[actIndex] ?? null;
  const presentation = runtimeScenario?.presentation ?? {
    accent: 'var(--gold)',
    accentSoft: 'rgba(196,169,106,.12)',
    dialogueText: 'var(--gold-bright)',
    frameBorder: 'rgba(196,169,106,.28)',
    frameFill: 'rgba(13,18,32,.72)',
  };
  const storyFrame = runtimeScenario?.storyFrame ?? null;
  const sceneBlocks = useMemo(() => act?.narrative.pages[0]?.blocks ?? [], [act]);
  const typedSceneBlocks = useNarrativeTypewriter(sceneBlocks, stage === 'scene', `${runtimeScenario?.id || 'preview'}-${act?.id || 'none'}-scene`);
  const hasSceneContent = sceneBlocks.length > 0 && sceneBlocks.some((block) => block.text.trim());
  const sceneReady =
    hasSceneContent
    && typedSceneBlocks.length === sceneBlocks.length
    && typedSceneBlocks.every((block, index) => block.text === sceneBlocks[index]?.text);
  const isDeepDream = runtimeScenario?.depth === 'deep';
  const isClosingAct = Boolean(act && closingActId && act.id === closingActId);
  const isLastGeneratedAct = Boolean(runtimeScenario && actIndex === runtimeScenario.acts.length - 1);
  const endingView = runtimeScenario && selectedRole ? buildRuntimeEndingView(runtimeScenario, selectedRole.name, userName) : scenario.ending;
  const aftermathView = runtimeScenario ? buildRuntimeAftermathView(runtimeScenario) : scenario.aftermath;
  const reactionFullText = selectedChoice ? `${selectedChoice.reaction}\n\n${selectedChoice.storyPush}` : '';
  const reactionText = useTypewriter(
    reactionFullText,
    stage === 'reaction',
  );
  const choiceHoldTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatDreamTime()), 20000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roles.length) return;
    if (!selectedRoleId || !roles.some((role) => role.id === selectedRoleId)) setSelectedRoleId(roles[0].id);
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (stage !== 'splash') return;
    const timer = window.setTimeout(() => setStage('home'), 3200);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'loading' || !selectedRole || !selectedCharacter) return;
    let cancelled = false;
    setLoadingError(null);
    setRuntimeScenario(null);
    setLoadingProgress(12);
    const progressTimer = window.setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 92) return prev;
        return Math.min(92, prev + 1 + Math.random() * 3.5);
      });
    }, 180);

    generateDreamScenario({
      activeConfig,
      character: selectedCharacter,
      masks,
      worldBooks,
      selection: {
        entryMode,
        domainId: selectedDomain,
        depth: dreamDepth,
        selectedTags,
      },
    })
      .then((generatedScenario) => {
        if (cancelled) return;
        window.clearInterval(progressTimer);
        setRuntimeScenario(generatedScenario);
        localStorage.setItem(
          'dream_app_latest_session',
          JSON.stringify({
            mode: entryMode,
            roleId: selectedCharacter.id,
            domain: selectedDomain,
            depth: dreamDepth,
            selectedTags,
            scenario: generatedScenario,
            createdAt: Date.now(),
          }),
        );
        setLoadingProgress(100);
        setActIndex(0);
        setSelectedChoice(null);
        setClosingActId(null);
        setCustomInput('');
        window.setTimeout(() => {
          if (!cancelled) setStage('scene');
        }, 260);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        window.clearInterval(progressTimer);
        setLoadingProgress(0);
        setLoadingError(error instanceof Error ? error.message : '梦境生成失败');
      });

    return () => {
      cancelled = true;
      window.clearInterval(progressTimer);
    };
  }, [activeConfig, dreamDepth, entryMode, masks, selectedCharacter, selectedDomain, selectedRole, selectedTags, stage, worldBooks]);

  useEffect(() => {
    if (stage !== 'choices') {
      setPreviewChoiceId(null);
      setCustomInputOpen(false);
      if (choiceHoldTimerRef.current) {
        window.clearTimeout(choiceHoldTimerRef.current);
        choiceHoldTimerRef.current = null;
      }
    }
  }, [stage]);

  useEffect(() => {
    if (!runtimeScenario || !selectedCharacter) return;
    localStorage.setItem(
      'dream_app_latest_session',
      JSON.stringify({
        mode: entryMode,
        roleId: selectedCharacter.id,
        domain: selectedDomain,
        depth: dreamDepth,
        selectedTags,
        scenario: runtimeScenario,
        createdAt: Date.now(),
      }),
    );
  }, [dreamDepth, entryMode, runtimeScenario, selectedCharacter, selectedDomain, selectedTags]);

  const openEntry = () => {
    if (!selectedRole) {
      setStage('role-picker');
      return;
    }
    setStage('entry');
  };

  const chooseMode = (mode: DreamEntryMode) => {
    setEntryMode(mode);
    if (mode === 'quick') {
      const preset = buildQuickDreamPreset();
      setSelectedDomain(preset.domainId);
      setDreamDepth(preset.depth);
      setSelectedTags(preset.selectedTags);
      setConfirmPreview(preset.preview);
      setStage('confirm');
      return;
    }
    if (mode === 'character') {
      setSelectedDomain('rift');
      setDreamDepth('deep');
      setSelectedTags({ ...defaultTagSelection, world: ['rift'], lead: ['character-lead'], mood: ['secret'], tension: ['forbidden'] });
      setConfirmPreview(null);
      setStage('confirm');
      return;
    }
    setSelectedDomain('shared');
    setDreamDepth('shallow');
    setConfirmPreview(null);
    setStage('tags');
  };

  const toggleTag = (category: DreamTagCategory, optionId: string, max: number) => {
    setSelectedTags((prev) => {
      const current = prev[category] ?? [];
      const group = dreamTagGroups.find((item) => item.category === category);
      const isSingleSelect = category === 'world' || category === 'participants';
      const isUnlimitedDetailed = Boolean(group?.detailed);
      let next: string[];
      if (isSingleSelect) {
        next = [optionId];
      } else if (isUnlimitedDetailed) {
        next = current.includes(optionId)
          ? current.filter((item) => item !== optionId)
          : [...current, optionId];
      } else {
        next = current.includes(optionId)
          ? current.filter((item) => item !== optionId)
          : [...current.slice(-(Math.max(max - 1, 0))), optionId];
      }
      if (category === 'world' && next[0]) setSelectedDomain(next[0] as DreamDomainId);
      return { ...prev, [category]: next };
    });
  };

  const continueDeeper = async () => {
    if (!runtimeScenario || !selectedCharacter || !selectedChoice || isGeneratingNextAct || isEndingDeepDream) return;
    setLoadingError(null);
    setIsGeneratingNextAct(true);
    try {
      const payload = await generateDreamContinuation({
        activeConfig,
        character: selectedCharacter,
        masks,
        worldBooks,
        selection: {
          entryMode,
          domainId: selectedDomain,
          depth: dreamDepth,
          selectedTags,
        },
        scenario: runtimeScenario,
        actIndex,
        mode: 'deeper',
        selectedChoice,
      });

      if (!payload.nextActs || payload.nextActs.length === 0) {
        throw new Error('深梦续写没有返回新的下沉段。');
      }

      setRuntimeScenario((prev) =>
        prev
          ? {
              ...prev,
              acts: [...prev.acts, ...payload.nextActs],
            }
          : prev,
      );
      setActIndex((prev) => prev + 1);
      setSelectedChoice(null);
      setStage('scene');
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : '深梦继续失败');
    } finally {
      setIsGeneratingNextAct(false);
    }
  };

  const submitCustomChoice = async () => {
    if (!runtimeScenario || !selectedCharacter || !act || !customInput.trim() || isSubmittingCustom || isGeneratingNextAct || isEndingDeepDream) return;
    const needsNextAct = isDeepDream || actIndex < runtimeScenario.acts.length - 1;
    setLoadingError(null);
    setIsSubmittingCustom(true);
    try {
      const payload = await generateDreamContinuation({
        activeConfig,
        character: selectedCharacter,
        masks,
        worldBooks,
        selection: {
          entryMode,
          domainId: selectedDomain,
          depth: dreamDepth,
          selectedTags,
        },
        scenario: runtimeScenario,
        actIndex,
        mode: 'custom',
        userInput: customInput.trim(),
      });

      if (needsNextAct) {
        if (!payload.nextAct) {
          throw new Error('自定义续写没有返回下一幕。');
        }

        setRuntimeScenario((prev) =>
          prev
            ? {
                ...prev,
                acts: upsertDreamAct(prev.acts, payload.nextAct!, actIndex + 1),
              }
            : prev,
        );
      }

      const nextChoice = {
        id: `custom-${Date.now()}`,
        title: '自定义描述',
        direction: '按你的描述推进',
        detail: customInput.trim(),
        reactionHint: payload.reactionText || '梦按你的描述发生了偏转。',
        storyPush: payload.storyPush || payload.nextAct?.progression.plotAdvance || act.progression.plotAdvance || '主线沿着你的输入继续下沉。',
        emotion: payload.emotion || '回响',
        reaction: payload.reactionText || '梦按你的描述继续往下走。',
        fromCustom: true,
      };
      setRuntimeScenario((prev) =>
        prev
          ? {
              ...prev,
              decisionTrail: appendDecisionRecord(prev.decisionTrail, createDecisionRecord(act, nextChoice)),
            }
          : prev,
      );
      setSelectedChoice(nextChoice);
      setCustomInput('');
      setCustomInputOpen(false);
      setStage('reaction');
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : '自定义续写失败');
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  const endDeepDream = async () => {
    if (!runtimeScenario || !selectedCharacter || isGeneratingNextAct || isEndingDeepDream) return;
    setLoadingError(null);
    setIsEndingDeepDream(true);
    try {
      const payload = await generateDreamContinuation({
        activeConfig,
        character: selectedCharacter,
        masks,
        worldBooks,
        selection: {
          entryMode,
          domainId: selectedDomain,
          depth: dreamDepth,
          selectedTags,
        },
        scenario: runtimeScenario,
        actIndex,
        mode: 'deep-end',
        selectedChoice,
      });

      if (!payload.finalAct || !payload.endingInput || !payload.aftermathInput) {
        throw new Error('深梦收束没有返回完整的最后一幕与结局。');
      }

      setRuntimeScenario((prev) =>
        prev
          ? {
              ...prev,
              acts: [...prev.acts, payload.finalAct!],
              endingInput: payload.endingInput!,
              aftermathInput: payload.aftermathInput!,
            }
          : prev,
      );
      setClosingActId(payload.finalAct.id);
      setActIndex((prev) => prev + 1);
      setSelectedChoice(null);
      setStage('scene');
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : '结束做梦失败');
    } finally {
      setIsEndingDeepDream(false);
    }
  };

  const goNextFromReaction = async () => {
    if (actIndex < scenario.acts.length - 1) {
      setActIndex((prev) => prev + 1);
      setSelectedChoice(null);
      setStage('scene');
      return;
    }
    if (isDeepDream && !isClosingAct) {
      await continueDeeper();
      return;
    }
    setStage('ending');
  };

  const restart = () => {
    setEntryMode('quick');
    setSelectedDomain('shared');
    setDreamDepth('shallow');
    setSelectedTags(defaultTagSelection);
    setDetailExpanded(false);
    setActIndex(0);
    setSelectedChoice(null);
    setPreviewChoiceId(null);
    setLoadingProgress(0);
    setCustomInput('');
    setCustomInputOpen(false);
    setConfirmPreview(null);
    setIsSubmittingCustom(false);
    setIsGeneratingNextAct(false);
    setIsEndingDeepDream(false);
    setClosingActId(null);
    setRuntimeScenario(null);
    setStage('home');
  };

  const selectedLabels = dreamTagGroups.flatMap((group) => group.options.filter((option) => (selectedTags[group.category] ?? []).includes(option.id)).map((option) => option.label));
  const baseTagGroups = dreamTagGroups.filter((group) => !group.detailed);
  const detailedTagGroups = dreamTagGroups.filter((group) => group.detailed);

  const loadingLabel =
    loadingProgress < 25
      ? '正在入梦'
      : loadingProgress < 50
        ? '梦域生成中'
        : loadingProgress < 75
          ? '场景浮现'
          : '进入其中';

  const beginChoicePreview = (choiceId: string) => {
    if (choiceHoldTimerRef.current) {
      window.clearTimeout(choiceHoldTimerRef.current);
    }
    choiceHoldTimerRef.current = window.setTimeout(() => {
      setPreviewChoiceId(choiceId);
    }, 620);
  };

  const cancelChoicePreview = () => {
    if (choiceHoldTimerRef.current) {
      window.clearTimeout(choiceHoldTimerRef.current);
      choiceHoldTimerRef.current = null;
    }
  };

  const retryDreamGeneration = () => {
    setLoadingError(null);
    setLoadingProgress(0);
    setStage('confirm');
    window.requestAnimationFrame(() => {
      setStage('loading');
    });
  };

  return (
    <>
        {stage === 'splash' && (
          <Shell time={time} contentClassName="pb-[calc(6rem+env(safe-area-inset-bottom))]">
            <div className="flex min-h-[calc(100dvh-5rem)] flex-1 items-start justify-center pt-[24vh] sm:pt-[22vh]">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4 }} className="space-y-6 text-center">
                <div className="text-[72px] font-[200] tracking-[0.2em] text-[var(--paper)]">梦</div>
                <div className="mx-auto h-px w-20 bg-[var(--border-mid)]" />
                <div className="text-[11px] tracking-[0.52em] text-[var(--paper-60)]">局 · 梦 · 夜</div>
              </motion.div>
            </div>
          </Shell>
        )}
        {(stage === 'home' || stage === 'entry') && (
          <div className="relative">
          <HomeV2 time={time} role={selectedRole} onPickRole={() => setStage('role-picker')} onEnter={openEntry} onExit={onBack} />
            <AnimatePresence initial={false}>
              {stage === 'entry' && selectedRole ? (
                <EntrySheet role={selectedRole} onChoose={chooseMode} onClose={() => setStage('home')} />
              ) : null}
            </AnimatePresence>
          </div>
        )}
        {stage === 'role-picker' && (
          <Shell time={time} scrollable contentClassName="pb-[calc(6rem+env(safe-area-inset-bottom))]">
            <div className="flex flex-1 flex-col pb-[calc(2rem+env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => setStage('home')} className="self-center border border-[var(--border)] px-6 py-2 text-[11px] tracking-[0.4em] text-[var(--mist)]">返 回</button>
              <div className="mt-10 text-center text-[14px] tracking-[0.36em] text-[var(--mist)]">选择入梦角色</div>
              <div className="mt-8 flex flex-1 flex-col gap-4">
                {roles.map((role) => {
                  const active = selectedRoleId === role.id;
                  return (
                    <button key={role.id} type="button" onClick={() => { setSelectedRoleId(role.id); setStage('home'); }} className="border px-4 py-5 text-left transition duration-300" style={{ borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)', backgroundColor: active ? 'rgba(19,25,38,.92)' : 'rgba(13,18,32,.76)' }}>
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
            </div>
          </Shell>
        )}
        {stage === 'tags' && selectedRole && (
          <TagsStageV2
            time={time}
            selectedRole={selectedRole}
            dreamDepth={dreamDepth}
            setDreamDepth={setDreamDepth}
            selectedTags={selectedTags}
            toggleTag={toggleTag}
            detailExpanded={detailExpanded}
            setDetailExpanded={setDetailExpanded}
            selectedLabels={selectedLabels}
            onBack={() => setStage('entry')}
            onConfirm={() => setStage('confirm')}
          />
        )}
        {false && stage === 'tags' && selectedRole && (
          <Shell time={time} scrollable>
            <div className="flex flex-1 flex-col">
              <div className="mt-7 text-center text-[12px] tracking-[0.56em] text-[var(--mist)]">{resolveDomainName(selectedDomain)} · {dreamDepth === 'deep' ? '深梦' : '浅梦'}</div>
              <div className="mt-8 flex flex-col items-center text-center">
                <Avatar role={selectedRole} small />
                <div className="mt-5 text-[22px] font-[200] tracking-[0.18em] text-[var(--paper)]">{selectedRole.name}</div>
                <div className="mt-2 text-[13px] tracking-[0.18em] text-[var(--mist)]">他正等你</div>
              </div>
              <div className="mt-8 border-y border-[var(--border)] py-5">
                <div className="text-[11px] tracking-[0.38em] text-[var(--mist)]">梦 型</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {([
                    {
                      id: 'shallow',
                      title: '浅梦',
                      detail: '4-5 轮，一局一结，更像短篇。',
                    },
                    {
                      id: 'deep',
                      title: '深梦',
                      detail: '更长更沉，幕与幕之间会继续往下走。',
                    },
                  ] as const).map((item) => {
                    const active = dreamDepth === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setDreamDepth(item.id)}
                        className="border px-4 py-4 text-left transition duration-300"
                        style={{
                          borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)',
                          backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.65)',
                        }}
                      >
                        <div className={`text-[15px] tracking-[0.18em] ${active ? 'text-[var(--gold-bright)]' : 'text-[var(--gold)]'}`}>{item.title}</div>
                        <div className="mt-2 text-[11px] leading-[1.8] tracking-[0.08em] text-[var(--mist)]">{item.detail}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-6 flex flex-1 flex-col gap-5">
                {dreamTagGroups.map((group) => {
                  const hidden = group.detailed && !detailExpanded;
                  const activeIds = selectedTags[group.category] ?? [];
                  return (
                    <div key={group.category} className="transition duration-300" style={{ opacity: hidden ? 0 : 1, pointerEvents: hidden ? 'none' : 'auto', height: hidden ? 0 : 'auto', overflow: 'hidden' }}>
                      <div className="mb-3 text-[11px] tracking-[0.42em] text-[var(--mist)]">{group.label}</div>
                      <div className="flex flex-wrap gap-3">
                        {group.options.map((option) => {
                          const active = activeIds.includes(option.id);
                          return (
                            <button key={option.id} type="button" onClick={() => toggleTag(group.category, option.id, group.max)} className="border px-4 py-3 text-[12px] tracking-[0.2em] transition duration-300" style={{ borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)', backgroundColor: active ? 'rgba(196,169,106,.1)' : 'rgba(13,18,32,.65)', color: active ? 'var(--gold-bright)' : 'var(--gold)' }}>
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 border border-[rgba(196,169,106,.16)] bg-[rgba(13,18,32,.56)] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[12px] tracking-[0.32em] text-[var(--gold)]">细化规则</div>
                    <div className="mt-2 text-[11px] leading-[1.8] tracking-[0.12em] text-[var(--mist)]">细化标签已经默认展开，你可以继续控制 NPC / 阵营、角色身份、主导度、互动强度和结局倾向。</div>
                    <div className="mt-3 text-[11px] tracking-[0.18em] text-[var(--gold-bright)]">已选 {selectedLabels.length} 项</div>
                  </div>
                  <button type="button" onClick={() => setDetailExpanded((prev) => !prev)} className="shrink-0 border border-[rgba(196,169,106,.2)] px-3 py-2 text-[12px] tracking-[0.22em] text-[var(--gold)]">
                    {detailExpanded ? '收起' : '展开'}
                  </button>
                </div>
              </div>
              <div className="mt-6 border-t border-[var(--border)] pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] tracking-[0.18em] text-[var(--gold-bright)]">
                    已选 {selectedLabels.length} 项
                  </div>
                  <button type="button" onClick={() => setDetailExpanded((prev) => !prev)} className="text-[12px] tracking-[0.28em] text-[var(--mist)]">{detailExpanded ? '收 起 细 化' : '展 开 细 化'}</button>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <button type="button" onClick={() => setStage('entry')} className="text-[12px] tracking-[0.28em] text-[var(--mist)]">返 回 选 择</button>
                  <div className="w-[54%]">
                    <SealButton label="前 往 确 认" onClick={() => setStage('confirm')} />
                  </div>
                </div>
              </div>
            </div>
          </Shell>
        )}
        {stage === 'confirm' && selectedRole && (
          <ConfirmStageV2
            time={time}
            entryMode={entryMode}
            selectedRole={selectedRole}
            selectedDomain={selectedDomain}
            scenario={scenario}
            preview={confirmPreview}
            selectedLabels={selectedLabels}
            onBack={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')}
            onConfirm={() => setStage('loading')}
          />
        )}
        {/* {false && stage === 'confirm' && selectedRole && (
          <Shell time={time} scrollable>
            <div className="flex flex-1 flex-col">
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{entryMode === 'character' ? '角 色 入 梦' : `${resolveDomainName(selectedDomain)} · ${scenario.coverTitle}`}</div>
              <div className={`mt-10 flex flex-col items-center text-center ${entryMode === 'character' ? 'hidden' : ''}`}>
                <div className="relative px-7">
                  <div className="absolute left-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                  <div className="absolute right-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                  <Avatar role={selectedRole} small secret={entryMode === 'character'} />
                </div>
                <div className="mt-8 text-[28px] font-[200] tracking-[0.18em] text-[var(--paper)]">{selectedRole.name}</div>
                <div className="mt-3 text-[13px] tracking-[0.18em] text-[var(--mist)]">{entryMode === 'character' ? '他的梦，他来决定' : scenario.coverSubtitle}</div>
              </div>
              {entryMode === 'character' ? (
                <div className="mt-12 flex flex-1 flex-col items-center justify-center text-center">
                  <div className="relative px-7">
                    <div className="absolute left-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                    <div className="absolute right-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                    <div className="flex h-[92px] w-[92px] items-center justify-center border border-[var(--border)] text-[44px] text-[var(--gold)]">?</div>
                  </div>
                  <div className="mt-10 text-[34px] font-[200] tracking-[0.12em] text-[var(--paper)]">{selectedRole.name}</div>
                  <div className="mt-4 text-[13px] tracking-[0.2em] text-[var(--jade)]">他的梦，他来决定</div>
                  <div className="mt-14 flex h-20 w-20 items-center justify-center border border-[rgba(196,169,106,.08)] text-[26px] text-[var(--jade)]">♦</div>
                  <div className="mt-8 space-y-4 text-[15px] leading-[2.1] tracking-[0.18em] text-[var(--jade)]">
                    <div>这场梦由他决定</div>
                    <div>你进入后才会逐渐知道</div>
                    <div>身份 · 阵营 · 你们之间是什么关系</div>
                  </div>
                </div>
              ) : false && entryMode === 'character' ? (
                <div className="mt-12 flex flex-1 flex-col items-center justify-center text-center">
                  <div className="flex h-20 w-20 items-center justify-center border border-[var(--border)] text-[28px] text-[var(--mist)]">◊</div>
                  <div className="mt-8 space-y-3 text-[14px] leading-[2.2] tracking-[0.16em] text-[var(--mist)]">
                    <div>这场梦由他决定</div>
                    <div>你进入后才会逐渐知道</div>
                    <div>身份 · 阵营 · 你们之间是什么关系</div>
                  </div>
                </div>
              ) : (
                <div className="mt-10 flex-1">
                  <div className="flex flex-wrap justify-center gap-3">
                    {selectedLabels.map((label) => <div key={label} className="border px-4 py-3 text-[12px] tracking-[0.2em] text-[var(--gold)]" style={{ borderColor: 'rgba(196,169,106,.18)', backgroundColor: 'rgba(13,18,32,.7)' }}>{label}</div>)}
                  </div>
                  <div className="mt-8 text-center text-[13px] leading-[2.2] tracking-[0.16em] text-[var(--mist)]">{scenario.confirmHint}</div>
                </div>
              )}
              {entryMode === 'character' ? (
                <button type="button" onClick={() => setStage('entry')} className="mt-10 text-center text-[13px] tracking-[0.24em] text-[var(--gold)]">← 换一种入梦方式</button>
              ) : (
                <>
                  <div className="mt-10"><SealButton label="确认入梦" onClick={() => setStage('loading')} /></div>
                  <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-6 text-center text-[12px] tracking-[0.22em] text-[var(--mist)]">← 换一种入梦方式</button>
                </>
              )}
              <div className="hidden">
              {entryMode === 'character' ? (
                <button type="button" onClick={() => setStage('entry')} className="mt-10 text-center text-[13px] tracking-[0.24em] text-[var(--gold)]">← 换一种入梦方式</button>
              ) : (
                <>
                  <div className="mt-10"><SealButton label="确认入梦" onClick={() => setStage('loading')} /></div>
                  <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-6 text-center text-[12px] tracking-[0.22em] text-[var(--mist)]">← 换一种入梦方式</button>
                </>
              )}
              {entryMode === 'character' ? (
                <>
                  <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-10 text-center text-[13px] tracking-[0.24em] text-[var(--gold)]">← 换一种入梦方式</button>
                </>
              ) : (
                <>
                  <div className="mt-10"><SealButton label="确认入梦" onClick={() => setStage('loading')} /></div>
                  <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-6 text-center text-[12px] tracking-[0.22em] text-[var(--mist)]">← 换一种入梦方式</button>
                </>
              )}
              <div className="mt-10"><SealButton label="确认入梦" onClick={() => setStage('loading')} /></div>
              <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-6 text-center text-[12px] tracking-[0.3em] text-[var(--mist)]">← 换一种入梦方式</button>
              <div className="mt-10"><SealButton label="确 认 入 梦" onClick={() => setStage('loading')} /></div>
              <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-6 text-center text-[12px] tracking-[0.3em] text-[var(--mist)]">← 换 一 种 入 梦 方 式</button>
            </div>
          </Shell>
        )} */}
        {stage === 'loading' && selectedRole && (
          <Shell time={time} bottomTone={false} contentClassName="pb-[calc(6rem+env(safe-area-inset-bottom))]">
            <div className="flex flex-1 flex-col items-center justify-start pb-[calc(4rem+env(safe-area-inset-bottom))] pt-[10vh] text-center sm:justify-center sm:pt-0">
              <div className="relative flex h-36 w-36 items-center justify-center">
                <div className="absolute h-14 w-14 rounded-full border border-[rgba(196,169,106,.2)] bg-[radial-gradient(circle_at_40%_38%,rgba(196,169,106,.4),transparent_65%)] animate-[pulse_3s_ease-in-out_infinite]" />
                <div className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle,rgba(196,169,106,.06),transparent_70%)] animate-[pulse_3s_ease-in-out_infinite_reverse]" />
              </div>
              <div className="mt-8 text-[22px] font-[200] tracking-[0.22em] text-[var(--paper)]">正在进入 {selectedRole.name} 的今夜</div>
              {loadingError ? (
                <>
                  <div className="mt-4 max-w-[320px] text-[12px] leading-[2.1] tracking-[0.12em] text-[var(--mist)]">{loadingError}</div>
                  <div className="mt-8 grid w-full max-w-[334px] gap-4">
                    <SealButton label="重新入梦" onClick={retryDreamGeneration} />
                    <SecondaryAction label="返回确认" onClick={() => setStage('confirm')} />
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-4 text-[12px] tracking-[0.42em] text-[var(--mist)] animate-[pulse_3s_ease-in-out_infinite]">{loadingLabel}</div>
                  <div className="mt-5 h-px w-20 bg-[rgba(196,169,106,.1)]">
                    <div className="h-px bg-[var(--gold)] transition-[width] duration-300 ease-linear" style={{ width: `${loadingProgress}%` }} />
                  </div>
                </>
              )}
            </div>
          </Shell>
        )}
        {stage === 'scene' && act && (
          <Shell time={time} contentClassName="pb-[calc(6rem+env(safe-area-inset-bottom))]">
            <div className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
              <div className="mt-5 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{scenario.coverTitle} · {act.label}</div>
              <div className="mt-8 flex items-center justify-center gap-3">{scenario.acts.map((item, index) => <div key={item.id} className="h-[5px] w-[5px] border border-[var(--border)]">{index <= actIndex ? <div className="h-full w-full bg-[var(--gold)]" /> : null}</div>)}</div>
              <div className="mt-8">
                <div className="mx-auto w-full max-w-[460px]">
                  {storyFrame && actIndex === 0 ? (
                    <div className="mb-7 border px-4 py-4" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.accentSoft }}>
                      <div className="text-[11px] tracking-[0.28em]" style={{ color: presentation.accent }}>
                        {storyFrame.worldTitle} · {storyFrame.dreamRelationship}
                      </div>
                      <div className="mt-3 text-[14px] leading-[2.1] tracking-[0.08em] text-[var(--paper)]">{storyFrame.worldSummary}</div>
                      <div className="mt-4 text-[12px] leading-[2] tracking-[0.08em] text-[var(--mist)]">
                        {storyFrame.characterDreamIdentity} / {storyFrame.userDreamIdentity}
                      </div>
                      <div className="mt-2 text-[12px] leading-[2] tracking-[0.08em] text-[var(--mist)]">
                        节点：{storyFrame.openingNode}
                      </div>
                      {storyFrame.timeNode ? <div className="mt-2 text-[12px] leading-[2] tracking-[0.08em] text-[var(--mist)]">时点：{storyFrame.timeNode}</div> : null}
                      {storyFrame.currentCrisis ? <div className="mt-2 text-[12px] leading-[2] tracking-[0.08em] text-[var(--mist)]">危机：{storyFrame.currentCrisis}</div> : null}
                      {storyFrame.forbiddenRule ? <div className="mt-2 text-[12px] leading-[2] tracking-[0.08em] text-[var(--mist)]">规则：{storyFrame.forbiddenRule}</div> : null}
                      {storyFrame.immediateGoal ? <div className="mt-2 text-[12px] leading-[2] tracking-[0.08em]" style={{ color: presentation.accent }}>此幕目标：{storyFrame.immediateGoal}</div> : null}
                      <div className="mt-2 text-[12px] leading-[2] tracking-[0.08em]" style={{ color: presentation.accent }}>
                        主线：{storyFrame.storyObjective}
                      </div>
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
              <div className="mt-10">
                <SealButton label={sceneReady ? (isClosingAct ? '进 入 结 局' : '进 入 选 择') : '正 文 正 在 浮 出'} onClick={() => (isClosingAct ? setStage('ending') : setStage('choices'))} disabled={!sceneReady} />
              </div>
              {isDeepDream && !isClosingAct ? (
                <div className="mt-4">
                  <SecondaryAction
                    label={isEndingDeepDream ? '正 在 收 梦' : '结 束 做 梦'}
                    onClick={() => {
                      void endDeepDream();
                    }}
                    disabled={isEndingDeepDream || isGeneratingNextAct}
                  />
                </div>
              ) : null}
            </div>
          </Shell>
        )}
        {stage === 'choices' && act && (
          <Shell time={time} contentClassName="pb-[calc(6rem+env(safe-area-inset-bottom))]">
            <div className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] tracking-[0.26em] text-[var(--gold)]">
                <span className="inline-flex border border-[rgba(196,169,106,.18)] px-3 py-1">{resolveDomainName(selectedDomain)}</span>
                <span className="text-[var(--mist)]">路</span>
                <span>{scenario.coverTitle}</span>
              </div>
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{act.label} 路 梦触</div>
              <div className="mt-6 text-center text-[14px] leading-[2.2] tracking-[0.16em] text-[var(--paper-60)]">
                梦已经给出方向。<br />
                现在由你决定，下一步要怎样落下去。
              </div>
              <div className="mt-10 flex flex-1 flex-col gap-4">
                {act.choiceSet.generated.map((choice, index) => {
                  const previewing = previewChoiceId === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      onPointerDown={() => beginChoicePreview(choice.id)}
                      onPointerUp={cancelChoicePreview}
                      onPointerLeave={cancelChoicePreview}
                      onPointerCancel={cancelChoicePreview}
                      onClick={() => {
                        cancelChoicePreview();
                        const nextChoice = {
                          ...choice,
                          reaction: choice.reactionHint,
                        };
                        setRuntimeScenario((prev) => (
                          prev && act
                            ? {
                                ...prev,
                                decisionTrail: appendDecisionRecord(prev.decisionTrail, createDecisionRecord(act, nextChoice)),
                              }
                            : prev
                        ));
                        setSelectedChoice(nextChoice);
                        setStage('reaction');
                      }}
                      className="w-full border px-5 py-5 text-left transition duration-300"
                      style={{
                        borderColor: previewing ? 'rgba(196,169,106,.3)' : 'rgba(196,169,106,.12)',
                        backgroundColor: previewing ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.72)',
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
                  onClick={() => setCustomInputOpen((prev) => !prev)}
                  className="w-full border px-5 py-5 text-left opacity-70"
                  style={{
                    borderColor: 'rgba(123,168,196,.18)',
                    backgroundColor: 'rgba(12,18,30,.78)',
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="pt-1 text-[14px] tracking-[0.18em]" style={{ color: presentation.accent }}>四</div>
                    <div className="min-w-0">
                      <div className="text-[15px] font-[300] tracking-[0.18em] text-[var(--paper)]">{act.choiceSet.custom.title}</div>
                      <div className="mt-3 text-[12px] leading-[2.1] tracking-[0.14em] text-[var(--mist)]">{act.choiceSet.custom.guidance}</div>
                    </div>
                  </div>
                </button>
                {customInputOpen ? (
                  <div className="border px-5 py-5" style={{ borderColor: 'rgba(123,168,196,.18)', backgroundColor: 'rgba(10,14,24,.82)' }}>
                    <textarea
                      value={customInput}
                      onChange={(event) => setCustomInput(event.target.value)}
                      placeholder={act.choiceSet.custom.placeholder}
                      className="min-h-[120px] w-full resize-none bg-transparent text-[14px] leading-[2.1] tracking-[0.08em] text-white caret-white outline-none placeholder:text-white/45"
                    />
                    <div className="mt-4 text-[12px] leading-[2] tracking-[0.12em] text-[var(--mist)]">
                      这里输入的是你这一幕想怎么做、怎么说、想把梦推向哪边。
                    </div>
                    <div className="mt-5 grid gap-3">
                      <SealButton
                        label={isSubmittingCustom ? '正 在 续 写' : '提 交 自 定 义'}
                        onClick={() => {
                          void submitCustomChoice();
                        }}
                        disabled={isSubmittingCustom || !customInput.trim()}
                      />
                      <SecondaryAction label="收 起 输 入" onClick={() => setCustomInputOpen(false)} />
                    </div>
                  </div>
                ) : null}
                {loadingError ? <div className="text-[12px] leading-[2] tracking-[0.12em] text-[rgba(255,190,190,.9)]">{loadingError}</div> : null}
                {isDeepDream ? (
                  <SecondaryAction
                    label={isEndingDeepDream ? '正 在 收 梦' : '结 束 做 梦'}
                    onClick={() => {
                      void endDeepDream();
                    }}
                    disabled={isEndingDeepDream || isGeneratingNextAct || isSubmittingCustom}
                  />
                ) : null}
              </div>
            </div>
          </Shell>
        )}
        {false && stage === 'choices' && act && (
          <Shell time={time}>
            <div className="flex flex-1 flex-col">
              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] tracking-[0.26em] text-[var(--gold)]">
                <span className="inline-flex border border-[rgba(196,169,106,.18)] px-3 py-1">{resolveDomainName(selectedDomain)}</span>
                <span className="text-[var(--mist)]">路</span>
                <span>{scenario.coverTitle}</span>
              </div>
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{act.label} · 梦触</div>
              <div className="mt-6 text-center text-[14px] leading-[2.2] tracking-[0.16em] text-[var(--paper-60)]">梦已经给出方向。<br />现在由你决定，下一步要怎样落下去。</div>
              <div className="mt-10 flex flex-1 flex-col gap-4">
                {act.choiceSet.generated.map((choice, index) => <button key={choice.id} type="button" onClick={() => { setSelectedChoice({ ...choice, reaction: choice.reactionHint }); setStage('reaction'); }} className="w-full border px-5 py-5 text-left transition duration-300" style={{ borderColor: 'rgba(196,169,106,.12)', backgroundColor: 'rgba(13,18,32,.72)' }}><div className="flex items-start gap-4"><div className="pt-1 text-[14px] tracking-[0.18em] text-[var(--gold)]">{['一', '二', '三'][index]}</div><div className="min-w-0"><div className="text-[15px] font-[300] tracking-[0.18em] text-[var(--paper)]">{choice.title}</div><div className="mt-3 text-[12px] leading-[2.1] tracking-[0.14em] text-[var(--mist)]">{choice.detail}</div></div></div></button>)}
              </div>
            </div>
          </Shell>
        )}
        {stage === 'reaction' && selectedChoice && (
          <Shell time={time} contentClassName="pb-[calc(6rem+env(safe-area-inset-bottom))]">
            <div className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">角 色 反 应</div>
              <div className="mt-10 flex items-center gap-4">
                <div className="h-px flex-1 bg-[rgba(196,169,106,.18)]" />
                <div className="text-[12px] tracking-[0.18em]" style={{ color: presentation.accent }}>你选择了 {selectedChoice.title}</div>
                <div className="h-px flex-1 bg-[rgba(196,169,106,.18)]" />
              </div>
              <div className="mt-12 rounded-[26px] border px-5 py-6" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.frameFill }}>
                <div className="whitespace-pre-line text-[16px] font-[300] leading-[2.45] tracking-[0.08em] text-[var(--paper)]">{reactionText}</div>
              </div>
              <div className="mt-6 grid gap-3">
                {act?.progression.plotAdvance ? (
                  <div className="border px-4 py-4 text-[13px] leading-[2.1] tracking-[0.12em]" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.accentSoft, color: presentation.accent }}>
                    主线推进：{act.progression.plotAdvance}
                  </div>
                ) : null}
                {act?.progression.tensionShift ? (
                  <div className="border px-4 py-4 text-[12px] leading-[2] tracking-[0.14em] text-[var(--mist)]" style={{ borderColor: 'rgba(123,168,196,.16)' }}>
                    张力变化：{act.progression.tensionShift}
                  </div>
                ) : null}
              </div>
              <div className={`mt-16 transition duration-500 ${reactionText.length >= reactionFullText.length ? 'opacity-100' : 'opacity-0'}`}>
                <span className="inline-flex rounded-[20px] border px-5 py-3 text-[12px] tracking-[0.2em]" style={{ borderColor: presentation.frameBorder, backgroundColor: presentation.accentSoft, color: presentation.accent }}>
                  <span className="mr-3 inline-block h-[6px] w-[6px] rounded-full" style={{ backgroundColor: presentation.accent }} />
                  {selectedChoice.emotion}
                </span>
              </div>
              {loadingError ? <div className="mt-6 text-[12px] leading-[2] tracking-[0.12em] text-[rgba(255,190,190,.9)]">{loadingError}</div> : null}
              <div className="mt-8">
                <SealButton
                  label={
                    reactionText.length < reactionFullText.length
                      ? '反 应 正 在 浮 出'
                      : isDeepDream && isLastGeneratedAct && !isClosingAct
                        ? isGeneratingNextAct
                          ? '正 在 下 沉'
                          : '沉 向 更 深 一 幕'
                        : '继 续  →'
                  }
                  onClick={() => {
                    void goNextFromReaction();
                  }}
                  disabled={reactionText.length < reactionFullText.length || isGeneratingNextAct || isEndingDeepDream}
                />
              </div>
              {isDeepDream && !isClosingAct ? (
                <div className="mt-4">
                  <SecondaryAction
                    label={isEndingDeepDream ? '正 在 收 梦' : '结 束 做 梦'}
                    onClick={() => {
                      void endDeepDream();
                    }}
                    disabled={isEndingDeepDream || isGeneratingNextAct}
                  />
                </div>
              ) : null}
            </div>
          </Shell>
        )}
        {stage === 'ending' && (
          <Shell time={time} bottomTone={false} contentClassName="pb-[calc(7rem+env(safe-area-inset-bottom))]">
            <div
              className="flex flex-1 flex-col justify-start pb-[calc(5rem+env(safe-area-inset-bottom))] pt-14"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(180deg, rgba(196,169,106,.045) 0, rgba(196,169,106,.045) 1px, transparent 1px, transparent 32px)',
              }}
            >
              <div className="px-8 text-center">
                <div className="text-[11px] tracking-[0.52em] text-[var(--mist)]">结 局</div>
                <div className="mx-auto mt-5 flex w-[130px] items-center justify-center gap-4">
                  <div className="h-px flex-1 bg-[rgba(196,169,106,.16)]" />
                  <div className="h-px w-8 bg-[var(--gold)]" />
                  <div className="h-px flex-1 bg-[rgba(196,169,106,.16)]" />
                </div>
                <div className="mt-10 text-[48px] font-[200] tracking-[0.08em] text-[var(--paper)]">{endingView.title}</div>
                <div className="mx-auto mt-10 max-w-[420px] text-left text-[15px] font-[300] leading-[2.85] tracking-[0.08em] text-[var(--paper-60)]">
                  {endingView.excerpt}
                </div>
                <div className="mx-auto mt-10 h-px w-16 bg-[rgba(196,169,106,.14)]" />
                <div className="mt-10 text-right text-[13px] tracking-[0.18em] text-[var(--mist)]">—— {selectedRole.name}</div>
                <div className="mt-4 text-right text-[12px] tracking-[0.22em] text-[var(--gold)]">{endingView.chapter}</div>
              </div>
              <div className="mt-10 grid gap-4 px-8">
                <SealButton label="截 图 分 享 这 一 页" onClick={() => setStage('aftermath')} />
                <SecondaryAction label="查 看 梦 后 余 响  →" onClick={() => setStage('aftermath')} />
              </div>
            </div>
          </Shell>
        )}
        {false && stage === 'ending' && (
          <Shell time={time} bottomTone={false}>
            <div className="flex flex-1 flex-col justify-center py-8">
              <div className="border-y border-[var(--border)] py-10 text-center">
                <div className="text-[34px] font-[200] tracking-[0.22em] text-[var(--paper)]">{scenario.ending.title}</div>
                <div className="mx-auto mt-10 max-w-[290px] text-[15px] font-[300] leading-[2.35] tracking-[0.08em] text-[var(--paper-60)]">{scenario.ending.excerpt}</div>
                <div className="mt-8 text-[13px] tracking-[0.18em] text-[var(--mist)]">—— {scenario.ending.signature}</div>
                <div className="mt-3 text-[12px] tracking-[0.26em] text-[var(--gold)]">{scenario.ending.chapter}</div>
              </div>
              <div className="mt-10"><SealButton label="查 看 余 响" onClick={() => setStage('aftermath')} /></div>
            </div>
          </Shell>
        )}
        {stage === 'aftermath' && (
          <Shell time={time} scrollable contentClassName="pb-[calc(7rem+env(safe-area-inset-bottom))]">
            <div className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">余响</div>
              <div className="mt-8 border border-[var(--border)] bg-[rgba(13,18,32,.72)] px-5 py-6">
                <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
                  <Avatar role={selectedRole} small />
                  <div className="min-w-0">
                    <div className="text-[14px] tracking-[0.14em] text-[var(--paper)]">{selectedRole?.name || '角色'}</div>
                    <div className="mt-1 text-[11px] tracking-[0.18em] text-[var(--mist)]">明日聊天预览</div>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {aftermathView.previewMessages.map((message, index) => (
                    <div
                      key={`${message}-${index}`}
                      className="max-w-[92%] border px-4 py-4 text-[13px] leading-[2] tracking-[0.12em] text-[var(--paper)]"
                      style={{
                        marginLeft: index === 1 ? 'auto' : 0,
                        borderColor: 'rgba(123,168,196,.18)',
                        backgroundColor: index === 1 ? 'rgba(196,169,106,.08)' : 'rgba(123,168,196,.08)',
                      }}
                    >
                      {message}
                    </div>
                  ))}
                  <div className="max-w-[48%] border border-[rgba(196,169,106,.12)] bg-[rgba(13,18,32,.5)] px-4 py-3 text-[12px] tracking-[0.24em] text-[var(--mist)]">
                    ……
                  </div>
                </div>
              </div>
              <div className="mt-8 border border-[var(--border)] bg-[rgba(13,18,32,.62)] px-5 py-6">
                <div className="text-[12px] tracking-[0.26em] text-[var(--mist)]">余响</div>
                <div className="mt-4 text-[14px] leading-[2.2] tracking-[0.14em] text-[var(--paper)]">{aftermathView.summary}</div>
                <div className="mt-3 text-[12px] leading-[2] tracking-[0.14em] text-[var(--mist)]">{aftermathView.detail}</div>
                <div className="mt-5 border-t pt-4 text-[11px] tracking-[0.24em]" style={{ borderColor: presentation.frameBorder, color: presentation.accent }}>轻微关系温度变化 · 语气漂移</div>
              </div>
              <div className="mt-8"><SealButton label="再入一梦" onClick={restart} /></div>
            </div>
          </Shell>
        )}
        {false && stage === 'aftermath' && (
          <Shell time={time} scrollable>
            <div className="flex flex-1 flex-col">
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">余 响</div>
              <div className="mt-8 border border-[var(--border)] bg-[rgba(13,18,32,.72)] px-5 py-6">
                <div className="text-[12px] tracking-[0.26em] text-[var(--mist)]">明日聊天预览</div>
                <div className="mt-5 space-y-3">{scenario.aftermath.previewMessages.map((message) => <div key={message} className="border border-[rgba(123,168,196,.18)] bg-[rgba(123,168,196,.08)] px-4 py-4 text-[13px] leading-[2] tracking-[0.12em] text-[var(--paper)]">{message}</div>)}</div>
              </div>
              <div className="mt-8 border border-[var(--border)] bg-[rgba(13,18,32,.62)] px-5 py-6">
                <div className="text-[12px] tracking-[0.26em] text-[var(--mist)]">回流说明</div>
                <div className="mt-4 text-[14px] leading-[2.2] tracking-[0.14em] text-[var(--paper)]">{scenario.aftermath.summary}</div>
                <div className="mt-3 text-[12px] leading-[2] tracking-[0.14em] text-[var(--mist)]">{scenario.aftermath.detail}</div>
              </div>
              <div className="mt-auto pt-8"><SealButton label="再 入 一 梦" onClick={restart} /></div>
            </div>
          </Shell>
        )}
    </>
  );
}
