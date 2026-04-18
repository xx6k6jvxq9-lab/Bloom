import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Moon } from 'lucide-react';
import type { Character } from '../../types';
import { defaultTagSelection, dreamTagGroups, resolveDomainName, resolveScenario } from './dreamContent';
import type { DreamAct, DreamDepth, DreamDomainId, DreamEntryMode, DreamTagCategory } from './types';

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

type DreamRoleOption = {
  id: string;
  glyph: string;
  name: string;
  status: string;
  avatar: string;
};

const dreamFontFamily = "'Noto Serif SC','STSong','SimSun',Georgia,serif";
const dreamThemeStyle: React.CSSProperties = {
  fontFamily: dreamFontFamily,
  fontWeight: 300,
  ['--void' as string]: '#030509',
  ['--ink' as string]: '#05080E',
  ['--deep' as string]: '#080C18',
  ['--surface' as string]: '#0D1220',
  ['--lift' as string]: '#131926',
  ['--raised' as string]: '#19212E',
  ['--gold' as string]: '#C4A96A',
  ['--gold-dim' as string]: 'rgba(196,169,106,.14)',
  ['--gold-glow' as string]: 'rgba(196,169,106,.22)',
  ['--gold-bright' as string]: '#D9C08A',
  ['--jade' as string]: '#7BA8C4',
  ['--jade-dim' as string]: 'rgba(123,168,196,.12)',
  ['--paper' as string]: '#EDE6D6',
  ['--paper-60' as string]: 'rgba(237,230,214,.6)',
  ['--paper-30' as string]: 'rgba(237,230,214,.3)',
  ['--mist' as string]: '#647899',
  ['--ghost' as string]: '#283348',
  ['--border' as string]: 'rgba(196,169,106,.1)',
  ['--border-mid' as string]: 'rgba(196,169,106,.2)',
};

const stars = Array.from({ length: 34 }, (_, index) => ({
  id: index,
  top: `${6 + (index * 11) % 88}%`,
  left: `${4 + (index * 19) % 92}%`,
  size: 1 + (index % 3),
  opacity: 0.06 + (index % 5) * 0.05,
  duration: 3.4 + (index % 7) * 0.8,
}));

function buildDreamRoleOptions(characters: Character[]): DreamRoleOption[] {
  return characters
    .filter((character) => typeof character.name === 'string' && character.name.trim().length > 0)
    .map((character) => ({
      id: character.id,
      glyph: (character.remarkName?.trim() || character.name.trim()).slice(0, 1),
      name: character.remarkName?.trim() || character.name.trim(),
      status: character.signature?.trim() || character.motto?.trim() || '今夜在做梦',
      avatar: character.avatar || '',
    }));
}

function Shell({ stage, children }: { stage: DreamStage; children: React.ReactNode }) {
  return (
    <motion.div className="absolute inset-0 overflow-hidden" style={{ ...dreamThemeStyle, backgroundColor: 'var(--ink)', color: 'var(--paper)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,var(--void)_0%,var(--ink)_52%,var(--void)_100%)' }} />
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.06)_0.7px,transparent_0.7px)] [background-size:24px_24px]" />
      <div className="absolute inset-0">
        {stars.map((star) => (
          <span
            key={star.id}
            className="absolute bg-[#c8aa67]"
            style={{
              borderRadius: '999px',
              top: star.top,
              left: star.left,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animation: `dream-float ${star.duration}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes dream-float {
          from { transform: translateY(0px); opacity: .08; }
          to { transform: translateY(-7px); opacity: .38; }
        }
      `}</style>

      {stage === 'splash' ? (
        children
      ) : (
        <div className="absolute inset-0 flex flex-col">
          <div className="relative z-10 flex-1 px-6 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}>
            <div className="absolute inset-x-0 top-1 z-10 flex items-center justify-center px-8">
              <div className="text-[10px] font-normal tracking-[0.42em]" style={{ color: 'var(--mist)' }}>DREAM APP</div>
              <button className="absolute right-8 flex h-12 w-12 items-center justify-center border text-[#c4a96a]" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(8,12,24,0.12)', color: 'var(--gold)' }}>
                <Moon size={18} />
              </button>
            </div>
            <div className="h-full pt-12">{children}</div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SplashScreen() {
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="text-[96px] font-[200] tracking-[0.05em]">梦</div>
      <div className="my-5 h-10 w-px bg-[rgba(196,169,106,0.28)]" />
      <div className="text-[11px] font-normal tracking-[0.6em] text-[#7088b0]">局 梦 夜</div>
    </motion.div>
  );
}

function HaloGlyph({ glyph }: { glyph: string }) {
  return (
    <div className="relative flex h-[112px] w-[112px] items-center justify-center rounded-full border bg-[rgba(8,12,24,0.38)] text-[40px] font-[300] text-[#f6efe4]" style={{ borderColor: 'rgba(196,169,106,0.18)' }}>
      {glyph}
      <div className="absolute inset-[-16px] rounded-full border border-[rgba(196,169,106,0.08)]" />
      <div className="absolute inset-[-30px] rounded-full border border-[rgba(196,169,106,0.05)]" />
    </div>
  );
}

function DreamAvatarArt({
  avatar,
  alt,
  className,
  imageClassName = '',
}: {
  avatar: string;
  alt: string;
  className: string;
  imageClassName?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-full ${className}`} style={{ backgroundColor: 'var(--surface)' }}>
      <img src={avatar} alt={alt} className={`h-full w-full object-contain object-center p-1.5 ${imageClassName}`} draggable={false} />
    </div>
  );
}

function HaloAvatar({ glyph, avatar }: { glyph: string; avatar: string }) {
  return (
    <div className="relative flex h-[112px] w-[112px] items-center justify-center rounded-full border bg-[rgba(8,12,24,0.38)] text-[40px] font-[300] text-[#f6efe4]" style={{ borderColor: 'rgba(196,169,106,0.18)' }}>
      {avatar ? <DreamAvatarArt avatar={avatar} alt={glyph} className="h-full w-full" imageClassName="scale-[1.02]" /> : glyph}
      <div className="absolute inset-[-16px] rounded-full border border-[rgba(196,169,106,0.08)]" />
      <div className="absolute inset-[-30px] rounded-full border border-[rgba(196,169,106,0.05)]" />
    </div>
  );
}

function HomeScreen({
  selectedRole,
  availableLine,
  expireLine,
  onChooseRole,
  onOpen,
}: {
  selectedRole: DreamRoleOption | null;
  availableLine: string;
  expireLine: string;
  onChooseRole: () => void;
  onOpen: () => void;
}) {
  return (
    <motion.div className="flex h-full flex-col pb-4" layout>
      <div className="mt-1 text-[12px] font-normal tracking-[0.08em] text-[#6d82a7]">23:14</div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.button onClick={onChooseRole} className="transition hover:opacity-90" whileTap={{ scale: 0.98 }} layout>
          {selectedRole ? <HaloAvatar glyph={selectedRole.glyph} avatar={selectedRole.avatar} /> : <HaloGlyph glyph="梦" />}
        </motion.button>

        <AnimatePresence mode="wait">
          {selectedRole ? (
            <motion.div key="selected-role" className="flex w-full flex-col items-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.24, ease: 'easeOut' }}>
              <div className="mt-14 text-[34px] font-[200] tracking-[0.16em] text-[#f5efe2] [text-shadow:0_0_8px_rgba(123,168,196,0.28)]">{selectedRole.name}</div>
              <div className="mt-3 text-[12px] font-normal tracking-[0.16em] text-[#7088b0]">{selectedRole.status}</div>
              <div className="relative mt-12 w-full max-w-[322px] border px-6 py-7" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(196,169,106,0.02)' }}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#05080e] px-5 text-[10px] font-normal tracking-[0.4em] text-[#c4a96a]">今夜</div>
                <div className="text-[15px] font-[300] tracking-[0.12em] text-[#f5efe2]">{availableLine}</div>
                <div className="mt-3 text-[11px] font-normal tracking-[0.12em] text-[#7088b0]">{expireLine}</div>
              </div>
              <button onClick={onOpen} className="mt-14 w-full max-w-[440px] border px-5 py-7 text-[13px] font-normal tracking-[0.5em] transition" style={{ borderColor: 'var(--border-mid)', backgroundColor: 'transparent', color: 'var(--gold)' }}>
                进入今夜
              </button>
            </motion.div>
          ) : (
            <motion.div key="unselected-role" className="mt-14 text-[12px] font-normal tracking-[0.24em] text-[#7088b0]" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
              点击头像，选择今夜入梦的角色
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-5 flex items-center justify-around border-t border-[rgba(196,169,106,0.1)] pt-4 text-[11px] font-normal tracking-[0.28em] text-[#7088b0]">
        <div className="flex flex-col items-center gap-2 text-[#d4b46f]"><span>今夜</span><span className="h-1.5 w-1.5 rounded-full bg-[#d4b46f]" /></div>
        <div className="flex flex-col items-center gap-2"><span>残响</span><span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" /></div>
        <div className="flex flex-col items-center gap-2"><span>深层</span><span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" /></div>
      </div>
    </motion.div>
  );
}

function RolePicker({
  roles,
  selectedRoleId,
  onSelect,
  onClose,
}: {
  roles: DreamRoleOption[];
  selectedRoleId: string | null;
  onSelect: (roleId: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="absolute inset-0 z-20"
      style={{ backgroundColor: 'rgba(8,12,24,0.96)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
    >
      <button className="absolute inset-0" onClick={onClose} aria-label="关闭角色选择" />
      <div className="relative h-full px-7 pt-24 pb-10">
        <div className="border-b pb-4 text-center" style={{ borderColor: 'var(--border)' }}>
          <div className="text-[10px] font-normal tracking-[0.42em]" style={{ color: 'var(--mist)' }}>今 夜 角 色</div>
          <div className="mt-4 text-[12px] font-normal tracking-[0.4em] text-[#7088b0]">选择入梦角色</div>
        </div>
        <div className="mt-8 space-y-3">
          {roles.map((role) => {
            const active = selectedRoleId === role.id;
            return (
              <button
                key={role.id}
                onClick={() => onSelect(role.id)}
                className={`flex w-full items-center gap-4 border px-4 py-4 text-left transition ${
                  active
                    ? 'border-[rgba(196,169,106,0.38)] bg-[rgba(196,169,106,0.05)]'
                    : 'border-[rgba(196,169,106,0.08)] bg-[rgba(8,12,24,0.24)] hover:border-[rgba(196,169,106,0.18)]'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border text-[20px] text-[#c8aa67]" style={{ borderColor: 'var(--border-mid)', color: 'var(--gold)' }}>
                  {role.avatar ? <DreamAvatarArt avatar={role.avatar} alt={role.name} className="h-full w-full" /> : role.glyph}
                </div>
                <div>
                  <div className="text-[16px] font-[300] tracking-[0.14em] text-[#f4eee3]">{role.name}</div>
                  <div className="mt-1 text-[12px] font-normal leading-[1.9] tracking-[0.08em] text-[#7088b0]">{role.status}</div>
                </div>
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="mt-8 text-[11px] font-normal tracking-[0.28em] transition"
          style={{ color: 'var(--mist)' }}
        >
          返回今夜
        </button>
      </div>
    </motion.div>
  );
}

function EntryScreen({ onChoose, onClose }: { onChoose: (mode: DreamEntryMode) => void; onClose: () => void }) {
  const items = [
    { mode: 'quick' as DreamEntryMode, title: '一键入梦', description: '系统自动决定世界观、张力与情绪底色。' },
    { mode: 'custom' as DreamEntryMode, title: '自定义入梦', description: '由你选择梦域、题材母题、关系张力和剧情驱动。' },
    { mode: 'character' as DreamEntryMode, title: '角色入梦', description: '先选角色，再进入由他主导的大部分黑盒设定。' },
  ];

  return (
    <motion.div
      className="absolute inset-0 z-20"
      style={{ backgroundColor: 'rgba(8,12,24,0.97)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <button className="absolute inset-0" onClick={onClose} aria-label="关闭入梦方式" />
      <div className="relative h-full px-7 pt-24 pb-10">
        <div className="border-b pb-4 text-center" style={{ borderColor: 'var(--border)' }}>
          <div className="text-[10px] font-normal tracking-[0.42em]" style={{ color: 'var(--mist)' }}>今 夜 入 梦</div>
          <div className="mt-4 text-center text-[12px] font-normal tracking-[0.4em] text-[#7088b0]">选择入梦方式</div>
        </div>
        <div className="mt-8">
          {items.map((item) => (
            <button
              key={item.mode}
              onClick={() => onChoose(item.mode)}
              className="flex w-full items-start justify-between border-b px-1 py-5 text-left transition hover:bg-[rgba(196,169,106,0.03)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <div>
                <div className="text-[16px] font-normal tracking-[0.14em] text-[#f4eee3]">{item.title}</div>
                <div className="mt-2 text-[12px] font-normal leading-[1.9] tracking-[0.08em] text-[#7088b0]">{item.description}</div>
              </div>
              <span className="pt-1" style={{ color: 'var(--gold)' }}>◌</span>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-8 text-[11px] font-normal tracking-[0.28em] transition"
          style={{ color: 'var(--mist)' }}
        >
          返回今夜
        </button>
      </div>
    </motion.div>
  );
}

function TagsScreen({
  selectedTags,
  detailExpanded,
  onToggleDetail,
  onToggleTag,
  onBack,
  onConfirm,
}: {
  selectedTags: Record<DreamTagCategory, string[]>;
  detailExpanded: boolean;
  onToggleDetail: () => void;
  onToggleTag: (category: DreamTagCategory, optionId: string, max: number) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mt-1 flex items-center gap-3 text-[12px] font-normal tracking-[0.34em] text-[#7088b0]">
        <button onClick={onBack} className="text-[#c8aa67]">←</button>
        <span>细化梦局</span>
      </div>
      <div className="mt-8 flex-1 overflow-y-auto">
        {[false, true].map((detailed) => (
          <div key={String(detailed)} className={detailed && !detailExpanded ? 'hidden' : 'block'}>
            {dreamTagGroups.filter((group) => Boolean(group.detailed) === detailed).map((group) => (
              <section key={group.category} className="mb-7">
                <div className="mb-3 text-[10px] font-normal tracking-[0.34em] text-[#7088b0]">{group.label}</div>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const selected = selectedTags[group.category].includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => onToggleTag(group.category, option.id, group.max)}
                        className={`border px-4 py-2.5 text-[13px] font-normal tracking-[0.14em] transition ${
                          selected
                            ? 'border-[rgba(196,169,106,0.4)] bg-[rgba(196,169,106,0.08)] text-[#d4b46f]'
                            : 'border-[rgba(196,169,106,0.12)] text-[#7088b0] hover:border-[rgba(196,169,106,0.26)] hover:text-[#f4eee3]'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ))}
        <button onClick={onToggleDetail} className="mt-2 text-[12px] font-normal tracking-[0.34em] text-[#7088b0] transition hover:text-[#c8aa67]">
          {detailExpanded ? '收起细化标签' : '展开细化标签'}
        </button>
      </div>
      <button onClick={onConfirm} className="mt-8 border px-5 py-6 text-[13px] font-normal tracking-[0.46em] transition" style={{ borderColor: 'var(--border-mid)', backgroundColor: 'rgba(196,169,106,0.03)', color: 'var(--gold)' }}>
        进入确认
      </button>
    </div>
  );
}

function ConfirmScreen({
  domainName,
  dreamDepth,
  heroGlyph,
  heroName,
  heroStatus,
  tags,
  onBack,
  onStart,
}: {
  domainName: string;
  dreamDepth: DreamDepth;
  heroGlyph: string;
  heroName: string;
  heroStatus: string;
  tags: string[];
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="text-[10px] font-normal tracking-[0.5em]" style={{ color: 'var(--mist)' }}>{domainName} · {dreamDepth === 'shallow' ? '浅梦' : '深梦'}</div>
      <div className="mt-10 flex items-center gap-5">
        <div className="h-14 w-px" style={{ backgroundColor: 'var(--border-mid)' }} />
        <div className="flex h-[84px] w-[112px] items-center justify-center border text-[34px] font-light" style={{ borderColor: 'var(--border-mid)', color: 'var(--gold)' }}>
          {heroGlyph}
        </div>
        <div className="h-14 w-px" style={{ backgroundColor: 'var(--border-mid)' }} />
      </div>
      <div className="mt-12 text-[24px] font-[200] tracking-[0.16em]" style={{ color: 'var(--paper)' }}>{heroName}</div>
      <div className="mt-4 text-[12px] font-normal tracking-[0.16em]" style={{ color: 'var(--mist)' }}>{heroStatus}</div>
      <div className="mt-14 flex max-w-[520px] flex-wrap justify-center gap-3">
        {tags.map((tag) => (
          <span key={tag} className="border px-5 py-2 text-[11px] font-normal tracking-[0.14em]" style={{ borderColor: 'var(--border-mid)', color: 'var(--gold)' }}>
            {tag}
          </span>
        ))}
      </div>
      <button onClick={onStart} className="relative mt-20 w-full max-w-[520px] border px-6 py-9 text-[14px] font-normal tracking-[0.62em] transition" style={{ borderColor: 'rgba(196,169,106,.36)', backgroundColor: 'rgba(196,169,106,0.01)', color: 'var(--gold)' }}>
        确 认 入 梦
      </button>
      <button onClick={onBack} className="mt-6 text-[11px] font-normal tracking-[0.28em] text-[#7088b0] transition hover:text-[#c8aa67]">
        ← 返回修改
      </button>
    </div>
  );
}

function DreamConfirmScreen({
  domainName,
  dreamDepth,
  heroGlyph,
  heroAvatar,
  heroName,
  heroStatus,
  entryMode,
  tags,
  onBack,
  onStart,
}: {
  domainName: string;
  dreamDepth: DreamDepth;
  heroGlyph: string;
  heroAvatar: string;
  heroName: string;
  heroStatus: string;
  entryMode: DreamEntryMode;
  tags: string[];
  onBack: () => void;
  onStart: () => void;
}) {
  const isCharacterEntry = entryMode === 'character';
  const topLine = [domainName, tags[0], dreamDepth === 'shallow' ? '浅梦' : '深梦'].filter(Boolean).join(' · ');

  return (
    <div className="flex h-full flex-col items-center justify-center px-2 text-center">
      <div className="text-[10px] font-normal tracking-[0.5em]" style={{ color: 'var(--mist)' }}>{isCharacterEntry ? '角色入梦 · 黑盒入场' : topLine}</div>
      <div className="mt-10 flex items-center gap-6">
        <div className="h-20 w-px" style={{ background: 'linear-gradient(180deg,transparent,rgba(196,169,106,0.2),transparent)' }} />
        <div className="flex h-[118px] w-[118px] items-center justify-center border px-2 py-2 text-[34px] font-light" style={{ borderColor: 'var(--border-mid)', backgroundColor: 'rgba(196,169,106,0.015)', color: 'var(--gold)' }}>
          {isCharacterEntry ? (
            <span className="text-[44px] text-[#c8aa67]">?</span>
          ) : heroAvatar ? (
            <DreamAvatarArt avatar={heroAvatar} alt={heroName} className="h-full w-full rounded-none border border-[rgba(196,169,106,0.06)]" imageClassName="rounded-none p-2" />
          ) : (
            heroGlyph
          )}
        </div>
        <div className="h-20 w-px" style={{ background: 'linear-gradient(180deg,transparent,rgba(196,169,106,0.2),transparent)' }} />
      </div>
      <div className="mt-12 text-[24px] font-[200] tracking-[0.16em]" style={{ color: 'var(--paper)' }}>{heroName}</div>
      <div className="mt-4 text-[12px] font-normal tracking-[0.16em]" style={{ color: 'var(--mist)' }}>{isCharacterEntry ? '他的梦，他来决定' : heroStatus}</div>

      {isCharacterEntry ? (
        <div className="mt-14 flex max-w-[520px] flex-col items-center text-[#7088b0]">
          <div className="flex h-[78px] w-[78px] items-center justify-center border border-[rgba(196,169,106,0.08)] bg-[rgba(23,31,46,0.28)] text-[18px] text-[#556685]">◊</div>
          <div className="mt-8 text-[13px] font-normal tracking-[0.24em]">这场梦由他决定</div>
          <div className="mt-3 text-[13px] font-normal tracking-[0.24em]">你进入后才会逐渐知道</div>
          <div className="mt-5 text-[13px] font-normal tracking-[0.24em] text-[#8aa8cf]">身份 · 阵营 · 你们之间是什么关系</div>
        </div>
      ) : (
        <div className="mt-16 flex max-w-[520px] flex-wrap justify-center gap-2.5">
          {tags.map((tag) => (
            <span key={tag} className="min-w-[92px] border border-[rgba(196,169,106,0.22)] bg-[rgba(196,169,106,0.015)] px-4 py-2.5 text-[11px] font-normal tracking-[0.14em] text-[#d4b46f]">
              {tag}
            </span>
          ))}
        </div>
      )}

      <button onClick={onStart} className="relative mt-20 w-full max-w-[520px] border px-6 py-9 text-[14px] font-normal tracking-[0.62em] transition" style={{ borderColor: 'rgba(196,169,106,.38)', backgroundColor: 'rgba(196,169,106,0.01)', color: 'var(--gold)' }}>
        确 认 入 梦
      </button>
      <button onClick={onBack} className="mt-8 text-[11px] font-normal tracking-[0.28em] text-[#7088b0] transition hover:text-[#8aa8cf]">
        ← {isCharacterEntry ? '换一种入梦方式' : '返回修改'}
      </button>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full border bg-[radial-gradient(circle_at_42%_34%,rgba(218,197,143,0.16),rgba(53,68,91,0.42)_58%,rgba(6,10,18,0.96)_100%)] text-[30px] text-[#f6efe4]" style={{ borderColor: 'rgba(196,169,106,0.22)' }}>
        梦
      </div>
      <div className="mt-12 text-[12px] font-normal tracking-[0.42em] text-[#7088b0]">正在进入梦境</div>
    </div>
  );
}

function SceneScreen({ act, progressLabel, onContinue }: { act: DreamAct; progressLabel: string; onContinue: () => void }) {
  return (
    <div className="flex h-full flex-col px-2">
      <div className="flex items-start justify-between text-[10px] font-normal tracking-[0.34em] text-[#7088b0]">
        <span>{act.label}</span>
        <span>{progressLabel}</span>
      </div>
      <div className="mt-10 text-[16px] font-[300] leading-[2.3] text-[#f4eee3]">{act.scene}</div>
      <div className="mt-8 text-[12px] font-normal leading-[1.9] tracking-[0.16em] text-[#c8aa67]">{act.charState}</div>
      <button onClick={onContinue} className="mt-auto pb-8 text-center text-[10px] font-normal tracking-[0.34em] text-[#7088b0] transition hover:text-[#c8aa67]">
        你想做什么
      </button>
    </div>
  );
}

function ChoicesScreen({ act, onPick }: { act: DreamAct; onPick: (choiceId: string) => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="text-center text-[12px] font-normal tracking-[0.36em] text-[#7088b0]">{act.label}</div>
      <div className="mt-4 text-center text-[17px] font-[300] tracking-[0.14em] text-[#f4eee3]">在这场梦里，你选择</div>
      <div className="mt-10 flex flex-1 flex-col gap-4">
        {act.choices.map((choice) => (
          <button key={choice.id} onClick={() => onPick(choice.id)} className="border border-[rgba(196,169,106,0.12)] bg-[rgba(196,169,106,0.02)] px-5 py-5 text-left transition hover:border-[rgba(196,169,106,0.26)] hover:bg-[rgba(196,169,106,0.05)]">
            <div className="text-[16px] font-normal tracking-[0.14em] text-[#f4eee3]">{choice.title}</div>
            <div className="mt-2 text-[12px] font-normal leading-[1.9] tracking-[0.08em] text-[#7088b0]">{choice.detail}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReactionScreen({
  choiceTitle,
  reaction,
  reactionDone,
  emotion,
  onContinue,
  isLast,
}: {
  choiceTitle: string;
  reaction: string;
  reactionDone: boolean;
  emotion: string;
  onContinue: () => void;
  isLast: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="text-[11px] font-normal tracking-[0.3em] text-[#7088b0]">你的选择 · <span className="text-[#c8aa67]">{choiceTitle}</span></div>
      <div className="mt-10 min-h-[220px] text-[16px] font-[300] leading-[2.3] text-[#f4eee3]">
        {reaction}
        {!reactionDone && <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-[#c8aa67]" />}
      </div>
      <div className={`mt-4 text-[12px] font-normal tracking-[0.16em] ${reactionDone ? 'text-[#7ba8c4]' : 'text-transparent'}`}>{emotion}</div>
      <button onClick={onContinue} disabled={!reactionDone} className={`mt-auto self-end border px-5 py-3 text-[12px] font-normal tracking-[0.32em] transition ${reactionDone ? 'border-[rgba(196,169,106,0.16)] text-[#7088b0] hover:border-[rgba(196,169,106,0.28)] hover:text-[#c8aa67]' : 'border-[rgba(196,169,106,0.06)] text-[#334056]'}`}>
        {isLast ? '醒来之前' : '继续下沉'}
      </button>
    </div>
  );
}

function EndingScreen({ title, excerpt, signature, chapter, onAftermath }: { title: string; excerpt: string; signature: string; chapter: string; onAftermath: () => void }) {
  return (
    <div className="flex h-full flex-col justify-between text-center">
      <div>
        <div className="text-[9px] font-normal tracking-[0.6em] text-[#7088b0]">结 局</div>
        <div className="mt-10 text-[42px] font-[200] tracking-[0.18em] text-[#f4eee3]">{title}</div>
      </div>
      <div className="text-[15px] font-[300] leading-[2.4] text-[rgba(244,238,227,0.74)]">{excerpt}</div>
      <div>
        <div className="text-right text-[13px] font-normal tracking-[0.22em] text-[rgba(244,238,227,0.44)]">—— {signature}</div>
        <div className="mt-2 text-right text-[12px] font-normal tracking-[0.14em] text-[#c8aa67]">{chapter}</div>
        <div className="mt-8 flex flex-col gap-3">
          <button className="border border-[rgba(196,169,106,0.18)] px-4 py-4 text-[12px] font-normal tracking-[0.34em] text-[#c8aa67] transition hover:bg-[rgba(196,169,106,0.05)]">截图分享这一页</button>
          <button onClick={onAftermath} className="border border-[rgba(196,169,106,0.1)] px-4 py-4 text-[12px] font-normal tracking-[0.28em] text-[#7088b0] transition hover:border-[rgba(123,168,196,0.24)] hover:text-[#7ba8c4]">查看梦后余响</button>
        </div>
      </div>
    </div>
  );
}

function AftermathScreen({
  heroGlyph,
  heroName,
  summary,
  detail,
  previewMessages,
  onBackHome,
}: {
  heroGlyph: string;
  heroName: string;
  summary: string;
  detail: string;
  previewMessages: [string, string];
  onBackHome: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="text-[10px] font-normal tracking-[0.42em] text-[#7088b0]">梦后余响</div>
      <div className="mt-7 border border-[rgba(196,169,106,0.1)] bg-[rgba(196,169,106,0.03)]">
        <div className="flex items-center gap-3 border-b border-[rgba(196,169,106,0.08)] px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(196,169,106,0.2)] text-[12px] text-[#c8aa67]">{heroGlyph}</div>
          <div>
            <div className="text-[13px] font-normal tracking-[0.12em] text-[#f4eee3]">{heroName}</div>
            <div className="text-[11px] font-normal text-[#7088b0]">刚刚在线</div>
          </div>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="flex gap-2"><div className="max-w-[220px] border border-[rgba(196,169,106,0.1)] bg-[rgba(196,169,106,0.05)] px-3 py-2 text-[13px] font-[300] leading-[1.8] text-[rgba(244,238,227,0.74)]">{previewMessages[0]}</div><div className="self-end pb-1 text-[10px] font-normal text-[#314055]">08:43</div></div>
          <div className="flex flex-row-reverse gap-2"><div className="max-w-[220px] border border-[rgba(196,169,106,0.08)] bg-[rgba(8,12,26,0.68)] px-3 py-2 text-[13px] font-[300] leading-[1.8] text-[rgba(244,238,227,0.74)]">在，怎么了</div><div className="self-end pb-1 text-[10px] font-normal text-[#314055]">08:44</div></div>
          <div className="flex gap-2"><div className="max-w-[220px] border border-[rgba(196,169,106,0.1)] bg-[rgba(196,169,106,0.05)] px-3 py-2 text-[13px] font-[300] leading-[1.8] text-[rgba(244,238,227,0.74)]">{previewMessages[1]}</div><div className="self-end pb-1 text-[10px] font-normal text-[#314055]">08:44</div></div>
        </div>
      </div>
      <div className="relative mt-6 border border-[rgba(196,169,106,0.1)] px-5 py-5">
        <div className="absolute -top-2.5 left-4 bg-[#05080e] px-2 text-[9px] font-normal tracking-[0.3em] text-[#c8aa67]">余响</div>
        <div className="text-[14px] font-[300] leading-[2.2] text-[rgba(244,238,227,0.74)]">{summary}</div>
        <div className="mt-3 text-[11px] font-normal tracking-[0.12em] text-[#7ba8c4]">{detail}</div>
      </div>
      <button onClick={onBackHome} className="mt-auto border border-[rgba(196,169,106,0.18)] px-4 py-4 text-[12px] font-normal tracking-[0.34em] text-[#c8aa67] transition hover:bg-[rgba(196,169,106,0.05)]">回到今夜</button>
    </div>
  );
}

export function DreamAppPage({ onBack: _onBack, characters }: { onBack: () => void; characters: Character[] }) {
  const [stage, setStage] = useState<DreamStage>('splash');
  const [entryMode, setEntryMode] = useState<DreamEntryMode>('custom');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DreamDomainId>('shared');
  const [dreamDepth, setDreamDepth] = useState<DreamDepth>('shallow');
  const [selectedTags, setSelectedTags] = useState(defaultTagSelection);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [actIndex, setActIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [typedReaction, setTypedReaction] = useState('');
  const splashTimerRef = useRef<number | null>(null);
  const loadingTimerRef = useRef<number | null>(null);

  const dreamRoles = useMemo(() => buildDreamRoleOptions(characters), [characters]);
  const scenario = useMemo(() => resolveScenario(selectedDomain, dreamDepth), [selectedDomain, dreamDepth]);
  const selectedRole = useMemo(() => dreamRoles.find((role) => role.id === selectedRoleId) ?? null, [dreamRoles, selectedRoleId]);
  const currentAct: DreamAct = scenario.acts[Math.min(actIndex, scenario.acts.length - 1)];
  const selectedChoice = currentAct.choices.find((choice) => choice.id === selectedChoiceId) ?? null;
  const confirmTags = useMemo(() => dreamTagGroups.flatMap((group) => selectedTags[group.category].map((id) => group.options.find((option) => option.id === id)?.label ?? id)), [selectedTags]);

  useEffect(() => {
    splashTimerRef.current = window.setTimeout(() => setStage('home'), 2200);
    return () => {
      if (splashTimerRef.current !== null) window.clearTimeout(splashTimerRef.current);
      if (loadingTimerRef.current !== null) window.clearTimeout(loadingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (stage !== 'loading') return;
    loadingTimerRef.current = window.setTimeout(() => {
      setActIndex(0);
      setSelectedChoiceId(null);
      setTypedReaction('');
      setStage('scene');
    }, 1500);
    return () => {
      if (loadingTimerRef.current !== null) window.clearTimeout(loadingTimerRef.current);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'reaction' || !selectedChoice) return;
    setTypedReaction('');
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedReaction(selectedChoice.reaction.slice(0, index));
      if (index >= selectedChoice.reaction.length) window.clearInterval(timer);
    }, 16);
    return () => window.clearInterval(timer);
  }, [selectedChoice, stage]);

  function chooseEntryMode(mode: DreamEntryMode) {
    setEntryMode(mode);
    if (mode === 'quick') {
      setSelectedDomain('threshold');
      setDreamDepth('shallow');
      setSelectedTags({ ...defaultTagSelection, world: ['threshold'], tension: ['unfinished'], mood: ['restraint'] });
      setStage('confirm');
      return;
    }
    if (mode === 'character') {
      setSelectedDomain('rift');
      setDreamDepth('deep');
      setSelectedTags({ ...defaultTagSelection, world: ['rift'], lead: ['character-lead'], intensity: ['strong'], mood: ['danger'] });
      setStage('confirm');
      return;
    }
    setStage('tags');
  }

  function toggleTag(category: DreamTagCategory, optionId: string, max: number) {
    setSelectedTags((previous) => {
      const current = previous[category];
      const exists = current.includes(optionId);
      if (exists) return { ...previous, [category]: current.filter((value) => value !== optionId) };
      const next = max === 1 ? [optionId] : [...current, optionId].slice(-max);
      return { ...previous, [category]: next };
    });
    if (category === 'world') setSelectedDomain(optionId as DreamDomainId);
  }

  function continueFromReaction() {
    if (actIndex >= scenario.acts.length - 1) {
      setStage('ending');
      return;
    }
    setActIndex((previous) => previous + 1);
    setSelectedChoiceId(null);
    setTypedReaction('');
    setStage('scene');
  }

  function restartDream() {
    setStage('home');
    setActIndex(0);
    setSelectedChoiceId(null);
    setTypedReaction('');
  }

  return (
    <AnimatePresence mode="wait">
      <Shell stage={stage}>
        {stage === 'splash' && <SplashScreen />}
        {stage === 'home' && <HomeScreen selectedRole={selectedRole} availableLine={scenario.availableLine} expireLine={scenario.expireLine} onChooseRole={() => setStage('role-picker')} onOpen={() => setStage('entry')} />}
        {stage === 'role-picker' && <RolePicker roles={dreamRoles} selectedRoleId={selectedRoleId} onSelect={(roleId) => { setSelectedRoleId(roleId); setStage('home'); }} onClose={() => setStage('home')} />}
        {stage === 'entry' && <EntryScreen onChoose={chooseEntryMode} onClose={() => setStage('home')} />}
        {stage === 'tags' && <TagsScreen selectedTags={selectedTags} detailExpanded={detailExpanded} onToggleDetail={() => setDetailExpanded((previous) => !previous)} onToggleTag={toggleTag} onBack={() => setStage('entry')} onConfirm={() => setStage('confirm')} />}
        {stage === 'confirm' && <DreamConfirmScreen domainName={resolveDomainName(selectedDomain)} dreamDepth={dreamDepth} heroGlyph={selectedRole?.glyph ?? scenario.heroGlyph} heroAvatar={selectedRole?.avatar ?? ''} heroName={selectedRole?.name ?? scenario.heroName} heroStatus={selectedRole?.status ?? scenario.heroStatus} entryMode={entryMode} tags={confirmTags} onBack={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')} onStart={() => setStage('loading')} />}
        {stage === 'loading' && <LoadingScreen />}
        {stage === 'scene' && <SceneScreen act={currentAct} progressLabel={`${actIndex + 1} / ${scenario.acts.length}`} onContinue={() => setStage('choices')} />}
        {stage === 'choices' && <ChoicesScreen act={currentAct} onPick={(choiceId) => { setSelectedChoiceId(choiceId); setStage('reaction'); }} />}
        {stage === 'reaction' && selectedChoice && <ReactionScreen choiceTitle={selectedChoice.title} reaction={typedReaction} reactionDone={typedReaction.length === selectedChoice.reaction.length} emotion={selectedChoice.emotion} onContinue={continueFromReaction} isLast={actIndex >= scenario.acts.length - 1} />}
        {stage === 'ending' && <EndingScreen title={scenario.ending.title} excerpt={scenario.ending.excerpt} signature={selectedRole?.name ?? scenario.ending.signature} chapter={scenario.ending.chapter} onAftermath={() => setStage('aftermath')} />}
        {stage === 'aftermath' && <AftermathScreen heroGlyph={selectedRole?.glyph ?? scenario.heroGlyph} heroName={selectedRole?.name ?? scenario.heroName} summary={scenario.aftermath.summary} detail={scenario.aftermath.detail} previewMessages={scenario.aftermath.previewMessages} onBackHome={restartDream} />}
      </Shell>
    </AnimatePresence>
  );
}

export default DreamAppPage;
