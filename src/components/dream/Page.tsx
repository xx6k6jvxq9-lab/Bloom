import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Coffee, Heart, Moon, ScanEye, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { defaultTagSelection, dreamTagGroups, resolveDomainName, resolveScenario } from './dreamContent';
import type { DreamAct, DreamDepth, DreamDomain, DreamDomainId, DreamEntryMode, DreamTagCategory } from './types';

type DreamStage =
  | 'splash'
  | 'home'
  | 'entry'
  | 'tags'
  | 'confirm'
  | 'loading'
  | 'scene'
  | 'choices'
  | 'reaction'
  | 'ending'
  | 'aftermath';

const decorativeStars = Array.from({ length: 26 }, (_, index) => ({
  id: index,
  top: `${8 + (index * 17) % 86}%`,
  left: `${5 + (index * 13) % 90}%`,
  size: 1 + (index % 3),
  opacity: 0.16 + (index % 5) * 0.08,
  duration: 3.8 + (index % 6) * 0.7,
}));

const iconMap: Record<DreamDomain['icon'], typeof Sparkles> = {
  sparkles: Sparkles,
  scan: ScanEye,
  heart: Heart,
  coffee: Coffee,
};

const reactionTypingDelay = 16;

function AppFrame({
  children,
  stage,
  onBack,
  onRestart,
}: {
  children: React.ReactNode;
  stage: DreamStage;
  onBack: () => void;
  onRestart: () => void;
}) {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-[#030509] text-[#ede6d6]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(196,169,106,0.18),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(123,168,196,0.16),transparent_26%),linear-gradient(180deg,#05080e_0%,#070c16_38%,#04070f_100%)]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(196,169,106,0.05)_1px,transparent_1px)] [background-size:100%_32px]" />
      <div className="absolute inset-0">
        {decorativeStars.map((star) => (
          <span
            key={star.id}
            className="absolute rounded-full bg-[#c4a96a]"
            style={{
              top: star.top,
              left: star.left,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animation: `dream-star ${star.duration}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes dream-star {
          from { transform: translateY(0px); opacity: .16; }
          to { transform: translateY(-8px); opacity: .56; }
        }
      `}</style>

      {stage === 'splash' ? (
        children
      ) : (
        <div className="absolute inset-0 flex flex-col">
          <div
            className="relative z-10 flex items-center justify-between px-7 pb-4"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
          >
            <button
              onClick={stage === 'home' ? onBack : onRestart}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(196,169,106,0.18)] bg-[rgba(13,18,32,0.62)] text-[#ede6d6] transition hover:border-[rgba(196,169,106,0.3)] hover:text-[#c4a96a]"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <div className="text-[10px] tracking-[0.42em] text-[#647899]">DREAM APP</div>
              <div className="mt-1 text-[28px] font-light tracking-[0.16em] text-[#ede6d6]">梦境</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(196,169,106,0.12)] bg-[rgba(13,18,32,0.48)] text-[#c4a96a]">
              <Moon size={18} />
            </div>
          </div>

          <div
            className="relative z-10 flex-1 overflow-hidden px-5"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)' }}
          >
            {children}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SplashScreen() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-[94px] font-light tracking-[0.08em] text-[#ede6d6]">梦</div>
      <div className="my-5 h-10 w-px bg-[rgba(196,169,106,0.28)]" />
      <div className="text-[11px] tracking-[0.6em] text-[#647899]">局 梦 夜</div>
    </motion.div>
  );
}

function HomeScreen({ availableLine, expireLine, heroGlyph, heroName, heroStatus, onOpen }: {
  availableLine: string;
  expireLine: string;
  heroGlyph: string;
  heroName: string;
  heroStatus: string;
  onOpen: () => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-[32px] border border-[rgba(196,169,106,0.12)] bg-[rgba(5,8,14,0.7)] px-7 pb-7 pt-6 shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
      <div className="flex items-center justify-between text-[12px] tracking-[0.16em] text-[#647899]">
        <span>23:14</span>
        <span className="h-1.5 w-1.5 rounded-full bg-[#c4a96a]" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-7 flex h-[92px] w-[92px] items-center justify-center rounded-full border border-[rgba(196,169,106,0.22)] bg-[radial-gradient(circle_at_40%_35%,rgba(196,169,106,0.32),rgba(123,168,196,0.16)_58%,transparent_74%)] text-[32px] font-light">
          {heroGlyph}
          <div className="absolute inset-[-14px] rounded-full border border-[rgba(196,169,106,0.12)]" />
          <div className="absolute inset-[-26px] rounded-full border border-[rgba(196,169,106,0.05)]" />
        </div>
        <div className="text-[22px] font-light tracking-[0.24em]">{heroName}</div>
        <div className="mt-2 text-[12px] tracking-[0.18em] text-[#647899]">{heroStatus}</div>
        <div className="relative mt-10 w-full max-w-[290px] border border-[rgba(196,169,106,0.14)] bg-[rgba(196,169,106,0.04)] px-6 py-5">
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#05080e] px-3 text-[10px] tracking-[0.3em] text-[#c4a96a]">今夜</div>
          <div className="text-[15px] font-light tracking-[0.1em] text-[#ede6d6]">{availableLine}</div>
          <div className="mt-2 text-[11px] tracking-[0.12em] text-[#647899]">{expireLine}</div>
        </div>
        <button
          onClick={onOpen}
          className="mt-10 w-full max-w-[290px] border border-[rgba(196,169,106,0.24)] bg-transparent px-5 py-4 text-[13px] tracking-[0.42em] text-[#c4a96a] transition hover:bg-[rgba(196,169,106,0.08)] hover:tracking-[0.5em]"
        >
          进入梦境
        </button>
      </div>
      <div className="flex items-center justify-around border-t border-[rgba(196,169,106,0.12)] pt-4 text-[11px] tracking-[0.28em] text-[#647899]">
        <div className="flex flex-col items-center gap-2 text-[#c4a96a]"><span>今夜</span><span className="h-1 w-1 rounded-full bg-[#c4a96a]" /></div>
        <div className="flex flex-col items-center gap-2"><span>残响</span><span className="h-1 w-1 rounded-full bg-current opacity-40" /></div>
        <div className="flex flex-col items-center gap-2"><span>深层</span><span className="h-1 w-1 rounded-full bg-current opacity-40" /></div>
      </div>
    </div>
  );
}

function EntryScreen({ onChoose, onClose }: { onChoose: (mode: DreamEntryMode) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 flex items-end">
      <button className="absolute inset-0 bg-[rgba(3,5,9,0.64)]" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full rounded-t-[30px] border-t border-[rgba(196,169,106,0.12)] bg-[#080c18] pb-10 pt-4"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-[#283348]" />
        <div className="mt-7 text-center text-[12px] tracking-[0.38em] text-[#647899]">选择入梦方式</div>
        <div className="mt-5">
          {[
            { mode: 'quick' as DreamEntryMode, icon: '◌', title: '一键入梦', description: '直接沉入，让梦替你决定今晚先看见什么。' },
            { mode: 'custom' as DreamEntryMode, icon: '◐', title: '自定义梦局', description: '你先挑梦域、张力和语气，再把自己放进去。' },
            { mode: 'character' as DreamEntryMode, icon: '✶', title: '角色入梦', description: '更深地贴近角色内里，从他没说完的那层开始。' },
          ].map((item) => (
            <button
              key={item.mode}
              onClick={() => onChoose(item.mode)}
              className="flex w-full items-center gap-5 border-b border-[rgba(196,169,106,0.1)] px-8 py-5 text-left transition hover:bg-[rgba(196,169,106,0.04)]"
            >
              <div className="flex h-10 w-10 items-center justify-center border border-[rgba(196,169,106,0.16)] text-[#c4a96a]">
                {item.icon}
              </div>
              <div>
                <div className="text-[16px] tracking-[0.12em] text-[#ede6d6]">{item.title}</div>
                <div className="mt-1 text-[12px] leading-6 text-[#647899]">{item.description}</div>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function TagsScreen({
  detailExpanded,
  onToggleDetail,
  selectedTags,
  selectedTagCount,
  onToggleTag,
  onBack,
  onConfirm,
}: {
  detailExpanded: boolean;
  onToggleDetail: () => void;
  selectedTags: Record<DreamTagCategory, string[]>;
  selectedTagCount: number;
  onToggleTag: (category: DreamTagCategory, optionId: string, max: number) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[32px] border border-[rgba(196,169,106,0.12)] bg-[rgba(5,8,14,0.76)]">
      <div className="flex items-center gap-4 border-b border-[rgba(196,169,106,0.1)] px-6 py-4">
        <button onClick={onBack} className="text-lg text-[#647899] transition hover:text-[#c4a96a]">←</button>
        <div className="text-[13px] tracking-[0.32em] text-[#ede6d6]">自定义梦局</div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-5 pt-3">
        {dreamTagGroups.filter((group) => !group.detailed).map((group) => (
          <section key={group.category} className="mt-5">
            <div className="mb-3 flex items-center gap-3 text-[10px] tracking-[0.36em] text-[#647899]">
              <span>{group.label}</span>
              <span className="h-px flex-1 bg-[rgba(196,169,106,0.12)]" />
            </div>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => {
                const selected = selectedTags[group.category].includes(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => onToggleTag(group.category, option.id, group.max)}
                    className={`border px-4 py-2 text-[13px] tracking-[0.08em] transition ${
                      selected
                        ? 'border-[rgba(196,169,106,0.46)] bg-[rgba(196,169,106,0.14)] text-[#c4a96a]'
                        : 'border-[rgba(196,169,106,0.12)] text-[#647899] hover:border-[rgba(196,169,106,0.24)] hover:text-[#ede6d6]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <button
          onClick={onToggleDetail}
          className="mt-6 flex w-full items-center gap-3 border-t border-[rgba(196,169,106,0.1)] pt-4 text-[12px] tracking-[0.28em] text-[#647899]"
        >
          <span>细化标签</span>
          <span className={`transition ${detailExpanded ? 'rotate-180' : ''}`}>⌄</span>
        </button>

        {detailExpanded && (
          <div className="pb-6">
            {dreamTagGroups.filter((group) => group.detailed).map((group) => (
              <section key={group.category} className="mt-5">
                <div className="mb-3 flex items-center gap-3 text-[10px] tracking-[0.36em] text-[#647899]">
                  <span>{group.label}</span>
                  <span className="h-px flex-1 bg-[rgba(196,169,106,0.12)]" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const selected = selectedTags[group.category].includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => onToggleTag(group.category, option.id, group.max)}
                        className={`border px-4 py-2 text-[13px] tracking-[0.08em] transition ${
                          selected
                            ? 'border-[rgba(196,169,106,0.46)] bg-[rgba(196,169,106,0.14)] text-[#c4a96a]'
                            : 'border-[rgba(196,169,106,0.12)] text-[#647899] hover:border-[rgba(196,169,106,0.24)] hover:text-[#ede6d6]'
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
        )}
      </div>
      <div className="flex items-center gap-4 border-t border-[rgba(196,169,106,0.1)] px-6 py-4">
        <div className="whitespace-nowrap text-[11px] tracking-[0.18em] text-[#647899]">已选 {selectedTagCount} 项</div>
        <button
          onClick={onConfirm}
          className="flex-1 border border-[rgba(196,169,106,0.24)] px-4 py-3 text-[13px] tracking-[0.34em] text-[#c4a96a] transition hover:bg-[rgba(196,169,106,0.08)]"
        >
          开始造梦
        </button>
      </div>
    </div>
  );
}

function ConfirmScreen({
  domainName,
  dreamDepth,
  heroGlyph,
  heroName,
  confirmHint,
  tags,
  onBack,
  onStart,
}: {
  domainName: string;
  dreamDepth: DreamDepth;
  heroGlyph: string;
  heroName: string;
  confirmHint: string;
  tags: string[];
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-[32px] border border-[rgba(196,169,106,0.12)] bg-[rgba(5,8,14,0.82)] px-8 text-center">
      <div className="text-[10px] tracking-[0.38em] text-[#647899]">
        {domainName} · {dreamDepth === 'shallow' ? '浅梦' : '深梦'}
      </div>
      <div className="relative mt-8 flex h-20 w-20 items-center justify-center border border-[rgba(196,169,106,0.16)]">
        <span className="text-[26px] font-light tracking-[0.16em] text-[#c4a96a]">{heroGlyph}</span>
        <div className="absolute inset-y-0 -left-4 w-px bg-[rgba(196,169,106,0.16)]" />
        <div className="absolute inset-y-0 -right-4 w-px bg-[rgba(196,169,106,0.16)]" />
      </div>
      <div className="mt-7 text-[24px] font-light tracking-[0.24em]">{heroName}</div>
      <div className="mt-2 text-[12px] tracking-[0.16em] text-[#647899]">{confirmHint}</div>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {tags.map((tag) => (
          <span key={tag} className="border border-[rgba(196,169,106,0.14)] px-3 py-1 text-[11px] tracking-[0.12em] text-[#c4a96a]">
            {tag}
          </span>
        ))}
      </div>
      <button
        onClick={onStart}
        className="relative mt-10 w-full border border-[rgba(196,169,106,0.42)] px-5 py-4 text-[14px] tracking-[0.5em] text-[#c4a96a] transition hover:bg-[rgba(196,169,106,0.08)]"
      >
        确认入梦
      </button>
      <button onClick={onBack} className="mt-5 text-[11px] tracking-[0.24em] text-[#647899] transition hover:text-[#c4a96a]">
        返回修改
      </button>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-[32px] border border-[rgba(196,169,106,0.08)] bg-[rgba(3,5,9,0.9)]">
      <div className="h-14 w-14 rounded-full border border-[rgba(196,169,106,0.22)] bg-[radial-gradient(circle_at_40%_38%,rgba(196,169,106,0.42),transparent_66%)]" />
      <div className="mt-10 text-[12px] tracking-[0.42em] text-[#647899]">正在进入梦境</div>
      <div className="mt-5 h-px w-20 overflow-hidden bg-[rgba(196,169,106,0.12)]">
        <div className="h-full w-full animate-pulse bg-[#c4a96a]" />
      </div>
    </div>
  );
}

function SceneScreen({ act, progressLabel, onContinue }: { act: DreamAct; progressLabel: string; onContinue: () => void }) {
  return (
    <div className="flex h-full flex-col rounded-[32px] border border-[rgba(196,169,106,0.12)] bg-[rgba(5,8,14,0.78)] px-8 py-8">
      <div className="flex items-start justify-between">
        <div className="text-[10px] tracking-[0.34em] text-[#647899]">{act.label}</div>
        <div className="text-[10px] tracking-[0.2em] text-[#647899]">{progressLabel}</div>
      </div>
      <div className="mt-8 text-[16px] font-light leading-[2.1] text-[#ede6d6]">{act.scene}</div>
      <div className="mt-8 text-[12px] leading-7 tracking-[0.08em] text-[#c4a96a]">{act.charState}</div>
      <button onClick={onContinue} className="mt-auto self-center pt-10 text-[11px] tracking-[0.34em] text-[#647899] transition hover:text-[#c4a96a]">
        你想做什么
      </button>
    </div>
  );
}

function ChoicesScreen({ act, onPick }: { act: DreamAct; onPick: (choiceId: string) => void }) {
  return (
    <div className="flex h-full flex-col rounded-[32px] border border-[rgba(196,169,106,0.12)] bg-[rgba(5,8,14,0.78)] px-6 py-8">
      <div className="text-center">
        <div className="inline-flex border border-[rgba(196,169,106,0.12)] px-4 py-1 text-[10px] tracking-[0.2em] text-[#647899]">{act.label}</div>
        <div className="mt-4 text-[15px] font-light tracking-[0.14em] text-[#ede6d6]">在这场梦里，你选择</div>
      </div>
      <div className="mt-8 flex flex-1 flex-col gap-3">
        {act.choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => onPick(choice.id)}
            className="flex items-center gap-5 border border-[rgba(196,169,106,0.12)] bg-[rgba(8,12,26,0.58)] px-5 py-5 text-left transition hover:border-[rgba(196,169,106,0.34)] hover:bg-[rgba(196,169,106,0.04)] hover:translate-x-1"
          >
            <div className="w-7 text-center text-lg text-[#c4a96a]">{choice.icon}</div>
            <div>
              <div className="text-[15px] tracking-[0.08em] text-[#ede6d6]">{choice.title}</div>
              <div className="mt-1 text-[12px] leading-6 text-[#647899]">{choice.detail}</div>
            </div>
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
    <div className="flex h-full flex-col rounded-[32px] border border-[rgba(196,169,106,0.12)] bg-[rgba(5,8,14,0.8)] px-8 py-8">
      <div className="text-[10px] tracking-[0.34em] text-[#647899]">
        你的选择 <span className="ml-2 text-[#c4a96a]">{choiceTitle}</span>
      </div>
      <div className="mt-8 min-h-[220px] text-[16px] font-light leading-[2.2] text-[#ede6d6]">
        {reaction}
        {!reactionDone && <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-[#c4a96a]" />}
      </div>
      <div className={`mt-6 inline-flex w-fit items-center gap-2 border px-4 py-2 text-[11px] tracking-[0.12em] transition ${reactionDone ? 'border-[rgba(123,168,196,0.3)] bg-[rgba(123,168,196,0.08)] text-[#7ba8c4]' : 'border-transparent text-transparent'}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-[#7ba8c4]" />
        {emotion}
      </div>
      <button
        onClick={onContinue}
        disabled={!reactionDone}
        className={`mt-auto self-end border px-5 py-3 text-[11px] tracking-[0.28em] transition ${
          reactionDone
            ? 'border-[rgba(196,169,106,0.18)] text-[#647899] hover:border-[rgba(196,169,106,0.34)] hover:text-[#c4a96a]'
            : 'border-[rgba(196,169,106,0.06)] text-[#39475f]'
        }`}
      >
        {isLast ? '醒来之前' : '继续下沉'}
      </button>
    </div>
  );
}

function EndingScreen({
  title,
  excerpt,
  signature,
  chapter,
  onAftermath,
}: {
  title: string;
  excerpt: string;
  signature: string;
  chapter: string;
  onAftermath: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-between rounded-[32px] border border-[rgba(196,169,106,0.12)] bg-[rgba(3,5,9,0.84)] px-8 py-8">
      <div className="text-center">
        <div className="text-[9px] tracking-[0.6em] text-[#647899]">结 局</div>
        <div className="mt-10 text-[44px] font-light tracking-[0.18em] text-[#ede6d6]">{title}</div>
        <div className="mx-auto mt-6 flex w-fit items-center gap-3 text-[10px] tracking-[0.2em] text-[#c4a96a]">
          <span className="h-px w-9 bg-[rgba(196,169,106,0.2)]" />
          <span>梦尾摘录</span>
          <span className="h-px w-9 bg-[rgba(196,169,106,0.2)]" />
        </div>
      </div>
      <div className="text-[15px] font-light leading-[2.3] text-[rgba(237,230,214,0.72)]">{excerpt}</div>
      <div>
        <div className="text-right text-[13px] tracking-[0.22em] text-[rgba(237,230,214,0.44)]">—— {signature}</div>
        <div className="mt-2 text-right text-[12px] tracking-[0.14em] text-[#c4a96a]">{chapter}</div>
        <div className="mt-8 flex flex-col gap-3">
          <button className="border border-[rgba(196,169,106,0.22)] px-4 py-3 text-[12px] tracking-[0.34em] text-[#c4a96a] transition hover:bg-[rgba(196,169,106,0.08)]">
            截图分享这一页
          </button>
          <button
            onClick={onAftermath}
            className="border border-[rgba(196,169,106,0.12)] px-4 py-3 text-[12px] tracking-[0.28em] text-[#647899] transition hover:border-[rgba(123,168,196,0.24)] hover:text-[#7ba8c4]"
          >
            查看梦后余响
          </button>
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
    <div className="flex h-full flex-col rounded-[32px] border border-[rgba(196,169,106,0.12)] bg-[rgba(5,8,14,0.84)] px-6 py-6">
      <div className="border-b border-[rgba(196,169,106,0.1)] pb-4 text-[10px] tracking-[0.42em] text-[#647899]">梦后余响</div>
      <div className="mt-7 text-[10px] tracking-[0.42em] text-[#c4a96a]">明天会发生什么</div>
      <div className="mt-5 border border-[rgba(196,169,106,0.12)] bg-[rgba(13,18,32,0.5)]">
        <div className="flex items-center gap-3 border-b border-[rgba(196,169,106,0.1)] px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(196,169,106,0.2)] bg-[radial-gradient(circle_at_40%_35%,rgba(196,169,106,0.26),transparent_70%)] text-[12px]">
            {heroGlyph}
          </div>
          <div>
            <div className="text-[13px] tracking-[0.12em] text-[#ede6d6]">{heroName}</div>
            <div className="text-[11px] tracking-[0.08em] text-[#647899]">刚刚在线</div>
          </div>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="flex gap-2">
            <div className="max-w-[220px] border border-[rgba(196,169,106,0.14)] bg-[rgba(196,169,106,0.08)] px-3 py-2 text-[13px] leading-6 text-[rgba(237,230,214,0.72)]">
              {previewMessages[0]}
            </div>
            <div className="self-end pb-1 text-[10px] text-[#283348]">08:43</div>
          </div>
          <div className="flex flex-row-reverse gap-2">
            <div className="max-w-[220px] border border-[rgba(196,169,106,0.1)] bg-[rgba(8,12,26,0.65)] px-3 py-2 text-[13px] leading-6 text-[rgba(237,230,214,0.72)]">
              在，怎么了
            </div>
            <div className="self-end pb-1 text-[10px] text-[#283348]">08:44</div>
          </div>
          <div className="flex gap-2">
            <div className="max-w-[220px] border border-[rgba(196,169,106,0.14)] bg-[rgba(196,169,106,0.08)] px-3 py-2 text-[13px] leading-6 text-[rgba(237,230,214,0.72)]">
              {previewMessages[1]}
            </div>
            <div className="self-end pb-1 text-[10px] text-[#283348]">08:44</div>
          </div>
        </div>
      </div>
      <div className="relative mt-6 border border-[rgba(196,169,106,0.12)] px-5 py-5">
        <div className="absolute -top-2.5 left-4 bg-[#05080e] px-2 text-[9px] tracking-[0.3em] text-[#c4a96a]">余响</div>
        <div className="text-[14px] font-light leading-[2.2] text-[rgba(237,230,214,0.72)]">{summary}</div>
        <div className="mt-3 flex items-center gap-2 text-[11px] tracking-[0.08em] text-[#7ba8c4]">
          <span className="h-1 w-1 rounded-full bg-[#7ba8c4]" />
          {detail}
        </div>
      </div>
      <button
        onClick={onBackHome}
        className="mt-auto border border-[rgba(196,169,106,0.22)] px-4 py-4 text-[12px] tracking-[0.34em] text-[#c4a96a] transition hover:bg-[rgba(196,169,106,0.08)]"
      >
        回到今夜
      </button>
    </div>
  );
}

export function DreamAppPage({ onBack }: { onBack: () => void }) {
  const [stage, setStage] = useState<DreamStage>('splash');
  const [entryMode, setEntryMode] = useState<DreamEntryMode>('custom');
  const [selectedDomain, setSelectedDomain] = useState<DreamDomainId>('shared');
  const [dreamDepth, setDreamDepth] = useState<DreamDepth>('shallow');
  const [selectedTags, setSelectedTags] = useState(defaultTagSelection);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [actIndex, setActIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [typedReaction, setTypedReaction] = useState('');
  const loadingTimerRef = useRef<number | null>(null);
  const splashTimerRef = useRef<number | null>(null);

  const scenario = useMemo(() => resolveScenario(selectedDomain, dreamDepth), [dreamDepth, selectedDomain]);
  const currentAct: DreamAct = scenario.acts[Math.min(actIndex, scenario.acts.length - 1)];
  const selectedChoice = currentAct.choices.find((choice) => choice.id === selectedChoiceId) ?? null;

  useEffect(() => {
    splashTimerRef.current = window.setTimeout(() => setStage('home'), 2400);
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
    }, 1700);
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
    }, reactionTypingDelay);
    return () => window.clearInterval(timer);
  }, [selectedChoice, stage]);

  const selectedTagCount = useMemo(() => Object.values(selectedTags).reduce((sum, values) => sum + values.length, 0), [selectedTags]);
  const confirmTags = useMemo(() => dreamTagGroups.flatMap((group) => selectedTags[group.category].map((valueId) => group.options.find((option) => option.id === valueId)?.label ?? valueId)), [selectedTags]);
  const progressLabel = `${actIndex + 1} / ${scenario.acts.length}`;

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

  function startDream() {
    setStage('loading');
  }

  function pickChoice(choiceId: string) {
    setSelectedChoiceId(choiceId);
    setStage('reaction');
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
      <AppFrame stage={stage} onBack={onBack} onRestart={restartDream}>
        {stage === 'splash' && <SplashScreen />}
        {stage === 'home' && (
          <HomeScreen
            availableLine={scenario.availableLine}
            expireLine={scenario.expireLine}
            heroGlyph={scenario.heroGlyph}
            heroName={scenario.heroName}
            heroStatus={scenario.heroStatus}
            onOpen={() => setStage('entry')}
          />
        )}
        {stage === 'entry' && <EntryScreen onChoose={chooseEntryMode} onClose={() => setStage('home')} />}
        {stage === 'tags' && (
          <TagsScreen
            detailExpanded={detailExpanded}
            onToggleDetail={() => setDetailExpanded((previous) => !previous)}
            selectedTags={selectedTags}
            selectedTagCount={selectedTagCount}
            onToggleTag={toggleTag}
            onBack={() => setStage('entry')}
            onConfirm={() => setStage('confirm')}
          />
        )}
        {stage === 'confirm' && (
          <ConfirmScreen
            domainName={resolveDomainName(selectedDomain)}
            dreamDepth={dreamDepth}
            heroGlyph={scenario.heroGlyph}
            heroName={scenario.heroName}
            confirmHint={scenario.confirmHint}
            tags={confirmTags}
            onBack={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')}
            onStart={startDream}
          />
        )}
        {stage === 'loading' && <LoadingScreen />}
        {stage === 'scene' && <SceneScreen act={currentAct} progressLabel={progressLabel} onContinue={() => setStage('choices')} />}
        {stage === 'choices' && <ChoicesScreen act={currentAct} onPick={pickChoice} />}
        {stage === 'reaction' && selectedChoice && (
          <ReactionScreen
            choiceTitle={selectedChoice.title}
            reaction={typedReaction}
            reactionDone={typedReaction.length === selectedChoice.reaction.length}
            emotion={selectedChoice.emotion}
            onContinue={continueFromReaction}
            isLast={actIndex >= scenario.acts.length - 1}
          />
        )}
        {stage === 'ending' && (
          <EndingScreen
            title={scenario.ending.title}
            excerpt={scenario.ending.excerpt}
            signature={scenario.ending.signature}
            chapter={scenario.ending.chapter}
            onAftermath={() => setStage('aftermath')}
          />
        )}
        {stage === 'aftermath' && (
          <AftermathScreen
            heroGlyph={scenario.heroGlyph}
            heroName={scenario.heroName}
            summary={scenario.aftermath.summary}
            detail={scenario.aftermath.detail}
            previewMessages={scenario.aftermath.previewMessages}
            onBackHome={restartDream}
          />
        )}
      </AppFrame>
    </AnimatePresence>
  );
}

export default DreamAppPage;
