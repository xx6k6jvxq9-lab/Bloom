import { motion } from 'motion/react';
import { type CSSProperties } from 'react';

import type { DreamGenerationMode } from '../../services/dream/dreamRuntimeTypes';

type DreamGenerationModeOption = {
  id: DreamGenerationMode;
  title: string;
  detail: string;
  summary: string;
};

const dreamModeToneStyle = {
  '--gold': '#E7C983',
  '--gold-bright': '#F3DEAC',
  '--paper': '#F3DEAC',
  '--paper-60': 'rgba(243,222,172,.86)',
  '--mist': 'rgba(231,201,131,.82)',
  '--jade': '#E7C983',
  '--border': 'rgba(231,201,131,.38)',
} as CSSProperties;

const dreamGenerationModeOptions: DreamGenerationModeOption[] = [
  {
    id: 'light',
    title: '轻入梦',
    detail: '较快进入今夜，先让梦落下来。',
    summary: '一次生成，速度更快。',
  },
  {
    id: 'woven',
    title: '织成篇',
    detail: '再织一层，成篇更稳。',
    summary: '两次整理，更稳成篇。',
  },
];

function findModeOption(mode: DreamGenerationMode | null | undefined) {
  return dreamGenerationModeOptions.find((option) => option.id === mode) || null;
}

export function resolveDreamGenerationModeLabel(mode: DreamGenerationMode | null | undefined) {
  return findModeOption(mode)?.title || '未设置';
}

export function DreamGenerationModeCards({
  selectedMode,
  onSelect,
}: {
  selectedMode: DreamGenerationMode | null;
  onSelect: (mode: DreamGenerationMode) => void;
}) {
  return (
    <div className="grid gap-4">
      {dreamGenerationModeOptions.map((option) => {
        const active = selectedMode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className="group relative overflow-hidden border px-5 py-4 text-left transition duration-500 active:scale-[0.99]"
            style={{
              borderColor: active ? 'rgba(231,201,131,.72)' : 'rgba(231,201,131,.34)',
              backgroundColor: active ? 'rgba(231,201,131,.16)' : 'rgba(18,14,8,.62)',
              color: 'var(--gold)',
              boxShadow: active ? '0 0 24px rgba(231,201,131,.14)' : '0 0 18px rgba(231,201,131,.04)',
            }}
          >
            <span
              className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition duration-500 group-hover:scale-x-100 group-active:scale-x-100"
              style={{ backgroundColor: 'rgba(231,201,131,.1)' }}
            />
            <span className="pointer-events-none absolute inset-[3px] border" style={{ borderColor: active ? 'rgba(231,201,131,.58)' : 'rgba(231,201,131,.24)' }} />
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <div className="text-[15px] font-[400] tracking-[0.26em] text-[var(--gold)]">{option.title}</div>
                <span
                  className="inline-flex h-5 min-w-5 items-center justify-center border px-2 text-[9px] tracking-[0.22em] text-[var(--gold)]"
                  style={{
                    borderColor: active ? 'rgba(231,201,131,.56)' : 'rgba(231,201,131,.32)',
                    backgroundColor: active ? 'rgba(231,201,131,.18)' : 'transparent',
                  }}
                >
                  {active ? '已选' : '可选'}
                </span>
              </div>
              <div className="mt-2 text-[12px] leading-[1.9] tracking-[0.12em] text-[var(--gold)] opacity-90">{option.detail}</div>
              <div className="mt-3 text-[10px] leading-[1.8] tracking-[0.18em] text-[var(--gold)] opacity-70">{option.summary}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function DreamGenerationModeRememberToggle({
  checked,
  onToggle,
  hasStoredDefault,
}: {
  checked: boolean;
  onToggle: () => void;
  hasStoredDefault: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-4 flex items-center gap-3 text-left text-[11px] tracking-[0.18em] text-[var(--gold)]"
    >
      <span
        className="flex h-5 w-5 items-center justify-center border text-[11px]"
        style={{
          borderColor: checked ? 'rgba(231,201,131,.56)' : 'rgba(231,201,131,.32)',
          backgroundColor: checked ? 'rgba(231,201,131,.18)' : 'transparent',
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <span>{hasStoredDefault ? '更新默认模式' : '设为默认模式'}</span>
    </button>
  );
}

export function DreamGenerationModeSection({
  selectedMode,
  rememberAsDefault,
  hasStoredDefault,
  onSelectMode,
  onToggleRememberAsDefault,
}: {
  selectedMode: DreamGenerationMode | null;
  rememberAsDefault: boolean;
  hasStoredDefault: boolean;
  onSelectMode: (mode: DreamGenerationMode) => void;
  onToggleRememberAsDefault: () => void;
}) {
  return (
    <div className="border px-4 py-4" style={{ borderColor: 'rgba(231,201,131,.28)', backgroundColor: 'rgba(18,14,8,.68)' }}>
      <div className="text-[11px] tracking-[0.28em] text-[var(--gold)]">入梦方式</div>
      <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.12em] text-[var(--gold)] opacity-85">
        先选今夜如何成篇，再让梦落下来。
      </div>
      <div className="mt-4">
        <DreamGenerationModeCards selectedMode={selectedMode} onSelect={onSelectMode} />
      </div>
      <DreamGenerationModeRememberToggle
        checked={rememberAsDefault}
        onToggle={onToggleRememberAsDefault}
        hasStoredDefault={hasStoredDefault}
      />
      {!selectedMode ? (
        <div className="mt-3 text-[11px] leading-[1.8] tracking-[0.12em] text-[var(--gold)] opacity-80">
          先选一种入梦方式，今夜才会开始编织。
        </div>
      ) : null}
    </div>
  );
}

export function DreamGenerationModeTriggerButton({
  mode,
  onClick,
  className = '',
}: {
  mode: DreamGenerationMode | null;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="打开入梦偏好"
      className={`relative flex h-11 min-w-11 items-center justify-center rounded-full border px-3 transition duration-300 hover:scale-[1.02] ${className}`}
      style={{
        borderColor: 'rgba(231,201,131,.42)',
        background: 'radial-gradient(circle, rgba(231,201,131,.18) 0%, rgba(231,201,131,.08) 58%, transparent 100%)',
        boxShadow: mode ? '0 0 22px rgba(231,201,131,.14)' : '0 0 18px rgba(231,201,131,.05)',
        color: 'var(--gold)',
      }}
    >
      <span className="text-[12px] tracking-[0.18em]">{mode ? resolveDreamGenerationModeLabel(mode).slice(0, 1) : '式'}</span>
      {mode ? (
        <span
          className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full"
          style={{
            backgroundColor: 'var(--gold)',
            boxShadow: '0 0 12px rgba(231,201,131,.52)',
          }}
        />
      ) : null}
    </button>
  );
}

export function DreamGenerationModePreferenceSheet({
  selectedDefaultMode,
  onSelectDefaultMode,
  onClearDefaultMode,
  onClose,
}: {
  selectedDefaultMode: DreamGenerationMode | null;
  onSelectDefaultMode: (mode: DreamGenerationMode) => void;
  onClearDefaultMode: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 bg-[rgba(3,5,9,.44)]">
      <button type="button" aria-label="关闭入梦偏好" className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.65, ease: [0.2, 0.8, 0.4, 1] }}
        className="absolute inset-x-0 bottom-0 max-h-[calc(100%-16px)] overflow-y-auto overscroll-contain touch-pan-y border-t border-[var(--border)] bg-[var(--deep)] px-8 pb-[calc(4.25rem+var(--app-safe-area-bottom-ui,0px))] pt-5 [webkit-overflow-scrolling:touch]"
        style={dreamModeToneStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto h-[3px] w-10 rounded-[2px] bg-[var(--gold)] opacity-40" />
        <div className="mt-7 text-center text-[12px] tracking-[0.42em] text-[var(--gold)]">入梦偏好</div>
        <div className="mt-3 text-center text-[11px] leading-[1.9] tracking-[0.16em] text-[var(--gold)] opacity-80">
          未设置默认时，每次入梦前由你亲自挑选。
        </div>
        <div className="mt-7">
          <DreamGenerationModeCards selectedMode={selectedDefaultMode} onSelect={onSelectDefaultMode} />
        </div>
        <div className="mt-6 space-y-3">
          {selectedDefaultMode ? (
            <button
              type="button"
              onClick={onClearDefaultMode}
              className="w-full border px-5 py-4 text-[12px] tracking-[0.24em] text-[var(--gold)] transition duration-500 active:scale-[0.99]"
              style={{
                borderColor: 'rgba(231,201,131,.34)',
                backgroundColor: 'rgba(18,14,8,.62)',
              }}
            >
              清除默认模式
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="w-full text-[11px] tracking-[0.3em] text-[var(--gold)] opacity-80">
            返 回 今 夜
          </button>
        </div>
      </motion.div>
    </div>
  );
}
