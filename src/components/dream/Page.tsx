import { AnimatePresence, motion } from 'motion/react';
import { Moon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Character } from '../../types';
import { defaultTagSelection, dreamTagGroups, resolveDomainName, resolveScenario } from './dreamContent';
import type { DreamChoice, DreamDepth, DreamDomainId, DreamEntryMode, DreamTagCategory } from './types';

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
} as React.CSSProperties;

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

function Shell({ time, children, bottomTone = true }: { time: string; children: React.ReactNode; bottomTone?: boolean }) {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[390px] overflow-hidden bg-[var(--ink)] text-[var(--paper)]" style={dreamThemeStyle}>
      <DreamStars />
      <div className="pointer-events-none fixed inset-0 z-[5] opacity-[0.025]" style={{ backgroundImage: dreamNoise, backgroundRepeat: 'repeat', mixBlendMode: 'screen' }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-48 bg-[linear-gradient(180deg,rgba(8,12,24,.92),rgba(8,12,24,0))]" />
      {bottomTone ? <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-[linear-gradient(0deg,rgba(8,12,24,.96),rgba(8,12,24,0))]" /> : null}
      <div className="relative z-10 flex min-h-screen flex-col px-7 pb-8 pt-5">
        <div className="mb-6 flex items-start justify-between text-[10px] tracking-[0.5em] text-[var(--mist)]">
          <div className="text-[28px] font-[500] tracking-[-0.06em] text-[var(--paper)]">{time}</div>
          <div className="pt-1">DREAM APP</div>
          <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] text-[var(--gold)]"><Moon size={15} strokeWidth={1.2} /></div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Avatar({ role, secret, small = false }: { role?: DreamRole | null; secret?: boolean; small?: boolean }) {
  const outer = small ? 'h-16 w-16' : 'h-40 w-40';
  const inner = small ? 'h-14 w-14' : 'h-32 w-32';
  return (
    <div className={`relative flex ${outer} items-center justify-center`}>
      <div className="absolute inset-0 border border-[var(--border)] opacity-60" />
      <div className="absolute inset-[14%] border border-[var(--border)] opacity-40" />
      <div className={`relative flex ${inner} items-center justify-center border border-[rgba(196,169,106,.25)] bg-[rgba(13,18,32,.9)]`} style={{ boxShadow: 'inset 0 0 12px rgba(196,169,106,.08)' }}>
        {secret ? (
          <span className="text-[40px] font-[200] text-[var(--gold)]">?</span>
        ) : role?.avatar ? (
          <img alt={role.name} src={role.avatar} className="h-full w-full object-contain p-2" />
        ) : (
          <span className={`${small ? 'text-[24px]' : 'text-[56px]'} font-[200] text-[var(--paper)]`}>{role?.glyph || '梦'}</span>
        )}
      </div>
    </div>
  );
}

function SealButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="group relative w-full border border-[rgba(196,169,106,.4)] px-6 py-5 text-center text-[13px] font-[400] tracking-[0.7em] text-[var(--gold)] transition duration-300 disabled:opacity-30" style={{ backgroundColor: disabled ? 'rgba(13,18,32,.45)' : 'rgba(13,18,32,.7)' }}>
      <span className="pointer-events-none absolute inset-[3px] border border-[rgba(196,169,106,.15)]" />
      <span className="relative">{label}</span>
    </button>
  );
}

function Home({ time, role, onPickRole, onEnter }: { time: string; role: DreamRole | null; onPickRole: () => void; onEnter: () => void }) {
  return (
    <Shell time={time}>
      <div className="flex flex-1 flex-col">
        <div className="pt-4 text-[30px] font-[200] tracking-[0.32em] text-[var(--paper)]">梦境</div>
        <div className="mt-7 text-[28px] font-[300] tracking-[0.16em] text-[var(--mist)]">23:14</div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center">
          <button type="button" onClick={onPickRole}><Avatar role={role} /></button>
          {role ? (
            <>
              <div className="space-y-2">
                <div className="text-[22px] font-[200] tracking-[0.18em] text-[var(--paper)]">{role.name}</div>
                <div className="text-[13px] font-[300] tracking-[0.18em] text-[var(--mist)]">今夜在做梦</div>
              </div>
              <div className="w-full max-w-[320px] border border-[var(--border)] bg-[rgba(13,18,32,.62)] px-5 py-5 text-center">
                <div className="mx-auto -mt-8 mb-3 inline-block bg-[var(--ink)] px-3 text-[11px] tracking-[0.4em] text-[var(--gold)]">今夜</div>
                <div className="text-[17px] font-[300] leading-[2] text-[var(--paper)]">有一场梦等待进入</div>
                <div className="mt-2 text-[12px] tracking-[0.18em] text-[var(--mist)]">梦将于 06:00 消散</div>
              </div>
              <div className="w-full max-w-[334px]"><SealButton label="进 入 今 夜" onClick={onEnter} /></div>
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

export function DreamAppPage({ onBack: _onBack, characters }: { onBack: () => void; characters: Character[] }) {
  const roles = useMemo(() => buildRoles(characters), [characters]);
  const [time, setTime] = useState(formatDreamTime);
  const [stage, setStage] = useState<DreamStage>('splash');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(roles[0]?.id ?? null);
  const [entryMode, setEntryMode] = useState<DreamEntryMode>('quick');
  const [selectedDomain, setSelectedDomain] = useState<DreamDomainId>('shared');
  const [dreamDepth, setDreamDepth] = useState<DreamDepth>('shallow');
  const [selectedTags, setSelectedTags] = useState<Record<DreamTagCategory, string[]>>(defaultTagSelection);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [actIndex, setActIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<DreamChoice | null>(null);
  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null, [roles, selectedRoleId]);
  const scenario = useMemo(() => resolveScenario(selectedDomain, dreamDepth), [selectedDomain, dreamDepth]);
  const act = scenario.acts[actIndex];
  const sceneText = useTypewriter(act?.scene || '', stage === 'scene');
  const reactionText = useTypewriter(selectedChoice?.reaction || '', stage === 'reaction');

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
    if (stage !== 'loading' || !selectedRole) return;
    localStorage.setItem('dream_app_latest_session', JSON.stringify({ mode: entryMode, roleId: selectedRole.id, domain: selectedDomain, depth: dreamDepth, selectedTags, scenario, createdAt: Date.now() }));
    const timer = window.setTimeout(() => {
      setActIndex(0);
      setSelectedChoice(null);
      setStage('scene');
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [dreamDepth, entryMode, scenario, selectedDomain, selectedRole, selectedTags, stage]);

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
      setSelectedDomain('threshold');
      setDreamDepth('shallow');
      setSelectedTags({ ...defaultTagSelection, world: ['threshold'], drive: ['appointment'], mood: ['restraint'] });
      setStage('confirm');
      return;
    }
    if (mode === 'character') {
      setSelectedDomain('rift');
      setDreamDepth('deep');
      setSelectedTags({ ...defaultTagSelection, world: ['rift'], lead: ['character-lead'], mood: ['secret'], tension: ['forbidden'] });
      setStage('confirm');
      return;
    }
    setSelectedDomain('shared');
    setDreamDepth('shallow');
    setStage('tags');
  };

  const toggleTag = (category: DreamTagCategory, optionId: string, max: number) => {
    setSelectedTags((prev) => {
      const current = prev[category] ?? [];
      const next = current.includes(optionId) ? current.filter((item) => item !== optionId) : [...current.slice(-(Math.max(max - 1, 0))), optionId];
      if (category === 'world' && next[0]) setSelectedDomain(next[0] as DreamDomainId);
      return { ...prev, [category]: next };
    });
  };

  const goNextFromReaction = () => {
    if (actIndex < scenario.acts.length - 1) {
      setActIndex((prev) => prev + 1);
      setSelectedChoice(null);
      setStage('scene');
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
    setStage('home');
  };

  const selectedLabels = dreamTagGroups.flatMap((group) => group.options.filter((option) => (selectedTags[group.category] ?? []).includes(option.id)).map((option) => option.label));

  return (
    <AnimatePresence mode="wait">
      <motion.div key={stage} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>
        {stage === 'splash' && (
          <Shell time={time}>
            <div className="flex min-h-[calc(100vh-5rem)] flex-1 items-center justify-center">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4 }} className="space-y-6 text-center">
                <div className="text-[72px] font-[200] tracking-[0.2em] text-[var(--paper)]">梦</div>
                <div className="mx-auto h-px w-20 bg-[var(--border-mid)]" />
                <div className="text-[10px] tracking-[0.6em] text-[var(--mist)]">局 · 梦 · 夜</div>
              </motion.div>
            </div>
          </Shell>
        )}
        {stage === 'home' && <Home time={time} role={selectedRole} onPickRole={() => setStage('role-picker')} onEnter={openEntry} />}
        {stage === 'role-picker' && (
          <Shell time={time}>
            <div className="flex flex-1 flex-col">
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
        {stage === 'entry' && selectedRole && (
          <Shell time={time}>
            <div className="flex flex-1 flex-col">
              <div className="mt-8 text-center text-[12px] tracking-[0.56em] text-[var(--mist)]">入 梦 方 式</div>
              <div className="mt-5 text-center text-[13px] leading-[2.2] tracking-[0.18em] text-[var(--paper-60)]">今夜由你决定如何进入这场梦。<br />不是弹出，不是选择框，而是一层一层走进去。</div>
              <div className="mt-10 flex flex-1 flex-col gap-5">
                {[{ id: 'quick', title: '一键入梦', detail: '系统自动给出世界观、关系张力、剧情驱动与情绪底色。' }, { id: 'custom', title: '自定义入梦', detail: '你先挑标签，再决定这场梦该往哪里沉。' }, { id: 'character', title: '角色入梦', detail: `这一场梦由 ${selectedRole.name} 来决定。你进入之后，才会渐渐知道自己的位置。` }].map((option) => (
                  <button key={option.id} type="button" onClick={() => chooseMode(option.id as DreamEntryMode)} className="border px-5 py-6 text-left transition duration-300 hover:border-[rgba(196,169,106,.3)] hover:bg-[rgba(196,169,106,.06)]" style={{ borderColor: 'rgba(196,169,106,.12)', backgroundColor: 'rgba(13,18,32,.72)' }}>
                    <div className="text-[16px] font-[300] tracking-[0.22em] text-[var(--gold)]">{option.title}</div>
                    <div className="mt-3 text-[12px] leading-[2.1] tracking-[0.16em] text-[var(--mist)]">{option.detail}</div>
                  </button>
                ))}
              </div>
              <div className="mt-6 self-center"><button type="button" onClick={() => setStage('home')} className="text-[12px] tracking-[0.32em] text-[var(--mist)]">返 回 今 夜</button></div>
            </div>
          </Shell>
        )}
        {stage === 'tags' && selectedRole && (
          <Shell time={time}>
            <div className="flex flex-1 flex-col">
              <div className="mt-7 text-center text-[12px] tracking-[0.56em] text-[var(--mist)]">{resolveDomainName(selectedDomain)} · {dreamDepth === 'deep' ? '深梦' : '浅梦'}</div>
              <div className="mt-8 flex flex-col items-center text-center">
                <Avatar role={selectedRole} small />
                <div className="mt-5 text-[22px] font-[200] tracking-[0.18em] text-[var(--paper)]">{selectedRole.name}</div>
                <div className="mt-2 text-[13px] tracking-[0.18em] text-[var(--mist)]">他正等你</div>
              </div>
              <div className="mt-9 flex flex-1 flex-col gap-5">
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
              <div className="mt-6 flex items-center justify-between">
                <button type="button" onClick={() => setDetailExpanded((prev) => !prev)} className="text-[12px] tracking-[0.28em] text-[var(--mist)]">{detailExpanded ? '收 起 细 化' : '展 开 细 化'}</button>
                <button type="button" onClick={() => setStage('entry')} className="text-[12px] tracking-[0.28em] text-[var(--mist)]">返 回 选 择</button>
              </div>
              <div className="mt-5"><SealButton label="前 往 确 认" onClick={() => setStage('confirm')} /></div>
            </div>
          </Shell>
        )}
        {stage === 'confirm' && selectedRole && (
          <Shell time={time}>
            <div className="flex flex-1 flex-col">
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{entryMode === 'character' ? '角 色 入 梦' : `${resolveDomainName(selectedDomain)} · ${scenario.coverTitle}`}</div>
              <div className="mt-10 flex flex-col items-center text-center">
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
              <div className="mt-10"><SealButton label="确 认 入 梦" onClick={() => setStage('loading')} /></div>
              <button type="button" onClick={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} className="mt-6 text-center text-[12px] tracking-[0.3em] text-[var(--mist)]">← 换 一 种 入 梦 方 式</button>
            </div>
          </Shell>
        )}
        {stage === 'loading' && selectedRole && (
          <Shell time={time} bottomTone={false}>
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="relative flex h-36 w-36 items-center justify-center">
                <div className="absolute inset-0 border border-[var(--border)] animate-[spin_18s_linear_infinite]" />
                <div className="absolute inset-[18%] border border-[rgba(196,169,106,.24)]" />
                <div className="relative flex h-20 w-20 items-center justify-center border border-[rgba(196,169,106,.28)] bg-[rgba(13,18,32,.9)] text-[34px] font-[200] text-[var(--paper)]" style={{ boxShadow: 'inset 0 0 12px rgba(196,169,106,.08)' }}>梦</div>
              </div>
              <div className="mt-8 text-[22px] font-[200] tracking-[0.22em] text-[var(--paper)]">正在进入 {selectedRole.name} 的今夜</div>
              <div className="mt-4 text-[12px] tracking-[0.3em] text-[var(--mist)]">正在生成梦局与梦尾摘录</div>
            </div>
          </Shell>
        )}
        {stage === 'scene' && act && (
          <Shell time={time}>
            <div className="flex flex-1 flex-col">
              <div className="mt-5 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{scenario.coverTitle} · {act.label}</div>
              <div className="mt-8 flex items-center justify-center gap-3">{scenario.acts.map((item, index) => <div key={item.id} className="h-[5px] w-[5px] border border-[var(--border)]">{index <= actIndex ? <div className="h-full w-full bg-[var(--gold)]" /> : null}</div>)}</div>
              <div className="mt-12 flex-1 border border-[var(--border)] bg-[rgba(13,18,32,.52)] px-6 py-7">
                <div className="text-[15px] font-[300] leading-[2.35] tracking-[0.08em] text-[var(--paper)]">{sceneText}</div>
                <div className="mt-8 border-t border-[var(--border)] pt-5 text-[12px] leading-[2.1] tracking-[0.18em] text-[var(--mist)]">{act.charState}</div>
              </div>
              <div className="mt-8"><SealButton label={sceneText.length >= act.scene.length ? '进 入 选 择' : '梦 正 在 展 开'} onClick={() => setStage('choices')} disabled={sceneText.length < act.scene.length} /></div>
            </div>
          </Shell>
        )}
        {stage === 'choices' && act && (
          <Shell time={time}>
            <div className="flex flex-1 flex-col">
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">{act.label} · 梦触</div>
              <div className="mt-6 text-center text-[14px] leading-[2.2] tracking-[0.16em] text-[var(--paper-60)]">梦已经给出方向。<br />现在由你决定，下一步要怎样落下去。</div>
              <div className="mt-10 flex flex-1 flex-col gap-4">
                {act.choices.map((choice) => <button key={choice.id} type="button" onClick={() => { setSelectedChoice(choice); setStage('reaction'); }} className="w-full border px-5 py-5 text-left transition duration-300" style={{ borderColor: 'rgba(196,169,106,.12)', backgroundColor: 'rgba(13,18,32,.72)' }}><div className="flex items-start gap-4"><div className="pt-1 text-[14px] tracking-[0.18em] text-[var(--gold)]">{choice.icon}</div><div className="min-w-0"><div className="text-[15px] font-[300] tracking-[0.18em] text-[var(--paper)]">{choice.title}</div><div className="mt-3 text-[12px] leading-[2.1] tracking-[0.14em] text-[var(--mist)]">长按 620ms 预感，轻触提交选择。{choice.detail}</div></div></div></button>)}
              </div>
            </div>
          </Shell>
        )}
        {stage === 'reaction' && selectedChoice && (
          <Shell time={time}>
            <div className="flex flex-1 flex-col">
              <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">角 色 反 应</div>
              <div className="mt-10 flex-1 border border-[var(--border)] bg-[rgba(13,18,32,.54)] px-6 py-7">
                <div className="text-[15px] font-[300] leading-[2.35] tracking-[0.08em] text-[var(--paper)]">{reactionText}</div>
                <div className={`mt-8 transition duration-500 ${reactionText.length >= selectedChoice.reaction.length ? 'opacity-100' : 'opacity-0'}`}>
                  <span className="inline-flex rounded-[20px] border border-[rgba(123,168,196,.26)] bg-[rgba(123,168,196,.12)] px-4 py-2 text-[12px] tracking-[0.2em] text-[var(--jade)]">{selectedChoice.emotion}</span>
                </div>
              </div>
              <div className="mt-8"><SealButton label={reactionText.length >= selectedChoice.reaction.length ? '继 续 下 沉' : '反 应 正 在 浮 出'} onClick={goNextFromReaction} disabled={reactionText.length < selectedChoice.reaction.length} /></div>
            </div>
          </Shell>
        )}
        {stage === 'ending' && (
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
          <Shell time={time}>
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
      </motion.div>
    </AnimatePresence>
  );
}
